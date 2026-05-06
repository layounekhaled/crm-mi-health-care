import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, canAccess } from '@/lib/auth-helpers'

// GET /api/rh/calendar — List calendar days
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const type = searchParams.get('type')

    const where: Record<string, unknown> = {}

    if (year || month) {
      const dateFilter: Record<string, Date> = {}
      if (year && month) {
        const y = parseInt(year)
        const m = parseInt(month) - 1
        dateFilter.gte = new Date(y, m, 1)
        dateFilter.lte = new Date(y, m + 1, 0)
      } else if (year) {
        const y = parseInt(year)
        dateFilter.gte = new Date(y, 0, 1)
        dateFilter.lte = new Date(y, 11, 31)
      }
      where.date = dateFilter
    }

    if (type) where.type = type

    const days = await db.calendarDay.findMany({
      where,
      orderBy: { date: 'asc' },
    })

    return NextResponse.json({ days })
  } catch (error) {
    console.error('[RH_CALENDAR_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/rh/calendar — Create/update calendar days (batch)
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!canAccess(authUser, ['admin'])) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const { days } = body as { days: { date: string; type: string; label?: string }[] }

    if (!days || !Array.isArray(days) || days.length === 0) {
      return NextResponse.json(
        { error: 'Un tableau de jours est requis' },
        { status: 400 }
      )
    }

    const validTypes = ['working_day', 'weekend', 'holiday']
    for (const day of days) {
      if (!day.date || !day.type) {
        return NextResponse.json(
          { error: 'Chaque jour doit avoir une date et un type' },
          { status: 400 }
        )
      }
      if (!validTypes.includes(day.type)) {
        return NextResponse.json(
          { error: `Type invalide: ${day.type}. Valeurs acceptées: working_day, weekend, holiday` },
          { status: 400 }
        )
      }
    }

    const results = await Promise.all(
      days.map((day) =>
        db.calendarDay.upsert({
          where: { date: new Date(day.date) },
          update: {
            type: day.type,
            label: day.label || null,
          },
          create: {
            date: new Date(day.date),
            type: day.type,
            label: day.label || null,
          },
        })
      )
    )

    return NextResponse.json({ created: results.length, days: results })
  } catch (error) {
    console.error('[RH_CALENDAR_POST]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
