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
    
    if (end < start) return NextResponse.json({ error: 'Date fin antérieure à date début' }, { status: 400 })

    // Get employee info
    const employee = await db.employee.findUnique({
      where: { id: employeId },
      select: { id: true, nom: true, role: true, email: true, telephone: true }
    })
    if (!employee) return NextResponse.json({ error: 'Employé non trouvé' }, { status: 404 })

    // 1. TASKS - created by or assigned to the employee
    const tasks = await db.task.findMany({
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
    })

    const tasksRealisees = tasks.filter(t => t.statut === 'termine').length
    const tasksEnRetard = tasks.filter(t => 
      t.statut !== 'termine' && t.dateEcheance && new Date(t.dateEcheance) < new Date()
    ).length

    // 2. INTERACTIONS - by the employee
    const interactions = await db.interaction.findMany({
      where: {
        employeId: employeId,
        date: { gte: start, lte: end }
      },
      include: {
        prospect: { select: { id: true, nom: true } },
        opportunity: { select: { id: true, nomProjet: true } },
      },
      orderBy: { date: 'desc' }
    })

    const visites = interactions.filter(i => i.type === 'visite').length
    const appels = interactions.filter(i => i.type === 'appel').length

    // 3. PROSPECTS - created by the employee
    const prospects = await db.prospect.findMany({
      where: {
        creeParId: employeId,
        createdAt: { gte: start, lte: end }
      },
      select: { id: true, nom: true, wilaya: true, isClient: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    })

    // 4. OPPORTUNITIES - created by the employee
    const opportunities = await db.opportunity.findMany({
      where: {
        creeParId: employeId,
        createdAt: { gte: start, lte: end }
      },
      include: {
        client: { select: { id: true, nom: true } },
        operations: { select: { id: true, produit: true, marque: true, prixEstime: true, statut: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    const oppGagnees = opportunities.filter(o => o.statut === 'Gagnée')
    const oppPerdues = opportunities.filter(o => o.statut === 'Perdu')
    const montantGagne = oppGagnees.reduce((sum, o) => sum + (o.montantEstime || 0), 0)

    // 5. EVENTS - employee participated in
    const events = await db.event.findMany({
      where: {
        employees: { some: { employeeId: employeId } },
        date: { gte: start, lte: end }
      },
      select: { id: true, nom: true, ville: true, date: true, dateFin: true, type: true, marques: true },
      orderBy: { date: 'desc' }
    })

    // 6. OPERATIONS - created by the employee
    const operations = await db.operation.findMany({
      where: {
        creeParId: employeId,
        createdAt: { gte: start, lte: end }
      },
      include: {
        opportunity: { select: { id: true, nomProjet: true } },
      },
      orderBy: { createdAt: 'desc' }
    })

    // 7. AFTER-SALES - created by or assigned to the employee
    const afterSales = await db.afterSale.findMany({
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
    })

    // 8. CHARGES - by the employee
    const charges = await db.charge.findMany({
      where: {
        employeId: employeId,
        date: { gte: start, lte: end }
      },
      orderBy: { date: 'desc' }
    })
    const totalCharges = charges.reduce((sum, c) => sum + c.montant, 0)

    // 9. DOCUMENTS - uploaded by the employee
    const documents = await db.document.findMany({
      where: {
        uploadedBy: employeId,
        createdAt: { gte: start, lte: end }
      },
      select: { id: true, title: true, brand: true, documentType: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    })

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
  } catch (error) {
    console.error('[EMPLOYEE_ACTIVITY_REPORT]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
