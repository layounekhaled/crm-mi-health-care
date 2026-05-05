import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { ImapFlow } from 'imapflow'

// GET /api/emails/inbox - Récupérer les emails d'un dossier
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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const search = searchParams.get('search') || ''

    const client = new ImapFlow({
      host: emailConfig.imapHost,
      port: emailConfig.imapPort,
      secure: emailConfig.imapTls,
      auth: {
        user: emailConfig.email,
        pass: emailConfig.emailPassword,
      },
      logger: false as unknown as undefined,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    })

    try {
      await client.connect()

      const lock = await client.getMailboxLock(folder)

      try {
        // Recherche
        let searchCriteria: Record<string, unknown> | string = {}
        if (search) {
          searchCriteria = { or: [{ from: search }, { subject: search }, { to: search }] }
        }

        const totalMessages = await client.messageFlags(folder, searchCriteria, { uid: true })

        // Fetch messages for the page
        const messages: Record<string, unknown>[] = []
        const total = totalMessages.length || 0
        const startSeq = Math.max(1, total - (page * limit) + 1)
        const endSeq = total - ((page - 1) * limit)

        if (endSeq < 1) {
          lock.release()
          await client.logout()
          return NextResponse.json({ messages: [], total: 0, page, totalPages: 0 })
        }

        // Utiliser fetch pour récupérer les en-têtes
        const range = `${Math.max(1, startSeq)}:${Math.max(1, endSeq)}`

        for await (const msg of client.fetch(range, {
          envelope: true,
          flags: true,
          uid: true,
          bodyStructure: true,
        })) {
          messages.push({
            uid: msg.uid,
            flags: msg.flags,
            envelope: msg.envelope,
            bodyStructure: msg.bodyStructure,
          })
        }

        // Inverser pour avoir les plus récents en premier
        messages.reverse()

        lock.release()
        await client.logout()

        const totalPages = Math.ceil(total / limit)

        return NextResponse.json({
          messages,
          total,
          page,
          totalPages,
        })
      } catch (innerError) {
        // S'assurer que le lock est libéré en cas d'erreur
        try { lock.release() } catch { /* déjà libéré */ }
        throw innerError
      }
    } catch (imapError: unknown) {
      const errorMsg = imapError instanceof Error ? imapError.message : 'Erreur de connexion IMAP'
      console.error('[EMAIL_INBOX_IMAP]', errorMsg)

      let userMessage = 'Impossible de se connecter au serveur email'
      if (errorMsg.includes('AUTHENTICATE FAILED') || errorMsg.includes('Invalid credentials')) {
        userMessage = 'Identifiants incorrects. Vérifiez votre configuration email.'
      } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
        userMessage = `Serveur IMAP "${emailConfig.imapHost}" introuvable.`
      } else if (errorMsg.includes('ECONNREFUSED')) {
        userMessage = `Connexion IMAP refusée par ${emailConfig.imapHost}:${emailConfig.imapPort}.`
      } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout')) {
        userMessage = `Le serveur IMAP ${emailConfig.imapHost} ne répond pas.`
      }

      return NextResponse.json(
        { error: userMessage, details: errorMsg },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[EMAIL_INBOX_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
