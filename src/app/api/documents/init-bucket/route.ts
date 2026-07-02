import { NextRequest, NextResponse } from 'next/server'
import { readFileContent } from '@/lib/storage'

export const dynamic = 'force-dynamic'

// POST /api/documents/init-bucket - Vérifier le stockage local des documents
export async function POST(request: NextRequest) {
  try {
    // Test that we can read from the storage
    const { listFiles } = await import('@/lib/storage')
    const result = await listFiles()

    const storagePath = process.env.DOCUMENTS_STORAGE_PATH || '/data/dalia-documents'

    return NextResponse.json({
      success: true,
      message: `Stockage local opérationnel (${storagePath})`,
      storagePath,
      fileCount: result.blobs.length,
    })
  } catch (error: any) {
    console.error('[INIT_BUCKET_POST]', error)
    const storagePath = process.env.DOCUMENTS_STORAGE_PATH || '/data/dalia-documents'
    return NextResponse.json({
      error: `Erreur stockage: ${error.message}`,
      storagePath,
      action: 'CHECK_STORAGE_PATH',
    }, { status: 500 })
  }
}

// GET - also allow GET for easy browser testing
export async function GET(request: NextRequest) {
  return POST(request)
}
