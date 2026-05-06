import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, canAccess } from '@/lib/auth-helpers'

// POST /api/rh/annual-credit — Trigger annual credit for a specific year
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!canAccess(authUser, ['admin'])) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const year = body.year || new Date().getFullYear()

    if (typeof year !== 'number' || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: 'Année invalide' },
        { status: 400 }
      )
    }

    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31)

    // Get all active employees
    const employees = await db.employee.findMany({
      where: { actif: true },
      select: { id: true, nom: true },
    })

    let created = 0
    let skipped = 0

    for (const emp of employees) {
      // Check if annual_credit already exists for this year
      const existing = await db.leaveMovement.findFirst({
        where: {
          employeeId: emp.id,
          type: 'annual_credit',
          date: {
            gte: startOfYear,
            lte: endOfYear,
          },
        },
      })

      if (existing) {
        skipped++
      } else {
        await db.leaveMovement.create({
          data: {
            employeeId: emp.id,
            type: 'annual_credit',
            value: 30,
            date: startOfYear,
          },
        })
        created++
      }
    }

    return NextResponse.json({
      year,
      totalEmployees: employees.length,
      creditsCreated: created,
      creditsSkipped: skipped,
    })
  } catch (error) {
    console.error('[RH_ANNUAL_CREDIT_POST]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
