import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'

// POST /api/chat/conversations/[id]/read - Marquer une conversation comme lue
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Mettre à jour lastReadAt
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CHAT_CONVERSATION_READ_POST]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
