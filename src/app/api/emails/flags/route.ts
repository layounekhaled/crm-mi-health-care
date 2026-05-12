import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

export const maxDuration = 60

// PATCH /api/emails/flags - Modifier les flags d'un email (lu/non-lu, favori)
export async function PATCH(request: NextRequest) {
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

    const { folder, uid, addFlags, removeFlags } = body
    if (!folder || !uid) {
      return NextResponse.json({ error: 'Dossier et UID requis' }, { status: 400 })
    }

    if (!addFlags && !removeFlags) {
      return NextResponse.json({ error: 'Au moins un flag à ajouter ou supprimer est requis' }, { status: 400 })
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
        if (addFlags && Array.isArray(addFlags) && addFlags.length > 0) {
          await client.messageFlagsAdd(uid, addFlags, { uid: true })
        }

        if (removeFlags && Array.isArray(removeFlags) && removeFlags.length > 0) {
          await client.messageFlagsRemove(uid, removeFlags, { uid: true })
        }
      } finally {
        try { lock.release() } catch { /* déjà libéré */ }
      }

      await client.logout()

      return NextResponse.json({ success: true })
    } catch (imapError: unknown) {
      const errorMsg = imapError instanceof Error ? imapError.message : 'Erreur de connexion IMAP'
      console.error('[EMAIL_FLAGS_IMAP]', errorMsg)

      let userMessage = 'Impossible de modifier les flags du message'
      if (errorMsg.includes('AUTHENTICATE FAILED') || errorMsg.includes('Invalid credentials')) {
        userMessage = 'Identifiants incorrects. Vérifiez votre configuration email.'
      } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
        userMessage = `Serveur IMAP "${emailConfig.imapHost}" introuvable.`
      } else if (errorMsg.includes('ECONNREFUSED')) {
        userMessage = `Connexion IMAP refusée par ${emailConfig.imapHost}:${emailConfig.imapPort}.`
      }

      return NextResponse.json(
        { error: userMessage, details: errorMsg },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[EMAIL_FLAGS_PATCH]', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: 'Erreur serveur', details: message }, { status: 500 })
  }
}
