// Pure utility functions — safe to use on both client and server (no Node.js built-ins)

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

// Get public URL for a file
// All files are served through /api/files/ proxy to avoid exposing MinIO directly
// and to work over HTTPS (MinIO is HTTP-only)
export function getPublicUrl(filePath: string): string {
  // If it's already a /api/files/ URL, return as-is
  if (filePath.startsWith('/api/files/')) {
    return filePath
  }
  // If it's already an absolute URL (legacy Vercel Blob), return as-is
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath
  }
  // For relative paths, serve via /api/files/ route
  return `/api/files/${filePath}`
}

// Format file size — pure utility, safe for client
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
