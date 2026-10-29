#!/usr/bin/env python3
"""Crée la table Deplacement sur la VRAIE base prod (docker exec psql) - idempotent."""
import sys
sys.path.insert(0, '/home/z/my-project/scripts')
from ssh_cmd import run

PSQL = 'docker exec postgresql-bwj97q1aao9793pgif71u3ou psql -U 705XInzPkEjPnO6Y -d dalia -v ON_ERROR_STOP=1'

DDL = '''
CREATE TABLE IF NOT EXISTS "Deplacement" (
    "id" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "prospectId" TEXT,
    "motif" TEXT NOT NULL DEFAULT 'visite',
    "statut" TEXT NOT NULL DEFAULT 'planifie',
    "moyenTransport" TEXT NOT NULL DEFAULT 'vehicule_personnel',
    "villeDepart" TEXT,
    "villeArrivee" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "heureDepart" TEXT,
    "heureRetour" TEXT,
    "distanceKm" DOUBLE PRECISION,
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "creeParId" TEXT,
    "modifieParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Deplacement_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
    ALTER TABLE "Deplacement" ADD CONSTRAINT "Deplacement_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "Deplacement" ADD CONSTRAINT "Deplacement_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "Deplacement" ADD CONSTRAINT "Deplacement_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "Deplacement" ADD CONSTRAINT "Deplacement_modifieParId_fkey" FOREIGN KEY ("modifieParId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "Deplacement_employeId_idx" ON "Deplacement"("employeId");
CREATE INDEX IF NOT EXISTS "Deplacement_prospectId_idx" ON "Deplacement"("prospectId");
CREATE INDEX IF NOT EXISTS "Deplacement_date_idx" ON "Deplacement"("date");
'''

# 1. État avant
print('=== AVANT ===')
print(run(f'{PSQL} -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_name=\'Deplacement\';"').strip(), 'table(s) Deplacement')

# 2. Appliquer le DDL via fichier temporaire côté VPS (évite souci d'échappement)
import base64
b64 = base64.b64encode(DDL.encode()).decode()
run(f'echo {b64} | base64 -d > /tmp/deplacement_ddl.sql && wc -c /tmp/deplacement_ddl.sql')
out = run('cat /tmp/deplacement_ddl.sql | docker exec -i postgresql-bwj97q1aao9793pgif71u3ou psql -U 705XInzPkEjPnO6Y -d dalia -v ON_ERROR_STOP=1', timeout=90)
print('=== DDL ===')
print(out.strip() or '(ok, sans sortie)')

# 3. Vérification après
print('=== APRES ===')
print(run(f'{PSQL} -c "SELECT column_name, data_type, column_default IS NOT NULL AS has_default FROM information_schema.columns WHERE table_name=\'Deplacement\' ORDER BY ordinal_position;"', timeout=60).strip())
print('--- index ---')
print(run(f'{PSQL} -tAc "SELECT indexname FROM pg_indexes WHERE tablename=\'Deplacement\' ORDER BY indexname;"', timeout=60).strip())
print('--- FK ---')
print(run(f'{PSQL} -tAc "SELECT conname FROM pg_constraint WHERE conrelid = \'Deplacement\'::regclass AND contype=\'f\' ORDER BY conname;"', timeout=60).strip())
