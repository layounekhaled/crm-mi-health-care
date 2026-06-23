const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_N2ESji9uVPfL@ep-divine-darkness-an3iu4co-pooler.c-6.us-east-1.aws.neon.tech/crm_dalia?sslmode=require' } }
});

(async () => {
  try {
    const users = await prisma.user.findMany({ select: { email: true, role: true, employeId: true }, take: 10 });
    console.log('=== Utilisateurs en DB ===');
    users.forEach(u => console.log(`  ${u.email} | role=${u.role} | employeId=${u.employeId || 'null'}`));
  } catch (e) {
    console.error('Erreur:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
