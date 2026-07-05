import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth-helpers'

// GET /api/cash/expenses - List expenses (admin only)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!isAdmin(authUser)) return NextResponse.json({ error: 'Accès refusé - Admin uniquement' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const categorie = searchParams.get('categorie')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const where: Record<string, unknown> = { archived: false }
    if (categorie) where.categorie = categorie
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = new Date(dateTo)
      where.createdAt = dateFilter
    }

    const expenses = await db.cashExpense.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        creePar: { select: { id: true, nom: true } },
      },
    })

    return NextResponse.json(expenses)
  } catch (error) {
    console.error('[CASH_EXPENSES_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/cash/expenses - Create expense (admin only)
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!isAdmin(authUser)) return NextResponse.json({ error: 'Accès refusé - Admin uniquement' }, { status: 403 })
    if (!authUser.employeId) return NextResponse.json({ error: 'Employé non trouvé' }, { status: 400 })

    const body = await request.json()
    const { categorie, montant, description, justificatifUrl, justificatifPath } = body

    if (!categorie || !montant || montant <= 0) {
      return NextResponse.json({ error: 'Catégorie et montant positif sont requis' }, { status: 400 })
    }

    const validCategories = ['carburant', 'fournitures', 'deplacement', 'restauration', 'divers']
    if (!validCategories.includes(categorie)) {
      return NextResponse.json({ error: `Catégorie invalide. Valeurs: ${validCategories.join(', ')}` }, { status: 400 })
    }

    // Create expense
    const expense = await db.cashExpense.create({
      data: {
        categorie,
        montant: parseFloat(montant),
        description: description || null,
        justificatifUrl: justificatifUrl || null,
        justificatifPath: justificatifPath || null,
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

    // Create journal entry (depense)
    await db.cashJournalEntry.create({
      data: {
        type: 'depense',
        reference: `DEP-${expense.id.slice(-6)}`,
        montantEntree: 0,
        montantSortie: parseFloat(montant),
        soldeApres: newBalance,
        description: `Dépense ${categorie}${description ? ` - ${description}` : ''}`,
        employeId: authUser.employeId,
        cashExpenseId: expense.id,
      },
    })

    // Create audit log
    await db.cashAuditLog.create({
      data: {
        entityType: 'cash_expense',
        entityId: expense.id,
        action: 'create',
        details: { categorie, montant, description },
        employeId: authUser.employeId,
      },
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error('[CASH_EXPENSES_POST]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
