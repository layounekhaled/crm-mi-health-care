import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

export const maxDuration = 60

// POST /api/emails/test - Tester la connexion email (IMAP + SMTP)
export async function POST(request: NextRequest) {
  const steps: string[] = []

  try {
    steps.push('1. Starting auth check')
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      steps.push('1b. Auth failed: no user or employeId')
      return NextResponse.json({ error: 'Non autorisé', steps }, { status: 401 })
    }
    steps.push(`1c. Auth OK: employeId=${authUser.employeId}`)

    steps.push('2. Checking employee exists')
    const employeeExists = await db.employee.findUnique({ where: { id: authUser.employeId }, select: { id: true } })
    if (!employeeExists) {
      steps.push('2b. Employee not found')
      return staleSessionResponse()
    }
    steps.push('2c. Employee found')

    steps.push('3. Parsing request body')
    let body
    try {
      body = await request.json()
    } catch {
      steps.push('3b. Body parse failed')
      return NextResponse.json({ error: 'Corps de requête invalide', steps }, { status: 400 })
    }
    steps.push(`3c. Body parsed, keys: ${Object.keys(body).join(', ')}`)

    const { email, imapHost, imapPort, imapTls, smtpHost, smtpPort, smtpTls, emailPassword } = body

    if (!email || !imapHost || !smtpHost || !emailPassword) {
      steps.push('4b. Missing required fields')
      return NextResponse.json(
        { error: 'Email, mot de passe, serveur IMAP et SMTP sont requis', steps },
        { status: 400 }
      )
    }
    steps.push(`4c. Fields OK: email=${email}, imap=${imapHost}:${imapPort || 993}, smtp=${smtpHost}:${smtpPort || 587}`)

    // Importer dynamiquement imapflow et nodemailer
    steps.push('5. Importing imapflow')
    let ImapFlow: typeof import('imapflow').ImapFlow
    try {
      const imapModule = await import('imapflow')
      ImapFlow = imapModule.ImapFlow
      steps.push('5c. imapflow imported OK')
    } catch (importErr) {
      steps.push(`5b. imapflow import FAILED: ${importErr instanceof Error ? importErr.message : String(importErr)}`)
      console.error('[EMAIL_TEST_IMPORT_IMAP]', importErr)
      return NextResponse.json({
        success: false,
        results: {
          imap: { success: false, message: 'Module IMAP non disponible sur le serveur.' },
          smtp: { success: false, message: 'Module SMTP non disponible sur le serveur.' },
        },
        error: 'Modules email non disponibles',
        details: importErr instanceof Error ? importErr.message : String(importErr),
        steps,
      }, { status: 500 })
    }

    steps.push('6. Importing nodemailer')
    let nodemailer: typeof import('nodemailer')
    try {
      nodemailer = await import('nodemailer')
      steps.push('6c. nodemailer imported OK')
    } catch (importErr) {
      steps.push(`6b. nodemailer import FAILED: ${importErr instanceof Error ? importErr.message : String(importErr)}`)
      console.error('[EMAIL_TEST_IMPORT_SMTP]', importErr)
      return NextResponse.json({
        success: false,
        results: {
          imap: { success: false, message: 'Module SMTP non disponible.' },
          smtp: { success: false, message: 'Module SMTP non disponible sur le serveur.' },
        },
        error: 'Modules email non disponibles',
        details: importErr instanceof Error ? importErr.message : String(importErr),
        steps,
      }, { status: 500 })
    }

    const results: { imap: { success: boolean; message: string }; smtp: { success: boolean; message: string } } = {
      imap: { success: false, message: '' },
      smtp: { success: false, message: '' },
    }

    // Test IMAP
    steps.push('7. Testing IMAP connection')
    const imapClient = new ImapFlow({
      host: imapHost,
      port: imapPort || 993,
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

    try {
      await imapClient.connect()
      steps.push('7c. IMAP connected')
      await imapClient.list()
      steps.push('7d. IMAP listed folders')
      await imapClient.logout()
      steps.push('7e. IMAP logout OK')
      results.imap = { success: true, message: 'Connexion IMAP réussie' }
    } catch (imapError: unknown) {
      const errorMsg = imapError instanceof Error ? imapError.message : 'Erreur inconnue'
      const errorCode = (imapError as any)?.code || ''
      steps.push(`7b. IMAP FAILED: ${errorMsg} (code: ${errorCode})`)
      console.error('[EMAIL_TEST_IMAP]', errorMsg, 'Code:', errorCode)

      let userMessage = errorMsg
      if (errorMsg.includes('AUTHENTICATE FAILED') || errorMsg.includes('Invalid credentials')) {
        userMessage = 'Identifiants incorrects. Vérifiez votre email et mot de passe d\'application.'
      } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
        userMessage = `Serveur "${imapHost}" introuvable. Vérifiez l'adresse du serveur IMAP.`
      } else if (errorMsg.includes('ECONNREFUSED')) {
        userMessage = `Connexion refusée par ${imapHost}:${imapPort || 993}. Le port peut être bloqué par l'hébergeur (Vercel).`
      } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout') || errorCode === 'ETIMEDOUT') {
        userMessage = `Délai d'attente dépassé pour ${imapHost}. Le port ${imapPort || 993} peut être bloqué par Vercel.`
      } else if (errorMsg.includes('SSL') || errorMsg.includes('TLS') || errorMsg.includes('certificate')) {
        userMessage = 'Erreur de certificat SSL/TLS. Essayez de désactiver TLS si le serveur ne le supporte pas.'
      } else if (errorMsg.includes('Too many login') || errorMsg.includes('rate limit')) {
        userMessage = 'Trop de tentatives de connexion. Réessayez dans quelques minutes.'
      } else if (errorMsg.includes('EHOSTUNREACH') || errorCode === 'EHOSTUNREACH') {
        userMessage = `Impossible de joindre ${imapHost}:${imapPort || 993}. Le port est probablement bloqué par Vercel.`
      }

      results.imap = { success: false, message: userMessage }
    }

    // Test SMTP
    steps.push('8. Testing SMTP connection')
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
      steps.push('8c. SMTP verified')
      transporter.close()
      results.smtp = { success: true, message: 'Connexion SMTP réussie' }
    } catch (smtpError: unknown) {
      const errorMsg = smtpError instanceof Error ? smtpError.message : 'Erreur inconnue'
      const errorCode = (smtpError as any)?.code || ''
      steps.push(`8b. SMTP FAILED: ${errorMsg} (code: ${errorCode})`)
      console.error('[EMAIL_TEST_SMTP]', errorMsg, 'Code:', errorCode)

      let userMessage = errorMsg
      if (errorMsg.includes('Invalid login') || errorMsg.includes('AUTH') || errorMsg.includes('credentials')) {
        userMessage = 'Identifiants SMTP incorrects. Vérifiez votre email et mot de passe d\'application.'
      } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
        userMessage = `Serveur "${smtpHost}" introuvable. Vérifiez l'adresse du serveur SMTP.`
      } else if (errorMsg.includes('ECONNREFUSED')) {
        userMessage = `Connexion refusée par ${smtpHost}:${smtpPort || 587}. Le port peut être bloqué par Vercel.`
      } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout') || errorCode === 'ETIMEDOUT') {
        userMessage = `Délai d'attente dépassé pour ${smtpHost}. Le port ${smtpPort || 587} peut être bloqué par Vercel.`
      } else if (errorMsg.includes('SSL') || errorMsg.includes('TLS') || errorMsg.includes('certificate')) {
        userMessage = 'Erreur de certificat SSL/TLS. Essayez le port 465 avec SSL ou le port 587 avec STARTTLS.'
      } else if (errorMsg.includes('EHOSTUNREACH') || errorCode === 'EHOSTUNREACH' || errorMsg.includes('EPIPE') || errorMsg.includes('connection reset') || errorMsg.includes('socket hang up')) {
        userMessage = `Impossible de se connecter à ${smtpHost}:${smtpPort || 587}. Le port est probablement bloqué par Vercel.`
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
    steps.push(`UNCAUGHT ERROR: ${message} (code: ${code})`)
    // Retourner les détails de l'erreur au lieu d'un message générique
    return NextResponse.json({
      error: 'Erreur serveur',
      details: message,
      code,
      steps,
    }, { status: 500 })
  }
}
