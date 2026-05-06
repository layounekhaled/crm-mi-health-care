import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import nodemailer from 'nodemailer'

// POST /api/documents/send - Envoyer des documents par email
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { documentIds, recipientType, recipientId, recipientEmail, message } = body

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'Au moins un document est requis' }, { status: 400 })
    }

    if (!recipientEmail) {
      return NextResponse.json({ error: 'Email du destinataire requis' }, { status: 400 })
    }

    // Fetch documents
    const documents = await db.document.findMany({
      where: {
        id: { in: documentIds },
        status: 'active',
      },
    })

    if (documents.length === 0) {
      return NextResponse.json({ error: 'Aucun document actif trouvé' }, { status: 404 })
    }

    // Get email config for sender
    const emailConfig = await db.emailConfig.findUnique({
      where: { employeId: authUser.employeId },
    })

    if (!emailConfig || !emailConfig.smtpHost || !emailConfig.emailPassword) {
      return NextResponse.json(
        { error: 'Configuration email manquante. Configurez votre email d\'abord.' },
        { status: 400 }
      )
    }

    // Build email content with links (NOT attachments)
    const documentLinks = documents
      .map((doc, i) => `${i + 1}. <strong>${doc.title}</strong>${doc.brand ? ` (${doc.brand})` : ''} — <a href="${doc.fileUrl}" target="_blank">Voir / Télécharger</a>`)
      .join('<br/>')

    const senderName = authUser.employeNom || emailConfig.email
    const emailSubject = documents.length === 1
      ? `Document : ${documents[0].title}`
      : `${documents.length} documents partagés - MI HEALTH CARE`

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #134885; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 18px;">MI HEALTH CARE</h2>
          <p style="margin: 5px 0 0; font-size: 13px; opacity: 0.85;">${senderName} vous a partagé des documents</p>
        </div>
        <div style="padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          ${message ? `<p style="margin: 0 0 15px; padding: 12px; background: white; border-left: 3px solid #F6852A; border-radius: 4px;">${message.replace(/\n/g, '<br/>')}</p>` : ''}
          <h3 style="margin: 0 0 10px; font-size: 15px; color: #134885;">Documents :</h3>
          <div style="padding: 12px; background: white; border-radius: 4px; border: 1px solid #e2e8f0;">
            ${documentLinks}
          </div>
          <p style="margin: 15px 0 0; font-size: 12px; color: #94a3b8;">Cliquez sur les liens ci-dessus pour consulter ou télécharger les documents.</p>
        </div>
        <div style="margin-top: 10px; text-align: center; font-size: 11px; color: #94a3b8;">
          Envoyé via DALIA CRM — MI HEALTH CARE
        </div>
      </div>
    `

    // Send email
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

    await transporter.sendMail({
      from: `"${senderName}" <${emailConfig.email}>`,
      to: recipientEmail,
      subject: emailSubject,
      html: emailHtml,
    })

    transporter.close()

    // Record the send
    const documentSend = await db.documentSend.create({
      data: {
        documentIds: JSON.stringify(documentIds),
        sentBy: authUser.employeId,
        recipientType: recipientType || 'manual',
        recipientId: recipientId || null,
        recipientEmail,
        message: message || null,
        status: 'sent',
      },
    })

    // Add interaction to prospect/client if applicable
    if (recipientId && (recipientType === 'prospect' || recipientType === 'client')) {
      const docNames = documents.map(d => d.title).join(', ')
      await db.interaction.create({
        data: {
          type: 'email',
          prospectId: recipientId,
          notes: `Documents envoyés : ${docNames}`,
          employeId: authUser.employeId,
        },
      })
    }

    return NextResponse.json({ data: documentSend })
  } catch (error) {
    console.error('[DOCUMENTS_SEND_POST]', error)
    const errMessage = error instanceof Error ? error.message : 'Erreur inconnue'

    let userMessage = "Impossible d'envoyer l'email"
    if (errMessage.includes('Invalid login') || errMessage.includes('AUTH') || errMessage.includes('credentials')) {
      userMessage = 'Identifiants SMTP incorrects.'
    } else if (errMessage.includes('ENOTFOUND') || errMessage.includes('getaddrinfo')) {
      userMessage = 'Serveur SMTP introuvable.'
    }

    // Record failed send
    try {
      const authUser = await getAuthUser(request)
      if (authUser?.employeId) {
        const body2 = await request.clone().json().catch(() => ({}))
        await db.documentSend.create({
          data: {
            documentIds: JSON.stringify(body2.documentIds || []),
            sentBy: authUser.employeId,
            recipientType: body2.recipientType || 'manual',
            recipientId: body2.recipientId || null,
            recipientEmail: body2.recipientEmail || '',
            message: body2.message || null,
            status: 'failed',
          },
        })
      }
    } catch {}

    return NextResponse.json({ error: userMessage }, { status: 500 })
  }
}
