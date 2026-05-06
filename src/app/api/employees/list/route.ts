import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'

// GET /api/employees/list - Récupérer les employés actifs (pour démarrer de nouvelles conversations)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const employeId = authUser.employeId

    // Vérifier que l'employé existe encore
    const employeeExists = await db.employee.findUnique({ where: { id: employeId }, select: { id: true } })
    if (!employeeExists) {
      return staleSessionResponse()
    }

    // Récupérer tous les employés actifs sauf l'utilisateur courant
    const employees = await db.employee.findMany({
      where: {
        actif: true,
        id: { not: employeId },
      },
      select: {
        id: true,
        nom: true,
        role: true,
      },
      orderBy: { nom: 'asc' },
    })

    return NextResponse.json(employees)
  } catch (error) {
    console.error('[EMPLOYEES_LIST_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
