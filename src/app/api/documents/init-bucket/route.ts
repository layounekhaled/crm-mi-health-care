import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, BUCKET_NAME } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST /api/documents/init-bucket - Vérifier la connexion au Supabase Storage
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()

    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      return NextResponse.json({
        error: `Erreur Supabase Storage: ${listError.message}`,
        action: 'CHECK_SUPABASE_CONFIG',
      }, { status: 500 })
    }

    const bucket = buckets?.find(b => b.name === BUCKET_NAME)

    if (!bucket) {
      // Try to create the bucket
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true, // Files should be publicly accessible via URL
        fileSizeLimit: 20 * 1024 * 1024, // 20MB limit
      })

      if (createError) {
        return NextResponse.json({
          error: `Bucket "${BUCKET_NAME}" n'existe pas et la création a échoué: ${createError.message}`,
          action: 'CREATE_BUCKET_MANUALLY',
          bucketName: BUCKET_NAME,
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Bucket "${BUCKET_NAME}" créé avec succès`,
        action: 'BUCKET_CREATED',
      })
    }

    // Bucket exists — test listing
    const { data: files, error: listFilesError } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', { limit: 5 })

    if (listFilesError) {
      return NextResponse.json({
        error: `Bucket existe mais erreur de listage: ${listFilesError.message}`,
        action: 'CHECK_BUCKET_PERMISSIONS',
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Supabase Storage connecté — Bucket "${BUCKET_NAME}" opérationnel`,
      bucketPublic: bucket.public,
      fileCount: files?.length || 0,
    })
  } catch (error: any) {
    console.error('[INIT_BUCKET_POST]', error)
    return NextResponse.json({
      error: `Erreur Supabase Storage: ${error.message}`,
      action: 'CHECK_SUPABASE_CONFIG',
    }, { status: 500 })
  }
}

// GET - also allow GET for easy browser testing
export async function GET(request: NextRequest) {
  return POST(request)
}
