// Server-only storage module — uses Supabase Storage for file persistence
// Re-exports pure utilities from storage-utils.ts for convenience in API routes
// IMPORTANT: this module must only be imported from server-side code (API routes, server components)
// because it uses Supabase admin client which requires the service role key.

import { createSupabaseAdmin, BUCKET_NAME } from './supabase'

// Re-export everything from storage-utils so API routes can still import from '@/lib/storage'
export {
  BRAND_FOLDERS,
  getPublicUrl,
  formatFileSize,
} from './storage-utils'

import { BRAND_FOLDERS } from './storage-utils'

// Get the public Supabase URL for a file path
function getSupabasePublicUrl(filePath: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  }
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${filePath}`
}

// Upload a file to Supabase Storage
// filePath is relative path like "mir/1234567_file.pdf"
// Returns: { url: public URL to access the file, pathname: relative path stored in DB }
export async function uploadFile(
  filePath: string,
  file: File | Blob | Buffer,
  contentType?: string
): Promise<{ url: string; pathname: string }> {
  const supabase = createSupabaseAdmin()

  // Get file content as Uint8Array (works with all input types)
  let fileData: Uint8Array
  if (Buffer.isBuffer(file)) {
    fileData = new Uint8Array(file)
  } else if (file instanceof File || file instanceof Blob) {
    const ab = await file.arrayBuffer()
    fileData = new Uint8Array(ab)
  } else {
    throw new Error('Type de fichier non supporté')
  }

  // Upload to Supabase Storage
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, fileData, {
      contentType: contentType || 'application/pdf',
      upsert: true, // Overwrite if exists (useful for re-uploads)
    })

  if (error) {
    console.error('[STORAGE_UPLOAD_ERROR]', error)
    throw new Error(`Erreur upload Supabase: ${error.message}`)
  }

  // Return the public URL (absolute URL, accessible without auth)
  const publicUrl = getSupabasePublicUrl(filePath)

  return {
    url: publicUrl,
    pathname: filePath,
  }
}

// Delete a file from Supabase Storage
// url can be: a Supabase public URL, a relative /api/files/ path, or a legacy Vercel Blob URL
export async function deleteFile(url: string): Promise<void> {
  const supabase = createSupabaseAdmin()

  // If it's a Supabase URL, extract the file path
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl && url.startsWith(supabaseUrl)) {
    const prefix = `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/`
    const filePath = url.replace(prefix, '')
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath])
    if (error) {
      console.error('[STORAGE_DELETE_ERROR]', error)
    }
    return
  }

  // If it's a relative /api/files/ path (old local storage), extract the file path
  // and try to delete from Supabase (file might have been migrated)
  if (url.startsWith('/api/files/')) {
    const filePath = url.replace('/api/files/', '')
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath])
    if (error) {
      console.log(`[STORAGE] Could not delete from Supabase: ${error.message}`)
    }
    return
  }

  // Legacy Vercel Blob URLs - we can't delete those, just skip
  console.log(`[STORAGE] Skipping deletion of legacy URL: ${url}`)
}

// List files in a folder (relative path like "mir/")
export async function listFiles(prefix?: string) {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(prefix || '', { limit: 100 })

  if (error) {
    console.error('[STORAGE_LIST_ERROR]', error)
    return { blobs: [] }
  }

  const files = (data || [])
    .filter((item) => item.id) // Only files, not folders
    .map((item) => ({
      pathname: prefix ? `${prefix}${item.name}` : item.name,
      url: getSupabasePublicUrl(prefix ? `${prefix}${item.name}` : item.name),
    }))

  return { blobs: files }
}

// Get file metadata (size, etc.)
export async function getFileHead(url: string) {
  // For Supabase URLs, we can't easily get metadata without a HEAD request
  // Return minimal info
  return { url, pathname: url }
}

// Read file content — now fetches from Supabase Storage
// Used by /api/files/[...path] route as a fallback for old relative URLs
export async function readFileContent(filePath: string): Promise<Buffer | null> {
  const supabase = createSupabaseAdmin()

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(filePath)

    if (error || !data) {
      console.error('[STORAGE_READ_ERROR]', error?.message || 'No data')
      return null
    }

    const arrayBuffer = await data.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (err) {
    console.error('[STORAGE_READ_EXCEPTION]', err)
    return null
  }
}
