import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { db } from '@/lib/db'
import { getAuthUser, staleSessionResponse } from '@/lib/auth-helpers'
import { uploadFile } from '@/lib/storage'

// POST /api/chat/messages - Envoyer un message (text ou image)
export async function POST(request: NextRequest) {
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

    // Check content type to handle both JSON and FormData
    const contentType = request.headers.get('content-type') || ''
    let conversationId: string
    let contenu: string
    let type: string = 'text'
    let imageUrl: string | null = null

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (image upload)
      const formData = await request.formData()
      conversationId = formData.get('conversationId') as string
      contenu = (formData.get('contenu') as string) || ''
      type = (formData.get('type') as string) || 'text'
      const imageFile = formData.get('image') as File | null

      if (!conversationId) {
        return NextResponse.json({ error: "L'identifiant de la conversation est requis" }, { status: 400 })
      }

      if (imageFile && imageFile.size > 0) {
        // Validate image
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (imageFile.size > maxSize) {
          return NextResponse.json({ error: 'Image trop volumineuse (max 10 MB)' }, { status: 400 })
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if (!allowedTypes.includes(imageFile.type)) {
          return NextResponse.json({ error: "Format d'image non supporté (JPEG, PNG, WebP, GIF)" }, { status: 400 })
        }

        // Upload to MinIO
        const timestamp = Date.now()
        const ext = imageFile.name.split('.').pop() || 'jpg'
        const filePath = `chat-images/${timestamp}_${Math.random().toString(36).slice(2, 8)}.${ext}`

        const result = await uploadFile(filePath, imageFile, imageFile.type, 'media')
        imageUrl = result.url
        type = 'image'

        // If no text content, add a default
        if (!contenu.trim()) {
          contenu = '📷 Image'
        }
      }
    } else {
      // Handle JSON (text message)
      let body
      try {
        body = await request.json()
      } catch {
        return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
      }
      conversationId = body.conversationId
      contenu = body.contenu
      type = body.type || 'text'
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: "L'identifiant de la conversation est requis" },
        { status: 400 }
      )
    }

    if (!contenu || typeof contenu !== 'string' || contenu.trim().length === 0) {
      return NextResponse.json(
        { error: 'Le contenu du message est requis' },
        { status: 400 }
      )
    }

    // Vérifier que l'expéditeur est participant de la conversation
    const participant = await db.chatParticipant.findUnique({
      where: {
        conversationId_employeId: {
          conversationId,
          employeId,
        },
      },
    })

    if (!participant) {
      return NextResponse.json(
        { error: "Vous n'êtes pas participant de cette conversation" },
        { status: 403 }
      )
    }

    // Créer le message et mettre à jour la conversation dans une transaction
    const message = await db.$transaction(async (tx) => {
      const msg = await tx.chatMessage.create({
        data: {
          conversationId,
          expediteurId: employeId,
          contenu: contenu.trim(),
          type,
          imageUrl,
        },
        include: {
          expediteur: {
            select: {
              id: true,
              nom: true,
            },
          },
        },
      })

      // Mettre à jour le updatedAt de la conversation pour le tri
      await tx.chatConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      })

      return msg
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('[CHAT_MESSAGES_POST]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
