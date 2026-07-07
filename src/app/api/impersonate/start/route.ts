import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { encode } from 'next-auth/jwt'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // Get current admin token
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

    // Only admins can impersonate
    if (currentToken.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accès refusé. Seuls les administrateurs peuvent accéder aux comptes employés.' },
        { status: 403 }
      )
    }

    // Cannot impersonate while already impersonating
    if (currentToken.impersonatedBy) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas usurper une identité pendant une session d\'usurpation.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { employeeId } = body

    if (!employeeId) {
      return NextResponse.json(
        { error: 'ID employé requis' },
        { status: 400 }
      )
    }

    // Find the target employee with their User account
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      include: { user: true },
    })

    if (!employee) {
      return NextResponse.json(
        { error: 'Employé introuvable' },
        { status: 404 }
      )
    }

    if (!employee.user) {
      return NextResponse.json(
        { error: 'Cet employé n\'a pas de compte utilisateur. Créez d\'abord un compte pour cet employé.' },
        { status: 400 }
      )
    }

    if (!employee.actif || !employee.user.actif) {
      return NextResponse.json(
        { error: 'Ce compte employé est désactivé.' },
        { status: 400 }
      )
    }

    const adminId = currentToken.id as string
    const adminNom = currentToken.employeNom as string

    // Create a new JWT with the employee's data + impersonatedBy
    const newToken = await encode({
      token: {
        id: employee.user.id,
        email: employee.user.email,
        role: employee.user.role,
        employeId: employee.id,
        employeNom: employee.nom,
        permissions: (employee.permissions as Record<string, unknown>) || null,
        impersonatedBy: adminId,
        impersonatedByNom: adminNom,
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: 24 * 60 * 60, // Same 24h maxAge as normal sessions
    })

    // Determine cookie name (same logic as auth.ts)
    const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://')
    const cookiePrefix = useSecureCookies ? '__Secure-' : ''
    const cookieName = `${cookiePrefix}next-auth.session-token`

    // Log impersonation action
    console.log('[IMPERSONATE]', {
      action: 'start',
      adminId,
      adminNom,
      targetUserId: employee.user.id,
      targetEmployeeId: employee.id,
      targetEmployeeNom: employee.nom,
      timestamp: new Date().toISOString(),
    })

    const response = NextResponse.json({
      success: true,
      message: `Connecté en tant que ${employee.nom}`,
      employee: {
        id: employee.id,
        nom: employee.nom,
        role: employee.role,
      },
    })

    // Set the new session cookie
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
    console.error('[IMPERSONATE] Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'accès au compte' },
      { status: 500 }
    )
  }
}
