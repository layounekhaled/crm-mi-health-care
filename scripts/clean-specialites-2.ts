import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_N2ESji9uVPfL@ep-divine-darkness-an3iu4co-pooler.c-6.us-east-1.aws.neon.tech/crm_dalia?sslmode=require',
    },
  },
});

const FIXES: [string, string | null][] = [
  ['DISTRIBUTEUR', 'Distributeur'],
  ['PARTICULIER', 'Particulier'],
  ['MEDECIN', 'Médecin'],
  ['ENDOCRINOLOGUE', 'Endocrinologue'],
  ['KHODJA Tarek', 'Médecin divers'],
  ['NAKIB Tarek', 'Médecin divers'],
  ['Taleb yousra', 'Médecin divers'],
  ['BOUDCHICHA Nacer eddine', 'Médecin divers'],
  ['neurologue', 'Neurologue'],
  ['orthopediste', 'Orthopédiste'],
  ['reeducateur', 'Rééducateur'],
  ['medecine esthetique / www.dermes.net', 'Médecine esthétique'],
];

async function main() {
  let totalUpdated = 0;
  
  for (const [from, to] of FIXES) {
    const result = await prisma.prospect.updateMany({
      where: { specialite: from },
      data: { specialite: to },
    });
    if (result.count > 0) {
      console.log(`  ✓ "${from}" → "${to}" [${result.count}]`);
      totalUpdated += result.count;
    }
  }
  
  console.log(`\n📊 Total: ${totalUpdated} mis à jour`);
  
  const total = await prisma.prospect.count();
  const clients = await prisma.prospect.count({ where: { isClient: true } });
  const prospects = await prisma.prospect.count({ where: { isClient: false } });
  
  console.log(`\n📋 Résumé DALIA:`);
  console.log(`  📊 Total: ${total}`);
  console.log(`  ✅ Clients (isClient=true): ${clients}`);
  console.log(`  🟡 Prospects (isClient=false): ${prospects}`);
  
  const finalBySpec = await prisma.prospect.groupBy({
    by: ['specialite'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  
  console.log(`\n📋 Par spécialité:`);
  for (const s of finalBySpec) {
    console.log(`  • ${s.specialite || 'N/A'}: ${s._count.id}`);
  }
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
