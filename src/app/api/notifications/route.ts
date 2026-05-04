import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/notifications - List notifications for current user
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const lue = searchParams.get('lue')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: { userId: string; lue?: boolean } = { userId }
    if (lue !== null && lue !== undefined) {
      where.lue = lue === 'true'
    }

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: { userId, lue: false },
      }),
    ])

    const response = NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })

    response.headers.set('x-unread-count', unreadCount.toString())
    return response
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/notifications - Create notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, type, titre, message, lien, referenceId } = body

    if (!userId || !titre || !message) {
      return NextResponse.json(
        { error: 'userId, titre et message sont requis' },
        { status: 400 }
      )
    }

    const notification = await db.notification.create({
      data: {
        userId,
        type: type || 'info',
        titre,
        message,
        lien: lien || null,
        referenceId: referenceId || null,
      },
    })

    return NextResponse.json(notification, { status: 201 })
  } catch (error) {
    console.error('Error creating notification:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
