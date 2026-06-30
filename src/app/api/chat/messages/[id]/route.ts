import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'

// DELETE /api/chat/messages/[id] - Supprimer un message (seulement par son auteur)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || !authUser.employeId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const employeId = authUser.employeId

    // Vérifier que l'employé existe
    const employeeExists = await db.employee.findUnique({ where: { id: employeId }, select: { id: true } })
    if (!employeeExists) {
      return staleSessionResponse()
    }

    const { id } = await params

    // Trouver le message
    const message = await db.chatMessage.findUnique({
      where: { id },
      select: { id: true, expediteurId: true },
    })

    if (!message) {
      return NextResponse.json({ error: 'Message introuvable' }, { status: 404 })
    }

    // Seul l'auteur peut supprimer son message (ou un admin)
    const isAdmin = authUser.role === 'admin'
    if (message.expediteurId !== employeId && !isAdmin) {
      return NextResponse.json({ error: 'Vous ne pouvez supprimer que vos propres messages' }, { status: 403 })
    }

    await db.chatMessage.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CHAT_MESSAGE_DELETE]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
