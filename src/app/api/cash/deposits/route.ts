import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth-helpers'

// GET /api/cash/deposits - List bank deposits (admin only)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!isAdmin(authUser)) return NextResponse.json({ error: 'Accès refusé - Admin uniquement' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const where: Record<string, unknown> = { archived: false }
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = new Date(dateTo)
      where.createdAt = dateFilter
    }

    const deposits = await db.bankDeposit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        creePar: { select: { id: true, nom: true } },
      },
    })

    return NextResponse.json(deposits)
  } catch (error) {
    console.error('[CASH_DEPOSITS_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/cash/deposits - Create bank deposit (admin only)
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!isAdmin(authUser)) return NextResponse.json({ error: 'Accès refusé - Admin uniquement' }, { status: 403 })
    if (!authUser.employeId) return NextResponse.json({ error: 'Employé non trouvé' }, { status: 400 })

    const body = await request.json()
    const { montant, banque, compte, reference, observation } = body

    if (!montant || montant <= 0) {
      return NextResponse.json({ error: 'Le montant positif est requis' }, { status: 400 })
    }
    if (!banque || !banque.trim()) {
      return NextResponse.json({ error: 'La banque est requise' }, { status: 400 })
    }

    // Create bank deposit
    const deposit = await db.bankDeposit.create({
      data: {
        montant: parseFloat(montant),
        banque: banque.trim(),
        compte: compte || null,
        reference: reference || null,
        observation: observation || null,
        creeParId: authUser.employeId,
      },
      include: {
        creePar: { select: { id: true, nom: true } },
      },
    })

    // Get current balance
    const lastEntry = await db.cashJournalEntry.findFirst({
      orderBy: { dateOperation: 'desc' },
    })
    const currentBalance = lastEntry?.soldeApres ?? 0
    const newBalance = currentBalance - parseFloat(montant)

    // Create journal entry (depot_banque)
    await db.cashJournalEntry.create({
      data: {
        type: 'depot_banque',
        reference: deposit.reference || `DEPOT-${deposit.id.slice(-6)}`,
        montantEntree: 0,
        montantSortie: parseFloat(montant),
        soldeApres: newBalance,
        description: `Dépôt bancaire - ${banque}${observation ? ` - ${observation}` : ''}`,
        employeId: authUser.employeId,
        bankDepositId: deposit.id,
      },
    })

    // Create audit log
    await db.cashAuditLog.create({
      data: {
        entityType: 'bank_deposit',
        entityId: deposit.id,
        action: 'create',
        details: { montant, banque, compte, reference },
        employeId: authUser.employeId,
      },
    })

    return NextResponse.json(deposit, { status: 201 })
  } catch (error) {
    console.error('[CASH_DEPOSITS_POST]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
