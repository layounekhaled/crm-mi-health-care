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
// For new uploads: returns Supabase Storage public URL (absolute, persistent)
// For legacy uploads: returns /api/files/... path (relative, served via API route)
// This function is pure and safe for client usage
export function getPublicUrl(filePath: string): string {
  // If it's already an absolute URL (Supabase or legacy Vercel Blob), return as-is
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath
  }
  // For relative paths like "mir/1234567_file.pdf", serve via /api/files/ route
  // The route will proxy the file from Supabase Storage
  // filePath is like "mir/1234567_file.pdf"
  return `/api/files/${filePath}`
}

// Get the Supabase public URL for a file path (used server-side during upload)
export function getSupabaseUrl(filePath: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return `/api/files/${filePath}`
  return `${supabaseUrl}/storage/v1/object/public/Documents/${filePath}`
}

// Format file size — pure utility, safe for client
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
