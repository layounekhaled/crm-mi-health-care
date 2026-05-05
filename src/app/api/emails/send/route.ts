import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import nodemailer from 'nodemailer'

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

    // Créer le transporteur SMTP
    const transporter = nodemailer.createTransport({
      host: emailConfig.smtpHost,
      port: emailConfig.smtpPort,
      secure: emailConfig.smtpPort === 465,
      auth: {
        user: emailConfig.email,
        pass: emailConfig.emailPassword,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    })

    // Envoyer l'email
    const info = await transporter.sendMail({
      from: `"${authUser.employeNom || emailConfig.email}" <${emailConfig.email}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
      bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined,
      subject,
      text: text || '',
      html: html || undefined,
      replyTo: replyTo || undefined,
    })

    transporter.close()

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
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
