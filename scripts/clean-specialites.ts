import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_N2ESji9uVPfL@ep-divine-darkness-an3iu4co-pooler.c-6.us-east-1.aws.neon.tech/crm_dalia?sslmode=require',
    },
  },
});

// Normalization map
const SPECIALITE_MAP: Record<string, string> = {
  'DISTRIBUTEUR': 'Distributeur',
  'Distributeur': 'Distributeur',
  'PARTICULIER': 'Particulier',
  'MEDECIN': 'Médecin',
  'CLINIQUE': 'Clinique',
  'Clinique': 'Clinique',
  'LABORATOIRE': 'Laboratoire',
  'GYNECOLOGUE': 'Gynécologue',
  'generaliste': 'Généraliste',
  'diabéto': 'Diabétologue',
  '0': null as any,
};

async function main() {
  console.log('🧹 Nettoyage des spécialités...\n');
  
  // Get all distinct specialites
  const bySpec = await prisma.prospect.groupBy({
    by: ['specialite'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  
  let totalUpdated = 0;
  
  for (const s of bySpec) {
    const spec = s.specialite;
    const count = s._count.id;
    
    if (!spec) continue;
    
    // Check if needs normalization
    const normalized = SPECIALITE_MAP[spec];
    
    if (normalized !== undefined && normalized !== spec) {
      if (normalized === null) {
        // Remove invalid specialite
        const result = await prisma.prospect.updateMany({
          where: { specialite: spec },
          data: { specialite: null },
        });
        console.log(`  ✓ "${spec}" → (supprimé) [${result.count} mis à jour]`);
        totalUpdated += result.count;
      } else {
        const result = await prisma.prospect.updateMany({
          where: { specialite: spec },
          data: { specialite: normalized },
        });
        console.log(`  ✓ "${spec}" → "${normalized}" [${result.count} mis à jour]`);
        totalUpdated += result.count;
      }
    }
  }
  
  // Fix obviously wrong specialites (email addresses, person names, etc.)
  const wrongPatterns = ['@', 'Dr ', 'DR ', 'MR ', 'Mr ', 'Nom du'];
  for (const pattern of wrongPatterns) {
    const results = await prisma.prospect.findMany({
      where: { specialite: { contains: pattern } },
      select: { id: true, specialite: true, nom: true },
    });
    
    if (results.length > 0) {
      const ids = results.map(r => r.id);
      await prisma.prospect.updateMany({
        where: { id: { in: ids } },
        data: { specialite: 'Médecin divers' },
      });
      console.log(`  ✓ "${pattern}..." → "Médecin divers" [${ids.length} mis à jour]`);
      totalUpdated += ids.length;
    }
  }
  
  // Final stats
  console.log(`\n📊 Total mis à jour: ${totalUpdated}`);
  
  const finalBySpec = await prisma.prospect.groupBy({
    by: ['specialite'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  
  console.log(`\n📋 Spécialités après nettoyage:`);
  for (const s of finalBySpec) {
    console.log(`  • ${s.specialite || 'N/A'}: ${s._count.id}`);
  }
  
  const total = await prisma.prospect.count();
  console.log(`\n📊 Total en base: ${total} prospects`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
