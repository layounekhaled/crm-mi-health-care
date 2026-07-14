import { NextRequest, NextResponse } from 'next/server'
import { listFiles } from '@/lib/storage'

export const dynamic = 'force-dynamic'

// POST /api/documents/init-bucket - Vérifier la connexion au stockage MinIO S3
export async function POST(request: NextRequest) {
  try {
    const s3AccessKey = process.env.S3_ACCESS_KEY
    const s3SecretKey = process.env.S3_SECRET_KEY
    const s3Endpoint = process.env.S3_ENDPOINT

    if (!s3AccessKey || !s3SecretKey) {
      return NextResponse.json({
        error: 'S3_ACCESS_KEY ou S3_SECRET_KEY non configuré.',
        action: 'SET_S3_CREDENTIALS',
        instructions: '1. Allez dans Coolify → Variables d\'environnement\n2. Ajoutez S3_ACCESS_KEY et S3_SECRET_KEY\n3. Ajoutez S3_ENDPOINT (ex: http://156.67.26.104:9000)',
      }, { status: 500 })
    }

    // Test S3 connection by listing files
    const result = await listFiles(undefined, 'documents')

    return NextResponse.json({
      success: true,
      message: 'MinIO S3 Storage connecté avec succès',
      endpoint: s3Endpoint || 'http://156.67.26.104:9000',
      bucketDocuments: process.env.S3_BUCKET_DOCUMENTS || 'dalia-documents',
      bucketMedia: process.env.S3_BUCKET_MEDIA || 'dalia-media',
      bucketBackups: process.env.S3_BUCKET_BACKUPS || 'dalia-backups',
      fileCount: result.blobs.length,
    })
  } catch (error: any) {
    console.error('[INIT_BUCKET_POST]', error)
    return NextResponse.json({
      error: `Erreur S3 Storage: ${error.message}`,
      action: 'CHECK_S3_CREDENTIALS',
    }, { status: 500 })
  }
}

// GET - also allow GET for easy browser testing
export async function GET(request: NextRequest) {
  return POST(request)
}
