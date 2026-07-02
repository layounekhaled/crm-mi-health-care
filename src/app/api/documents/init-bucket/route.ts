import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export const dynamic = 'force-dynamic'

// POST /api/documents/init-bucket - Vérifier la connexion au Vercel Blob Storage
export async function POST(request: NextRequest) {
  try {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN

    if (!blobToken || blobToken === 'placeholder_link_blob_store') {
      return NextResponse.json({
        error: 'BLOB_READ_WRITE_TOKEN non configuré ou placeholder.',
        action: 'SET_BLOB_TOKEN',
        instructions: '1. Allez sur https://vercel.com/dashboard → votre projet → Storage → Blob\n2. Copiez le token Read/Write\n3. Ajoutez-le comme variable BLOB_READ_WRITE_TOKEN dans Coolify',
      }, { status: 500 })
    }

    // Test blob connection
    const result = await list({ limit: 5 })

    return NextResponse.json({
      success: true,
      message: 'Vercel Blob Storage connecté avec succès',
      blobCount: result.blobs.length,
      hasMore: result.hasMore,
      sampleUrls: result.blobs.slice(0, 3).map(b => b.url.substring(0, 80) + '...'),
    })
  } catch (error: any) {
    console.error('[INIT_BUCKET_POST]', error)
    return NextResponse.json({
      error: `Erreur Blob Storage: ${error.message}`,
      action: 'CHECK_BLOB_TOKEN',
    }, { status: 500 })
  }
}

// GET - also allow GET for easy browser testing
export async function GET(request: NextRequest) {
  return POST(request)
}
