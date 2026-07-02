/**
 * Migration script: Move all documents from Vercel Blob to Supabase Storage
 * 
 * This script:
 * 1. Reads all Document records from the production database
 * 2. Downloads files from their current URLs (Vercel Blob or /api/files/...)
 * 3. Uploads them to Supabase Storage (Documents bucket)
 * 4. Updates the database with the new Supabase public URLs
 * 
 * Run: node scripts/migrate-documents-to-supabase.mjs
 */

import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

const DATABASE_URL = 'postgresql://neondb_owner:npg_N2ESji9uVPfL@ep-divine-darkness-an3iu4co-pooler.c-6.us-east-1.aws.neon.tech/crm_dalia?sslmode=require'
const SUPABASE_URL = 'https://vsxzdvecxcnijojmaund.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzeHpkdmVjeGNuaWpvam1hdW5kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMjQ4NzI5NiwiZXhwIjoyMDM4MDYzMjk2fQ.rJXsG-t_G2b6sqV3YLzeGKjO9VhE-TklgNlJi7PcNsk'
const BUCKET_NAME = 'Documents'
const DALIA_BASE = 'https://dalia.fret.direct'

const db = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } }
})

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function ensureBucketExists() {
  console.log('🔍 Checking if Supabase bucket exists...')
  
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()
  if (listError) {
    throw new Error(`Failed to list buckets: ${listError.message}`)
  }
  
  const bucket = buckets?.find(b => b.name === BUCKET_NAME)
  if (bucket) {
    console.log(`  ✅ Bucket "${BUCKET_NAME}" exists (public: ${bucket.public})`)
    return
  }
  
  // Create the bucket
  console.log(`  📦 Creating bucket "${BUCKET_NAME}"...`)
  const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: 20 * 1024 * 1024, // 20MB
  })
  
  if (createError) {
    throw new Error(`Failed to create bucket: ${createError.message}`)
  }
  
  console.log(`  ✅ Bucket "${BUCKET_NAME}" created successfully`)
}

async function downloadFile(url: string): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    // For relative URLs, prepend the Dalia base URL
    let fullUrl = url
    if (url.startsWith('/api/files/')) {
      fullUrl = `${DALIA_BASE}${url}`
    }
    
    const response = await fetch(fullUrl, {
      headers: { 'User-Agent': 'Dalia-Migration-Script/1.0' }
    })
    
    if (!response.ok) {
      console.log(`    ❌ Download failed: HTTP ${response.status} for ${fullUrl}`)
      return null
    }
    
    const arrayBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'application/pdf'
    
    return { data: Buffer.from(arrayBuffer), contentType }
  } catch (err: any) {
    console.log(`    ❌ Download error: ${err.message}`)
    return null
  }
}

async function uploadToSupabase(filePath: string, data: Buffer, contentType: string): Promise<string | null> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, new Uint8Array(data), {
        contentType,
        upsert: true,
      })
    
    if (error) {
      console.log(`    ❌ Upload to Supabase failed: ${error.message}`)
      return null
    }
    
    // Build the public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${filePath}`
    return publicUrl
  } catch (err: any) {
    console.log(`    ❌ Upload error: ${err.message}`)
    return null
  }
}

async function migrate() {
  console.log('🚀 Starting document migration to Supabase Storage\n')
  
  // Step 1: Ensure bucket exists
  await ensureBucketExists()
  
  // Step 2: Get all documents from DB
  const documents = await db.document.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      fileUrl: true,
      filePath: true,
      fileName: true,
      brand: true,
      status: true,
    }
  })
  
  console.log(`\n📋 Found ${documents.length} documents in database\n`)
  
  // Categorize documents
  const alreadySupabase = documents.filter(d => d.fileUrl.startsWith(SUPABASE_URL))
  const vercelBlob = documents.filter(d => d.fileUrl.includes('vercel-storage.com'))
  const relativeUrl = documents.filter(d => d.fileUrl.startsWith('/api/files/'))
  const other = documents.filter(d => !d.fileUrl.startsWith(SUPABASE_URL) && !d.fileUrl.includes('vercel-storage.com') && !d.fileUrl.startsWith('/api/files/'))
  
  console.log(`  📊 Already on Supabase: ${alreadySupabase.length}`)
  console.log(`  📊 On Vercel Blob: ${vercelBlob.length}`)
  console.log(`  📊 Relative URLs (/api/files/): ${relativeUrl.length}`)
  console.log(`  📊 Other: ${other.length}`)
  
  if (alreadySupabase.length > 0) {
    console.log(`\n  ⏭️  Skipping ${alreadySupabase.length} already-migrated documents`)
  }
  
  // Step 3: Migrate Vercel Blob documents
  const toMigrate = [...vercelBlob, ...relativeUrl, ...other]
  
  if (toMigrate.length === 0) {
    console.log('\n✅ No documents to migrate!')
    return
  }
  
  console.log(`\n📦 Migrating ${toMigrate.length} documents...\n`)
  
  let migrated = 0
  let failed = 0
  
  for (const doc of toMigrate) {
    console.log(`  📄 [${migrated + failed + 1}/${toMigrate.length}] ${doc.title}`)
    console.log(`     Current URL: ${doc.fileUrl.substring(0, 80)}...`)
    console.log(`     File path: ${doc.filePath}`)
    
    // Download the file
    console.log(`     ⬇️  Downloading...`)
    const result = await downloadFile(doc.fileUrl)
    
    if (!result) {
      console.log(`     ⚠️  Could not download — will try to mark URL as-is`)
      failed++
      continue
    }
    
    console.log(`     ✅ Downloaded ${result.data.length} bytes`)
    
    // Upload to Supabase using the existing filePath (e.g., "mir/1780581403003_file.pdf")
    console.log(`     ⬆️  Uploading to Supabase as "${doc.filePath}"...`)
    const newUrl = await uploadToSupabase(doc.filePath, result.data, result.contentType)
    
    if (!newUrl) {
      failed++
      continue
    }
    
    console.log(`     ✅ Uploaded to: ${newUrl}`)
    
    // Update the database
    await db.document.update({
      where: { id: doc.id },
      data: { fileUrl: newUrl }
    })
    
    console.log(`     ✅ Database updated`)
    migrated++
  }
  
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 Migration Results:`)
  console.log(`  ✅ Migrated: ${migrated}`)
  console.log(`  ❌ Failed: ${failed}`)
  console.log(`  ⏭️  Skipped (already Supabase): ${alreadySupabase.length}`)
  console.log(`${'='.repeat(60)}`)
  
  await db.$disconnect()
}

migrate().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
