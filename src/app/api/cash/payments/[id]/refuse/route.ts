import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth-helpers'

// POST /api/cash/payments/[id]/refuse - Refuse a payment (admin only, motif required)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!isAdmin(authUser)) return NextResponse.json({ error: 'Accès refusé - Admin uniquement' }, { status: 403 })

    const { id } = await params
    const body = await request.json()
    const { motifRefus } = body

    if (!motifRefus || !motifRefus.trim()) {
      return NextResponse.json({ error: 'Le motif de refus est obligatoire' }, { status: 400 })
    }

    const payment = await db.cashPayment.findUnique({ where: { id } })

    if (!payment) return NextResponse.json({ error: 'Paiement non trouvé' }, { status: 404 })
    if (payment.statut !== 'en_attente') {
      return NextResponse.json({ error: 'Seuls les paiements en attente peuvent être refusés' }, { status: 400 })
    }
    if (payment.archived) {
      return NextResponse.json({ error: 'Ce paiement est archivé' }, { status: 400 })
    }

    // Update payment and create audit log
    const [updatedPayment, auditLog] = await db.$transaction([
      db.cashPayment.update({
        where: { id },
        data: {
          statut: 'refuse',
          motifRefus: motifRefus.trim(),
          valideParId: authUser.employeId,
          dateValidation: new Date(),
        },
        include: {
          prospect: { select: { id: true, nom: true } },
          opportunity: { select: { id: true, nomProjet: true } },
          creePar: { select: { id: true, nom: true } },
          validePar: { select: { id: true, nom: true } },
        },
      }),
      db.cashAuditLog.create({
        data: {
          entityType: 'cash_payment',
          entityId: id,
          action: 'refuse',
          details: { motifRefus: motifRefus.trim() },
          employeId: authUser.employeId!,
        },
      }),
    ])

    // Notify the employee who created the payment
    try {
      const user = await db.user.findFirst({ where: { employeId: payment.creeParId } })
      if (user) {
        await db.notification.create({
          data: {
            userId: user.id,
            type: 'warning',
            titre: 'Encaissement refusé',
            message: `Votre encaissement de ${payment.montant.toLocaleString('fr-FR')} DA a été refusé. Motif : ${motifRefus.trim()}`,
            referenceId: id,
          },
        })
      }
    } catch {}

    return NextResponse.json({ payment: updatedPayment, auditLog })
  } catch (error) {
    console.error('[CASH_PAYMENT_REFUSE]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
