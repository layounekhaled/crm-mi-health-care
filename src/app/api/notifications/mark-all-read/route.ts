import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/notifications/mark-all-read - Mark all as read for a user
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId est requis' },
        { status: 400 }
      )
    }

    const result = await db.notification.updateMany({
      where: { userId, lue: false },
      data: { lue: true },
    })

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `${result.count} notification(s) marquée(s) comme lue(s)`,
    })
  } catch (error) {
    console.error('Error marking all as read:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
