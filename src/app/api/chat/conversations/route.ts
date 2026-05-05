import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'

// Constante pour le canal Général
const GENERAL_CHANNEL_NAME = 'Général'

/**
 * S'assurer que le canal Général existe et que l'employé y est participant.
 * Si le canal n'existe pas, le créer avec tous les employés actifs.
 * Si le canal existe mais que l'employé n'y est pas, l'ajouter.
 */
async function ensureGeneralChannel(employeId: string) {
  try {
    // Chercher le canal Général existant
    let generalConv = await db.chatConversation.findFirst({
      where: { type: 'group', nom: GENERAL_CHANNEL_NAME },
      include: {
        participants: {
          select: { employeId: true },
        },
      },
    })

    if (!generalConv) {
      // Créer le canal Général avec tous les employés actifs
      const allEmployees = await db.employee.findMany({
        where: { actif: true },
        select: { id: true },
      })

      generalConv = await db.chatConversation.create({
        data: {
          type: 'group',
          nom: GENERAL_CHANNEL_NAME,
          participants: {
            create: allEmployees.map((emp) => ({ employeId: emp.id })),
          },
        },
        include: {
          participants: {
            select: { employeId: true },
          },
        },
      })
    } else {
      // Vérifier que l'employé courant est participant
      const isParticipant = generalConv.participants.some(
        (p) => p.employeId === employeId
      )
      if (!isParticipant) {
        await db.chatParticipant.create({
          data: {
            conversationId: generalConv.id,
            employeId,
          },
        })
      }

      // Ajouter les nouveaux employés qui ne sont pas encore dans le canal
      const allEmployees = await db.employee.findMany({
        where: { actif: true },
        select: { id: true },
      })
      const existingParticipantIds = new Set(
        generalConv.participants.map((p) => p.employeId)
      )
      const newParticipants = allEmployees.filter(
        (emp) => !existingParticipantIds.has(emp.id)
      )
      if (newParticipants.length > 0) {
        await db.chatParticipant.createMany({
          data: newParticipants.map((emp) => ({
            conversationId: generalConv.id,
            employeId: emp.id,
          })),
        })
      }
    }
  } catch (error) {
    console.error('[ENSURE_GENERAL_CHANNEL]', error)
    // Ne pas bloquer si la création du canal échoue
  }
}

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

    // S'assurer que le canal Général existe
    await ensureGeneralChannel(employeId)

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

    // Vérifier que tous les participants existent dans la base
    const participants = await db.employee.findMany({
      where: {
        id: { in: participantIds },
      },
    })
    if (participants.length !== participantIds.length) {
      const foundIds = participants.map((p) => p.id)
      const missingIds = participantIds.filter((id: string) => !foundIds.includes(id))
      console.error('[CHAT_CONVERSATIONS_POST] Employés introuvables:', missingIds)
      return NextResponse.json(
        { error: 'Un ou plusieurs employés introuvables', missingIds },
        { status: 404 }
      )
    }

    // Créer la liste finale des participants (éviter les doublons)
    const allParticipantIds = [...new Set([employeId, ...participantIds])]

    // Double-vérification : s'assurer que TOUS les IDs (y compris le courant) existent
    const allExistCheck = await db.employee.findMany({
      where: { id: { in: allParticipantIds } },
      select: { id: true },
    })
    if (allExistCheck.length !== allParticipantIds.length) {
      const foundIds = allExistCheck.map((p) => p.id)
      const missingIds = allParticipantIds.filter((id) => !foundIds.includes(id))
      console.error('[CHAT_CONVERSATIONS_POST] IDs manquants après vérification:', missingIds, '- employeId JWT:', employeId)
      return NextResponse.json(
        { error: 'Session obsolète. Veuillez vous déconnecter et reconnecter.', action: 'relogin' },
        { status: 401 }
      )
    }

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
