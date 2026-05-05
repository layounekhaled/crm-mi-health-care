import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'

// GET /api/chat/messages/latest - Récupérer les nouveaux messages depuis un timestamp (polling)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const employeId = authUser.employeId
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since')

    if (!since) {
      return NextResponse.json(
        { error: 'Le paramètre "since" est requis (date ISO)' },
        { status: 400 }
      )
    }

    const sinceDate = new Date(since)
    if (isNaN(sinceDate.getTime())) {
      return NextResponse.json(
        { error: 'Format de date invalide pour "since"' },
        { status: 400 }
      )
    }

    // Récupérer les identifiants des conversations de l'employé
    const userConversations = await db.chatParticipant.findMany({
      where: { employeId },
      select: { conversationId: true },
    })

    const conversationIds = userConversations.map((uc) => uc.conversationId)

    if (conversationIds.length === 0) {
      return NextResponse.json({ messages: [] })
    }

    // Récupérer les messages créés après le timestamp dans les conversations de l'employé
    const messages = await db.chatMessage.findMany({
      where: {
        conversationId: { in: conversationIds },
        createdAt: { gt: sinceDate },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        expediteur: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('[CHAT_MESSAGES_LATEST_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
