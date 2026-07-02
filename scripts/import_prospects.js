/**
 * Import prospects into Dalia CRM database via Prisma createMany.
 * Fast bulk import approach.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const PROSPECTS_FILE = path.join(__dirname, 'prospects_import_ready.json');
const BATCH_SIZE = 200;

function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/[^\d]/g, '');
}

async function main() {
  console.log('='.repeat(60));
  console.log('Dalia CRM - Import des prospects (bulk)');
  console.log('='.repeat(60));

  const prospectsToImport = JSON.parse(fs.readFileSync(PROSPECTS_FILE, 'utf-8'));
  console.log(`\nProspects à importer: ${prospectsToImport.length}`);

  // Get existing prospects for duplicate check - only email and phone
  console.log('\nChargement des prospects existants...');
  const existing = await prisma.prospect.findMany({
    select: { email: true, telephone: true }
  });
  console.log(`Prospects existants en DB: ${existing.length}`);

  const existingEmails = new Set();
  const existingPhones = new Set();
  for (const p of existing) {
    if (p.email) existingEmails.add(p.email.toLowerCase().trim());
    if (p.telephone) {
      const phone = normalizePhone(p.telephone);
      if (phone.length >= 8) existingPhones.add(phone);
    }
  }

  // Filter duplicates
  const toInsert = [];
  let dupEmail = 0, dupPhone = 0;

  for (const p of prospectsToImport) {
    const emailClean = p.email ? p.email.toLowerCase().trim() : '';
    const phoneClean = normalizePhone(p.telephone);

    if (emailClean && existingEmails.has(emailClean)) {
      dupEmail++;
      continue;
    }
    if (phoneClean.length >= 8 && existingPhones.has(phoneClean)) {
      dupPhone++;
      continue;
    }

    // Prepare data and add to set to prevent intra-batch duplicates
    if (emailClean) existingEmails.add(emailClean);
    if (phoneClean.length >= 8) existingPhones.add(phoneClean);

    toInsert.push({
      nom: p.nom || 'Nom inconnu',
      email: p.email || null,
      telephone: p.telephone || null,
      telephone2: p.telephone2 || null,
      whatsapp: null,
      adresse: p.adresse || null,
      specialite: p.specialite || null,
      wilaya: p.wilaya || null,
      etablissement: p.etablissement || null,
      source: 'import_excel',
      notes: p.notes || null,
    });
  }

  console.log(`\nDoublons email: ${dupEmail}`);
  console.log(`Doublons téléphone: ${dupPhone}`);
  console.log(`Nouveaux prospects à insérer: ${toInsert.length}`);

  if (toInsert.length === 0) {
    console.log('\nAucun nouveau prospect à insérer.');
    await prisma.$disconnect();
    return;
  }

  // Insert in batches using createMany
  let totalInserted = 0;
  const totalBatches = Math.ceil(toInsert.length / BATCH_SIZE);

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    
    try {
      const result = await prisma.prospect.createMany({
        data: batch,
        skipDuplicates: true,
      });
      totalInserted += result.count;
      console.log(`  Batch ${batchNum}/${totalBatches}: ${result.count} insérés (total: ${totalInserted})`);
    } catch (err) {
      console.error(`  Batch ${batchNum}/${totalBatches} ERROR: ${err.message.substring(0, 100)}`);
      // Try smaller batches
      for (let j = 0; j < batch.length; j += 20) {
        const miniBatch = batch.slice(j, j + 20);
        try {
          const r = await prisma.prospect.createMany({ data: miniBatch, skipDuplicates: true });
          totalInserted += r.count;
        } catch (e2) {
          // Try one by one
          for (const item of miniBatch) {
            try {
              await prisma.prospect.create({ data: item });
              totalInserted++;
            } catch (e3) {
              // skip
            }
          }
        }
      }
    }
  }

  // Final count
  const finalCount = await prisma.prospect.count();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RÉSULTAT FINAL`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Prospects à importer: ${prospectsToImport.length}`);
  console.log(`Doublons évités (email): ${dupEmail}`);
  console.log(`Doublons évités (téléphone): ${dupPhone}`);
  console.log(`Nouveaux insérés: ${totalInserted}`);
  console.log(`Total en DB maintenant: ${finalCount}`);

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    totalToImport: prospectsToImport.length,
    duplicatesEmail: dupEmail,
    duplicatesPhone: dupPhone,
    inserted: totalInserted,
    totalInDBAfter: finalCount,
  };
  fs.writeFileSync(path.join(__dirname, 'import_report.json'), JSON.stringify(report, null, 2));

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
