const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_N2ESji9uVPfL@ep-divine-darkness-an3iu4co-pooler.c-6.us-east-1.aws.neon.tech/crm_dalia?sslmode=require' } }
});

(async () => {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'khaled@mihealthcare.dz' }, select: { email: true, motDePasse: true, role: true } });
    if (!user) { console.log('User not found'); return; }
    console.log('Hash stocké:', user.motDePasse ? user.motDePasse.substring(0,30)+'...' : 'NULL');
    for (const pwd of ['admin123', 'password', '123456', 'khaled', 'Dalia2024', 'Admin123!', 'admin', 'Admin1234', 'khaled2024']) {
      const ok = user.motDePasse ? await bcrypt.compare(pwd, user.motDePasse) : false;
      console.log(`  ${pwd} → ${ok ? 'OK ✓' : 'KO'}`);
    }
  } catch (e) {
    console.error('Erreur:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
