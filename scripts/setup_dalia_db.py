#!/usr/bin/env python3
"""Push Prisma schema and seed the Dalia database on the local PostgreSQL server."""
import paramiko
import json
import time
import sys

HOST = '156.67.26.104'
USER = 'root'
PASSWORD = 'N8l1q67yIa5LI4V48unaE'

DB_URL = "postgresql://crm:CrmPr0sp!bNnRO9R5aPGJ@m2gr4uesqj3npja5a2exvqql:5432/dalia?sslmode=disable"

def ssh_cmd(ssh, cmd, timeout=120):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    return out, err

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)
    print("Connected to server")

    # Step 1: Create temp directory and upload files
    print("\n>>> Step 1: Setting up migration environment")
    ssh.exec_command('rm -rf /tmp/dalia-migrate && mkdir -p /tmp/dalia-migrate/prisma')
    time.sleep(1)

    # Upload schema via SFTP
    sftp = ssh.open_sftp()
    sftp.put('/home/z/my-project/prisma/schema.prisma', '/tmp/dalia-migrate/prisma/schema.prisma')
    sftp.close()
    print("  Schema uploaded")

    # Upload seed script
    sftp = ssh.open_sftp()
    sftp.put('/home/z/my-project/prisma/seed.ts', '/tmp/dalia-migrate/prisma/seed.ts')
    sftp.close()
    print("  Seed script uploaded")

    # Create package.json
    pkg = json.dumps({
        "name": "dalia-migrate",
        "type": "module",
        "dependencies": {
            "prisma": "^6.11.0",
            "@prisma/client": "^6.11.0",
            "bcryptjs": "^2.4.3"
        }
    })
    stdin, stdout, stderr = ssh.exec_command(f"cat > /tmp/dalia-migrate/package.json << 'PKGEOF'\n{pkg}\nPKGEOF")
    stdout.read()

    # Step 2: Install dependencies
    print("\n>>> Step 2: Installing dependencies")
    out, err = ssh_cmd(ssh, "cd /tmp/dalia-migrate && npm install 2>&1", timeout=120)
    print(f"  npm install: {err[-200:] if err else 'OK'}")

    # Step 3: Generate Prisma client
    print("\n>>> Step 3: Generating Prisma client")
    out, err = ssh_cmd(ssh, f"cd /tmp/dalia-migrate && DATABASE_URL='{DB_URL}' DIRECT_URL='{DB_URL}' npx prisma generate 2>&1", timeout=60)
    print(f"  Output: {out[-200:]}")
    if err and 'error' in err.lower():
        print(f"  Error: {err[-200:]}")

    # Step 4: Push schema
    print("\n>>> Step 4: Pushing schema to database")
    out, err = ssh_cmd(ssh, f"cd /tmp/dalia-migrate && DATABASE_URL='{DB_URL}' DIRECT_URL='{DB_URL}' npx prisma db push --accept-data-loss 2>&1", timeout=120)
    print(f"  Output: {out[-300:]}")
    if err and 'error' in err.lower():
        print(f"  Error: {err[-200:]}")

    # Step 5: Verify tables were created
    print("\n>>> Step 5: Verifying tables")
    out, err = ssh_cmd(ssh, "docker exec m2gr4uesqj3npja5a2exvqql psql -U crm -d dalia -c \"\\dt\" 2>&1")
    print(f"  Tables:\n{out}")

    # Step 6: Create a minimal seed script (using SQL for simplicity)
    print("\n>>> Step 6: Seeding database via SQL")
    
    # First, we need to hash the passwords. Let's create a Node.js script to generate the hashes
    # and then use SQL to insert all data
    seed_sql = """
-- Create employees
INSERT INTO "Employee" (id, nom, email, telephone, role, "createdAt", "updatedAt") VALUES 
('emp_khaled', 'Khaled Layoune', 'khaled@mihealthcare.dz', '0555123456', 'admin', NOW(), NOW()),
('emp_amine', 'Amine Benali', 'amine@mihealthcare.dz', '0555789012', 'commercial', NOW(), NOW()),
('emp_sara', 'Sara Mansouri', 'sara@mihealthcare.dz', '0555345678', 'commercial', NOW(), NOW()),
('emp_youcef', 'Youcef Khelifi', 'youcef@mihealthcare.dz', '0555901234', 'technicien', NOW(), NOW()),
('emp_nadia', 'Nadia Boudiaf', 'nadia@mihealthcare.dz', '0555567890', 'technicien', NOW(), NOW());

-- Create users (passwords: admin123, com123, tech123 - bcrypt hashed)
-- We'll generate these hashes via Node.js first
"""
    
    # Generate bcrypt hashes via Node.js on the server
    print("  Generating password hashes...")
    out, err = ssh_cmd(ssh, "cd /tmp/dalia-migrate && node -e \"const b=require('bcryptjs');Promise.all([b.hash('admin123',10),b.hash('com123',10),b.hash('tech123',10)]).then(r=>console.log(r.join('|')))\" 2>&1")
    hashes = out.strip().split('|')
    if len(hashes) != 3:
        print(f"  Error generating hashes: {out} {err}")
        sys.exit(1)
    print(f"  Hashes generated: admin={hashes[0][:20]}... com={hashes[1][:20]}... tech={hashes[2][:20]}...")
    
    hash_admin = hashes[0]
    hash_com = hashes[1]
    hash_tech = hashes[2]

    full_seed_sql = f"""
-- Employees
INSERT INTO "Employee" (id, nom, email, telephone, role, "createdAt", "updatedAt") VALUES 
('emp_khaled', 'Khaled Layoune', 'khaled@mihealthcare.dz', '0555123456', 'admin', NOW(), NOW()),
('emp_amine', 'Amine Benali', 'amine@mihealthcare.dz', '0555789012', 'commercial', NOW(), NOW()),
('emp_sara', 'Sara Mansouri', 'sara@mihealthcare.dz', '0555345678', 'commercial', NOW(), NOW()),
('emp_youcef', 'Youcef Khelifi', 'youcef@mihealthcare.dz', '0555901234', 'technicien', NOW(), NOW()),
('emp_nadia', 'Nadia Boudiaf', 'nadia@mihealthcare.dz', '0555567890', 'technicien', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Prospects
INSERT INTO "Prospect" (id, nom, specialite, wilaya, telephone, whatsapp, etablissement, source, "isClient", "createdAt", "updatedAt") VALUES 
('pr_benahmed', 'Dr. Benahmed Mohamed', 'Cardiologie', 'Alger', '0661234567', '0661234567', 'CHU Mustapha Pacha', 'evenement', true, NOW(), NOW()),
('pr_zerhouni', 'Dr. Zerhouni Fatima', 'Radiologie', 'Oran', '0662345678', '0662345678', 'CHU Oran', 'recommandation', true, NOW(), NOW()),
('pr_bouzid', 'Dr. Bouzid Karim', 'Orthopédie', 'Constantine', '0663456789', '0663456789', 'CHU Constantine', 'prospection', false, NOW(), NOW()),
('pr_mebarki', 'Dr. Mebarki Amina', 'Chirurgie', 'Annaba', '0664567890', '0664567890', 'CHU Annaba', 'evenement', true, NOW(), NOW()),
('pr_taleb', 'Dr. Taleb Nouredine', 'Anesthésie', 'Sétif', '0665678901', '0665678901', 'Hôpital Sétif', 'prospection', false, NOW(), NOW()),
('pr_hamidi', 'Dr. Hamidi Leila', 'Cardiologie', 'Blida', '0666789012', '0666789012', 'CHU Blida', 'recommandation', true, NOW(), NOW()),
('pr_benmoussa', 'Dr. Benmoussa Rachid', 'Médecine générale', 'Tlemcen', '0667890123', NULL, 'Clinique El Amel Tlemcen', 'evenement', false, NOW(), NOW()),
('pr_kaci', 'Dr. Kaci Samira', 'Radiologie', 'Béjaïa', '0668901234', '0668901234', 'CHU Béjaïa', 'prospection', false, NOW(), NOW()),
('pr_clinique', 'Clinique Les Deux Bassins', 'Chirurgie', 'Alger', '0669012345', NULL, 'Clinique Les Deux Bassins', 'prospection', true, NOW(), NOW()),
('pr_ouali', 'Dr. Ouali Mustapha', 'Orthopédie', 'Batna', '0660123456', '0660123456', 'CHU Batna', 'recommandation', false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Users
INSERT INTO "User" (id, email, "motDePasse", "employeId", role, "createdAt", "updatedAt") VALUES 
('usr_khaled', 'khaled@mihealthcare.dz', '{hash_admin}', 'emp_khaled', 'admin', NOW(), NOW()),
('usr_amine', 'amine@mihealthcare.dz', '{hash_com}', 'emp_amine', 'commercial', NOW(), NOW()),
('usr_sara', 'sara@mihealthcare.dz', '{hash_com}', 'emp_sara', 'commercial', NOW(), NOW()),
('usr_youcef', 'youcef@mihealthcare.dz', '{hash_tech}', 'emp_youcef', 'technicien', NOW(), NOW()),
('usr_nadia', 'nadia@mihealthcare.dz', '{hash_tech}', 'emp_nadia', 'technicien', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Events
INSERT INTO "Event" (id, nom, ville, date, type, marques, equipe, "createdAt", "updatedAt") VALUES 
('evt_medexpo', 'MedExpo Algérie 2025', 'Alger', '2025-10-15', 'expo', 'MIR,BOS,Yuwell', 'Amine, Sara', NOW(), NOW()),
('evt_cardio', 'Congrès National de Cardiologie', 'Oran', '2025-11-20', 'congres', 'MIR,Löwenstein', 'Amine, Khaled', NOW(), NOW()),
('evt_vent', 'Formation Ventilateurs Löwenstein', 'Alger', '2025-12-05', 'formation', 'Löwenstein', 'Youcef, Nadia', NOW(), NOW()),
('evt_sante', 'Santé Expo 2026', 'Constantine', '2026-03-10', 'expo', 'MIR,BOS,Gelenke,Yuwell', 'Sara, Amine', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Event-Prospect links
INSERT INTO "EventProspect" (id, "eventId", "prospectId", "createdAt", "updatedAt") VALUES 
('ep1', 'evt_medexpo', 'pr_benahmed', NOW(), NOW()),
('ep2', 'evt_medexpo', 'pr_bouzid', NOW(), NOW()),
('ep3', 'evt_medexpo', 'pr_benmoussa', NOW(), NOW()),
('ep4', 'evt_cardio', 'pr_zerhouni', NOW(), NOW()),
('ep5', 'evt_cardio', 'pr_hamidi', NOW(), NOW()),
('ep6', 'evt_sante', 'pr_kaci', NOW(), NOW()),
('ep7', 'evt_sante', 'pr_ouali', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Opportunities
INSERT INTO "Opportunity" (id, "clientId", "nomProjet", statut, "montantEstime", "commercialId", "createdAt", "updatedAt") VALUES 
('opp1', 'pr_benahmed', 'Équipement Cardiologie CHU Mustapha', 'Négociation', 8500000, 'emp_amine', NOW(), NOW()),
('opp2', 'pr_zerhouni', 'Salle Radiologie CHU Oran', 'Devis', 12000000, 'emp_sara', NOW(), NOW()),
('opp3', 'pr_mebarki', 'Bloc Opératoire CHU Annaba', 'Gagné', 15000000, 'emp_amine', NOW(), NOW()),
('opp4', 'pr_hamidi', 'Moniteurs Cardiaques CHU Blida', 'Intéressé', 4500000, 'emp_sara', NOW(), NOW()),
('opp5', 'pr_clinique', 'Équipement Complet Clinique', 'Gagné', 22000000, 'emp_amine', NOW(), NOW()),
('opp6', 'pr_bouzid', 'Orthopédie CHU Constantine', 'Contacté', 6000000, 'emp_sara', NOW(), NOW()),
('opp7', NULL, 'Prospect Tlemcen - Échographe', 'Nouveau', 3500000, 'emp_amine', NOW(), NOW()),
('opp8', 'pr_taleb', 'Anesthésie Hôpital Sétif', 'Perdu', 5000000, 'emp_sara', NOW(), NOW()),
('opp9', 'pr_kaci', 'IRM CHU Béjaïa', 'Intéressé', 18000000, 'emp_amine', NOW(), NOW()),
('opp10', NULL, 'Ventilateurs CHU Batna', 'Contacté', 7500000, 'emp_sara', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Operations
INSERT INTO "Operation" (id, "opportunityId", produit, marque, "responsableId", "prixEstime", marge, statut, "datePrevue", priorite, "createdAt", "updatedAt") VALUES 
('op1', 'opp1', 'Moniteur Patient MIR', 'MIR', 'emp_amine', 3500000, 700000, 'en_cours', '2026-02-15', 'haute', NOW(), NOW()),
('op2', 'opp1', 'Défibrillateur BOS', 'BOS', 'emp_amine', 5000000, 1000000, 'en_attente', '2026-03-01', 'haute', NOW(), NOW()),
('op3', 'opp2', 'Échographe Yuwell', 'Yuwell', 'emp_sara', 7000000, 1400000, 'en_cours', '2026-02-20', 'moyenne', NOW(), NOW()),
('op4', 'opp2', 'Table Radiologie Yuwell', 'Yuwell', 'emp_sara', 5000000, 900000, 'en_attente', NULL, 'moyenne', NOW(), NOW()),
('op5', 'opp3', 'Lampe Opératoire BOS', 'BOS', 'emp_amine', 6000000, 1200000, 'termine', '2025-12-01', 'haute', NOW(), NOW()),
('op6', 'opp3', 'Table Opératoire Gelenke', 'Gelenke', 'emp_amine', 9000000, 1800000, 'termine', NULL, 'haute', NOW(), NOW()),
('op7', 'opp4', 'Moniteur Cardiaque MIR', 'MIR', 'emp_sara', 4500000, 900000, 'en_attente', NULL, 'moyenne', NOW(), NOW()),
('op8', 'opp5', 'Ventilateur Löwenstein', 'Löwenstein', 'emp_amine', 8000000, 1600000, 'termine', '2025-11-15', 'haute', NOW(), NOW()),
('op9', 'opp5', 'Système Anesthésie Löwenstein', 'Löwenstein', 'emp_amine', 14000000, 2800000, 'en_cours', NULL, 'haute', NOW(), NOW()),
('op10', 'opp9', 'IRM Yuwell', 'Yuwell', 'emp_amine', 18000000, 3600000, 'en_attente', '2026-04-01', 'haute', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Tasks
INSERT INTO "Task" (id, titre, type, "assigneAId", "opportunityId", "dateEcheance", priorite, statut, "createdAt", "updatedAt") VALUES 
('task1', 'Relancer Dr. Benahmed pour devis', 'commerciale', 'emp_amine', 'opp1', '2026-01-10', 'haute', 'en_attente', NOW(), NOW()),
('task2', 'Préparer devis échographe CHU Oran', 'commerciale', 'emp_sara', 'opp2', '2026-01-15', 'haute', 'en_cours', NOW(), NOW()),
('task3', 'Installation lampe opératoire CHU Annaba', 'technique', 'emp_youcef', 'opp3', '2025-12-20', 'haute', 'terminee', NOW(), NOW()),
('task4', 'Formation équipe CHU Annaba', 'technique', 'emp_nadia', 'opp3', '2025-12-25', 'moyenne', 'terminee', NOW(), NOW()),
('task5', 'Organiser stand MedExpo', 'evenement', 'emp_sara', NULL, '2025-10-14', 'haute', 'terminee', NOW(), NOW()),
('task6', 'Appeler Dr. Taleb pour suivi', 'commerciale', 'emp_sara', NULL, '2025-12-28', 'moyenne', 'en_attente', NOW(), NOW()),
('task7', 'Réunion hebdomadaire commerciale', 'interne', 'emp_khaled', NULL, '2026-01-06', 'basse', 'en_attente', NOW(), NOW()),
('task8', 'Installation système anesthésie clinique Alger', 'technique', 'emp_youcef', 'opp5', '2026-01-20', 'haute', 'en_cours', NOW(), NOW()),
('task9', 'Envoyer catalogue Yuwell au Dr. Kaci', 'commerciale', 'emp_amine', 'opp9', '2026-01-08', 'moyenne', 'en_attente', NOW(), NOW()),
('task10', 'Préparation démonstration ventilateurs', 'technique', 'emp_youcef', NULL, '2026-01-12', 'moyenne', 'en_attente', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Fix task5/6 event link
UPDATE "Task" SET "eventId" = 'evt_medexpo' WHERE id = 'task5';
UPDATE "Task" SET "prospectId" = 'pr_taleb' WHERE id = 'task6';
UPDATE "Task" SET "prospectId" = 'pr_kaci' WHERE id = 'task9';

-- Interactions
INSERT INTO "Interaction" (id, type, "prospectId", "opportunityId", notes, "employeId", date, "createdAt", "updatedAt") VALUES 
('int1', 'appel', 'pr_benahmed', 'opp1', 'Discussion sur les spécifications du moniteur patient. Très intéressé.', 'emp_amine', '2025-12-15', NOW(), NOW()),
('int2', 'visite', 'pr_zerhouni', 'opp2', 'Visite du site, mesures pour installation échographe.', 'emp_sara', '2025-12-18', NOW(), NOW()),
('int3', 'whatsapp', 'pr_hamidi', 'opp4', 'Envoi documentation moniteurs cardiaques MIR.', 'emp_sara', '2025-12-20', NOW(), NOW()),
('int4', 'email', 'pr_bouzid', 'opp6', 'Envoi devis préliminaire équipement orthopédie.', 'emp_sara', '2025-12-22', NOW(), NOW()),
('int5', 'appel', 'pr_kaci', 'opp9', 'Premier contact, très intéressée par IRM Yuwell.', 'emp_amine', '2025-12-28', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- After-sales
INSERT INTO "AfterSale" (id, "clientId", type, statut, date, "employeId", notes, "createdAt", "updatedAt") VALUES 
('sav1', 'pr_mebarki', 'installation', 'termine', '2025-12-10', 'emp_youcef', 'Installation lampe et table opératoire terminée avec succès.', NOW(), NOW()),
('sav2', 'pr_mebarki', 'formation', 'termine', '2025-12-15', 'emp_nadia', 'Formation équipe chirurgicale sur table Gelenke.', NOW(), NOW()),
('sav3', 'pr_clinique', 'installation', 'en_cours', '2026-01-10', 'emp_youcef', 'Installation ventilateurs Löwenstein en cours.', NOW(), NOW()),
('sav4', 'pr_clinique', 'sav', 'en_attente', NULL, 'emp_youcef', 'Demande maintenance moniteur MIR - écran défectueux.', NOW(), NOW()),
('sav5', 'pr_benahmed', 'livraison', 'en_attente', '2026-02-01', 'emp_youcef', 'Livraison moniteur patient prévue février.', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Objectives
INSERT INTO "Objective" (id, "employeId", mois, "caObjectif", "nbVentesObjectif", "tachesObjectif", "createdAt", "updatedAt") VALUES 
('obj1', 'emp_amine', '2026-01', 5000000, 3, 15, NOW(), NOW()),
('obj2', 'emp_sara', '2026-01', 4000000, 2, 12, NOW(), NOW()),
('obj3', 'emp_youcef', '2026-01', NULL, NULL, 8, NOW(), NOW()),
('obj4', 'emp_nadia', '2026-01', NULL, NULL, 6, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Chat conversation (Général)
INSERT INTO "ChatConversation" (id, type, nom, "createdAt", "updatedAt") VALUES 
('chat_general', 'group', 'Général', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Chat participants
INSERT INTO "ChatParticipant" (id, "conversationId", "employeId", "createdAt", "updatedAt") VALUES 
('cp1', 'chat_general', 'emp_khaled', NOW(), NOW()),
('cp2', 'chat_general', 'emp_amine', NOW(), NOW()),
('cp3', 'chat_general', 'emp_sara', NOW(), NOW()),
('cp4', 'chat_general', 'emp_youcef', NOW(), NOW()),
('cp5', 'chat_general', 'emp_nadia', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
"""

    # Write the SQL file to the server
    print("  Writing seed SQL to server...")
    sql_path = '/tmp/dalia-migrate/seed.sql'
    
    # Write via SFTP
    with sftp as sf:
        sf = ssh.open_sftp()
        with sf.open(sql_path, 'w') as f:
            f.write(full_seed_sql)
    
    print("  Running seed SQL...")
    out, err = ssh_cmd(ssh, f"docker exec -i m2gr4uesqj3npja5a2exvqql psql -U crm -d dalia < {sql_path} 2>&1", timeout=60)
    print(f"  Result: {out[-500:]}")
    if 'ERROR' in out.upper():
        print(f"  Errors found in output!")
    
    # Step 7: Verify data
    print("\n>>> Step 7: Verifying data")
    tables_to_check = ['Employee', 'User', 'Prospect', 'Event', 'Opportunity', 'Operation', 'Task', 'Interaction', 'AfterSale', 'Objective']
    for table in tables_to_check:
        out, err = ssh_cmd(ssh, f'docker exec m2gr4uesqj3npja5a2exvqql psql -U crm -d dalia -t -c "SELECT count(*) FROM \\\"{table}\\\"" 2>&1')
        count = out.strip()
        print(f"  {table}: {count}")

    # Cleanup
    print("\n>>> Cleaning up temp files")
    ssh.exec_command('rm -rf /tmp/dalia-migrate')
    
    ssh.close()
    print("\n>>> Database setup complete!")

if __name__ == '__main__':
    main()
