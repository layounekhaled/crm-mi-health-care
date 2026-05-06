import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client-side (public reads)
export function createSupabaseClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Server-side admin client (bypasses RLS, for uploads/deletes)
export function createSupabaseAdmin(): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Bucket name (must match Supabase dashboard exactly)
export const BUCKET_NAME = 'Documents'

// Brand folders
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
  const supabase = createSupabaseClient()
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath)
  return data.publicUrl
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
