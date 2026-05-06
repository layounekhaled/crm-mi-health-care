import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'

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

// GET /api/rh/balances — Get leave balances
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const currentYear = new Date().getFullYear()

    if (authUser.role === 'admin') {
      // Admin sees all employees
      const employees = await db.employee.findMany({
        where: { actif: true },
        select: { id: true, nom: true, email: true },
        orderBy: { nom: 'asc' },
      })

      const employeesWithBalances = await Promise.all(
        employees.map(async (emp) => {
          // Ensure annual credit exists
          await ensureAnnualCredit(emp.id, currentYear)

          const movements = await db.leaveMovement.findMany({
            where: { employeeId: emp.id },
            select: { type: true, value: true },
          })

          const breakdown = {
            annualCredit: movements.filter((m) => m.type === 'annual_credit').reduce((s, m) => s + m.value, 0),
            leaveTaken: Math.abs(movements.filter((m) => m.type === 'leave').reduce((s, m) => s + m.value, 0)),
            absenceTaken: Math.abs(movements.filter((m) => m.type === 'absence').reduce((s, m) => s + m.value, 0)),
            recoveryEarned: movements.filter((m) => m.type === 'recovery').reduce((s, m) => s + m.value, 0),
          }

          const solde = movements.reduce((s, m) => s + m.value, 0)

          return {
            employeeId: emp.id,
            employeeNom: emp.nom,
            employeeEmail: emp.email,
            solde,
            breakdown,
          }
        })
      )

      return NextResponse.json({ employees: employeesWithBalances })
    } else {
      // Employee sees only own balance
      if (!authUser.employeId) {
        return NextResponse.json(
          { error: 'Aucun employé associé à votre compte' },
          { status: 400 }
        )
      }

      await ensureAnnualCredit(authUser.employeId, currentYear)

      const movements = await db.leaveMovement.findMany({
        where: { employeeId: authUser.employeId },
        select: { type: true, value: true },
      })

      const breakdown = {
        annualCredit: movements.filter((m) => m.type === 'annual_credit').reduce((s, m) => s + m.value, 0),
        leaveTaken: Math.abs(movements.filter((m) => m.type === 'leave').reduce((s, m) => s + m.value, 0)),
        absenceTaken: Math.abs(movements.filter((m) => m.type === 'absence').reduce((s, m) => s + m.value, 0)),
        recoveryEarned: movements.filter((m) => m.type === 'recovery').reduce((s, m) => s + m.value, 0),
      }

      const solde = movements.reduce((s, m) => s + m.value, 0)

      return NextResponse.json({
        employeeId: authUser.employeId,
        employeeNom: authUser.employeNom,
        solde,
        breakdown,
      })
    }
  } catch (error) {
    console.error('[RH_BALANCES_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
