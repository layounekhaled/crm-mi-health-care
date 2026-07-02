import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Build a canonical external URL for the current request.
 *
 * When running behind a reverse proxy (Traefik on Coolify),
 * `request.url` is built from the internal Host header (e.g. `0.0.0.0:3000`).
 * This helper reconstructs the URL the end-user actually sees, by honoring
 * the standard `X-Forwarded-Host` / `X-Forwarded-Proto` headers, and falling
 * back to `NEXTAUTH_URL` if present.
 */
function getExternalUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const originalUrl = request.nextUrl.pathname + request.nextUrl.search

  if (forwardedHost) {
    const proto = forwardedProto || 'https'
    return `${proto}://${forwardedHost}${originalUrl}`
  }

  // Fallback to NEXTAUTH_URL if the request doesn't carry forwarded headers
  const nextAuthUrl = process.env.NEXTAUTH_URL
  if (nextAuthUrl) {
    return `${nextAuthUrl.replace(/\/$/, '')}${originalUrl}`
  }

  return request.url
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/debug') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/api/documents/init-bucket') ||
    pathname.startsWith('/api/emails/ping') ||
    pathname.startsWith('/api/files/') ||  // Document links shared via email/WhatsApp must be publicly accessible
    pathname.startsWith('/_next')
  ) {
    return NextResponse.next()
  }

  // Allow static files from public directory (images, fonts, icons, manifests, etc.)
  if (
    pathname.match(/\.(png|jpe?g|gif|svg|ico|webp|bmp|woff2?|ttf|eot|otf|json|xml|txt|webmanifest)$/i) ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/logo')
  ) {
    return NextResponse.next()
  }

  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token) {
      // For API routes, return 401 JSON instead of redirecting
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Non autorisé', message: 'Authentification requise' },
          { status: 401 }
        )
      }
      // For page routes, redirect to login
      const externalUrl = getExternalUrl(request)
      const loginUrl = new URL('/login', externalUrl)
      loginUrl.searchParams.set('callbackUrl', externalUrl)
      return NextResponse.redirect(loginUrl)
    }
  } catch {
    // For API routes, return 401 JSON instead of redirecting
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Non autorisé', message: 'Authentification requise' },
        { status: 401 }
      )
    }
    // For page routes, redirect to login
    const externalUrl = getExternalUrl(request)
    const loginUrl = new URL('/login', externalUrl)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login, /api/auth, /_next (handled in middleware function)
     * - Static files are allowed in middleware function via regex
     * Matcher is broad - actual filtering happens inside the function
     */
    '/(.*)',
  ],
}
