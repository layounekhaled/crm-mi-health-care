import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, canAccess } from '@/lib/auth-helpers'

// GET /api/rh/requests — List leave requests
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const employeeId = searchParams.get('employeeId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    // Non-admin sees only own requests
    if (authUser.role !== 'admin') {
      where.employeeId = authUser.employeId
    } else if (employeeId) {
      where.employeeId = employeeId
    }

    if (status) where.status = status
    if (type) where.type = type

    const [requests, total] = await Promise.all([
      db.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: { id: true, nom: true, email: true },
          },
          approver: {
            select: { id: true, nom: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.leaveRequest.count({ where }),
    ])

    return NextResponse.json({
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[RH_REQUESTS_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/rh/requests — Create a new leave request
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!authUser.employeId) {
      return NextResponse.json(
        { error: 'Aucun employé associé à votre compte' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { type, startDate, endDate, daysCount, reason, attachmentUrl } = body

    // Validate required fields
    if (!type || !startDate || !endDate || !daysCount) {
      return NextResponse.json(
        { error: 'Type, date début, date fin et nombre de jours sont requis' },
        { status: 400 }
      )
    }

    // Validate type
    const validTypes = ['leave', 'absence', 'recovery_work']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Type invalide. Valeurs acceptées: leave, absence, recovery_work' },
        { status: 400 }
      )
    }

    // Validate dates
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (start > end) {
      return NextResponse.json(
        { error: 'La date de début doit être antérieure ou égale à la date de fin' },
        { status: 400 }
      )
    }

    // Validate daysCount is positive integer
    const days = parseInt(String(daysCount))
    if (isNaN(days) || days <= 0 || !Number.isInteger(days)) {
      return NextResponse.json(
        { error: 'Le nombre de jours doit être un entier positif' },
        { status: 400 }
      )
    }

    // Validate recovery_work: at least one date in range must be weekend/holiday
    if (type === 'recovery_work') {
      const calendarDays = await db.calendarDay.findMany({
        where: {
          date: {
            gte: start,
            lte: end,
          },
          type: { in: ['weekend', 'holiday'] },
        },
      })
      if (calendarDays.length === 0) {
        return NextResponse.json(
          { error: 'Au moins un jour dans la plage doit être un week-end ou un jour férié pour une récupération' },
          { status: 400 }
        )
      }
    }

    // Check for overlapping requests
    const overlapping = await db.leaveRequest.findFirst({
      where: {
        employeeId: authUser.employeId,
        status: { in: ['pending', 'approved'] },
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start },
          },
        ],
      },
    })
    if (overlapping) {
      return NextResponse.json(
        { error: 'Vous avez déjà une demande qui chevauche cette période' },
        { status: 409 }
      )
    }

    const leaveRequest = await db.leaveRequest.create({
      data: {
        employeeId: authUser.employeId,
        type,
        startDate: start,
        endDate: end,
        daysCount: days,
        reason: reason || null,
        attachmentUrl: attachmentUrl || null,
        status: 'pending',
      },
      include: {
        employee: {
          select: { id: true, nom: true, email: true },
        },
      },
    })

    // Notify all admin users
    try {
      const admins = await db.user.findMany({
        where: { role: 'admin', actif: true },
        select: { id: true },
      })

      const typeLabel = type === 'leave' ? 'Congé' : type === 'absence' ? 'Absence' : 'Récupération'
      for (const admin of admins) {
        await db.notification.create({
          data: {
            userId: admin.id,
            type: 'info',
            titre: 'Nouvelle demande de congé',
            message: `${authUser.employeNom || 'Un employé'} a soumis une demande de ${typeLabel} (${days} jour${days > 1 ? 's' : ''})`,
            lien: '?page=rh',
            referenceId: leaveRequest.id,
          },
        })
      }
    } catch (notifError) {
      console.error('[RH_REQUESTS_NOTIFY]', notifError)
      // Don't fail the request if notification fails
    }

    return NextResponse.json(leaveRequest, { status: 201 })
  } catch (error) {
    console.error('[RH_REQUESTS_POST]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
