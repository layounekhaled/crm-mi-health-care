import { NextRequest, NextResponse } from 'next/server'
import { readFileContent } from '@/lib/storage'

export const dynamic = 'force-dynamic'

// GET /api/files/[...path] - Serve a stored file from MinIO
// Supports different buckets via ?bucket= query param (default: dalia-documents)
// Examples:
//   /api/files/mir/document.pdf                    → dalia-documents bucket
//   /api/files/chat-images/photo.png?bucket=media  → dalia-media bucket
//   /api/files/backups/dump.sql.gz?bucket=backups  → dalia-backups bucket
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params

    // Sanitize path - prevent directory traversal
    const safePath = pathSegments
      .map((seg) => decodeURIComponent(seg))
      .filter((seg) => seg && !seg.includes('..') && !seg.includes('\\') && !seg.startsWith('/'))
      .join('/')

    if (!safePath) {
      return NextResponse.json({ error: 'Chemin invalide' }, { status: 400 })
    }

    // Determine bucket type from query param or path prefix
    const url = new URL(request.url)
    const bucketParam = url.searchParams.get('bucket')
    let bucketType: 'documents' | 'media' | 'backups' = 'documents'

    if (bucketParam === 'media' || bucketParam === 'dalia-media') {
      bucketType = 'media'
    } else if (bucketParam === 'backups' || bucketParam === 'dalia-backups') {
      bucketType = 'backups'
    } else if (bucketParam === 'documents' || bucketParam === 'dalia-documents') {
      bucketType = 'documents'
    } else {
      // Auto-detect from path prefix
      if (safePath.startsWith('chat-images/') || safePath.startsWith('prospect-photos/') || safePath.startsWith('interaction-photos/')) {
        bucketType = 'media'
      } else if (safePath.startsWith('backups/')) {
        bucketType = 'backups'
      }
    }

    const content = await readFileContent(safePath, bucketType)
    if (!content) {
      return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })
    }

    // Determine content type based on extension
    const ext = safePath.split('.').pop()?.toLowerCase()
    let contentType = 'application/pdf' // default for DALIA documents
    if (ext === 'png') contentType = 'image/png'
    else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg'
    else if (ext === 'gif') contentType = 'image/gif'
    else if (ext === 'webp') contentType = 'image/webp'
    else if (ext === 'svg') contentType = 'image/svg+xml'
    else if (ext === 'txt') contentType = 'text/plain'
    else if (ext === 'json') contentType = 'application/json'
    else if (ext === 'sql' || ext === 'sql.gz') contentType = 'application/gzip'

    // Return file with appropriate headers
    return new NextResponse(new Uint8Array(content), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': content.length.toString(),
        'Content-Disposition': `inline; filename="${safePath.split('/').pop()}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[FILE_SERVE_ERROR]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
