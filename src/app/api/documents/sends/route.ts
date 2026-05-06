import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, canAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

// GET /api/documents/sends - Historique des envois
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {}

    // Non-admin see only their own sends
    if (authUser.role !== 'admin' && authUser.employeId) {
      where.sentBy = authUser.employeId
    }

    const [sends, total] = await Promise.all([
      db.documentSend.findMany({
        where,
        include: {
          sender: { select: { id: true, nom: true } },
          prospect: { select: { id: true, nom: true } },
        },
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.documentSend.count({ where }),
    ])

    // Enrich with document titles
    const enrichedSends = sends.map((send) => {
      let docIds: string[] = []
      try {
        docIds = JSON.parse(send.documentIds)
      } catch {}
      return {
        ...send,
        documentIdsParsed: docIds,
      }
    })

    // Fetch document titles for all referenced IDs
    const allDocIds = enrichedSends.flatMap((s) => s.documentIdsParsed)
    const uniqueDocIds = [...new Set(allDocIds)]

    const docs = await db.document.findMany({
      where: { id: { in: uniqueDocIds } },
      select: { id: true, title: true, brand: true },
    })

    const docMap = Object.fromEntries(docs.map((d) => [d.id, d]))

    const finalSends = enrichedSends.map((send) => ({
      ...send,
      documents: send.documentIdsParsed
        .map((id: string) => docMap[id])
        .filter(Boolean),
    }))

    return NextResponse.json({
      data: finalSends,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[DOCUMENTS_SENDS_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
