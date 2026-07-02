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
// For Vercel Blob uploads: the URL is absolute and stored directly in DB
// This function handles legacy relative paths that might still exist
export function getPublicUrl(filePath: string): string {
  // If it's already an absolute URL (Vercel Blob), return as-is
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath
  }
  // For legacy relative paths, serve via /api/files/ route
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
