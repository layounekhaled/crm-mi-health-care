import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Diagnostic endpoint to test Supabase connection and create bucket
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Diagnostic: check env vars
    const diagnostics: Record<string, any> = {
      supabaseUrl: supabaseUrl || 'MISSING',
      serviceKeyPresent: !!supabaseServiceKey,
      serviceKeyPrefix: supabaseServiceKey?.substring(0, 20) + '...',
      serviceKeyLength: supabaseServiceKey?.length || 0,
      anonKeyPresent: !!supabaseAnonKey,
      anonKeyPrefix: supabaseAnonKey?.substring(0, 20) + '...',
      anonKeyLength: supabaseAnonKey?.length || 0,
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        error: 'Variables Supabase manquantes',
        diagnostics,
      }, { status: 500 })
    }

    // Create client directly here for full control
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Test basic connectivity - try to list buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      console.error('[SUPABASE_LIST_BUCKETS_ERROR]', listError)
      return NextResponse.json({
        error: `Erreur Supabase listBuckets: ${listError.message}`,
        diagnostics,
        listErrorDetails: {
          name: listError.name,
          message: listError.message,
          status: (listError as any).status,
        },
      }, { status: 500 })
    }

    const BUCKET_NAME = 'Documents'
    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME)

    diagnostics.bucketsFound = buckets?.map((b: any) => b.name) || []
    diagnostics.bucketExists = bucketExists

    if (!bucketExists) {
      // Create the bucket as public
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 20 * 1024 * 1024,
        allowedMimeTypes: ['application/pdf'],
      })

      if (createError) {
        console.error('[SUPABASE_CREATE_BUCKET_ERROR]', createError)
        return NextResponse.json({
          error: `Erreur création bucket: ${createError.message}`,
          diagnostics,
        }, { status: 500 })
      }

      diagnostics.bucketCreated = true
    }

    // Create folder placeholders
    const BRAND_FOLDERS = {
      'MIR': 'mir',
      'BOS': 'bos',
      'Löwenstein': 'lowenstein',
      'Yuwell': 'yuwell',
      'Gelenke': 'gelenke',
      'Autres': 'autres',
    }

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
      diagnostics,
      folders: folderResults,
      testUpload: testError ? { error: testError.message } : { ok: true, path: testData?.path },
    })
  } catch (error: any) {
    console.error('[INIT_BUCKET_POST]', error)
    return NextResponse.json({
      error: error.message,
      stack: error.cause?.message || error.stack?.split('\n')[0],
    }, { status: 500 })
  }
}

// GET - also allow GET to init bucket (for easy browser testing)
export async function GET(request: NextRequest) {
  return POST(request)
}
