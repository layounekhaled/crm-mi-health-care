import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, canAccess, staleSessionResponse } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { deleteFile } from '@/lib/storage'

export const dynamic = 'force-dynamic'

// GET /api/documents/[id]
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

    return NextResponse.json({ data: document })
  } catch (error) {
    console.error('[DOCUMENT_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/documents/[id] - Update document
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !canAccess(authUser, ['admin'])) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }
    if (!authUser.employeId) return staleSessionResponse()

    const { id } = await params
    const body = await request.json()

    const document = await db.document.update({
      where: { id },
      data: {
        ...(body.title && { title: body.title }),
        ...(body.description !== undefined && { description: body.description || null }),
        ...(body.brand && { brand: body.brand }),
        ...(body.productName !== undefined && { productName: body.productName || null }),
        ...(body.documentType && { documentType: body.documentType }),
        ...(body.status && { status: body.status }),
      },
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

// DELETE /api/documents/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !canAccess(authUser, ['admin'])) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params
    const document = await db.document.findUnique({ where: { id } })

    if (!document) {
      return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 })
    }

    // Delete file from Vercel Blob
    try {
      await deleteFile(document.fileUrl)
    } catch (delError) {
      console.error('[DOCUMENT_DELETE_BLOB]', delError)
      // Continue even if blob deletion fails
    }

    // Delete from database
    await db.document.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DOCUMENT_DELETE]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
