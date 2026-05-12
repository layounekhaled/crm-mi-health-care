import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'

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
      // Tester qu'on peut lister les dossiers
      await imapClient.list()
      await imapClient.logout()
      results.imap = { success: true, message: 'Connexion IMAP réussie' }
    } catch (imapError: unknown) {
      const errorMsg = imapError instanceof Error ? imapError.message : 'Erreur inconnue'
      console.error('[EMAIL_TEST_IMAP]', errorMsg)

      // Messages d'erreur plus clairs
      let userMessage = errorMsg
      if (errorMsg.includes('AUTHENTICATE FAILED') || errorMsg.includes('Invalid credentials')) {
        userMessage = 'Identifiants incorrects. Vérifiez votre email et mot de passe d\'application.'
      } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
        userMessage = `Serveur "${imapHost}" introuvable. Vérifiez l'adresse du serveur IMAP.`
      } else if (errorMsg.includes('ECONNREFUSED')) {
        userMessage = `Connexion refusée par ${imapHost}:${imapPort || 993}. Vérifiez le port et le serveur.`
      } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout')) {
        userMessage = `Délai d'attente dépassé pour ${imapHost}. Le serveur ne répond pas.`
      } else if (errorMsg.includes('SSL') || errorMsg.includes('TLS') || errorMsg.includes('certificate')) {
        userMessage = 'Erreur de certificat SSL/TLS. Essayez de désactiver TLS si le serveur ne le supporte pas.'
      } else if (errorMsg.includes('Too many login') || errorMsg.includes('rate limit')) {
        userMessage = 'Trop de tentatives de connexion. Réessayez dans quelques minutes.'
      }

      results.imap = { success: false, message: userMessage }
    }

    // Test SMTP
    try {
      // Avertissement : Vercel bloque le port 465 (SSL direct). Utiliser 587 (STARTTLS).
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
      console.error('[EMAIL_TEST_SMTP]', errorMsg)

      let userMessage = errorMsg
      if (errorMsg.includes('Invalid login') || errorMsg.includes('AUTH') || errorMsg.includes('credentials')) {
        userMessage = 'Identifiants SMTP incorrects. Vérifiez votre email et mot de passe d\'application.'
      } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
        userMessage = `Serveur "${smtpHost}" introuvable. Vérifiez l'adresse du serveur SMTP.`
      } else if (errorMsg.includes('ECONNREFUSED')) {
        userMessage = `Connexion refusée par ${smtpHost}:${smtpPort || 587}. Vérifiez le port et le serveur.`
      } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout')) {
        userMessage = `Délai d'attente dépassé pour ${smtpHost}. Le serveur ne répond pas.`
      } else if (errorMsg.includes('SSL') || errorMsg.includes('TLS') || errorMsg.includes('certificate')) {
        userMessage = 'Erreur de certificat SSL/TLS. Essayez le port 465 avec SSL ou le port 587 avec STARTTLS.'
      } else if (errorMsg.includes('EHOSTUNREACH') || errorMsg.includes('EPIPE') || errorMsg.includes('connection reset') || errorMsg.includes('socket hang up')) {
        userMessage = `Impossible de se connecter à ${smtpHost}:${smtpPort || 587}. Le port ${smtpPort} peut être bloqué par l'hébergeur. Essayez le port 587 (STARTTLS) au lieu de 465 (SSL).`
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
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
