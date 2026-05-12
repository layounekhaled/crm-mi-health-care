import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

export const maxDuration = 60

// POST /api/emails/test - Tester la connexion email (IMAP + SMTP)
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const employeeExists = await db.employee.findUnique({ where: { id: authUser.employeId }, select: { id: true } })
    if (!employeeExists) {
      return staleSessionResponse()
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const { email, imapHost, imapPort, imapTls, smtpHost, smtpPort, smtpTls, emailPassword } = body

    if (!email || !imapHost || !smtpHost || !emailPassword) {
      return NextResponse.json(
        { error: 'Email, mot de passe, serveur IMAP et SMTP sont requis' },
        { status: 400 }
      )
    }

    // Importer dynamiquement imapflow et nodemailer pour capturer les erreurs d'import
    let ImapFlow: typeof import('imapflow').ImapFlow
    try {
      const imapModule = await import('imapflow')
      ImapFlow = imapModule.ImapFlow
    } catch (importErr) {
      console.error('[EMAIL_TEST_IMPORT_IMAP]', importErr)
      return NextResponse.json({
        success: false,
        results: {
          imap: { success: false, message: 'Module IMAP non disponible sur le serveur. Contactez le support.' },
          smtp: { success: false, message: 'Module SMTP non disponible sur le serveur. Contactez le support.' },
        },
        error: 'Modules email non disponibles',
        details: importErr instanceof Error ? importErr.message : String(importErr),
      }, { status: 500 })
    }

    let nodemailer: typeof import('nodemailer')
    try {
      nodemailer = await import('nodemailer')
    } catch (importErr) {
      console.error('[EMAIL_TEST_IMPORT_SMTP]', importErr)
      return NextResponse.json({
        success: false,
        results: {
          imap: { success: false, message: 'Module SMTP non disponible sur le serveur.' },
          smtp: { success: false, message: 'Module SMTP non disponible sur le serveur. Contactez le support.' },
        },
        error: 'Modules email non disponibles',
        details: importErr instanceof Error ? importErr.message : String(importErr),
      }, { status: 500 })
    }

    const results: { imap: { success: boolean; message: string }; smtp: { success: boolean; message: string } } = {
      imap: { success: false, message: '' },
      smtp: { success: false, message: '' },
    }

    // Test IMAP
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
      await imapClient.list()
      await imapClient.logout()
      results.imap = { success: true, message: 'Connexion IMAP réussie' }
    } catch (imapError: unknown) {
      const errorMsg = imapError instanceof Error ? imapError.message : 'Erreur inconnue'
      const errorCode = (imapError as any)?.code || ''
      console.error('[EMAIL_TEST_IMAP]', errorMsg, 'Code:', errorCode)

      let userMessage = errorMsg
      if (errorMsg.includes('AUTHENTICATE FAILED') || errorMsg.includes('Invalid credentials')) {
        userMessage = 'Identifiants incorrects. Vérifiez votre email et mot de passe d\'application.'
      } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
        userMessage = `Serveur "${imapHost}" introuvable. Vérifiez l'adresse du serveur IMAP.`
      } else if (errorMsg.includes('ECONNREFUSED')) {
        userMessage = `Connexion refusée par ${imapHost}:${imapPort || 993}. Le port peut être bloqué par l'hébergeur (Vercel).`
      } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout') || errorCode === 'ETIMEDOUT') {
        userMessage = `Délai d'attente dépassé pour ${imapHost}. Le port ${imapPort || 993} peut être bloqué par Vercel. Les ports IMAP (993) et SMTP (587/465) peuvent être bloqués sur Vercel Serverless.`
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
      transporter.close()
      results.smtp = { success: true, message: 'Connexion SMTP réussie' }
    } catch (smtpError: unknown) {
      const errorMsg = smtpError instanceof Error ? smtpError.message : 'Erreur inconnue'
      const errorCode = (smtpError as any)?.code || ''
      console.error('[EMAIL_TEST_SMTP]', errorMsg, 'Code:', errorCode)

      let userMessage = errorMsg
      if (errorMsg.includes('Invalid login') || errorMsg.includes('AUTH') || errorMsg.includes('credentials')) {
        userMessage = 'Identifiants SMTP incorrects. Vérifiez votre email et mot de passe d\'application.'
      } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
        userMessage = `Serveur "${smtpHost}" introuvable. Vérifiez l'adresse du serveur SMTP.`
      } else if (errorMsg.includes('ECONNREFUSED')) {
        userMessage = `Connexion refusée par ${smtpHost}:${smtpPort || 587}. Le port peut être bloqué par Vercel.`
      } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout') || errorCode === 'ETIMEDOUT') {
        userMessage = `Délai d'attente dépassé pour ${smtpHost}. Le port ${smtpPort || 587} peut être bloqué par Vercel Serverless.`
      } else if (errorMsg.includes('SSL') || errorMsg.includes('TLS') || errorMsg.includes('certificate')) {
        userMessage = 'Erreur de certificat SSL/TLS. Essayez le port 465 avec SSL ou le port 587 avec STARTTLS.'
      } else if (errorMsg.includes('EHOSTUNREACH') || errorCode === 'EHOSTUNREACH' || errorMsg.includes('EPIPE') || errorMsg.includes('connection reset') || errorMsg.includes('socket hang up')) {
        userMessage = `Impossible de se connecter à ${smtpHost}:${smtpPort || 587}. Le port est probablement bloqué par Vercel. Essayez le port 587 (STARTTLS) au lieu de 465 (SSL).`
      }

      results.smtp = { success: false, message: userMessage }
    }

    const allSuccess = results.imap.success && results.smtp.success

    return NextResponse.json({
      success: allSuccess,
      results,
      error: allSuccess ? undefined : 'Certains tests de connexion ont échoué',
    })
  } catch (error) {
    console.error('[EMAIL_TEST_POST]', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    const code = (error as any)?.code || ''
    // Retourner les détails de l'erreur au lieu d'un message générique
    return NextResponse.json({
      error: 'Erreur serveur',
      details: message,
      code,
    }, { status: 500 })
  }
}
