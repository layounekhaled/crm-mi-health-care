/**
 * Reproduction EXACTE de la route rapport sous BUN
 * (le serveur de prod tourne avec `bun .next/standalone/server.js`)
 * Usage: DATABASE_URL=... bun scripts/diag-report-bun.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function runOne(employeId: string, label: string) {
  const dateFrom = '2024-01-01'
  const dateTo = '2026-12-31'
  const start = new Date(dateFrom)
  const end = new Date(dateTo)
  end.setHours(23, 59, 59, 999)

  console.log(`\n=== ${label} (${employeId}) ===`)
  const t0 = Date.now()

  // ─── EXACTEMENT comme la route : Promise.all de 9 requêtes ───
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
    db.task.findMany({
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
    }),
    db.interaction.findMany({
      where: { employeId: employeId, date: { gte: start, lte: end } },
      include: {
        prospect: { select: { id: true, nom: true } },
        opportunity: { select: { id: true, nomProjet: true } },
      },
      orderBy: { date: 'desc' },
    }),
    db.prospect.findMany({
      where: { creeParId: employeId, createdAt: { gte: start, lte: end } },
      select: { id: true, nom: true, wilaya: true, isClient: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.opportunity.findMany({
      where: { creeParId: employeId, createdAt: { gte: start, lte: end } },
      include: {
        client: { select: { id: true, nom: true } },
        operations: { select: { id: true, produit: true, marque: true, prixEstime: true, statut: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.event.findMany({
      where: { employees: { some: { employeeId: employeId } }, date: { gte: start, lte: end } },
      select: { id: true, nom: true, ville: true, date: true, dateFin: true, type: true, marques: true },
      orderBy: { date: 'desc' },
    }),
    db.operation.findMany({
      where: { creeParId: employeId, createdAt: { gte: start, lte: end } },
      include: { opportunity: { select: { id: true, nomProjet: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    db.afterSale.findMany({
      where: { OR: [{ creeParId: employeId }, { employeId: employeId }], createdAt: { gte: start, lte: end } },
      include: { client: { select: { id: true, nom: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    db.charge.findMany({
      where: { employeId: employeId, date: { gte: start, lte: end } },
      orderBy: { date: 'desc' },
    }),
    db.document.findMany({
      where: { uploadedBy: employeId, createdAt: { gte: start, lte: end } },
      select: { id: true, title: true, brand: true, documentType: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const tasksRealisees = tasks.filter((t) => t.statut === 'termine').length
  const visites = interactions.filter((i) => i.type === 'visite').length
  const oppGagnees = opportunities.filter((o) => o.statut === 'Gagnée')
  const montantGagne = oppGagnees.reduce((sum, o) => sum + (o.montantEstime || 0), 0)
  const totalCharges = charges.reduce((sum, c) => sum + c.montant, 0)

  const report = {
    employee: { id: employeId },
    periode: { dateFrom, dateTo },
    resume: {
      totalTaches: tasks.length,
      tasksRealisees,
      totalInteractions: interactions.length,
      visites,
      prospectsAjoutes: prospects.length,
      opportunitesCreees: opportunities.length,
      opportunitesGagnees: oppGagnees.length,
      montantGagne,
      evenementsParticipes: events.length,
      operationsCreees: operations.length,
      afterSalesCount: afterSales.length,
      totalCharges,
      documentsUploades: documents.length,
    },
    details: { tasks, interactions, prospects, opportunities, events, operations, afterSales, charges, documents },
  }

  const json = JSON.stringify(report)
  console.log(
    `✅ OK en ${Date.now() - t0}ms — JSON ${(json.length / 1024).toFixed(1)} Ko — ` +
      `tasks=${tasks.length} interactions=${interactions.length} charges=${charges.length}`
  )
}

async function main() {
  const employees = await db.employee.findMany({ select: { id: true, nom: true, role: true } })
  console.log(`Runtime: Bun ${Bun.version} — ${employees.length} employés testés (plage 2024→2026 complète)`)

  // Test TOUS les employés avec la plage maximale (pire cas)
  for (const emp of employees) {
    await runOne(emp.id, `${emp.nom} [${emp.role}]`)
  }
  console.log('\n=== Tous les employés passent sous Bun ===')
}

main()
  .catch((e: unknown) => {
    const err = e as { name?: string; message?: string; code?: string; stack?: string }
    console.error('💥 ERREUR SOUS BUN:')
    console.error('  name:', err?.name)
    console.error('  code:', err?.code)
    console.error('  message:', JSON.stringify(err?.message))
    console.error('  message est-il vide ?:', !err?.message)
    console.error('  stack:', err?.stack?.split('\n').slice(0, 6).join('\n'))
    process.exit(1)
  })
  .finally(() => db.$disconnect())
