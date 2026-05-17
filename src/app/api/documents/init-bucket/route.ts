import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export const dynamic = 'force-dynamic'

// POST /api/documents/init-bucket - Vérifier la connexion au Blob Storage
export async function POST(request: NextRequest) {
  try {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN

    if (!blobToken) {
      return NextResponse.json({
        error: 'BLOB_READ_WRITE_TOKEN non configuré. Veuillez lier le Blob Store à votre projet Vercel depuis le Dashboard : https://vercel.com/khaled-s-projects10/~/stores/blob/store_hwmkfvhGDuWlTEy1',
        action: 'LINK_BLOB_STORE',
        storeUrl: 'https://vercel.com/khaled-s-projects10/~/stores/blob/store_hwmkfvhGDuWlTEy1',
      }, { status: 500 })
    }

    // Test blob connection
    const result = await list({ limit: 5 })

    return NextResponse.json({
      success: true,
      message: 'Vercel Blob Storage connecté avec succès',
      blobCount: result.blobs.length,
      hasMore: result.hasMore,
    })
  } catch (error: any) {
    console.error('[INIT_BUCKET_POST]', error)
    return NextResponse.json({
      error: `Erreur Blob Storage: ${error.message}`,
      action: 'LINK_BLOB_STORE',
      storeUrl: 'https://vercel.com/khaled-s-projects10/~/stores/blob/store_hwmkfvhGDuWlTEy1',
    }, { status: 500 })
  }
}

// GET - also allow GET for easy browser testing
export async function GET(request: NextRequest) {
  return POST(request)
}
