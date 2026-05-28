import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_N2ESji9uVPfL@ep-divine-darkness-an3iu4co-pooler.c-6.us-east-1.aws.neon.tech/crm_dalia?sslmode=require',
    },
  },
});

async function main() {
  console.log('🧹 Nettoyage des données orphelines et exemples...\n');

  // 1. Delete orphaned opportunities (no client linked)
  const orphanOpps = await prisma.opportunity.findMany({
    where: { clientId: null },
    select: { id: true, nomProjet: true },
  });
  if (orphanOpps.length > 0) {
    const oppIds = orphanOpps.map(o => o.id);
    // Delete their operations, tasks, interactions first
    await prisma.operation.deleteMany({ where: { opportunityId: { in: oppIds } } });
    await prisma.task.deleteMany({ where: { opportunityId: { in: oppIds } } });
    await prisma.interaction.deleteMany({ where: { opportunityId: { in: oppIds } } });
    await prisma.charge.deleteMany({ where: { opportunityId: { in: oppIds } } });
    const del = await prisma.opportunity.deleteMany({ where: { id: { in: oppIds } } });
    console.log(`  ✓ ${del.count} opportunités orphelines supprimées`);
  } else {
    console.log('  ✓ Pas d\'opportunités orphelines');
  }

  // 2. Delete orphaned tasks (no prospect, no opportunity, no operation, no event)
  const orphanTasks = await prisma.task.deleteMany({
    where: {
      prospectId: null,
      opportunityId: null,
      operationId: null,
      eventId: null,
    },
  });
  console.log(`  ✓ ${orphanTasks.count} tâches orphelines supprimées`);

  // 3. Delete sample events
  const events = await prisma.event.findMany({
    select: { id: true, nom: true },
  });
  if (events.length > 0) {
    await prisma.eventEmployee.deleteMany({});
    await prisma.eventProspect.deleteMany({});
    await prisma.task.deleteMany({ where: { eventId: { not: null } } });
    const del = await prisma.event.deleteMany({});
    console.log(`  ✓ ${del.count} événements supprimés`);
  }

  // 4. Delete sample charges
  const delCharges = await prisma.charge.deleteMany({});
  console.log(`  ✓ ${delCharges.count} charges supprimées`);

  // 5. Delete sample notifications
  const delNotifs = await prisma.notification.deleteMany({});
  console.log(`  ✓ ${delNotifs.count} notifications supprimées`);

  // 6. Delete sample documents
  const delDocs = await prisma.document.deleteMany({});
  console.log(`  ✓ ${delDocs.count} documents supprimés`);

  // 7. Delete remaining tasks
  const delTasks = await prisma.task.deleteMany({});
  console.log(`  ✓ ${delTasks.count} tâches restantes supprimées`);

  console.log('\n📊 État final de la base :');
  const tables = [
    { name: 'Prospects', count: await prisma.prospect.count() },
    { name: 'Événements', count: await prisma.event.count() },
    { name: 'Opportunités', count: await prisma.opportunity.count() },
    { name: 'Tâches', count: await prisma.task.count() },
    { name: 'Interactions', count: await prisma.interaction.count() },
    { name: 'SAV', count: await prisma.afterSale.count() },
    { name: 'Charges', count: await prisma.charge.count() },
    { name: 'Notifications', count: await prisma.notification.count() },
    { name: 'Employés', count: await prisma.employee.count() },
    { name: 'Utilisateurs', count: await prisma.user.count() },
  ];

  tables.forEach(t => {
    const icon = t.count > 0 ? '📦' : '✅';
    console.log(`  ${icon} ${t.name}: ${t.count}`);
  });

  console.log('\n👤 Employés et utilisateurs conservés (comptes réels).');
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
