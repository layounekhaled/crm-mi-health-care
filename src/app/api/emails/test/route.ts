import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// POST /api/emails/test - Tester la connexion email (IMAP + SMTP)
export async function POST(request: NextRequest) {
  const steps: string[] = []

  try {
    steps.push('1. Auth check')
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé', steps }, { status: 401 })
    }
    steps.push(`1c. Auth OK: employeId=${authUser.employeId}`)

    steps.push('2. Checking employee')
    const employeeExists = await db.employee.findUnique({ where: { id: authUser.employeId }, select: { id: true } })
    if (!employeeExists) {
      return staleSessionResponse()
    }
    steps.push('2c. Employee found')

    steps.push('3. Parsing body')
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide', steps }, { status: 400 })
    }

    const { email, imapHost, imapPort, imapTls, smtpHost, smtpPort, smtpTls, emailPassword } = body

    if (!email || !imapHost || !smtpHost || !emailPassword) {
      return NextResponse.json(
        { error: 'Email, mot de passe, serveur IMAP et SMTP sont requis', steps },
        { status: 400 }
      )
    }
    steps.push(`3c. Fields OK: email=${email}, imap=${imapHost}:${imapPort || 993}, smtp=${smtpHost}:${smtpPort || 587}`)

    const results: { imap: { success: boolean; message: string }; smtp: { success: boolean; message: string } } = {
      imap: { success: false, message: '' },
      smtp: { success: false, message: '' },
    }

    // Test IMAP
    steps.push('4. Testing IMAP connection')
    try {
      const imapPortNum = imapPort || 993
      const imapClient = new ImapFlow({
        host: imapHost,
        port: imapPortNum,
        secure: imapTls !== false,
        auth: {
          user: email,
          pass: emailPassword,
        },
        tls: { rejectUnauthorized: false },
        logger: false as unknown as undefined,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
      })

      await imapClient.connect()
      steps.push('4c. IMAP connected')
      await imapClient.list()
      steps.push('4d. IMAP listed folders')
      await imapClient.logout()
      steps.push('4e. IMAP logout OK')
      results.imap = { success: true, message: 'Connexion IMAP réussie' }
    } catch (imapError: unknown) {
      const errorMsg = imapError instanceof Error ? imapError.message : 'Erreur inconnue'
      const errorCode = (imapError as any)?.code || ''
      steps.push(`4b. IMAP FAILED: ${errorMsg} (code: ${errorCode})`)
      console.error('[EMAIL_TEST_IMAP]', errorMsg, 'Code:', errorCode)

      let userMessage = errorMsg
      if (errorMsg.includes('AUTHENTICATE FAILED') || errorMsg.includes('Invalid credentials')) {
        userMessage = 'Identifiants incorrects. Vérifiez votre email et mot de passe.'
      } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
        userMessage = `Serveur "${imapHost}" introuvable. Vérifiez l'adresse du serveur IMAP.`
      } else if (errorMsg.includes('ECONNREFUSED')) {
        userMessage = `Connexion refusée par ${imapHost}:${imapPort || 993}. Le port est peut-être bloqué.`
      } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout') || errorCode === 'ETIMEDOUT') {
        userMessage = `Délai dépassé pour ${imapHost}:${imapPort || 993}. Le port est probablement bloqué par Vercel.`
      } else if (errorMsg.includes('SSL') || errorMsg.includes('TLS') || errorMsg.includes('certificate')) {
        userMessage = 'Erreur SSL/TLS. Essayez de désactiver TLS.'
      } else if (errorMsg.includes('Too many login') || errorMsg.includes('rate limit')) {
        userMessage = 'Trop de tentatives. Réessayez dans quelques minutes.'
      } else if (errorMsg.includes('EHOSTUNREACH') || errorCode === 'EHOSTUNREACH') {
        userMessage = `Impossible de joindre ${imapHost}:${imapPort || 993}. Port bloqué par Vercel.`
      } else if (errorMsg.includes('ECONNRESET') || errorCode === 'ECONNRESET') {
        userMessage = `Connexion réinitialisée par ${imapHost}. Le port est peut-être bloqué par Vercel.`
      }
      results.imap = { success: false, message: userMessage }
    }

    // Test SMTP
    steps.push('5. Testing SMTP connection')
    try {
      const effectiveSmtpPort = smtpPort || 587
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: effectiveSmtpPort,
        secure: effectiveSmtpPort === 465,
        auth: {
          user: email,
          pass: emailPassword,
        },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
      })

      await transporter.verify()
      steps.push('5c. SMTP verified')
      transporter.close()
      results.smtp = { success: true, message: 'Connexion SMTP réussie' }
    } catch (smtpError: unknown) {
      const errorMsg = smtpError instanceof Error ? smtpError.message : 'Erreur inconnue'
      const errorCode = (smtpError as any)?.code || ''
      steps.push(`5b. SMTP FAILED: ${errorMsg} (code: ${errorCode})`)
      console.error('[EMAIL_TEST_SMTP]', errorMsg, 'Code:', errorCode)

      let userMessage = errorMsg
      if (errorMsg.includes('Invalid login') || errorMsg.includes('AUTH') || errorMsg.includes('credentials')) {
        userMessage = 'Identifiants SMTP incorrects.'
      } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
        userMessage = `Serveur "${smtpHost}" introuvable. Vérifiez l'adresse du serveur SMTP.`
      } else if (errorMsg.includes('ECONNREFUSED')) {
        userMessage = `Connexion refusée par ${smtpHost}:${smtpPort || 587}. Port bloqué.`
      } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout') || errorCode === 'ETIMEDOUT') {
        userMessage = `Délai dépassé pour ${smtpHost}:${smtpPort || 587}. Port probablement bloqué par Vercel.`
      } else if (errorMsg.includes('SSL') || errorMsg.includes('TLS') || errorMsg.includes('certificate')) {
        userMessage = 'Erreur SSL/TLS. Essayez port 587 avec STARTTLS.'
      } else if (errorMsg.includes('EHOSTUNREACH') || errorCode === 'EHOSTUNREACH' || errorMsg.includes('EPIPE') || errorMsg.includes('connection reset') || errorMsg.includes('socket hang up')) {
        userMessage = `Impossible de se connecter à ${smtpHost}:${smtpPort || 587}. Port probablement bloqué par Vercel.`
      }
      results.smtp = { success: false, message: userMessage }
    }

    const allSuccess = results.imap.success && results.smtp.success

    return NextResponse.json({
      success: allSuccess,
      results,
      error: allSuccess ? undefined : 'Certains tests de connexion ont échoué',
      steps,
    })
  } catch (error) {
    console.error('[EMAIL_TEST_POST]', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    const code = (error as any)?.code || ''
    const stack = error instanceof Error ? error.stack?.substring(0, 500) : ''
    steps.push(`UNCAUGHT ERROR: ${message} (code: ${code})`)
    return NextResponse.json({
      error: 'Erreur serveur',
      details: message,
      code,
      stack,
      steps,
    }, { status: 500 })
  }
}
