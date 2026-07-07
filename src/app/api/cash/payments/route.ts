import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, canAccess, isAdmin } from '@/lib/auth-helpers'

// GET /api/cash/payments - List payments with filters
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!canAccess(authUser, ['admin', 'responsable', 'commercial', 'technicien']))
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const statut = searchParams.get('statut')
    const creeParId = searchParams.get('creeParId')
    const prospectId = searchParams.get('prospectId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { archived: false }

    // Role-based filtering
    if (!isAdmin(authUser)) {
      // Employees see only their own payments
      where.creeParId = authUser.employeId
    } else {
      // Admin can filter by employee
      if (creeParId) where.creeParId = creeParId
    }

    if (statut) where.statut = statut
    if (prospectId) where.prospectId = prospectId

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = new Date(dateTo)
      where.datePaiement = dateFilter
    }

    const [payments, total] = await Promise.all([
      db.cashPayment.findMany({
        where,
        orderBy: { datePaiement: 'desc' },
        skip,
        take: limit,
        include: {
          prospect: { select: { id: true, nom: true } },
          opportunity: { select: { id: true, nomProjet: true } },
          creePar: { select: { id: true, nom: true } },
          validePar: { select: { id: true, nom: true } },
        },
      }),
      db.cashPayment.count({ where }),
    ])

    return NextResponse.json({
      payments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('[CASH_PAYMENTS_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/cash/payments - Declare a new payment
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!canAccess(authUser, ['admin', 'responsable', 'commercial', 'technicien']))
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const body = await request.json()
    const { montant, prospectId, opportunityId, reference, description, justificatifUrl, justificatifPath, datePaiement, modePaiement } = body

    if (!montant || montant <= 0) {
      return NextResponse.json({ error: 'Le montant est requis et doit être positif' }, { status: 400 })
    }

    if (!authUser.employeId) {
      return NextResponse.json({ error: 'Employé non trouvé' }, { status: 400 })
    }

    // Create the payment
    const payment = await db.cashPayment.create({
      data: {
        montant: parseFloat(montant),
        prospectId: prospectId || null,
        opportunityId: opportunityId || null,
        reference: reference || null,
        description: description || null,
        justificatifUrl: justificatifUrl || null,
        justificatifPath: justificatifPath || null,
        datePaiement: datePaiement ? new Date(datePaiement) : new Date(),
        modePaiement: modePaiement || 'especes',
        statut: 'en_attente',
        creeParId: authUser.employeId,
      },
      include: {
        prospect: { select: { id: true, nom: true } },
        opportunity: { select: { id: true, nomProjet: true } },
        creePar: { select: { id: true, nom: true } },
      },
    })

    // Create audit log
    await db.cashAuditLog.create({
      data: {
        entityType: 'cash_payment',
        entityId: payment.id,
        action: 'create',
        details: { montant, prospectId, reference, description },
        employeId: authUser.employeId,
      },
    })

    // Create notifications for all admin users
    try {
      const adminUsers = await db.user.findMany({
        where: { role: 'admin', actif: true },
        select: { id: true },
      })
      const employeNom = authUser.employeNom || authUser.email
      await db.notification.createMany({
        data: adminUsers.map(admin => ({
          userId: admin.id,
          type: 'cash_payment',
          titre: 'Nouvel encaissement déclaré',
          message: `${employeNom} a déclaré un encaissement de ${new Intl.NumberFormat('fr-DZ').format(parseFloat(montant))} DA`,
          lien: '/caisse',
          referenceId: payment.id,
        })),
      })
    } catch (notifError) {
      console.error('[CASH_PAYMENTS_NOTIFY]', notifError)
      // Don't fail the request if notification fails
    }

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error('[CASH_PAYMENTS_POST]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
