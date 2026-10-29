import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, isAdmin } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!isAdmin(authUser)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const employeId = searchParams.get('employeId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    if (!employeId) return NextResponse.json({ error: 'employeId requis' }, { status: 400 })
    if (!dateFrom || !dateTo) return NextResponse.json({ error: 'dateFrom et dateTo requis' }, { status: 400 })

    const start = new Date(dateFrom)
    const end = new Date(dateTo)
    end.setHours(23, 59, 59, 999)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Dates invalides' }, { status: 400 })
    }
    if (end < start) return NextResponse.json({ error: 'Date fin antérieure à date début' }, { status: 400 })

    // Get employee info
    const employee = await db.employee.findUnique({
      where: { id: employeId },
      select: { id: true, nom: true, role: true, email: true, telephone: true }
    })
    if (!employee) return NextResponse.json({ error: 'Employé non trouvé' }, { status: 404 })

    // ─── Requêtes parallélisées (performance + résilience) ───
    const [
      tasks,
      interactions,
      prospects,
      opportunities,
      events,
      operations,
      afterSales,
      charges,
      documents,
    ] = await Promise.all([
      // 1. TASKS - created by or assigned to the employee
      db.task.findMany({
        where: {
          OR: [
            { creeParId: employeId },
            { assigneAId: employeId },
            { assignees: { some: { employeeId: employeId } } }
          ],
          createdAt: { gte: start, lte: end }
        },
        include: {
          prospect: { select: { id: true, nom: true } },
          opportunity: { select: { id: true, nomProjet: true } },
          assigneA: { select: { id: true, nom: true } },
        },
        orderBy: { createdAt: 'desc' }
      }),

      // 2. INTERACTIONS - by the employee
      db.interaction.findMany({
        where: {
          employeId: employeId,
          date: { gte: start, lte: end }
        },
        include: {
          prospect: { select: { id: true, nom: true } },
          opportunity: { select: { id: true, nomProjet: true } },
        },
        orderBy: { date: 'desc' }
      }),

      // 3. PROSPECTS - created by the employee
      db.prospect.findMany({
        where: {
          creeParId: employeId,
          createdAt: { gte: start, lte: end }
        },
        select: { id: true, nom: true, wilaya: true, isClient: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      }),

      // 4. OPPORTUNITIES - created by the employee
      db.opportunity.findMany({
        where: {
          creeParId: employeId,
          createdAt: { gte: start, lte: end }
        },
        include: {
          client: { select: { id: true, nom: true } },
          operations: { select: { id: true, produit: true, marque: true, prixEstime: true, statut: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),

      // 5. EVENTS - employee participated in
      db.event.findMany({
        where: {
          employees: { some: { employeeId: employeId } },
          date: { gte: start, lte: end }
        },
        select: { id: true, nom: true, ville: true, date: true, dateFin: true, type: true, marques: true },
        orderBy: { date: 'desc' }
      }),

      // 6. OPERATIONS - created by the employee
      db.operation.findMany({
        where: {
          creeParId: employeId,
          createdAt: { gte: start, lte: end }
        },
        include: {
          opportunity: { select: { id: true, nomProjet: true } },
        },
        orderBy: { createdAt: 'desc' }
      }),

      // 7. AFTER-SALES - created by or assigned to the employee
      db.afterSale.findMany({
        where: {
          OR: [
            { creeParId: employeId },
            { employeId: employeId }
          ],
          createdAt: { gte: start, lte: end }
        },
        include: {
          client: { select: { id: true, nom: true } },
        },
        orderBy: { createdAt: 'desc' }
      }),

      // 8. CHARGES - by the employee
      db.charge.findMany({
        where: {
          employeId: employeId,
          date: { gte: start, lte: end }
        },
        orderBy: { date: 'desc' }
      }),

      // 9. DOCUMENTS - uploaded by the employee
      db.document.findMany({
        where: {
          uploadedBy: employeId,
          createdAt: { gte: start, lte: end }
        },
        select: { id: true, title: true, brand: true, documentType: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      }),
    ])

    const tasksRealisees = tasks.filter(t => t.statut === 'termine').length
    const tasksEnRetard = tasks.filter(t =>
      t.statut !== 'termine' && t.dateEcheance && new Date(t.dateEcheance) < new Date()
    ).length

    const visites = interactions.filter(i => i.type === 'visite').length
    const appels = interactions.filter(i => i.type === 'appel').length

    const oppGagnees = opportunities.filter(o => o.statut === 'Gagnée')
    const oppPerdues = opportunities.filter(o => o.statut === 'Perdu')
    const montantGagne = oppGagnees.reduce((sum, o) => sum + (o.montantEstime || 0), 0)
    const totalCharges = charges.reduce((sum, c) => sum + c.montant, 0)

    // 10. Products concerned (from operations)
    const produitsConcernes = [...new Map(
      operations
        .filter(op => op.produit)
        .map(op => [op.produit + '|' + op.marque, { produit: op.produit, marque: op.marque }])
        .values()
    )]

    // Compile the report
    const report = {
      employee,
      periode: { dateFrom, dateTo },
      resume: {
        totalTaches: tasks.length,
        tachesRealisees: tasksRealisees,
        tachesEnRetard: tasksEnRetard,
        totalInteractions: interactions.length,
        visites,
        appels,
        prospectsAjoutes: prospects.length,
        opportunitesCreees: opportunities.length,
        opportunitesGagnees: oppGagnees.length,
        opportunitesPerdues: oppPerdues.length,
        montantGagne,
        evenementsParticipes: events.length,
        operationsCreees: operations.length,
        afterSalesCount: afterSales.length,
        totalCharges,
        documentsUploades: documents.length,
        produitsConcernes: produitsConcernes.length,
      },
      details: {
        tasks,
        interactions,
        prospects,
        opportunities,
        events,
        operations,
        afterSales,
        charges,
        documents,
        produitsConcernes,
      }
    }

    return NextResponse.json(report)
  } catch (error: unknown) {
    // Log détaillé côté serveur
    const err = error as { name?: string; message?: string; code?: string; stack?: string }
    console.error('[EMPLOYEE_ACTIVITY_REPORT]', {
      name: err?.name,
      code: err?.code,
      message: err?.message?.split('\n').slice(0, 5).join(' | '),
      stack: err?.stack?.split('\n').slice(0, 4).join(' | '),
    })

    // Message utile pour l'admin (diagnostic direct à l'écran)
    let detail = err?.message?.split('\n')[0] || 'Erreur inconnue'
    if (detail.length > 300) detail = detail.slice(0, 300) + '…'

    return NextResponse.json(
      { error: 'Erreur serveur', detail },
      { status: 500 }
    )
  }
}
