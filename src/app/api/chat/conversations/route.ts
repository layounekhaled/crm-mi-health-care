import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'

// GET /api/chat/conversations - Récupérer toutes les conversations de l'employé courant
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const employeId = authUser.employeId

    // Vérifier que l'employé existe encore (session peut être obsolète après re-seed)
    const employeeExists = await db.employee.findUnique({ where: { id: employeId }, select: { id: true } })
    if (!employeeExists) {
      return staleSessionResponse()
    }

    // Récupérer les conversations où l'employé courant est participant
    const conversations = await db.chatConversation.findMany({
      where: {
        participants: {
          some: { employeId },
        },
      },
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
      orderBy: { updatedAt: 'desc' },
    })

    // Calculer le nombre de messages non lus pour chaque conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const participant = conv.participants.find((p) => p.employeId === employeId)
        if (!participant) {
          return { ...conv, unreadCount: 0 }
        }

        const unreadCount = await db.chatMessage.count({
          where: {
            conversationId: conv.id,
            createdAt: { gt: participant.lastReadAt },
            expediteurId: { not: employeId },
          },
        })

        return { ...conv, unreadCount }
      })
    )

    return NextResponse.json(conversationsWithUnread)
  } catch (error) {
    console.error('[CHAT_CONVERSATIONS_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/chat/conversations - Créer une nouvelle conversation
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const employeId = authUser.employeId

    // Vérifier que l'employé existe encore (session peut être obsolète après re-seed)
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
    const { type, participantIds, nom } = body

    if (!type || !['direct', 'group'].includes(type)) {
      return NextResponse.json(
        { error: 'Le type doit être "direct" ou "group"' },
        { status: 400 }
      )
    }

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return NextResponse.json(
        { error: 'Au moins un participant est requis' },
        { status: 400 }
      )
    }

    // Pour une conversation directe, vérifier si elle existe déjà entre les 2 participants
    if (type === 'direct') {
      if (participantIds.length !== 1) {
        return NextResponse.json(
          { error: 'Une conversation directe ne peut avoir qu\'un seul autre participant' },
          { status: 400 }
        )
      }

      const otherEmployeId = participantIds[0]

      // Vérifier que l'autre employé existe
      const otherEmploye = await db.employee.findUnique({
        where: { id: otherEmployeId },
      })
      if (!otherEmploye) {
        return NextResponse.json(
          { error: 'Employé introuvable' },
          { status: 404 }
        )
      }

      // Chercher une conversation directe existante entre les deux participants
      const existingConversation = await db.chatConversation.findFirst({
        where: {
          type: 'direct',
          participants: {
            every: {
              employeId: { in: [employeId, otherEmployeId] },
            },
          },
        },
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

      // Vérifier qu'il y a exactement 2 participants (pas plus)
      if (
        existingConversation &&
        existingConversation.participants.length === 2
      ) {
        // Calculer les non lus pour la conversation existante
        const participant = existingConversation.participants.find(
          (p) => p.employeId === employeId
        )
        const unreadCount = participant
          ? await db.chatMessage.count({
              where: {
                conversationId: existingConversation.id,
                createdAt: { gt: participant.lastReadAt },
                expediteurId: { not: employeId },
              },
            })
          : 0

        return NextResponse.json({ ...existingConversation, unreadCount })
      }
    }

    // Pour un groupe, le nom est requis
    if (type === 'group' && !nom) {
      return NextResponse.json(
        { error: 'Le nom est requis pour une conversation de groupe' },
        { status: 400 }
      )
    }

    // Vérifier que tous les participants existent
    const participants = await db.employee.findMany({
      where: {
        id: { in: participantIds },
      },
    })
    if (participants.length !== participantIds.length) {
      return NextResponse.json(
        { error: 'Un ou plusieurs employés introuvables' },
        { status: 404 }
      )
    }

    // Créer la conversation avec les participants
    const allParticipantIds = [...new Set([employeId, ...participantIds])]

    const conversation = await db.chatConversation.create({
      data: {
        type,
        nom: type === 'group' ? nom : null,
        participants: {
          create: allParticipantIds.map((id) => ({
            employeId: id,
          })),
        },
      },
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

    return NextResponse.json({ ...conversation, unreadCount: 0 }, { status: 201 })
  } catch (error) {
    console.error('[CHAT_CONVERSATIONS_POST]', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: 'Erreur serveur', details: message }, { status: 500 })
  }
}
