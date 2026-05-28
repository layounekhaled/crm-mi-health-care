const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const data = require('./import-data-final.json');

const BATCH_SIZE = 50;

async function main() {
  const startCount = await db.prospect.count();
  console.log(`Starting import. Current DB count: ${startCount}, Data file: ${data.length} records`);

  let imported = 0;
  let failed = 0;

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const batchData = batch.map(record => ({
      nom: record.nom || 'Unknown',
      specialite: record.specialite || null,
      wilaya: record.wilaya || null,
      telephone: record.telephone || null,
      telephone2: record.telephone2 || null,
      whatsapp: record.whatsapp || null,
      etablissement: record.etablissement || null,
      source: record.source || 'prospection',
      isClient: record.isClient === true,
      notes: record.notes || null,
    }));

    try {
      const result = await db.prospect.createMany({ data: batchData, skipDuplicates: true });
      imported += result.count;
    } catch (err) {
      // If batch fails, try one by one
      console.error(`Batch ${i}-${i + batch.length - 1} failed: ${err.message}. Trying one by one...`);
      for (const record of batch) {
        try {
          await db.prospect.create({
            data: {
              nom: record.nom || 'Unknown',
              specialite: record.specialite || null,
              wilaya: record.wilaya || null,
              telephone: record.telephone || null,
              telephone2: record.telephone2 || null,
              whatsapp: record.whatsapp || null,
              etablissement: record.etablissement || null,
              source: record.source || 'prospection',
              isClient: record.isClient === true,
              notes: record.notes || null,
            }
          });
          imported++;
        } catch (e2) {
          failed++;
          console.error(`  Failed: ${record.nom} - ${e2.message}`);
        }
      }
    }

    console.log(`Progress: ${Math.min(i + BATCH_SIZE, data.length)}/${data.length} processed (imported: ${imported}, failed: ${failed})`);
  }

  console.log(`\nImport complete! Imported: ${imported}, Failed: ${failed}`);

  const total = await db.prospect.count();
  const prospects = await db.prospect.count({ where: { isClient: false } });
  const clients = await db.prospect.count({ where: { isClient: true } });
  console.log(`Final count - Total: ${total} | Prospects: ${prospects} | Clients: ${clients}`);
}

main().catch(console.error).finally(() => db.$disconnect());
