import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
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
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', request.url)
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
    const loginUrl = new URL('/login', request.url)
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
