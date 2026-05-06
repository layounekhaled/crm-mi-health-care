import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, canAccess } from '@/lib/auth-helpers'
import { createSupabaseAdmin, BUCKET_NAME, BRAND_FOLDERS } from '@/lib/supabase'

// POST /api/documents/init-bucket - Initialiser le bucket Supabase Storage
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !canAccess(authUser, ['admin'])) {
      return NextResponse.json({ error: 'Accès refusé. Admin uniquement.' }, { status: 403 })
    }

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

    // Create folder placeholders (Supabase creates folders implicitly,
    // but we can create a .keep file in each to ensure they exist)
    const folders = Object.values(BRAND_FOLDERS)
    const uploadPromises = folders.map((folder) =>
      supabase.storage
        .from(BUCKET_NAME)
        .upload(`${folder}/.keep`, new Blob([''], { type: 'text/plain' }), {
          upsert: true,
        })
    )

    await Promise.allSettled(uploadPromises)

    return NextResponse.json({
      success: true,
      message: bucketExists ? 'Bucket déjà existant' : 'Bucket créé avec succès',
      bucket: BUCKET_NAME,
      folders,
    })
  } catch (error) {
    console.error('[INIT_BUCKET_POST]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
