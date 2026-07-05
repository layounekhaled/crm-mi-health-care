import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth-helpers'

// GET /api/cash/audit - List audit logs (admin only)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!isAdmin(authUser)) return NextResponse.json({ error: 'Accès refusé - Admin uniquement' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const action = searchParams.get('action')
    const employeId = searchParams.get('employeId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (entityType) where.entityType = entityType
    if (action) where.action = action
    if (employeId) where.employeId = employeId
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = new Date(dateTo)
      where.createdAt = dateFilter
    }

    const [logs, total] = await Promise.all([
      db.cashAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          employe: { select: { id: true, nom: true } },
        },
      }),
      db.cashAuditLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('[CASH_AUDIT_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
