import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_N2ESji9uVPfL@ep-divine-darkness-an3iu4co-pooler.c-6.us-east-1.aws.neon.tech/crm_dalia?sslmode=require',
    },
  },
});

async function main() {
  console.log('📊 État actuel de la base de données DALIA :\n');
  
  const tables = [
    { name: 'Prospects', count: await prisma.prospect.count() },
    { name: 'Événements', count: await prisma.event.count() },
    { name: 'Opportunités', count: await prisma.opportunity.count() },
    { name: 'Opérations', count: await prisma.operation.count() },
    { name: 'Tâches', count: await prisma.task.count() },
    { name: 'Interactions', count: await prisma.interaction.count() },
    { name: 'SAV (AfterSale)', count: await prisma.afterSale.count() },
    { name: 'Employés', count: await prisma.employee.count() },
    { name: 'Utilisateurs', count: await prisma.user.count() },
    { name: 'Charges', count: await prisma.charge.count() },
    { name: 'Notifications', count: await prisma.notification.count() },
    { name: 'Produits', count: await prisma.product.count() },
    { name: 'Documents', count: await prisma.document.count() },
    { name: 'Envois de documents', count: await prisma.documentSend.count() },
    { name: 'Photos prospects', count: await prisma.prospectPhoto.count() },
  ];

  tables.forEach(t => {
    const icon = t.count > 0 ? '📦' : '✅';
    console.log(`  ${icon} ${t.name}: ${t.count}`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
