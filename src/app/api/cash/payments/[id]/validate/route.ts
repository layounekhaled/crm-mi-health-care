import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth-helpers'

// POST /api/cash/payments/[id]/validate - Validate a payment (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!isAdmin(authUser)) return NextResponse.json({ error: 'Accès refusé - Admin uniquement' }, { status: 403 })

    const { id } = await params
    const payment = await db.cashPayment.findUnique({ where: { id } })

    if (!payment) return NextResponse.json({ error: 'Paiement non trouvé' }, { status: 404 })
    if (payment.statut !== 'en_attente') {
      return NextResponse.json({ error: 'Seuls les paiements en attente peuvent être validés' }, { status: 400 })
    }
    if (payment.archived) {
      return NextResponse.json({ error: 'Ce paiement est archivé' }, { status: 400 })
    }

    // Calculate new balance
    const lastEntry = await db.cashJournalEntry.findFirst({
      orderBy: { dateOperation: 'desc' },
    })
    const currentBalance = lastEntry?.soldeApres ?? 0
    const newBalance = currentBalance + payment.montant

    // Update payment and create journal entry in a transaction
    const [updatedPayment, journalEntry, auditLog] = await db.$transaction([
      db.cashPayment.update({
        where: { id },
        data: {
          statut: 'valide',
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
      db.cashJournalEntry.create({
        data: {
          type: 'encaissement',
          reference: payment.reference || `PAY-${id.slice(-6)}`,
          montantEntree: payment.montant,
          montantSortie: 0,
          soldeApres: newBalance,
          description: `Encaissement validé - ${payment.description || 'Paiement espèces'}`,
          employeId: authUser.employeId!,
          cashPaymentId: id,
        },
      }),
      db.cashAuditLog.create({
        data: {
          entityType: 'cash_payment',
          entityId: id,
          action: 'validate',
          details: { montant: payment.montant, soldeApres: newBalance },
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
            type: 'success',
            titre: 'Encaissement validé',
            message: `Votre encaissement de ${payment.montant.toLocaleString('fr-FR')} DA a été validé.`,
            referenceId: id,
          },
        })
      }
    } catch {}

    return NextResponse.json({ payment: updatedPayment, journalEntry, auditLog })
  } catch (error) {
    console.error('[CASH_PAYMENT_VALIDATE]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
