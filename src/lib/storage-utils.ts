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

// Get public URL for a file (served via /api/files/[...path] route)
// This function is pure and safe for client usage
export function getPublicUrl(filePath: string): string {
  // If it's already an absolute URL (Vercel Blob URLs), return as-is
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath
  }
  // Otherwise serve via our local file route
  // filePath is like "mir/1234567_file.pdf"
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
