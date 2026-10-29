/**
 * Diagnostic : reproduit les requêtes du rapport d'activité employé
 * une par une pour identifier celle qui échoue.
 * Usage: npx tsx scripts/diag-report.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function step(label: string, fn: () => Promise<unknown>) {
  try {
    const r = await fn()
    const count = Array.isArray(r) ? r.length : typeof r
    console.log(`✅ ${label} (${count})`)
    return r
  } catch (e: any) {
    console.log(`❌ ${label}`)
    console.log(`   ${e.message?.split('\n')[0]}`)
    return null
  }
}

async function main() {
  // Paramètres de test identiques à l'API
  const start = new Date('2026-01-01')
  const end = new Date('2026-12-31')
  end.setHours(23, 59, 59, 999)

  // 0. Récupérer un employé existant
  const employees = await db.employee.findMany({ take: 3, select: { id: true, nom: true, role: true } })
  console.log('Employés:', employees.map(e => `${e.nom} (${e.role})`).join(', '))
  const employeId = employees[0]?.id
  if (!employeId) {
    console.log('Aucun employé trouvé — impossible de tester')
    return
  }
  console.log(`Test avec employeId = ${employeId}\n`)

  await step('1. employee.findUnique', () =>
    db.employee.findUnique({ where: { id: employeId }, select: { id: true, nom: true, role: true, email: true, telephone: true } })
  )

  await step('2. task.findMany (avec assignees)', () =>
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
    })
  )

  await step('3. interaction.findMany', () =>
    db.interaction.findMany({
      where: { employeId, date: { gte: start, lte: end } },
      include: {
        prospect: { select: { id: true, nom: true } },
        opportunity: { select: { id: true, nomProjet: true } },
      },
      orderBy: { date: 'desc' },
    })
  )

  await step('4. prospect.findMany', () =>
    db.prospect.findMany({
      where: { creeParId: employeId, createdAt: { gte: start, lte: end } },
      select: { id: true, nom: true, wilaya: true, isClient: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
  )

  await step('5. opportunity.findMany (avec operations)', () =>
    db.opportunity.findMany({
      where: { creeParId: employeId, createdAt: { gte: start, lte: end } },
      include: {
        client: { select: { id: true, nom: true } },
        operations: { select: { id: true, produit: true, marque: true, prixEstime: true, statut: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  )

  await step('6. event.findMany (avec employees)', () =>
    db.event.findMany({
      where: { employees: { some: { employeeId: employeId } }, date: { gte: start, lte: end } },
      select: { id: true, nom: true, ville: true, date: true, dateFin: true, type: true, marques: true },
      orderBy: { date: 'desc' },
    })
  )

  await step('7. operation.findMany', () =>
    db.operation.findMany({
      where: { creeParId: employeId, createdAt: { gte: start, lte: end } },
      include: { opportunity: { select: { id: true, nomProjet: true } } },
      orderBy: { createdAt: 'desc' },
    })
  )

  await step('8. afterSale.findMany', () =>
    db.afterSale.findMany({
      where: { OR: [{ creeParId: employeId }, { employeId }], createdAt: { gte: start, lte: end } },
      include: { client: { select: { id: true, nom: true } } },
      orderBy: { createdAt: 'desc' },
    })
  )

  await step('9. charge.findMany', () =>
    db.charge.findMany({ where: { employeId, date: { gte: start, lte: end } }, orderBy: { date: 'desc' } })
  )

  await step('10. document.findMany', () =>
    db.document.findMany({
      where: { uploadedBy: employeId, createdAt: { gte: start, lte: end } },
      select: { id: true, title: true, brand: true, documentType: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
  )

  console.log('\nDiagnostic terminé.')
}

main()
  .catch((e) => {
    console.error('Erreur globale:', e.message)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
