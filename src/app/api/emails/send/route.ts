import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { sendEmail, saveToImapSent } from '@/lib/email'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// POST /api/emails/send - Envoyer un email
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const { to, cc, bcc, subject, text, html, replyTo, inReplyTo } = body

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

    // Use the centralised sendEmail utility
    // It will try personal SMTP config first, then fall back to company Office 365
    const result = await sendEmail(authUser.employeId, {
      to,
      cc,
      bcc,
      subject,
      text,
      html,
      replyTo,
      inReplyTo,
      fromName: authUser.employeNom,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Impossible d'envoyer l'email" },
        { status: 500 }
      )
    }

    // ── Sauvegarder la copie dans le dossier IMAP "Envoyés" ─────
    // Only if the employee has a personal IMAP config
    let savedToImap = false
    const emailConfig = await db.emailConfig.findUnique({
      where: { employeId: authUser.employeId },
    })

    if (emailConfig?.imapHost && emailConfig?.emailPassword) {
      savedToImap = await saveToImapSent(
        {
          imapHost: emailConfig.imapHost,
          imapPort: emailConfig.imapPort,
          imapTls: emailConfig.imapTls,
          email: emailConfig.email,
          emailPassword: emailConfig.emailPassword,
        },
        {
          from: result.from || '',
          to,
          cc,
          subject,
          text,
          html,
          replyTo,
          messageId: result.messageId,
        }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      savedToImap,
      method: result.method,
    })
  } catch (error) {
    console.error('[EMAIL_SEND_POST]', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'

    return NextResponse.json(
      { error: "Impossible d'envoyer l'email", details: message },
      { status: 500 }
    )
  }
}
