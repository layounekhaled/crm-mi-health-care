import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, canAccess } from '@/lib/auth-helpers'

// Helper: ensure annual credit exists for a given year
async function ensureAnnualCredit(employeeId: string, year: number) {
  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year, 11, 31)

  const existing = await db.leaveMovement.findFirst({
    where: {
      employeeId,
      type: 'annual_credit',
      date: {
        gte: startOfYear,
        lte: endOfYear,
      },
    },
  })

  if (!existing) {
    await db.leaveMovement.create({
      data: {
        employeeId,
        type: 'annual_credit',
        value: 30,
        date: startOfYear,
      },
    })
  }
}

// GET /api/rh/requests/[id] — Get single request
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { id } = await params

    const leaveRequest = await db.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, nom: true, email: true },
        },
        approver: {
          select: { id: true, nom: true },
        },
        movements: true,
      },
    })

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
    }

    // Non-admin can only see own requests
    if (authUser.role !== 'admin' && leaveRequest.employeeId !== authUser.employeId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    return NextResponse.json(leaveRequest)
  } catch (error) {
    console.error('[RH_REQUEST_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH /api/rh/requests/[id] — Approve or reject
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!canAccess(authUser, ['admin'])) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    if (!authUser.employeId) {
      return NextResponse.json(
        { error: 'Aucun employé associé à votre compte' },
        { status: 400 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { status, adminComment } = body

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Statut invalide. Valeurs acceptées: approved, rejected' },
        { status: 400 }
      )
    }

    if (status === 'rejected' && !adminComment) {
      return NextResponse.json(
        { error: 'Un commentaire est requis pour refuser une demande' },
        { status: 400 }
      )
    }

    const leaveRequest = await db.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, nom: true },
        },
      },
    })

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
    }

    if (leaveRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Cette demande a déjà été traitée' },
        { status: 400 }
      )
    }

    const now = new Date()

    if (status === 'approved') {
      // Ensure annual credit exists for current year
      const year = leaveRequest.startDate.getFullYear()
      await ensureAnnualCredit(leaveRequest.employeeId, year)

      // Determine movement type and value
      let movementType: string
      let movementValue: number

      if (leaveRequest.type === 'leave') {
        movementType = 'leave'
        movementValue = -leaveRequest.daysCount
      } else if (leaveRequest.type === 'absence') {
        movementType = 'absence'
        movementValue = -leaveRequest.daysCount
      } else {
        // recovery_work
        movementType = 'recovery'
        movementValue = leaveRequest.daysCount
      }

      // Create movement and update request in transaction
      const updated = await db.$transaction([
        db.leaveMovement.create({
          data: {
            employeeId: leaveRequest.employeeId,
            type: movementType,
            value: movementValue,
            sourceId: leaveRequest.id,
            date: now,
          },
        }),
        db.leaveRequest.update({
          where: { id },
          data: {
            status: 'approved',
            approvedBy: authUser.employeId,
            approvedAt: now,
            adminComment: adminComment || null,
          },
          include: {
            employee: {
              select: { id: true, nom: true, email: true },
            },
            approver: {
              select: { id: true, nom: true },
            },
          },
        }),
      ])

      // Notify the employee
      try {
        const user = await db.user.findFirst({
          where: { employeId: leaveRequest.employeeId },
          select: { id: true },
        })
        if (user) {
          const typeLabel = leaveRequest.type === 'leave' ? 'Congé' : leaveRequest.type === 'absence' ? 'Absence' : 'Récupération'
          await db.notification.create({
            data: {
              userId: user.id,
              type: 'info',
              titre: 'Demande approuvée',
              message: `Votre demande de ${typeLabel} du ${leaveRequest.startDate.toLocaleDateString('fr-FR')} au ${leaveRequest.endDate.toLocaleDateString('fr-FR')} a été approuvée`,
              lien: '?page=rh',
              referenceId: leaveRequest.id,
            },
          })
        }
      } catch (notifError) {
        console.error('[RH_REQUEST_APPROVE_NOTIFY]', notifError)
      }

      return NextResponse.json(updated[1])
    } else {
      // Reject
      const updated = await db.leaveRequest.update({
        where: { id },
        data: {
          status: 'rejected',
          approvedBy: authUser.employeId,
          approvedAt: now,
          adminComment: adminComment || null,
        },
        include: {
          employee: {
            select: { id: true, nom: true, email: true },
          },
          approver: {
            select: { id: true, nom: true },
          },
        },
      })

      // Notify the employee
      try {
        const user = await db.user.findFirst({
          where: { employeId: leaveRequest.employeeId },
          select: { id: true },
        })
        if (user) {
          const typeLabel = leaveRequest.type === 'leave' ? 'Congé' : leaveRequest.type === 'absence' ? 'Absence' : 'Récupération'
          await db.notification.create({
            data: {
              userId: user.id,
              type: 'info',
              titre: 'Demande refusée',
              message: `Votre demande de ${typeLabel} du ${leaveRequest.startDate.toLocaleDateString('fr-FR')} au ${leaveRequest.endDate.toLocaleDateString('fr-FR')} a été refusée. Raison: ${adminComment}`,
              lien: '?page=rh',
              referenceId: leaveRequest.id,
            },
          })
        }
      } catch (notifError) {
        console.error('[RH_REQUEST_REJECT_NOTIFY]', notifError)
      }

      return NextResponse.json(updated)
    }
  } catch (error) {
    console.error('[RH_REQUEST_PATCH]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
