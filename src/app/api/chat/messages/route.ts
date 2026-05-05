import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'

// POST /api/chat/messages - Envoyer un message
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const employeId = authUser.employeId

    // Vérifier que l'employé existe encore
    const employeeExists = await db.employee.findUnique({ where: { id: employeId }, select: { id: true } })
    if (!employeeExists) {
      return staleSessionResponse()
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }
    const { conversationId, contenu } = body

    if (!conversationId) {
      return NextResponse.json(
        { error: 'L\'identifiant de la conversation est requis' },
        { status: 400 }
      )
    }

    if (!contenu || typeof contenu !== 'string' || contenu.trim().length === 0) {
      return NextResponse.json(
        { error: 'Le contenu du message est requis' },
        { status: 400 }
      )
    }

    // Vérifier que l'expéditeur est participant de la conversation
    const participant = await db.chatParticipant.findUnique({
      where: {
        conversationId_employeId: {
          conversationId,
          employeId,
        },
      },
    })

    if (!participant) {
      return NextResponse.json(
        { error: 'Vous n\'êtes pas participant de cette conversation' },
        { status: 403 }
      )
    }

    // Créer le message et mettre à jour la conversation dans une transaction
    const message = await db.$transaction(async (tx) => {
      const msg = await tx.chatMessage.create({
        data: {
          conversationId,
          expediteurId: employeId,
          contenu: contenu.trim(),
        },
        include: {
          expediteur: {
            select: {
              id: true,
              nom: true,
            },
          },
        },
      })

      // Mettre à jour le updatedAt de la conversation pour le tri
      await tx.chatConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      })

      return msg
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('[CHAT_MESSAGES_POST]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
