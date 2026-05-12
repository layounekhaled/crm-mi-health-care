import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import nodemailer from 'nodemailer'
import { ImapFlow } from 'imapflow'

// POST /api/emails/send - Envoyer un email
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const emailConfig = await db.emailConfig.findUnique({
      where: { employeId: authUser.employeId },
    })

    if (!emailConfig || !emailConfig.smtpHost || !emailConfig.emailPassword) {
      return NextResponse.json({ error: 'Configuration email manquante' }, { status: 400 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const { to, cc, bcc, subject, text, html, replyTo } = body

    if (!to || !subject) {
      return NextResponse.json(
        { error: 'Destinataire et sujet sont requis' },
        { status: 400 }
      )
    }

    if (!text && !html) {
      return NextResponse.json(
        { error: 'Le contenu du message est requis' },
        { status: 400 }
      )
    }

    const fromAddress = `"${authUser.employeNom || emailConfig.email}" <${emailConfig.email}>`

    // Créer le transporteur SMTP
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
      socketTimeout: 30000,
    })

    // Envoyer l'email via SMTP
    const info = await transporter.sendMail({
      from: fromAddress,
      to: Array.isArray(to) ? to.join(', ') : to,
      cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
      bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined,
      subject,
      text: text || '',
      html: html || undefined,
      replyTo: replyTo || undefined,
    })

    transporter.close()

    // ── Sauvegarder la copie dans le dossier IMAP "Envoyés" ─────
    // On le fait après l'envoi SMTP pour ne pas bloquer l'envoi si l'append IMAP échoue
    let savedToImap = false
    try {
      // Construire le message MIME brut (sans BCC pour la confidentialité)
      const MailComposer = require('nodemailer/lib/mail-composer')
      const composer = new MailComposer({
        from: fromAddress,
        to: Array.isArray(to) ? to.join(', ') : to,
        cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
        // Ne pas inclure BCC dans la copie sauvegardée (confidentialité)
        subject,
        text: text || '',
        html: html || undefined,
        replyTo: replyTo || undefined,
        date: new Date(),
        messageId: info.messageId,
      })

      const mimeNode = composer.compile()
      const rawMessage = await new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = []
        const stream = mimeNode.createReadStream()
        stream.on('data', (chunk: Buffer) => chunks.push(chunk))
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
        stream.on('error', reject)
      })

      // Se connecter à IMAP pour trouver le dossier Envoyés et y ajouter le message
      if (emailConfig.imapHost) {
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
          socketTimeout: 30000,
        })

        await imapClient.connect()

        // Trouver le dossier "Envoyés" (le nom varie selon le fournisseur)
        const mailboxes = await imapClient.list()
        const sentFolder = mailboxes.find(m =>
          m.specialUse === '\\Sent' ||
          ['Sent', 'Sent Messages', 'Envoyés', 'Éléments envoyés', '[Gmail]/Sent Mail', 'INBOX.Sent', 'INBOX.Sent Messages'].includes(m.path)
        )

        if (sentFolder) {
          // ImapFlow.append(path, content, flags, idate)
          // path = dossier cible, content = Buffer du message MIME, flags = tableau de flags
          const contentBuffer = Buffer.from(rawMessage, 'utf-8')
          await imapClient.append(sentFolder.path, contentBuffer, ['\\Seen'], new Date())
          savedToImap = true
        } else {
          console.warn('[EMAIL_SEND_IMAP_APPEND] Dossier Envoyés non trouvé. Dossiers disponibles:', mailboxes.map(m => m.path).join(', '))
        }

        await imapClient.logout()
      }
    } catch (imapAppendError) {
      // Ne pas faire échouer l'envoi si la sauvegarde IMAP échoue
      console.error('[EMAIL_SEND_IMAP_APPEND] Erreur sauvegarde IMAP:', imapAppendError)
    }

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      savedToImap,
    })
  } catch (error) {
    console.error('[EMAIL_SEND_POST]', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'

    let userMessage = "Impossible d'envoyer l'email"
    if (message.includes('Invalid login') || message.includes('AUTH') || message.includes('credentials')) {
      userMessage = 'Identifiants SMTP incorrects. Vérifiez votre configuration email.'
    } else if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
      userMessage = `Serveur SMTP introuvable. Vérifiez la configuration.`
    } else if (message.includes('ECONNREFUSED')) {
      userMessage = 'Connexion SMTP refusée. Vérifiez le port et le serveur.'
    }

    return NextResponse.json(
      { error: userMessage, details: message },
      { status: 500 }
    )
  }
}
