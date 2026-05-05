import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { ImapFlow } from 'imapflow'

// GET /api/emails/message - Lire un email spécifique
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const emailConfig = await db.emailConfig.findUnique({
      where: { employeId: authUser.employeId },
    })

    if (!emailConfig || !emailConfig.imapHost || !emailConfig.emailPassword) {
      return NextResponse.json({ error: 'Configuration email manquante' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const folder = searchParams.get('folder') || 'INBOX'
    const uid = searchParams.get('uid')

    if (!uid) {
      return NextResponse.json({ error: 'UID du message requis' }, { status: 400 })
    }

    const client = new ImapFlow({
      host: emailConfig.imapHost,
      port: emailConfig.imapPort,
      secure: emailConfig.imapTls,
      auth: {
        user: emailConfig.email,
        pass: emailConfig.emailPassword,
      },
      logger: false as unknown as undefined,
    })

    try {
      await client.connect()

      const lock = await client.getMailboxLock(folder)

      try {
        // Récupérer le message complet
        const msgData = await client.fetchOne(uid, {
          envelope: true,
          flags: true,
          uid: true,
          source: true,
        }, { uid: true })

        // Marquer comme lu
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true })

        lock.release()
        await client.logout()

        // Parser le source pour extraire le texte et HTML
        const source = msgData.source?.toString('utf-8') || ''
        
        // Extraire les parties texte et HTML du source
        let textContent = ''
        let htmlContent = ''
        
        // Simple extraction : chercher les boundaries et les parties
        const textMatch = source.match(/Content-Type:\s*text\/plain[\s\S]*?\r\n\r\n([\s\S]*?)(?=\r\n--|$)/i)
        const htmlMatch = source.match(/Content-Type:\s*text\/html[\s\S]*?\r\n\r\n([\s\S]*?)(?=\r\n--|$)/i)
        
        if (htmlMatch) {
          htmlContent = htmlMatch[1]
          // Nettoyer les encodages quoted-printable
          htmlContent = htmlContent.replace(/=\r?\n/g, '')
          htmlContent = htmlContent.replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        } else if (textMatch) {
          textContent = textMatch[1]
          textContent = textContent.replace(/=\r?\n/g, '')
          textContent = textContent.replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        } else {
          // Pas de multipart, essayer de prendre tout le contenu
          const bodyStart = source.indexOf('\r\n\r\n')
          if (bodyStart > -1) {
            textContent = source.substring(bodyStart + 4)
            textContent = textContent.replace(/=\r?\n/g, '')
            textContent = textContent.replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
          }
        }

        return NextResponse.json({
          uid: msgData.uid,
          flags: msgData.flags,
          envelope: msgData.envelope,
          textContent,
          htmlContent,
          isHtml: !!htmlContent,
        })
      } finally {
        lock.release()
      }
    } catch (imapError: unknown) {
      const errorMsg = imapError instanceof Error ? imapError.message : 'Erreur de connexion IMAP'
      console.error('[EMAIL_MESSAGE_IMAP]', errorMsg)
      return NextResponse.json(
        { error: 'Impossible de lire le message', details: errorMsg },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[EMAIL_MESSAGE_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/emails/message - Supprimer un email
export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const emailConfig = await db.emailConfig.findUnique({
      where: { employeId: authUser.employeId },
    })

    if (!emailConfig || !emailConfig.imapHost || !emailConfig.emailPassword) {
      return NextResponse.json({ error: 'Configuration email manquante' }, { status: 400 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const { folder, uid } = body
    if (!folder || !uid) {
      return NextResponse.json({ error: 'Dossier et UID requis' }, { status: 400 })
    }

    const client = new ImapFlow({
      host: emailConfig.imapHost,
      port: emailConfig.imapPort,
      secure: emailConfig.imapTls,
      auth: {
        user: emailConfig.email,
        pass: emailConfig.emailPassword,
      },
      logger: false as unknown as undefined,
    })

    try {
      await client.connect()

      const lock = await client.getMailboxLock(folder)
      try {
        // Marquer comme supprimé
        await client.messageFlagsAdd(uid, ['\\Deleted'], { uid: true })
        // Expunger
        await client.expunge()
        lock.release()
      } finally {
        lock.release()
      }

      await client.logout()
      return NextResponse.json({ success: true })
    } catch (imapError: unknown) {
      const errorMsg = imapError instanceof Error ? imapError.message : 'Erreur IMAP'
      console.error('[EMAIL_MESSAGE_DELETE_IMAP]', errorMsg)
      return NextResponse.json(
        { error: 'Impossible de supprimer le message', details: errorMsg },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[EMAIL_MESSAGE_DELETE]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
