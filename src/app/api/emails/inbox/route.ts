import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
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
        // Recherche - use search() to get matching UIDs for total count
        let searchQuery: Record<string, unknown> = {}
        if (search) {
          searchQuery = { or: [{ from: search }, { subject: search }, { to: search }] }
        }

        const searchResult = await client.search(searchQuery, { uid: true })
        const matchingUids = Array.isArray(searchResult) ? searchResult : []
        const total = matchingUids.length

        if (total === 0) {
          lock.release()
          await client.logout()
          return NextResponse.json({ messages: [], total: 0, page, totalPages: 0 })
        }

        // Calculate pagination range from matching UIDs (newest first)
        const startIdx = Math.max(0, total - (page * limit))
        const endIdx = total - ((page - 1) * limit)
        const pageUids = matchingUids.slice(startIdx, endIdx).reverse()

        // Fetch messages for the page UIDs
        const messages: Record<string, unknown>[] = []
        const uidRange = pageUids.join(',')

        if (uidRange) {
          for await (const msg of client.fetch(uidRange, {
            envelope: true,
            flags: true,
            uid: true,
            bodyStructure: true,
          }, { uid: true })) {
            messages.push({
              uid: msg.uid,
              flags: msg.flags ? [...msg.flags] : [],
              envelope: msg.envelope,
              bodyStructure: msg.bodyStructure,
            })
          }
        }

        // Sort by UID descending (newest first) since UIDs are ascending
        messages.sort((a, b) => (b.uid as number) - (a.uid as number))

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
