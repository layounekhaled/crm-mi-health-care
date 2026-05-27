import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_N2ESji9uVPfL@ep-divine-darkness-an3iu4co-pooler.c-6.us-east-1.aws.neon.tech/crm_dalia?sslmode=require',
    },
  },
});

interface ProspectData {
  nom: string;
  specialite: string | null;
  wilaya: string | null;
  telephone: string | null;
  telephone2: string | null;
  whatsapp: string | null;
  etablissement: string | null;
  source: string;
  isClient: boolean;
  notes: string | null;
}

async function main() {
  console.log('📂 Chargement des données...');
  const rawData = fs.readFileSync('/home/z/my-project/upload/prospects_to_import.json', 'utf-8');
  const prospects: ProspectData[] = JSON.parse(rawData);
  
  console.log(`📊 ${prospects.length} prospects à importer\n`);
  
  // Get existing phone numbers to avoid duplicates
  console.log('🔍 Vérification des doublons existants...');
  const existingProspects = await prisma.prospect.findMany({
    select: { telephone: true },
  });
  const existingPhones = new Set(existingProspects.map(p => p.telephone).filter(Boolean));
  console.log(`  ${existingPhones.size} numéros existants en base`);
  
  // Filter out duplicates by phone
  const toInsert: ProspectData[] = [];
  const seenPhones = new Set<string>();
  let duplicatesSkipped = 0;
  
  for (const p of prospects) {
    // Skip if phone already in DB
    if (p.telephone && existingPhones.has(p.telephone)) {
      duplicatesSkipped++;
      continue;
    }
    // Skip if phone already seen in this batch
    if (p.telephone && seenPhones.has(p.telephone)) {
      duplicatesSkipped++;
      continue;
    }
    if (p.telephone) {
      seenPhones.add(p.telephone);
    }
    toInsert.push(p);
  }
  
  console.log(`  ${duplicatesSkipped} doublons téléphoniques ignorés`);
  console.log(`  ${toInsert.length} prospects à insérer\n`);
  
  // Use createMany in batches of 100
  let created = 0;
  let errors = 0;
  const batchSize = 100;
  
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    
    try {
      const result = await prisma.prospect.createMany({
        data: batch.map(p => ({
          nom: p.nom,
          specialite: p.specialite,
          wilaya: p.wilaya,
          telephone: p.telephone,
          telephone2: p.telephone2,
          whatsapp: p.whatsapp,
          etablissement: p.etablissement,
          source: p.source,
          isClient: p.isClient,
          notes: p.notes,
        })),
        skipDuplicates: true,
      });
      created += result.count;
    } catch (err: any) {
      errors += batch.length;
      if (errors <= 20) {
        console.log(`  ❌ Erreur batch ${i}: ${err.message?.substring(0, 100)}`);
      }
    }
    
    const progress = Math.min(i + batchSize, toInsert.length);
    const pct = ((progress / toInsert.length) * 100).toFixed(1);
    console.log(`  [${progress}/${toInsert.length}] ${pct}% - Créés: ${created} | Erreurs: ${errors}`);
  }
  
  // Verify
  const total = await prisma.prospect.count();
  console.log(`\n✅ Import terminé !`);
  console.log(`  🟢 Créés: ${created}`);
  console.log(`  🟡 Doublons ignorés: ${duplicatesSkipped}`);
  console.log(`  🔴 Erreurs: ${errors}`);
  console.log(`  📊 Total en base: ${total} prospects`);
  
  // Stats by specialite
  const bySpec = await prisma.prospect.groupBy({
    by: ['specialite'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  
  console.log(`\n📋 Par spécialité:`);
  for (const s of bySpec) {
    console.log(`  • ${s.specialite || 'N/A'}: ${s._count.id}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Erreur fatale:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
