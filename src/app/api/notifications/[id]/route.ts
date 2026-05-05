import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'

// PATCH /api/notifications/[id] - Mark as read/unread
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const authUser = await getAuthUser(request)
    const headerUserId = request.headers.get('x-user-id')
    const userId = authUser?.id || headerUserId
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { lue } = body

    // Verify notification belongs to user
    const notification = await db.notification.findFirst({
      where: { id, userId },
    })

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification non trouvée' },
        { status: 404 }
      )
    }

    const updated = await db.notification.update({
      where: { id },
      data: { lue: lue !== undefined ? lue : !notification.lue },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating notification:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const authUser = await getAuthUser(request)
    const headerUserId = request.headers.get('x-user-id')
    const userId = authUser?.id || headerUserId
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Verify notification belongs to user
    const notification = await db.notification.findFirst({
      where: { id, userId },
    })

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification non trouvée' },
        { status: 404 }
      )
    }

    await db.notification.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
