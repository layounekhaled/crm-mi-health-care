#!/usr/bin/env python3
"""Seed the Dalia database with initial data using SQL via the PG container."""
import paramiko
import sys

HOST = '156.67.26.104'
USER = 'root'
PASSWORD = 'N8l1q67yIa5LI4V48unaE'

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

    # Step 1: Generate password hashes via the Node container on the coolify network
    print("\n>>> Step 1: Generating password hashes")
    out, err = ssh_cmd(ssh, """docker run --rm --network coolify -v /tmp/dalia-migrate:/app -w /app node:20-alpine node -e "const b=require('bcryptjs');Promise.all([b.hash('admin123',10),b.hash('com123',10),b.hash('tech123',10)]).then(r=>console.log(r.join('|')))" 2>&1""", timeout=60)
    
    # Parse the output - the hash line should be the last non-empty line
    lines = [l.strip() for l in out.strip().split('\n') if l.strip() and l.strip().startswith('$2')]
    if not lines:
        print(f"  Error: Could not find hashes in output: {out[-300:]}")
        sys.exit(1)
    
    hashes = lines[-1].split('|')
    if len(hashes) != 3:
        print(f"  Error: Expected 3 hashes, got {len(hashes)}: {lines[-1][:100]}")
        sys.exit(1)
    
    hash_admin, hash_com, hash_tech = hashes
    print(f"  Admin hash: {hash_admin[:30]}...")
    print(f"  Commercial hash: {hash_com[:30]}...")
    print(f"  Technicien hash: {hash_tech[:30]}...")

    # Step 2: Write seed SQL
    print("\n>>> Step 2: Writing seed SQL")
    
    seed_sql = f"""
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

-- Users (with bcrypt hashed passwords)
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
INSERT INTO "Task" (id, titre, type, "assigneAId", "opportunityId", "eventId", "prospectId", "dateEcheance", priorite, statut, "createdAt", "updatedAt") VALUES 
('task1', 'Relancer Dr. Benahmed pour devis', 'commerciale', 'emp_amine', 'opp1', NULL, NULL, '2026-01-10', 'haute', 'en_attente', NOW(), NOW()),
('task2', 'Préparer devis échographe CHU Oran', 'commerciale', 'emp_sara', 'opp2', NULL, NULL, '2026-01-15', 'haute', 'en_cours', NOW(), NOW()),
('task3', 'Installation lampe opératoire CHU Annaba', 'technique', 'emp_youcef', 'opp3', NULL, NULL, '2025-12-20', 'haute', 'terminee', NOW(), NOW()),
('task4', 'Formation équipe CHU Annaba', 'technique', 'emp_nadia', 'opp3', NULL, NULL, '2025-12-25', 'moyenne', 'terminee', NOW(), NOW()),
('task5', 'Organiser stand MedExpo', 'evenement', 'emp_sara', NULL, 'evt_medexpo', NULL, '2025-10-14', 'haute', 'terminee', NOW(), NOW()),
('task6', 'Appeler Dr. Taleb pour suivi', 'commerciale', 'emp_sara', NULL, NULL, 'pr_taleb', '2025-12-28', 'moyenne', 'en_attente', NOW(), NOW()),
('task7', 'Réunion hebdomadaire commerciale', 'interne', 'emp_khaled', NULL, NULL, NULL, '2026-01-06', 'basse', 'en_attente', NOW(), NOW()),
('task8', 'Installation système anesthésie clinique Alger', 'technique', 'emp_youcef', 'opp5', NULL, NULL, '2026-01-20', 'haute', 'en_cours', NOW(), NOW()),
('task9', 'Envoyer catalogue Yuwell au Dr. Kaci', 'commerciale', 'emp_amine', 'opp9', NULL, 'pr_kaci', '2026-01-08', 'moyenne', 'en_attente', NOW(), NOW()),
('task10', 'Préparation démonstration ventilateurs', 'technique', 'emp_youcef', NULL, NULL, NULL, '2026-01-12', 'moyenne', 'en_attente', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

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

    # Write SQL to server
    sftp = ssh.open_sftp()
    with sftp.open('/tmp/dalia-migrate/seed.sql', 'w') as f:
        f.write(seed_sql)
    sftp.close()
    print("  Seed SQL written")

    # Step 3: Execute seed SQL
    print("\n>>> Step 3: Executing seed SQL")
    out, err = ssh_cmd(ssh, "docker exec -i m2gr4uesqj3npja5a2exvqql psql -U crm -d dalia < /tmp/dalia-migrate/seed.sql 2>&1", timeout=60)
    
    # Check for errors
    if 'ERROR' in out.upper():
        print(f"  ERRORS found!")
        # Print just the error lines
        for line in out.split('\n'):
            if 'ERROR' in line.upper():
                print(f"  {line}")
    else:
        print("  Seed executed successfully")

    # Step 4: Verify data counts
    print("\n>>> Step 4: Verifying data counts")
    tables = ['Employee', 'User', 'Prospect', 'Event', 'Opportunity', 'Operation', 'Task', 'Interaction', 'AfterSale', 'Objective', 'ChatConversation', 'ChatParticipant']
    for table in tables:
        out, err = ssh_cmd(ssh, f'docker exec m2gr4uesqj3npja5a2exvqql psql -U crm -d dalia -t -c "SELECT count(*) FROM \\\"{table}\\\"" 2>&1')
        count = out.strip()
        print(f"  {table}: {count}")

    ssh.close()
    print("\n>>> Database seeded successfully!")

if __name__ == '__main__':
    main()
