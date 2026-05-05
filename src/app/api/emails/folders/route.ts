import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { ImapFlow } from 'imapflow'

// GET /api/emails/folders - Lister les dossiers email
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

      const folders: { name: string; path: string; count: number; unseen: number; specialUse: string }[] = []

      const mailboxes = await client.list()
      for (const mailbox of mailboxes) {
        try {
          const status = await client.status(mailbox.path, { messages: true, unseen: true })
          folders.push({
            name: mailbox.name,
            path: mailbox.path,
            count: status.messages || 0,
            unseen: status.unseen || 0,
            specialUse: mailbox.specialUse || '',
          })
        } catch {
          // Some folders might not support STATUS
          folders.push({
            name: mailbox.name,
            path: mailbox.path,
            count: 0,
            unseen: 0,
            specialUse: mailbox.specialUse || '',
          })
        }
      }

      await client.logout()

      // Trier : INBOX en premier, puis Sent, puis Drafts, puis Trash, puis le reste
      const priorityOrder: Record<string, number> = {
        '\\Inbox': 1,
        '\\Sent': 2,
        '\\Drafts': 3,
        '\\Trash': 4,
        '\\Junk': 5,
        '\\Spam': 5,
      }

      folders.sort((a, b) => {
        const aPriority = priorityOrder[a.specialUse] || 99
        const bPriority = priorityOrder[b.specialUse] || 99
        if (aPriority !== bPriority) return aPriority - bPriority
        if (a.path === 'INBOX') return -1
        if (b.path === 'INBOX') return 1
        return a.name.localeCompare(b.name)
      })

      return NextResponse.json({ folders })
    } catch (imapError: unknown) {
      const errorMsg = imapError instanceof Error ? imapError.message : 'Erreur de connexion IMAP'
      console.error('[EMAIL_FOLDERS_IMAP]', errorMsg)

      // Messages d'erreur plus clairs
      let userMessage = 'Impossible de se connecter au serveur email'
      if (errorMsg.includes('AUTHENTICATE FAILED') || errorMsg.includes('Invalid credentials')) {
        userMessage = 'Identifiants incorrects. Vérifiez votre email et mot de passe d\'application dans les paramètres.'
      } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
        userMessage = `Serveur IMAP "${emailConfig.imapHost}" introuvable. Vérifiez la configuration.`
      } else if (errorMsg.includes('ECONNREFUSED')) {
        userMessage = `Connexion IMAP refusée par ${emailConfig.imapHost}:${emailConfig.imapPort}. Vérifiez le port.`
      } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout')) {
        userMessage = `Le serveur IMAP ${emailConfig.imapHost} ne répond pas. Réessayez plus tard.`
      }

      return NextResponse.json(
        { error: userMessage, details: errorMsg },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[EMAIL_FOLDERS_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
