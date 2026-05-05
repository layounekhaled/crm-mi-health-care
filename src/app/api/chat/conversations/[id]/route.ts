import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'

// GET /api/chat/conversations/[id] - Récupérer une conversation avec ses messages (paginés)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const employeId = authUser.employeId
    const { id } = await params

    // Vérifier que l'employé est participant de la conversation
    const participant = await db.chatParticipant.findUnique({
      where: {
        conversationId_employeId: {
          conversationId: id,
          employeId,
        },
      },
    })

    if (!participant) {
      return NextResponse.json(
        { error: 'Conversation introuvable ou accès refusé' },
        { status: 404 }
      )
    }

    // Récupérer la conversation avec ses participants et messages
    const conversation = await db.chatConversation.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            employe: {
              select: {
                id: true,
                nom: true,
                email: true,
                role: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
          include: {
            expediteur: {
              select: {
                id: true,
                nom: true,
              },
            },
          },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation introuvable' },
        { status: 404 }
      )
    }

    // Mettre à jour lastReadAt du participant courant
    await db.chatParticipant.update({
      where: {
        conversationId_employeId: {
          conversationId: id,
          employeId,
        },
      },
      data: {
        lastReadAt: new Date(),
      },
    })

    return NextResponse.json(conversation)
  } catch (error) {
    console.error('[CHAT_CONVERSATION_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
