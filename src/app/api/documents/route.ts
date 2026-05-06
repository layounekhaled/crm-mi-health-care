import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, canAccess, staleSessionResponse } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { createSupabaseAdmin, BUCKET_NAME, BRAND_FOLDERS } from '@/lib/supabase'

// GET /api/documents - Liste des documents
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const brand = searchParams.get('brand')
    const documentType = searchParams.get('documentType')
    const search = searchParams.get('search')
    const status = searchParams.get('status') || 'active'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Employees can only see active documents
    const statusFilter = authUser.role !== 'admin' ? 'active' : status

    const where: any = { status: statusFilter }
    if (brand) where.brand = brand
    if (documentType) where.documentType = documentType
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { productName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [documents, total] = await Promise.all([
      db.document.findMany({
        where,
        include: {
          uploader: { select: { id: true, nom: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.document.count({ where }),
    ])

    return NextResponse.json({
      data: documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[DOCUMENTS_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/documents - Upload + créer un document
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !canAccess(authUser, ['admin'])) {
      return NextResponse.json({ error: 'Accès refusé. Admin uniquement.' }, { status: 403 })
    }
    if (!authUser.employeId) return staleSessionResponse()

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string
    const description = formData.get('description') as string | null
    const brand = formData.get('brand') as string
    const productName = formData.get('productName') as string | null
    const documentType = formData.get('documentType') as string

    if (!file || !title || !brand || !documentType) {
      return NextResponse.json(
        { error: 'Fichier, titre, marque et type sont requis' },
        { status: 400 }
      )
    }

    // Validate PDF only
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Seuls les fichiers PDF sont acceptés' },
        { status: 400 }
      )
    }

    // Validate size (20MB max)
    const maxSize = 20 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Le fichier ne doit pas dépasser 20 MB' },
        { status: 400 }
      )
    }

    // Upload to Supabase Storage
    const folder = BRAND_FOLDERS[brand] || 'autres'
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${folder}/${timestamp}_${safeName}`

    const supabase = createSupabaseAdmin()
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('[SUPABASE_UPLOAD_ERROR]', uploadError)
      return NextResponse.json(
        { error: `Erreur upload: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath)

    const fileUrl = urlData.publicUrl

    // Create document record
    const document = await db.document.create({
      data: {
        title,
        description: description || null,
        brand,
        productName: productName || null,
        documentType,
        fileUrl,
        filePath,
        fileName: file.name,
        fileSize: file.size,
        uploadedBy: authUser.employeId,
        status: 'active',
      },
      include: {
        uploader: { select: { id: true, nom: true } },
      },
    })

    return NextResponse.json({ data: document }, { status: 201 })
  } catch (error) {
    console.error('[DOCUMENTS_POST]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
