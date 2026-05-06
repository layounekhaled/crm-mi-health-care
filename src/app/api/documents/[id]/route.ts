import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, canAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { createSupabaseAdmin, BUCKET_NAME } from '@/lib/supabase'

// GET /api/documents/[id] - Détail d'un document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const document = await db.document.findUnique({
      where: { id },
      include: {
        uploader: { select: { id: true, nom: true } },
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 })
    }

    // Employees can only see active documents
    if (authUser.role !== 'admin' && document.status !== 'active') {
      return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: document })
  } catch (error) {
    console.error('[DOCUMENT_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/documents/[id] - Modifier un document
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !canAccess(authUser, ['admin'])) {
      return NextResponse.json({ error: 'Accès refusé. Admin uniquement.' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { title, description, brand, productName, documentType, status } = body

    const existing = await db.document.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 })
    }

    // If changing brand, move file in storage
    if (brand && brand !== existing.brand) {
      const supabase = createSupabaseAdmin()
      const BRAND_FOLDERS: Record<string, string> = {
        'MIR': 'mir', 'BOS': 'bos', 'Löwenstein': 'lowenstein',
        'Yuwell': 'yuwell', 'Gelenke': 'gelenke', 'Autres': 'autres',
      }
      const newFolder = BRAND_FOLDERS[brand] || 'autres'
      const fileName = existing.filePath.split('/').pop()!
      const newPath = `${newFolder}/${fileName}`

      // Move file
      const { error: moveError } = await supabase.storage
        .from(BUCKET_NAME)
        .move(existing.filePath, newPath)

      if (!moveError) {
        const { data: urlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(newPath)

        await db.document.update({
          where: { id },
          data: { filePath: newPath, fileUrl: urlData.publicUrl },
        })
      }
    }

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (brand !== undefined) updateData.brand = brand
    if (productName !== undefined) updateData.productName = productName
    if (documentType !== undefined) updateData.documentType = documentType
    if (status !== undefined) updateData.status = status

    const document = await db.document.update({
      where: { id },
      data: updateData,
      include: {
        uploader: { select: { id: true, nom: true } },
      },
    })

    return NextResponse.json({ data: document })
  } catch (error) {
    console.error('[DOCUMENT_PUT]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/documents/[id] - Supprimer un document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !canAccess(authUser, ['admin'])) {
      return NextResponse.json({ error: 'Accès refusé. Admin uniquement.' }, { status: 403 })
    }

    const { id } = await params
    const existing = await db.document.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 })
    }

    // Delete from Supabase Storage
    const supabase = createSupabaseAdmin()
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([existing.filePath])

    if (deleteError) {
      console.error('[SUPABASE_DELETE_ERROR]', deleteError)
    }

    // Delete from database
    await db.document.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DOCUMENT_DELETE]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
