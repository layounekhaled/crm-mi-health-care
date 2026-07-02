import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { getPublicUrl } from '@/lib/storage-utils'

// Resolve a fileUrl to an absolute URL that email recipients can access
function resolveDocumentUrl(fileUrl: string, request: NextRequest): string {
  // If already an absolute URL (legacy Vercel Blob), return as-is
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl
  }
  // For relative paths like /api/files/mir/123_file.pdf, make them absolute
  // Use NEXTAUTH_URL as the base (set to https://dalia.fret.direct in production)
  const baseUrl = process.env.NEXTAUTH_URL
    || (request.headers.get('host') ? `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}` : '')
  if (baseUrl && fileUrl.startsWith('/')) {
    return `${baseUrl}${fileUrl}`
  }
  // Fallback: use getPublicUrl (returns /api/files/... path)
  return getPublicUrl(fileUrl)
}

// POST /api/documents/send - Envoyer des documents par email ou WhatsApp
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { documentIds, sendMethod, recipientType, recipientId, recipientEmail, recipientPhone, message } = body

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'Au moins un document est requis' }, { status: 400 })
    }

    const method = sendMethod || 'email'

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

    // WhatsApp send: just record it (the actual WhatsApp opening happens client-side via wa.me link)
    if (method === 'whatsapp') {
      const phone = (recipientPhone || '').replace(/[^0-9+]/g, '')
      if (!phone) {
        return NextResponse.json({ error: 'Numéro de téléphone requis pour WhatsApp' }, { status: 400 })
      }

      const documentSend = await db.documentSend.create({
        data: {
          documentIds: JSON.stringify(documentIds),
          sentBy: authUser.employeId,
          sendMethod: 'whatsapp',
          recipientType: recipientType || 'manual',
          recipientId: recipientId || null,
          recipientEmail: '',
          recipientPhone: phone,
          message: message || null,
          status: 'sent',
        },
      })

      // Add interaction to prospect/client if applicable
      if (recipientId && (recipientType === 'prospect' || recipientType === 'client')) {
        const docNames = documents.map(d => d.title).join(', ')
        await db.interaction.create({
          data: {
            type: 'whatsapp',
            prospectId: recipientId,
            notes: `Documents envoyés via WhatsApp : ${docNames}`,
            employeId: authUser.employeId,
          },
        })
      }

      return NextResponse.json({ data: documentSend })
    }

    // Email send (default)
    if (!recipientEmail) {
      return NextResponse.json({ error: 'Email du destinataire requis' }, { status: 400 })
    }

    // Build email content with links (NOT attachments)
    // Resolve relative URLs to absolute URLs so email recipients can access them
    const documentLinks = documents
      .map((doc, i) => `${i + 1}. <strong>${doc.title}</strong>${doc.brand ? ` (${doc.brand})` : ''} — <a href="${resolveDocumentUrl(doc.fileUrl, request)}" target="_blank">Voir / Télécharger</a>`)
      .join('<br/>')

    const senderName = authUser.employeNom || 'MI HEALTH CARE'
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

    // Use the centralised sendEmail utility (personal SMTP or Office 365 fallback)
    const result = await sendEmail(authUser.employeId, {
      to: recipientEmail,
      subject: emailSubject,
      html: emailHtml,
      fromName: senderName,
    })

    if (!result.success) {
      // Record failed send
      try {
        await db.documentSend.create({
          data: {
            documentIds: JSON.stringify(documentIds),
            sentBy: authUser.employeId,
            sendMethod: 'email',
            recipientType: recipientType || 'manual',
            recipientId: recipientId || null,
            recipientEmail,
            recipientPhone: '',
            message: message || null,
            status: 'failed',
          },
        })
      } catch {}

      return NextResponse.json(
        { error: result.error || "Impossible d'envoyer l'email" },
        { status: 500 }
      )
    }

    // Record the send
    const documentSend = await db.documentSend.create({
      data: {
        documentIds: JSON.stringify(documentIds),
        sentBy: authUser.employeId,
        sendMethod: 'email',
        recipientType: recipientType || 'manual',
        recipientId: recipientId || null,
        recipientEmail,
        recipientPhone: '',
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

    return NextResponse.json({ data: documentSend, emailMethod: result.method })
  } catch (error) {
    console.error('[DOCUMENTS_SEND_POST]', error)
    const errMessage = error instanceof Error ? error.message : 'Erreur inconnue'

    // Record failed send
    try {
      const authUser = await getAuthUser(request)
      if (authUser?.employeId) {
        const body2 = await request.clone().json().catch(() => ({}))
        await db.documentSend.create({
          data: {
            documentIds: JSON.stringify(body2.documentIds || []),
            sentBy: authUser.employeId,
            sendMethod: body2.sendMethod || 'email',
            recipientType: body2.recipientType || 'manual',
            recipientId: body2.recipientId || null,
            recipientEmail: body2.recipientEmail || '',
            recipientPhone: body2.recipientPhone || '',
            message: body2.message || null,
            status: 'failed',
          },
        })
      }
    } catch {}

    return NextResponse.json({ error: "Impossible d'envoyer l'email", details: errMessage }, { status: 500 })
  }
}
