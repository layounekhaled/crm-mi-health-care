import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// GET /api/emails/config - Récupérer la configuration email de l'employé
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const employeId = authUser.employeId

    const employeeExists = await db.employee.findUnique({ where: { id: employeId }, select: { id: true } })
    if (!employeeExists) {
      return staleSessionResponse()
    }

    let emailConfig = await db.emailConfig.findUnique({
      where: { employeId },
    })

    if (!emailConfig) {
      const employee = await db.employee.findUnique({
        where: { id: employeId },
        select: { email: true },
      })

      if (employee?.email) {
        return NextResponse.json({
          employeId,
          email: employee.email,
          imapHost: '',
          imapPort: 993,
          imapTls: true,
          smtpHost: '',
          smtpPort: 587,
          smtpTls: true,
          isConfigured: false,
        })
      }
    }

    if (!emailConfig) {
      return NextResponse.json({
        employeId,
        email: '',
        imapHost: '',
        imapPort: 993,
        imapTls: true,
        smtpHost: '',
        smtpPort: 587,
        smtpTls: true,
        isConfigured: false,
      })
    }

    return NextResponse.json({
      ...emailConfig,
      emailPassword: undefined,
      isConfigured: !!(emailConfig.imapHost && emailConfig.email),
    })
  } catch (error) {
    console.error('[EMAIL_CONFIG_GET]', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    const stack = error instanceof Error ? error.stack?.substring(0, 500) : ''
    return NextResponse.json({ error: 'Erreur serveur', details: message, stack }, { status: 500 })
  }
}

// POST /api/emails/config - Sauvegarder la configuration email
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const employeId = authUser.employeId

    const employeeExists = await db.employee.findUnique({ where: { id: employeId }, select: { id: true } })
    if (!employeeExists) {
      return staleSessionResponse()
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const { email, imapHost, imapPort, imapTls, smtpHost, smtpPort, smtpTls, emailPassword, signature } = body

    if (!email || !imapHost || !smtpHost) {
      return NextResponse.json(
        { error: 'Email, serveur IMAP et SMTP sont requis' },
        { status: 400 }
      )
    }

    // Vérifier si une config existe déjà
    const existingConfig = await db.emailConfig.findUnique({
      where: { employeId },
    })

    let emailConfig

    if (existingConfig) {
      // Update existing config
      emailConfig = await db.emailConfig.update({
        where: { employeId },
        data: {
          email,
          imapHost,
          imapPort: imapPort || 993,
          imapTls: imapTls !== false,
          smtpHost,
          smtpPort: smtpPort || 587,
          smtpTls: smtpTls !== false,
          ...(emailPassword ? { emailPassword } : {}),
          ...(signature !== undefined ? { signature } : {}),
        },
      })
    } else {
      // Create new config
      emailConfig = await db.emailConfig.create({
        data: {
          employeId,
          email,
          imapHost,
          imapPort: imapPort || 993,
          imapTls: imapTls !== false,
          smtpHost,
          smtpPort: smtpPort || 587,
          smtpTls: smtpTls !== false,
          emailPassword: emailPassword || '',
          signature: signature || null,
        },
      })
    }

    return NextResponse.json({
      ...emailConfig,
      emailPassword: undefined,
      isConfigured: true,
    })
  } catch (error) {
    console.error('[EMAIL_CONFIG_POST]', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    const code = (error as any)?.code || ''
    const meta = (error as any)?.meta || ''
    const stack = error instanceof Error ? error.stack?.substring(0, 500) : ''
    return NextResponse.json({
      error: 'Erreur serveur',
      details: message,
      code,
      meta: typeof meta === 'object' ? JSON.stringify(meta) : String(meta),
      stack,
    }, { status: 500 })
  }
}

// DELETE /api/emails/config - Supprimer la configuration email
export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const employeId = authUser.employeId

    await db.emailConfig.deleteMany({
      where: { employeId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[EMAIL_CONFIG_DELETE]', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: 'Erreur serveur', details: message }, { status: 500 })
  }
}
