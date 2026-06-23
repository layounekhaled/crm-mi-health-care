import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

// Brand folders for document organization
export const BRAND_FOLDERS: Record<string, string> = {
  'MIR': 'mir',
  'BOSO BOSCH': 'boso-bosch',
  'Löwenstein': 'lowenstein',
  'Yuwell': 'yuwell',
  'Gelenke': 'gelenke',
  'DRIVE DEVILBISS': 'drive-devilbiss',
  'INOGEN': 'inogen',
  'Autres': 'autres',
}

// Storage root: persistent volume mounted on Coolify (or local /tmp in dev)
// On Coolify: /data/dalia-documents (mounted as a volume)
// On Vercel/dev: /tmp/dalia-documents (ephemeral but works for testing)
const STORAGE_ROOT = process.env.DOCUMENTS_STORAGE_PATH || '/data/dalia-documents'

// Get public URL for a file (served via /api/files/[...path] route)
export function getPublicUrl(filePath: string): string {
  // If it's already an absolute URL (legacy Vercel Blob URLs), return as-is
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath
  }
  // Otherwise serve via our local file route
  // filePath is like "mir/1234567_file.pdf"
  return `/api/files/${filePath}`
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Ensure storage directory exists
async function ensureStorageDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (err: any) {
    if (err.code !== 'EEXIST') {
      // If we can't write to /data (not on Coolify), fallback to /tmp
      if (dirPath === STORAGE_ROOT) {
        const fallback = path.join(os.tmpdir(), 'dalia-documents')
        await fs.mkdir(fallback, { recursive: true })
        return
      }
      throw err
    }
  }
}

// Get effective storage path (with fallback for dev environments)
async function getEffectiveStorageRoot(): Promise<string> {
  try {
    await fs.access(STORAGE_ROOT)
    // Test write access
    await fs.mkdir(STORAGE_ROOT, { recursive: true })
    return STORAGE_ROOT
  } catch {
    const fallback = path.join(os.tmpdir(), 'dalia-documents')
    await fs.mkdir(fallback, { recursive: true })
    return fallback
  }
}

// Upload a file to local storage
// filePath is relative path like "mir/1234567_file.pdf"
// Returns: { url: public URL to access the file, pathname: relative path stored in DB }
export async function uploadFile(
  filePath: string,
  file: File | Blob | Buffer,
  contentType?: string
): Promise<{ url: string; pathname: string }> {
  const storageRoot = await getEffectiveStorageRoot()
  const fullPath = path.join(storageRoot, filePath)

  // Ensure parent directory exists
  await fs.mkdir(path.dirname(fullPath), { recursive: true })

  // Get file content as Buffer
  let buffer: Buffer
  if (Buffer.isBuffer(file)) {
    buffer = file
  } else if (file instanceof File) {
    const arrayBuffer = await file.arrayBuffer()
    buffer = Buffer.from(arrayBuffer)
  } else if (file instanceof Blob) {
    const arrayBuffer = await file.arrayBuffer()
    buffer = Buffer.from(arrayBuffer)
  } else {
    throw new Error('Type de fichier non supporté')
  }

  // Write to disk
  await fs.writeFile(fullPath, buffer)

  return {
    url: getPublicUrl(filePath),
    pathname: filePath,
  }
}

// Delete a file from local storage
// url can be either a full URL (legacy Vercel Blob) or a relative path
export async function deleteFile(url: string): Promise<void> {
  // If it's an absolute URL pointing to our own server, extract the path
  if (url.startsWith('/api/files/')) {
    const relativePath = url.replace('/api/files/', '')
    const storageRoot = await getEffectiveStorageRoot()
    const fullPath = path.join(storageRoot, relativePath)
    try {
      await fs.unlink(fullPath)
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err
      // File doesn't exist - already deleted, ignore
    }
    return
  }
  // Legacy Vercel Blob URLs - we can't delete those, just skip
  // (would require @vercel/blob client which is no longer used)
  console.log(`[STORAGE] Skipping deletion of legacy URL: ${url}`)
}

// List files in a folder (relative path like "mir/")
export async function listFiles(prefix?: string) {
  const storageRoot = await getEffectiveStorageRoot()
  const fullPath = prefix ? path.join(storageRoot, prefix) : storageRoot

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true })
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => ({
        pathname: prefix ? `${prefix}${e.name}` : e.name,
        url: getPublicUrl(prefix ? `${prefix}${e.name}` : e.name),
      }))
    return { blobs: files }
  } catch (err: any) {
    if (err.code === 'ENOENT') return { blobs: [] }
    throw err
  }
}

// Get file metadata (size, etc.)
export async function getFileHead(url: string) {
  if (url.startsWith('/api/files/')) {
    const relativePath = url.replace('/api/files/', '')
    const storageRoot = await getEffectiveStorageRoot()
    const fullPath = path.join(storageRoot, relativePath)
    try {
      const stat = await fs.stat(fullPath)
      return {
        size: stat.size,
        uploadedAt: stat.mtime,
        pathname: relativePath,
        url,
      }
    } catch {
      return null
    }
  }
  // Legacy URL - return minimal info
  return { url, pathname: url }
}

// Read file content for serving via API route
export async function readFileContent(filePath: string): Promise<Buffer | null> {
  const storageRoot = await getEffectiveStorageRoot()
  const fullPath = path.join(storageRoot, filePath)

  try {
    const content = await fs.readFile(fullPath)
    return content
  } catch (err: any) {
    if (err.code === 'ENOENT') return null
    throw err
  }
}
