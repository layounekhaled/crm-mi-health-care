import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

export const maxDuration = 60

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

    const { ImapFlow } = await import('imapflow')
    const { simpleParser } = await import('mailparser')

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
      tls: { rejectUnauthorized: false },
      logger: false as unknown as undefined,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    })

    try {
      await client.connect()

      const lock = await client.getMailboxLock(folder)

      try {
        const msgData = await client.fetchOne(uid, {
          envelope: true,
          flags: true,
          uid: true,
          source: true,
        }, { uid: true })

        if (!msgData) {
          lock.release()
          await client.logout()
          return NextResponse.json({ error: 'Message non trouvé' }, { status: 404 })
        }

        // Marquer comme lu
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true })

        lock.release()
        await client.logout()

        const source = msgData.source?.toString('utf-8') || ''
        let textContent = ''
        let htmlContent = ''

        try {
          const parsed = await simpleParser(source)
          textContent = parsed.text || ''
          htmlContent = parsed.html || ''
        } catch (parseError) {
          console.error('[EMAIL_MESSAGE_PARSE]', parseError)
          const bodyStart = source.indexOf('\r\n\r\n')
          if (bodyStart > -1) {
            textContent = source.substring(bodyStart + 4)
            textContent = textContent.replace(/=\r?\n/g, '')
            textContent = textContent.replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
          }
        }

        return NextResponse.json({
          uid: msgData.uid,
          flags: msgData.flags ? [...msgData.flags] : [],
          envelope: msgData.envelope,
          textContent,
          htmlContent,
          isHtml: !!htmlContent,
        })
      } catch (innerError) {
        try { lock.release() } catch { /* déjà libéré */ }
        throw innerError
      }
    } catch (imapError: unknown) {
      const errorMsg = imapError instanceof Error ? imapError.message : 'Erreur de connexion IMAP'
      console.error('[EMAIL_MESSAGE_IMAP]', errorMsg)

      let userMessage = 'Impossible de lire le message'
      if (errorMsg.includes('AUTHENTICATE FAILED') || errorMsg.includes('Invalid credentials')) {
        userMessage = 'Identifiants incorrects. Vérifiez votre configuration email.'
      }

      return NextResponse.json(
        { error: userMessage, details: errorMsg },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[EMAIL_MESSAGE_GET]', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: 'Erreur serveur', details: message }, { status: 500 })
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

    const { ImapFlow } = await import('imapflow')

    const client = new ImapFlow({
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

    try {
      await client.connect()

      const lock = await client.getMailboxLock(folder)
      try {
        await client.messageFlagsAdd(uid, ['\\Deleted'], { uid: true })
        await (client as unknown as { expunge: (range?: string, options?: { uid?: boolean }) => Promise<boolean> }).expunge(String(uid), { uid: true })
      } finally {
        try { lock.release() } catch { /* déjà libéré */ }
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
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: 'Erreur serveur', details: message }, { status: 500 })
  }
}
