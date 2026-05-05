import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'

// PUT /api/notifications/mark-all-read - Mark all as read for a user
export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    const { searchParams } = new URL(request.url)
    const queryUserId = searchParams.get('userId')

    const userId = authUser?.id || queryUserId
    if (!userId) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
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
