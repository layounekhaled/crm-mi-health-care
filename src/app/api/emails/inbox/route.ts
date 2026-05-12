import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { ImapFlow } from 'imapflow'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

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
        let searchResult
        if (search) {
          searchResult = await client.search(
            { or: [{ from: search }, { subject: search }, { to: search }] },
            { uid: true }
          )
        } else {
          searchResult = await client.search(true, { uid: true })
        }

        const matchingUids = Array.isArray(searchResult) ? searchResult : []
        const total = matchingUids.length

        if (total === 0) {
          lock.release()
          await client.logout()
          return NextResponse.json({ messages: [], total: 0, page, totalPages: 0 })
        }

        const startIdx = Math.max(0, total - (page * limit))
        const endIdx = total - ((page - 1) * limit)
        const pageUids = matchingUids.slice(startIdx, endIdx).reverse()

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
        try { lock.release() } catch { /* déjà libéré */ }
        throw innerError
      }
    } catch (imapError: unknown) {
      const errorMsg = imapError instanceof Error ? imapError.message : 'Erreur de connexion IMAP'
      const errorCode = (imapError as any)?.code || ''
      console.error('[EMAIL_INBOX_IMAP]', errorMsg, 'folder:', folder, 'Code:', errorCode)

      let userMessage = 'Impossible de se connecter au serveur email'
      if (errorMsg.includes('AUTHENTICATE FAILED') || errorMsg.includes('Invalid credentials')) {
        userMessage = 'Identifiants incorrects. Vérifiez votre configuration email.'
      } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
        userMessage = `Serveur IMAP "${emailConfig.imapHost}" introuvable.`
      } else if (errorMsg.includes('ECONNREFUSED')) {
        userMessage = `Connexion IMAP refusée par ${emailConfig.imapHost}:${emailConfig.imapPort}.`
      } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout') || errorCode === 'ETIMEDOUT') {
        userMessage = `Le serveur IMAP ne répond pas. Le port ${emailConfig.imapPort} est peut-être bloqué par Vercel.`
      } else if (errorMsg.includes('EHOSTUNREACH') || errorCode === 'EHOSTUNREACH') {
        userMessage = `Impossible de joindre le serveur IMAP. Port probablement bloqué par Vercel.`
      } else if (errorMsg.includes('Mailbox') && (errorMsg.includes('not found') || errorMsg.includes('doesn\'t exist') || errorMsg.includes('NONEXISTENT'))) {
        userMessage = `Le dossier "${folder}" n'existe pas sur le serveur.`
      }

      return NextResponse.json(
        { error: userMessage, details: errorMsg, code: errorCode },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[EMAIL_INBOX_GET]', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    const code = (error as any)?.code || ''
    return NextResponse.json({ error: 'Erreur serveur', details: message, code }, { status: 500 })
  }
}
