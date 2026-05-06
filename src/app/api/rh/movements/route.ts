import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'

// GET /api/rh/movements — List leave movements
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const type = searchParams.get('type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    // Non-admin sees only own movements
    if (authUser.role !== 'admin') {
      where.employeeId = authUser.employeId
    } else if (employeeId) {
      where.employeeId = employeeId
    }

    if (type) where.type = type

    const [movements, total] = await Promise.all([
      db.leaveMovement.findMany({
        where,
        include: {
          employee: {
            select: { id: true, nom: true, email: true },
          },
          source: {
            select: { id: true, type: true, status: true },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      db.leaveMovement.count({ where }),
    ])

    return NextResponse.json({
      movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[RH_MOVEMENTS_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
