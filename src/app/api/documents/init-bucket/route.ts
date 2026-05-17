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
      serviceKeyPrefix: supabaseServiceKey?.substring(0, 30) + '...',
      serviceKeyLength: supabaseServiceKey?.length || 0,
      anonKeyPresent: !!supabaseAnonKey,
      anonKeyPrefix: supabaseAnonKey?.substring(0, 30) + '...',
      anonKeyLength: supabaseAnonKey?.length || 0,
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        error: 'Variables Supabase manquantes',
        diagnostics,
      }, { status: 500 })
    }

    // Test 1: Direct HTTP request to Supabase (bypass SDK)
    let directFetchResult: Record<string, any> = {}
    try {
      const healthUrl = `${supabaseUrl}/rest/v1/`
      const healthRes = await fetch(healthUrl, {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        signal: AbortSignal.timeout(10000),
      })
      directFetchResult = {
        url: healthUrl,
        status: healthRes.status,
        statusText: healthRes.statusText,
        ok: healthRes.ok,
        body: (await healthRes.text()).substring(0, 200),
      }
    } catch (fetchErr: any) {
      directFetchResult = {
        error: fetchErr.message,
        cause: fetchErr.cause?.message || fetchErr.cause?.code || 'unknown',
      }
    }

    // Test 2: Direct HTTP to Storage API
    let storageFetchResult: Record<string, any> = {}
    try {
      const storageUrl = `${supabaseUrl}/storage/v1/bucket`
      const storageRes = await fetch(storageUrl, {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        signal: AbortSignal.timeout(10000),
      })
      storageFetchResult = {
        url: storageUrl,
        status: storageRes.status,
        statusText: storageRes.statusText,
        ok: storageRes.ok,
        body: (await storageRes.text()).substring(0, 500),
      }
    } catch (fetchErr: any) {
      storageFetchResult = {
        error: fetchErr.message,
        cause: fetchErr.cause?.message || fetchErr.cause?.code || 'unknown',
      }
    }

    // Test 3: Try Supabase SDK
    let sdkResult: Record<string, any> = {}
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
      const { data: buckets, error: listError } = await supabase.storage.listBuckets()

      if (listError) {
        sdkResult = { error: listError.message, name: listError.name }
      } else {
        sdkResult = {
          ok: true,
          buckets: buckets?.map((b: any) => b.name) || [],
        }

        // If SDK works, create bucket if needed
        const BUCKET_NAME = 'Documents'
        const bucketExists = buckets?.some((b: any) => b.name === BUCKET_NAME)

        if (!bucketExists) {
          const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
            public: true,
            fileSizeLimit: 20 * 1024 * 1024,
            allowedMimeTypes: ['application/pdf'],
          })

          if (createError) {
            sdkResult.createBucketError = createError.message
          } else {
            sdkResult.bucketCreated = true
          }
        }

        // Create folders
        const BRAND_FOLDERS = ['mir', 'bos', 'lowenstein', 'yuwell', 'gelenke', 'autres']
        const folderResults = []
        for (const folder of BRAND_FOLDERS) {
          const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(`${folder}/.keep`, new Blob([''], { type: 'text/plain' }), { upsert: true })
          folderResults.push({ folder, ok: !error, error: error?.message })
        }
        sdkResult.folders = folderResults
      }
    } catch (sdkErr: any) {
      sdkResult = { error: sdkErr.message, cause: sdkErr.cause?.message }
    }

    return NextResponse.json({
      diagnostics,
      directFetch: directFetchResult,
      storageFetch: storageFetchResult,
      sdk: sdkResult,
    })
  } catch (error: any) {
    console.error('[INIT_BUCKET_POST]', error)
    return NextResponse.json({
      error: error.message,
      stack: error.cause?.message || error.stack?.split('\n')[0],
    }, { status: 500 })
  }
}

// GET - also allow GET for easy browser testing
export async function GET(request: NextRequest) {
  return POST(request)
}
