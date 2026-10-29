/**
 * Test end-to-end de la logique du rapport d'activité employé
 * (identique à src/app/api/reports/employee-activity/route.ts)
 * Usage: DATABASE_URL=... npx tsx scripts/diag-report-full.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const dateFrom = '2026-01-01'
  const dateTo = '2026-12-31'
  const start = new Date(dateFrom)
  const end = new Date(dateTo)
  end.setHours(23, 59, 59, 999)

  const employees = await db.employee.findMany({ take: 3, select: { id: true } })
  const employeId = employees[0]!.id
  console.log('employeId:', employeId)

  const employee = await db.employee.findUnique({
    where: { id: employeId },
    select: { id: true, nom: true, role: true, email: true, telephone: true },
  })

  // ─── EXACTEMENT comme la route ───
  const tasks = await db.task.findMany({
    where: {
      OR: [
        { creeParId: employeId },
        { assigneAId: employeId },
        { assignees: { some: { employeeId: employeId } } },
      ],
      createdAt: { gte: start, lte: end },
    },
    include: {
      prospect: { select: { id: true, nom: true } },
      opportunity: { select: { id: true, nomProjet: true } },
      assigneA: { select: { id: true, nom: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const interactions = await db.interaction.findMany({
    where: { employeId: employeId, date: { gte: start, lte: end } },
    include: {
      prospect: { select: { id: true, nom: true } },
      opportunity: { select: { id: true, nomProjet: true } },
    },
    orderBy: { date: 'desc' },
  })

  const prospects = await db.prospect.findMany({
    where: { creeParId: employeId, createdAt: { gte: start, lte: end } },
    select: { id: true, nom: true, wilaya: true, isClient: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  const opportunities = await db.opportunity.findMany({
    where: { creeParId: employeId, createdAt: { gte: start, lte: end } },
    include: {
      client: { select: { id: true, nom: true } },
      operations: { select: { id: true, produit: true, marque: true, prixEstime: true, statut: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const oppGagnees = opportunities.filter(o => o.statut === 'Gagnée')
  const oppPerdues = opportunities.filter(o => o.statut === 'Perdu')
  const montantGagne = oppGagnees.reduce((sum, o) => sum + (o.montantEstime || 0), 0)

  const events = await db.event.findMany({
    where: { employees: { some: { employeeId: employeId } }, date: { gte: start, lte: end } },
    select: { id: true, nom: true, ville: true, date: true, dateFin: true, type: true, marques: true },
    orderBy: { date: 'desc' },
  })

  const operations = await db.operation.findMany({
    where: { creeParId: employeId, createdAt: { gte: start, lte: end } },
    include: { opportunity: { select: { id: true, nomProjet: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const afterSales = await db.afterSale.findMany({
    where: { OR: [{ creeParId: employeId }, { employeId: employeId }], createdAt: { gte: start, lte: end } },
    include: { client: { select: { id: true, nom: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const charges = await db.charge.findMany({
    where: { employeId: employeId, date: { gte: start, lte: end } },
    orderBy: { date: 'desc' },
  })
  const totalCharges = charges.reduce((sum, c) => sum + c.montant, 0)

  const documents = await db.document.findMany({
    where: { uploadedBy: employeId, createdAt: { gte: start, lte: end } },
    select: { id: true, title: true, brand: true, documentType: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  const produitsConcernes = [...new Map(
    operations
      .filter(op => op.produit)
      .map(op => [op.produit + '|' + op.marque, { produit: op.produit, marque: op.marque }])
      .values()
  )]

  const report = {
    employee,
    periode: { dateFrom, dateTo },
    resume: {
      totalTaches: tasks.length,
      tachesRealisees: tasks.filter(t => t.statut === 'termine').length,
      tachesEnRetard: tasks.filter(t =>
        t.statut !== 'termine' && t.dateEcheance && new Date(t.dateEcheance) < new Date()
      ).length,
      totalInteractions: interactions.length,
      visites: interactions.filter(i => i.type === 'visite').length,
      appels: interactions.filter(i => i.type === 'appel').length,
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
    details: { tasks, interactions, prospects, opportunities, events, operations, afterSales, charges, documents, produitsConcernes },
  }

  // Test de sérialisation (comme NextResponse.json)
  const json = JSON.stringify(report)
  console.log('✅ Toutes les étapes passent — taille JSON:', (json.length / 1024).toFixed(1), 'Ko')

  // Test avec une plage SANS données (ex: 2020)
  const empty = await db.task.findMany({
    where: {
      OR: [{ creeParId: employeId }, { assigneAId: employeId }, { assignees: { some: { employeeId: employeId } } }],
      createdAt: { gte: new Date('2020-01-01'), lte: new Date('2020-01-02') },
    },
  })
  console.log('✅ Plage vide OK:', empty.length, 'tâches')

  console.log('\nConclusion : la logique fonctionne sur la prod DB. Le 500 vient du serveur déployé (build/client Prisma).')
}

main()
  .catch((e) => {
    console.error('💥 ERREUR TROUVÉE:', e.constructor?.name)
    console.error(e.message?.split('\n').slice(0, 6).join('\n'))
    process.exit(1)
  })
  .finally(() => db.$disconnect())
