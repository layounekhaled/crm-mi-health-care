import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { encode } from 'next-auth/jwt'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // Get current (impersonated) token
    const currentToken = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!currentToken) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      )
    }

    // Must be in an impersonation session
    if (!currentToken.impersonatedBy) {
      return NextResponse.json(
        { error: 'Aucune session d\'usurpation en cours.' },
        { status: 400 }
      )
    }

    const adminId = currentToken.impersonatedBy as string

    // Find the original admin user
    const adminUser = await db.user.findUnique({
      where: { id: adminId },
      include: { employe: true },
    })

    if (!adminUser) {
      return NextResponse.json(
        { error: 'Compte administrateur introuvable. Veuillez vous déconnecter.' },
        { status: 404 }
      )
    }

    if (!adminUser.actif) {
      return NextResponse.json(
        { error: 'Votre compte administrateur a été désactivé. Contactez un autre administrateur.' },
        { status: 403 }
      )
    }

    // Create a new JWT with the admin's original data (no impersonatedBy)
    const newToken = await encode({
      token: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        employeId: adminUser.employeId,
        employeNom: adminUser.employe?.nom || null,
        permissions: (adminUser.employe?.permissions as Record<string, unknown> | null) || null,
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: 24 * 60 * 60,
    })

    // Determine cookie name (same logic as auth.ts)
    const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://')
    const cookiePrefix = useSecureCookies ? '__Secure-' : ''
    const cookieName = `${cookiePrefix}next-auth.session-token`

    // Log stop impersonation
    console.log('[IMPERSONATE]', {
      action: 'stop',
      adminId: adminUser.id,
      adminNom: adminUser.employe?.nom,
      wasImpersonating: currentToken.employeNom,
      wasImpersonatingEmployeeId: currentToken.employeId,
      timestamp: new Date().toISOString(),
    })

    const response = NextResponse.json({
      success: true,
      message: 'Revenu à votre compte administrateur',
    })

    // Set the original admin session cookie
    response.cookies.set({
      name: cookieName,
      value: newToken,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: useSecureCookies ? true : false,
      maxAge: 24 * 60 * 60,
    })

    return response
  } catch (error) {
    console.error('[IMPERSONATE STOP] Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du retour à votre compte' },
      { status: 500 }
    )
  }
}
