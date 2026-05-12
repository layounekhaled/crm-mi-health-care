import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'

// GET /api/emails/debug - Diagnostic de connexion email
export async function GET(request: NextRequest) {
  const debug: Record<string, unknown> = {}

  try {
    // 1. Vérifier l'authentification
    const authUser = await getAuthUser(request)
    debug.authUser = authUser ? {
      id: authUser.id,
      email: authUser.email,
      employeId: authUser.employeId,
      role: authUser.role,
    } : null

    if (!authUser?.employeId) {
      return NextResponse.json({ ...debug, error: 'Non autorisé' })
    }

    // 2. Vérifier l'employé existe
    const employee = await db.employee.findUnique({
      where: { id: authUser.employeId },
      select: { id: true, nom: true, email: true },
    })
    debug.employee = employee

    if (!employee) {
      return NextResponse.json({ ...debug, error: 'Employé non trouvé' })
    }

    // 3. Vérifier la config email
    const emailConfig = await db.emailConfig.findUnique({
      where: { employeId: authUser.employeId },
    })
    debug.emailConfigExists = !!emailConfig
    debug.emailConfigFields = emailConfig ? {
      email: emailConfig.email,
      imapHost: emailConfig.imapHost,
      imapPort: emailConfig.imapPort,
      imapTls: emailConfig.imapTls,
      smtpHost: emailConfig.smtpHost,
      smtpPort: emailConfig.smtpPort,
      smtpTls: emailConfig.smtpTls,
      hasPassword: !!emailConfig.emailPassword,
      signature: emailConfig.signature,
    } : null

    if (!emailConfig?.imapHost) {
      return NextResponse.json({ ...debug, error: 'Pas de config email' })
    }

    // 4. Tester IMAP
    debug.imapTest = { status: 'testing...' }
    try {
      const imapClient = new ImapFlow({
        host: emailConfig.imapHost,
        port: emailConfig.imapPort,
        secure: emailConfig.imapTls,
        auth: {
          user: emailConfig.email,
          pass: emailConfig.emailPassword,
        },
        tls: { rejectUnauthorized: false },
        logger: false as unknown as undefined,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
      })

      await imapClient.connect()
      const mailboxes = await imapClient.list()
      await imapClient.logout()
      debug.imapTest = {
        status: 'success',
        folders: mailboxes.map(m => m.path + ' (' + m.specialUse + ')'),
      }
    } catch (imapErr: unknown) {
      debug.imapTest = {
        status: 'failed',
        error: imapErr instanceof Error ? imapErr.message : String(imapErr),
      }
    }

    // 5. Tester SMTP
    debug.smtpTest = { status: 'testing...' }
    try {
      const transporter = nodemailer.createTransport({
        host: emailConfig.smtpHost,
        port: emailConfig.smtpPort,
        secure: emailConfig.smtpPort === 465,
        auth: {
          user: emailConfig.email,
          pass: emailConfig.emailPassword,
        },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
      })

      await transporter.verify()
      transporter.close()
      debug.smtpTest = { status: 'success' }
    } catch (smtpErr: unknown) {
      debug.smtpTest = {
        status: 'failed',
        error: smtpErr instanceof Error ? smtpErr.message : String(smtpErr),
      }
    }

    return NextResponse.json(debug)
  } catch (error) {
    debug.globalError = error instanceof Error ? error.message : String(error)
    debug.globalStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(debug, { status: 500 })
  }
}

// POST /api/emails/debug - Test direct avec credentials fournis
export async function POST(request: NextRequest) {
  const debug: Record<string, unknown> = {}

  try {
    const authUser = await getAuthUser(request)
    debug.authenticated = !!authUser?.employeId

    if (!authUser?.employeId) {
      return NextResponse.json({ ...debug, error: 'Non autorisé' })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body invalide' })
    }

    debug.receivedFields = Object.keys(body)

    const { email, imapHost, imapPort, imapTls, smtpHost, smtpPort, smtpTls, emailPassword } = body

    if (!email || !imapHost || !smtpHost || !emailPassword) {
      return NextResponse.json({
        ...debug,
        error: 'Champs manquants',
        missing: [
          !email && 'email',
          !imapHost && 'imapHost',
          !smtpHost && 'smtpHost',
          !emailPassword && 'emailPassword',
        ].filter(Boolean),
      })
    }

    // Test IMAP
    debug.imapTest = { status: 'testing...', host: imapHost, port: imapPort || 993 }
    try {
      const imapClient = new ImapFlow({
        host: imapHost,
        port: imapPort || 993,
        secure: imapTls !== false,
        auth: { user: email, pass: emailPassword },
        tls: { rejectUnauthorized: false },
        logger: false as unknown as undefined,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
      })

      await imapClient.connect()
      const mailboxes = await imapClient.list()
      await imapClient.logout()
      debug.imapTest = {
        status: 'success',
        folders: mailboxes.map(m => m.path + ' (' + m.specialUse + ')'),
      }
    } catch (imapErr: unknown) {
      debug.imapTest = {
        status: 'failed',
        error: imapErr instanceof Error ? imapErr.message : String(imapErr),
      }
    }

    // Test SMTP
    const effectiveSmtpPort = smtpPort || 587
    debug.smtpTest = { status: 'testing...', host: smtpHost, port: effectiveSmtpPort, secure: effectiveSmtpPort === 465 }
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: effectiveSmtpPort,
        secure: effectiveSmtpPort === 465,
        auth: { user: email, pass: emailPassword },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
      })

      await transporter.verify()
      transporter.close()
      debug.smtpTest = { status: 'success' }
    } catch (smtpErr: unknown) {
      debug.smtpTest = {
        status: 'failed',
        error: smtpErr instanceof Error ? smtpErr.message : String(smtpErr),
      }
    }

    // Test sauvegarde config (sans sauvegarder vraiment)
    debug.prismaTest = { status: 'testing...' }
    try {
      const existingConfig = await db.emailConfig.findUnique({
        where: { employeId: authUser.employeId },
      })
      debug.prismaTest = {
        status: 'success',
        existingConfig: !!existingConfig,
        fields: existingConfig ? Object.keys(existingConfig) : [],
      }
    } catch (prismaErr: unknown) {
      debug.prismaTest = {
        status: 'failed',
        error: prismaErr instanceof Error ? prismaErr.message : String(prismaErr),
      }
    }

    return NextResponse.json(debug)
  } catch (error) {
    debug.globalError = error instanceof Error ? error.message : String(error)
    debug.globalStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(debug, { status: 500 })
  }
}
