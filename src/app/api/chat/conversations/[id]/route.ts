import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'

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

    // Récupérer la conversation avec ses participants et messages
    // On récupère les 50 derniers messages (desc + take) puis on les inverse (asc)
    // pour afficher du plus ancien au plus récent dans le chat
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
          orderBy: { createdAt: 'desc' },
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

    // Inverser l'ordre des messages pour affichage chronologique (ancien → récent)
    conversation.messages = conversation.messages.reverse()

    // NOTE: On NE marque PAS la conversation comme lue ici.
    // Le marquage comme lu se fait via POST /api/chat/conversations/[id]/read
    // uniquement quand l'utilisateur a réellement ouvert la conversation,
    // pour éviter que le compteur de non-lus soit remis à zéro
    // alors que les messages ne sont pas encore affichés.

    return NextResponse.json(conversation, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    })
  } catch (error) {
    console.error('[CHAT_CONVERSATION_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH /api/chat/conversations/[id] - Modifier un groupe (nom, membres)
export async function PATCH(
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

    // Vérifier que c'est un groupe
    const conversation = await db.chatConversation.findUnique({
      where: { id },
      include: { participants: true },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation introuvable' },
        { status: 404 }
      )
    }

    if (conversation.type !== 'group') {
      return NextResponse.json(
        { error: 'Seuls les groupes peuvent être modifiés' },
        { status: 400 }
      )
    }

    // Empêcher la modification du canal Général
    if (conversation.nom === 'Général') {
      return NextResponse.json(
        { error: 'Le canal Général ne peut pas être modifié' },
        { status: 403 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const { nom, addMemberIds, removeMemberIds } = body

    // Modifier le nom si fourni
    if (nom !== undefined && typeof nom === 'string' && nom.trim()) {
      await db.chatConversation.update({
        where: { id },
        data: { nom: nom.trim() },
      })
    }

    // Ajouter des membres
    if (addMemberIds && Array.isArray(addMemberIds) && addMemberIds.length > 0) {
      // Vérifier que les employés existent
      const existingEmployees = await db.employee.findMany({
        where: { id: { in: addMemberIds } },
        select: { id: true },
      })
      const validIds = existingEmployees.map(e => e.id)

      // Filtrer ceux qui ne sont pas déjà participants
      const currentParticipantIds = new Set(conversation.participants.map(p => p.employeId))
      const newMemberIds = validIds.filter(empId => !currentParticipantIds.has(empId))

      if (newMemberIds.length > 0) {
        await db.chatParticipant.createMany({
          data: newMemberIds.map(empId => ({
            conversationId: id,
            employeId: empId,
          })),
        })
      }
    }

    // Retirer des membres
    if (removeMemberIds && Array.isArray(removeMemberIds) && removeMemberIds.length > 0) {
      // Ne pas retirer le dernier membre
      const remainingParticipants = conversation.participants.filter(
        p => !removeMemberIds.includes(p.employeId)
      )
      if (remainingParticipants.length === 0) {
        return NextResponse.json(
          { error: 'Un groupe doit avoir au moins un membre' },
          { status: 400 }
        )
      }

      await db.chatParticipant.deleteMany({
        where: {
          conversationId: id,
          employeId: { in: removeMemberIds },
        },
      })
    }

    // Récupérer la conversation mise à jour
    const updatedConversation = await db.chatConversation.findUnique({
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
          orderBy: { createdAt: 'desc' },
          take: 1,
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

    return NextResponse.json(updatedConversation)
  } catch (error) {
    console.error('[CHAT_CONVERSATION_PATCH]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/chat/conversations/[id] - Supprimer un groupe
export async function DELETE(
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

    // Vérifier que c'est un groupe
    const conversation = await db.chatConversation.findUnique({
      where: { id },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation introuvable' },
        { status: 404 }
      )
    }

    if (conversation.type !== 'group') {
      return NextResponse.json(
        { error: 'Seuls les groupes peuvent être supprimés' },
        { status: 400 }
      )
    }

    // Empêcher la suppression du canal Général
    if (conversation.nom === 'Général') {
      return NextResponse.json(
        { error: 'Le canal Général ne peut pas être supprimé' },
        { status: 403 }
      )
    }

    // Supprimer la conversation (cascade supprime participants et messages)
    await db.chatConversation.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CHAT_CONVERSATION_DELETE]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
