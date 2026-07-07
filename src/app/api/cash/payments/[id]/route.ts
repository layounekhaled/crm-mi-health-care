import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, canAccess, isAdmin } from '@/lib/auth-helpers'

// GET /api/cash/payments/[id] - Get single payment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!canAccess(authUser, ['admin', 'responsable', 'commercial', 'technicien']))
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { id } = await params
    const payment = await db.cashPayment.findUnique({
      where: { id },
      include: {
        prospect: { select: { id: true, nom: true } },
        opportunity: { select: { id: true, nomProjet: true } },
        creePar: { select: { id: true, nom: true } },
        validePar: { select: { id: true, nom: true } },
        modifiePar: { select: { id: true, nom: true } },
        journalEntry: true,
      },
    })

    if (!payment) return NextResponse.json({ error: 'Paiement non trouvé' }, { status: 404 })

    // Non-admin can only see their own payments
    if (!isAdmin(authUser) && payment.creeParId !== authUser.employeId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    return NextResponse.json(payment)
  } catch (error) {
    console.error('[CASH_PAYMENT_GET]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH /api/cash/payments/[id] - Modify a payment (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!isAdmin(authUser)) return NextResponse.json({ error: 'Accès refusé - Admin uniquement' }, { status: 403 })

    const { id } = await params
    const existing = await db.cashPayment.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Paiement non trouvé' }, { status: 404 })
    if (existing.statut !== 'en_attente') {
      return NextResponse.json({ error: 'Seuls les paiements en attente peuvent être modifiés' }, { status: 400 })
    }

    const body = await request.json()
    const { montant, prospectId, opportunityId, reference, description, justificatifUrl, justificatifPath, datePaiement } = body

    // Track changes for audit
    const changes: Record<string, { old: unknown; new: unknown }> = {}
    if (montant !== undefined && montant !== existing.montant) changes.montant = { old: existing.montant, new: montant }
    if (prospectId !== undefined && prospectId !== existing.prospectId) changes.prospectId = { old: existing.prospectId, new: prospectId }
    if (reference !== undefined && reference !== existing.reference) changes.reference = { old: existing.reference, new: reference }
    if (description !== undefined && description !== existing.description) changes.description = { old: existing.description, new: description }

    const updateData: Record<string, unknown> = { modifieParId: authUser.employeId }
    if (montant !== undefined) updateData.montant = parseFloat(montant)
    if (prospectId !== undefined) updateData.prospectId = prospectId || null
    if (opportunityId !== undefined) updateData.opportunityId = opportunityId || null
    if (reference !== undefined) updateData.reference = reference || null
    if (description !== undefined) updateData.description = description || null
    if (justificatifUrl !== undefined) {
      updateData.justificatifUrl = justificatifUrl || null
      updateData.justificatifPath = justificatifPath || null
    }
    if (datePaiement !== undefined) updateData.datePaiement = new Date(datePaiement)

    const payment = await db.cashPayment.update({
      where: { id },
      data: updateData,
      include: {
        prospect: { select: { id: true, nom: true } },
        opportunity: { select: { id: true, nomProjet: true } },
        creePar: { select: { id: true, nom: true } },
        validePar: { select: { id: true, nom: true } },
        modifiePar: { select: { id: true, nom: true } },
      },
    })

    // Create audit log
    if (Object.keys(changes).length > 0) {
      await db.cashAuditLog.create({
        data: {
          entityType: 'cash_payment',
          entityId: id,
          action: 'modify',
          details: JSON.parse(JSON.stringify(changes)),
          employeId: authUser.employeId!,
        },
      })
    }

    return NextResponse.json(payment)
  } catch (error) {
    console.error('[CASH_PAYMENT_PATCH]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
