import { NextResponse } from 'next/server'
import { createSupabaseAdmin, BUCKET_NAME, BRAND_FOLDERS } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createSupabaseAdmin()
    
    // 1. List buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      return NextResponse.json({ 
        step: 'listBuckets', 
        error: listError.message,
        keyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 15) + '...'
      }, { status: 500 })
    }
    
    const bucketNames = buckets?.map((b: any) => b.name) || []
    const docBucket = buckets?.find((b: any) => b.name === BUCKET_NAME)
    
    // 2. If bucket doesn't exist, create it
    let bucketCreated = false
    if (!docBucket) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 20 * 1024 * 1024,
        allowedMimeTypes: ['application/pdf'],
      })
      
      if (createError) {
        return NextResponse.json({ 
          step: 'createBucket', 
          error: createError.message 
        }, { status: 500 })
      }
      bucketCreated = true
    }
    
    // 3. Create brand folders
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
    
    // 4. Test upload
    const testContent = new Blob(['test pdf'], { type: 'application/pdf' })
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload('autres/test_connection.pdf', testContent, {
        contentType: 'application/pdf',
        upsert: true,
      })
    
    let testUrl = ''
    if (!uploadError && uploadData) {
      const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(uploadData.path)
      testUrl = urlData.publicUrl
    }
    
    return NextResponse.json({
      success: true,
      buckets: bucketNames,
      docBucketExists: !!docBucket || bucketCreated,
      bucketCreated,
      folders: folderResults,
      testUpload: uploadError ? { error: uploadError.message } : { path: uploadData?.path, url: testUrl },
      keyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 15) + '...',
    })
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
    }, { status: 500 })
  }
}
