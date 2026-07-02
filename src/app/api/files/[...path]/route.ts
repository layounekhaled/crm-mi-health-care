import { NextRequest, NextResponse } from 'next/server'
import { readFileContent } from '@/lib/storage'

export const dynamic = 'force-dynamic'

// GET /api/files/[...path] - Serve a stored file (PDF documents)
// Files are stored locally on the Coolify volume at /data/dalia-documents/
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

    const content = await readFileContent(safePath)
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

    // Return file with appropriate headers
    return new NextResponse(content, {
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
