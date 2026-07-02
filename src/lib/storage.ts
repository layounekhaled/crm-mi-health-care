// Server-only storage module — uses Vercel Blob for file storage
// Re-exports pure utilities from storage-utils.ts for convenience in API routes
// IMPORTANT: this module must only be imported from server-side code (API routes, server components)

import { put, del, list, head } from '@vercel/blob'

// Re-export everything from storage-utils so API routes can still import from '@/lib/storage'
export {
  BRAND_FOLDERS,
  getPublicUrl,
  formatFileSize,
} from './storage-utils'

import { BRAND_FOLDERS, getPublicUrl } from './storage-utils'

// Upload a file to Vercel Blob Storage
// filePath is relative path like "mir/1234567_file.pdf"
// Returns: { url: public URL to access the file, pathname: relative path stored in DB }
export async function uploadFile(
  filePath: string,
  file: File | Blob | Buffer,
  contentType?: string
): Promise<{ url: string; pathname: string }> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN non configuré. Veuillez lier le Blob Store dans le dashboard Vercel.')
  }

  // Convert to Blob if it's a Buffer
  let blobData: Blob
  if (Buffer.isBuffer(file)) {
    blobData = new Blob([file], { type: contentType || 'application/pdf' })
  } else {
    blobData = file
  }

  const blob = await put(filePath, blobData, {
    access: 'public',
    contentType: contentType || 'application/pdf',
    allowOverwrite: true,
  })

  return {
    url: blob.url,
    pathname: blob.pathname,
  }
}

// Delete a file from Vercel Blob Storage
export async function deleteFile(url: string): Promise<void> {
  // Only delete Vercel Blob URLs
  if (url.includes('vercel-storage.com') || url.includes('blob.vercel-storage.com')) {
    try {
      await del(url)
    } catch (err) {
      console.error('[STORAGE_DELETE_ERROR]', err)
    }
    return
  }
  // For relative /api/files/ paths (shouldn't happen with Vercel Blob, but just in case)
  console.log(`[STORAGE] Skipping deletion of non-blob URL: ${url}`)
}

// List files in a folder (prefix like "mir/")
export async function listFiles(prefix?: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { blobs: [] }
  }

  try {
    const result = await list({
      prefix: prefix || undefined,
      limit: 100,
    })

    return {
      blobs: result.blobs.map((b) => ({
        pathname: b.pathname,
        url: b.url,
      })),
    }
  } catch (err) {
    console.error('[STORAGE_LIST_ERROR]', err)
    return { blobs: [] }
  }
}

// Get file metadata (size, etc.)
export async function getFileHead(url: string) {
  if (url.includes('vercel-storage.com')) {
    try {
      const result = await head(url)
      return {
        size: result.size,
        uploadedAt: result.uploadedAt,
        pathname: result.pathname,
        url: result.url,
      }
    } catch {
      return null
    }
  }
  return { url, pathname: url }
}

// Read file content — downloads from Vercel Blob
// Used by /api/files/[...path] route as a fallback for old relative URLs
export async function readFileContent(filePath: string): Promise<Buffer | null> {
  try {
    // Try to find the file in Vercel Blob by pathname
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const result = await list({ prefix: filePath, limit: 1 })
      const blob = result.blobs.find(b => b.pathname === filePath)

      if (blob) {
        const response = await fetch(blob.url)
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer()
          return Buffer.from(arrayBuffer)
        }
      }
    }
    return null
  } catch (err) {
    console.error('[STORAGE_READ_ERROR]', err)
    return null
  }
}
