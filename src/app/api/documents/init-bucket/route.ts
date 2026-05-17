import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, BUCKET_NAME, BRAND_FOLDERS } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST /api/documents/init-bucket - Initialiser le bucket Supabase Storage
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()

    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      console.error('[SUPABASE_LIST_BUCKETS_ERROR]', listError)
      return NextResponse.json(
        { error: `Erreur Supabase: ${listError.message}` },
        { status: 500 }
      )
    }

    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME)

    if (!bucketExists) {
      // Create the bucket as public
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 20 * 1024 * 1024, // 20MB
        allowedMimeTypes: ['application/pdf'],
      })

      if (createError) {
        console.error('[SUPABASE_CREATE_BUCKET_ERROR]', createError)
        return NextResponse.json(
          { error: `Erreur création bucket: ${createError.message}` },
          { status: 500 }
        )
      }
    }

    // Create folder placeholders
    const folders = Object.values(BRAND_FOLDERS)
    const folderResults = []
    for (const folder of folders) {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(`${folder}/.keep`, new Blob([''], { type: 'text/plain' }), {
          upsert: true,
        })
      folderResults.push({ folder, ok: !error, error: error?.message })
    }

    // Test upload
    const { data: testData, error: testError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload('autres/test.pdf', new Blob(['test'], { type: 'application/pdf' }), { upsert: true })

    return NextResponse.json({
      success: true,
      message: bucketExists ? 'Bucket déjà existant' : 'Bucket créé avec succès',
      bucket: BUCKET_NAME,
      folders: folderResults,
      testUpload: testError ? { error: testError.message } : { ok: true, path: testData?.path },
    })
  } catch (error: any) {
    console.error('[INIT_BUCKET_POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET - also allow GET to init bucket (for easy browser testing)
export async function GET(request: NextRequest) {
  return POST(request)
}
