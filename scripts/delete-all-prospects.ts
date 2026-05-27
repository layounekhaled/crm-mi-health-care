import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_N2ESji9uVPfL@ep-divine-darkness-an3iu4co-pooler.c-6.us-east-1.aws.neon.tech/crm_dalia?sslmode=require',
    },
  },
});

async function main() {
  console.log('🔍 Comptage des prospects existants...');
  const prospectCount = await prisma.prospect.count();
  console.log(`📊 ${prospectCount} prospects trouvés dans la base.`);

  if (prospectCount === 0) {
    console.log('✅ La base est déjà vide, rien à supprimer.');
    return;
  }

  // Show some prospects for confirmation
  const prospects = await prisma.prospect.findMany({
    select: { id: true, nom: true, telephone: true, isClient: true },
    take: 10,
  });
  console.log('\n📋 Aperçu des prospects à supprimer :');
  prospects.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.nom} - ${p.telephone || 'pas de tél'} ${p.isClient ? '(client)' : '(prospect)'}`);
  });
  if (prospectCount > 10) {
    console.log(`  ... et ${prospectCount - 10} autres.`);
  }

  console.log('\n🗑️ Suppression en cours...');

  // Delete in correct order to respect foreign key constraints
  
  // 1. Delete DocumentSends referencing prospects
  const deletedDocSends = await prisma.documentSend.deleteMany({
    where: { recipientType: 'prospect' },
  });
  console.log(`  ✓ ${deletedDocSends.count} envois de documents supprimés`);

  // 2. Delete ProspectPhotos
  const deletedPhotos = await prisma.prospectPhoto.deleteMany({});
  console.log(`  ✓ ${deletedPhotos.count} photos supprimées`);

  // 3. Delete Interactions linked to prospects
  const deletedInteractions = await prisma.interaction.deleteMany({
    where: { prospectId: { not: null } },
  });
  console.log(`  ✓ ${deletedInteractions.count} interactions supprimées`);

  // 4. Delete EventProspect links
  const deletedEventLinks = await prisma.eventProspect.deleteMany({});
  console.log(`  ✓ ${deletedEventLinks.count} liens événements supprimés`);

  // 5. Delete Tasks linked to prospects
  const deletedTasks = await prisma.task.deleteMany({
    where: { prospectId: { not: null } },
  });
  console.log(`  ✓ ${deletedTasks.count} tâches supprimées`);

  // 6. Delete AfterSales linked to prospects
  const deletedAfterSales = await prisma.afterSale.deleteMany({});
  console.log(`  ✓ ${deletedAfterSales.count} SAV supprimés`);

  // 7. Delete Opportunities and their children
  const opportunities = await prisma.opportunity.findMany({
    where: { clientId: { not: null } },
    select: { id: true },
  });

  if (opportunities.length > 0) {
    const oppIds = opportunities.map(o => o.id);
    
    // Delete operations linked to these opportunities
    const deletedOps = await prisma.operation.deleteMany({
      where: { opportunityId: { in: oppIds } },
    });
    console.log(`  ✓ ${deletedOps.count} opérations supprimées`);

    // Delete tasks linked to these opportunities
    const deletedOppTasks = await prisma.task.deleteMany({
      where: { opportunityId: { in: oppIds } },
    });
    console.log(`  ✓ ${deletedOppTasks.count} tâches d'opportunités supprimées`);

    // Delete interactions linked to these opportunities
    const deletedOppInteractions = await prisma.interaction.deleteMany({
      where: { opportunityId: { in: oppIds } },
    });
    console.log(`  ✓ ${deletedOppInteractions.count} interactions d'opportunités supprimées`);

    // Delete charges linked to these opportunities
    const deletedCharges = await prisma.charge.deleteMany({
      where: { opportunityId: { in: oppIds } },
    });
    console.log(`  ✓ ${deletedCharges.count} charges d'opportunités supprimées`);

    // Delete the opportunities
    const deletedOpps = await prisma.opportunity.deleteMany({
      where: { id: { in: oppIds } },
    });
    console.log(`  ✓ ${deletedOpps.count} opportunités supprimées`);
  }

  // 8. Finally, delete all prospects
  const deletedProspects = await prisma.prospect.deleteMany({});
  console.log(`  ✓ ${deletedProspects.count} prospects supprimés`);

  // Verify
  const remaining = await prisma.prospect.count();
  console.log(`\n✅ Terminé ! ${remaining} prospects restants dans la base.`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
