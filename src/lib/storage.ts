import { put, del, list, head } from '@vercel/blob'

// Brand folders for document organization
export const BRAND_FOLDERS: Record<string, string> = {
  'MIR': 'mir',
  'BOS': 'bos',
  'Löwenstein': 'lowenstein',
  'Yuwell': 'yuwell',
  'Gelenke': 'gelenke',
  'Autres': 'autres',
}

// Get public URL for a file
export function getPublicUrl(filePath: string): string {
  // Vercel Blob files have direct URLs stored in the database
  return filePath
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Upload a file to Vercel Blob
export async function uploadFile(
  filePath: string,
  file: File | Blob | Buffer,
  contentType?: string
): Promise<{ url: string; pathname: string }> {
  const result = await put(filePath, file, {
    access: 'public',
    contentType: contentType || 'application/pdf',
    allowOverwrite: false,
  })
  return {
    url: result.url,
    pathname: result.pathname,
  }
}

// Delete a file from Vercel Blob
export async function deleteFile(url: string): Promise<void> {
  await del(url)
}

// List files in a folder
export async function listFiles(prefix?: string) {
  return list({ prefix, limit: 1000 })
}

// Get file metadata
export async function getFileHead(url: string) {
  return head(url)
}
