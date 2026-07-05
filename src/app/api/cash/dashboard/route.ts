import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, isAdmin, canAccess } from '@/lib/auth-helpers'

interface TopEmploye {
  employeId: string
  nom: string
  total: number
  count: number
}

interface EmployeeStat {
  employeId: string | null
  nom: string
  total: number
  count: number
}

// GET /api/cash/dashboard - Dashboard stats
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!canAccess(authUser, ['admin', 'responsable', 'commercial', 'technicien']))
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const admin = isAdmin(authUser)

    // Current balance (solde actuel) - from last journal entry
    let soldeActuel = 0
    if (admin) {
      const lastEntry = await db.cashJournalEntry.findFirst({
        orderBy: { dateOperation: 'desc' },
      })
      soldeActuel = lastEntry?.soldeApres ?? 0
    }

    // Base where clause based on role
    const baseWhere = admin ? {} : { creeParId: authUser.employeId! }

    // En attente (total amount of pending payments)
    const enAttentePayments = await db.cashPayment.findMany({
      where: { statut: 'en_attente', archived: false, ...baseWhere },
      select: { montant: true },
    })
    const enAttente = enAttentePayments.reduce((sum, p) => sum + p.montant, 0)
    const nbEnAttente = enAttentePayments.length

    // Validés aujourd'hui
    const validesAujourdhui = await db.cashPayment.findMany({
      where: {
        statut: 'valide',
        dateValidation: { gte: todayStart },
        archived: false,
        ...baseWhere,
      },
      select: { montant: true },
    })
    const validesAujourdhuiTotal = validesAujourdhui.reduce((sum, p) => sum + p.montant, 0)

    // Validés ce mois
    const validesCeMois = await db.cashPayment.findMany({
      where: {
        statut: 'valide',
        dateValidation: { gte: monthStart },
        archived: false,
        ...baseWhere,
      },
      select: { montant: true },
    })
    const validesCeMoisTotal = validesCeMois.reduce((sum, p) => sum + p.montant, 0)

    // Dépenses ce mois (admin only)
    let depensesCeMois = 0
    if (admin) {
      const expenses = await db.cashExpense.findMany({
        where: {
          archived: false,
          createdAt: { gte: monthStart },
        },
        select: { montant: true },
      })
      depensesCeMois = expenses.reduce((sum, e) => sum + e.montant, 0)
    }

    // Dépôts bancaires ce mois (admin only)
    let depotsCeMois = 0
    if (admin) {
      const deposits = await db.bankDeposit.findMany({
        where: {
          archived: false,
          createdAt: { gte: monthStart },
        },
        select: { montant: true },
      })
      depotsCeMois = deposits.reduce((sum, d) => sum + d.montant, 0)
    }

    // Top employé (most validated amount this month, admin only)
    let topEmploye: TopEmploye | null = null
    if (admin) {
      const topEmployee = await db.cashPayment.groupBy({
        by: ['creeParId'],
        where: {
          statut: 'valide',
          dateValidation: { gte: monthStart },
          archived: false,
        },
        _sum: { montant: true },
        _count: true,
        orderBy: { _sum: { montant: 'desc' } },
        take: 1,
      })

      if (topEmployee.length > 0 && topEmployee[0].creeParId) {
        const emp = await db.employee.findUnique({
          where: { id: topEmployee[0].creeParId },
          select: { id: true, nom: true },
        })
        topEmploye = {
          employeId: topEmployee[0].creeParId,
          nom: emp?.nom || '—',
          total: topEmployee[0]._sum.montant ?? 0,
          count: topEmployee[0]._count,
        }
      }
    }

    // Taux de validation (admin only)
    let tauxValidation = 0
    if (admin) {
      const [totalPayments, validatedPayments] = await Promise.all([
        db.cashPayment.count({ where: { archived: false, statut: { in: ['valide', 'refuse'] } } }),
        db.cashPayment.count({ where: { archived: false, statut: 'valide' } }),
      ])
      tauxValidation = totalPayments > 0 ? Math.round((validatedPayments / totalPayments) * 100) : 0
    }

    // Stats by employee (admin only)
    let statsByEmployee: EmployeeStat[] = []
    if (admin) {
      const employeeStats = await db.cashPayment.groupBy({
        by: ['creeParId'],
        where: { archived: false, datePaiement: { gte: monthStart } },
        _sum: { montant: true },
        _count: true,
        orderBy: { _sum: { montant: 'desc' } },
      })

      const employeeIds = employeeStats.map(e => e.creeParId).filter(Boolean) as string[]
      const employees = await db.employee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, nom: true },
      })
      const employeeMap = new Map(employees.map(e => [e.id, e.nom]))

      statsByEmployee = employeeStats.map(stat => ({
        employeId: stat.creeParId,
        nom: employeeMap.get(stat.creeParId!) || '—',
        total: stat._sum.montant ?? 0,
        count: stat._count,
      }))
    }

    return NextResponse.json({
      soldeActuel,
      enAttente,
      nbEnAttente,
      validesAujourdhui: validesAujourdhuiTotal,
      validesCeMois: validesCeMoisTotal,
      depensesCeMois,
      depotsCeMois,
      topEmploye,
      tauxValidation,
      statsByEmployee,
    })
  } catch (error) {
    console.error('[CASH_DASHBOARD_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
