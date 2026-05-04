import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Auto-initialize database for serverless environments (Vercel)
let dbInitialized = false

export async function ensureDbInitialized() {
  if (dbInitialized) return
  
  try {
    // Check if database has data by counting prospects
    const count = await db.prospect.count()
    if (count === 0) {
      console.log('[DB] Empty database detected, running seed...')
      await seedDatabase()
    }
    dbInitialized = true
  } catch (error) {
    console.error('[DB] Initialization check failed:', error)
    // If the table doesn't exist, the database needs to be created
    // On Vercel with SQLite, this will fail - we need a persistent DB
    dbInitialized = true
  }
}

async function seedDatabase() {
  // Create employees
  const khaled = await db.employee.create({ data: { nom: 'Khaled Layoune', email: 'khaled@mihealthcare.dz', telephone: '0555123456', role: 'admin' } })
  const amine = await db.employee.create({ data: { nom: 'Amine Benali', email: 'amine@mihealthcare.dz', telephone: '0555789012', role: 'commercial' } })
  const sara = await db.employee.create({ data: { nom: 'Sara Mansouri', email: 'sara@mihealthcare.dz', telephone: '0555345678', role: 'commercial' } })
  const youcef = await db.employee.create({ data: { nom: 'Youcef Khelifi', email: 'youcef@mihealthcare.dz', telephone: '0555901234', role: 'technicien' } })
  const nadia = await db.employee.create({ data: { nom: 'Nadia Boudiaf', email: 'nadia@mihealthcare.dz', telephone: '0555567890', role: 'technicien' } })

  // Create prospects
  const drBenahmed = await db.prospect.create({ data: { nom: 'Dr. Benahmed Mohamed', specialite: 'Cardiologie', wilaya: 'Alger', telephone: '0661234567', whatsapp: '0661234567', etablissement: 'CHU Mustapha Pacha', source: 'evenement', isClient: true } })
  const drZerhouni = await db.prospect.create({ data: { nom: 'Dr. Zerhouni Fatima', specialite: 'Radiologie', wilaya: 'Oran', telephone: '0662345678', whatsapp: '0662345678', etablissement: 'CHU Oran', source: 'recommandation', isClient: true } })
  const drBouzid = await db.prospect.create({ data: { nom: 'Dr. Bouzid Karim', specialite: 'Orthopédie', wilaya: 'Constantine', telephone: '0663456789', whatsapp: '0663456789', etablissement: 'CHU Constantine', source: 'prospection', isClient: false } })
  const drMebarki = await db.prospect.create({ data: { nom: 'Dr. Mebarki Amina', specialite: 'Chirurgie', wilaya: 'Annaba', telephone: '0664567890', whatsapp: '0664567890', etablissement: 'CHU Annaba', source: 'evenement', isClient: true } })
  const drTaleb = await db.prospect.create({ data: { nom: 'Dr. Taleb Nouredine', specialite: 'Anesthésie', wilaya: 'Sétif', telephone: '0665678901', whatsapp: '0665678901', etablissement: 'Hôpital Sétif', source: 'prospection', isClient: false } })
  const drHamidi = await db.prospect.create({ data: { nom: 'Dr. Hamidi Leila', specialite: 'Cardiologie', wilaya: 'Blida', telephone: '0666789012', whatsapp: '0666789012', etablissement: 'CHU Blida', source: 'recommandation', isClient: true } })
  const drBenmoussa = await db.prospect.create({ data: { nom: 'Dr. Benmoussa Rachid', specialite: 'Médecine générale', wilaya: 'Tlemcen', telephone: '0667890123', etablissement: 'Clinique El Amel Tlemcen', source: 'evenement', isClient: false } })
  const drKaci = await db.prospect.create({ data: { nom: 'Dr. Kaci Samira', specialite: 'Radiologie', wilaya: 'Béjaïa', telephone: '0668901234', whatsapp: '0668901234', etablissement: 'CHU Béjaïa', source: 'prospection', isClient: false } })
  const cliniqueAlger = await db.prospect.create({ data: { nom: 'Clinique Les Deux Bassins', specialite: 'Chirurgie', wilaya: 'Alger', telephone: '0669012345', etablissement: 'Clinique Les Deux Bassins', source: 'prospection', isClient: true } })
  const drOuali = await db.prospect.create({ data: { nom: 'Dr. Ouali Mustapha', specialite: 'Orthopédie', wilaya: 'Batna', telephone: '0660123456', whatsapp: '0660123456', etablissement: 'CHU Batna', source: 'recommandation', isClient: false } })

  // Create events
  const medExpo = await db.event.create({ data: { nom: 'MedExpo Algérie 2025', ville: 'Alger', date: new Date('2025-10-15'), type: 'expo', marques: 'MIR,BOS,Yuwell', equipe: 'Amine, Sara' } })
  const congresCardio = await db.event.create({ data: { nom: 'Congrès National de Cardiologie', ville: 'Oran', date: new Date('2025-11-20'), type: 'congres', marques: 'MIR,Löwenstein', equipe: 'Amine, Khaled' } })
  await db.event.create({ data: { nom: 'Formation Ventilateurs Löwenstein', ville: 'Alger', date: new Date('2025-12-05'), type: 'formation', marques: 'Löwenstein', equipe: 'Youcef, Nadia' } })
  await db.event.create({ data: { nom: 'Santé Expo 2026', ville: 'Constantine', date: new Date('2026-03-10'), type: 'expo', marques: 'MIR,BOS,Gelenke,Yuwell', equipe: 'Sara, Amine' } })

  // Link prospects to events
  await db.eventProspect.create({ data: { eventId: medExpo.id, prospectId: drBenahmed.id } })
  await db.eventProspect.create({ data: { eventId: medExpo.id, prospectId: drBouzid.id } })
  await db.eventProspect.create({ data: { eventId: medExpo.id, prospectId: drBenmoussa.id } })
  await db.eventProspect.create({ data: { eventId: congresCardio.id, prospectId: drZerhouni.id } })
  await db.eventProspect.create({ data: { eventId: congresCardio.id, prospectId: drHamidi.id } })

  // Create opportunities
  const opp1 = await db.opportunity.create({ data: { clientId: drBenahmed.id, nomProjet: 'Équipement Cardiologie CHU Mustapha', statut: 'Négociation', montantEstime: 8500000, commercialId: amine.id } })
  const opp2 = await db.opportunity.create({ data: { clientId: drZerhouni.id, nomProjet: 'Salle Radiologie CHU Oran', statut: 'Devis', montantEstime: 12000000, commercialId: sara.id } })
  const opp3 = await db.opportunity.create({ data: { clientId: drMebarki.id, nomProjet: 'Bloc Opératoire CHU Annaba', statut: 'Gagné', montantEstime: 15000000, commercialId: amine.id } })
  const opp4 = await db.opportunity.create({ data: { clientId: drHamidi.id, nomProjet: 'Moniteurs Cardiaques CHU Blida', statut: 'Intéressé', montantEstime: 4500000, commercialId: sara.id } })
  const opp5 = await db.opportunity.create({ data: { clientId: cliniqueAlger.id, nomProjet: 'Équipement Complet Clinique', statut: 'Gagné', montantEstime: 22000000, commercialId: amine.id } })
  const opp6 = await db.opportunity.create({ data: { clientId: drBouzid.id, nomProjet: 'Orthopédie CHU Constantine', statut: 'Contacté', montantEstime: 6000000, commercialId: sara.id } })
  await db.opportunity.create({ data: { nomProjet: 'Prospect Tlemcen - Échographe', statut: 'Nouveau', montantEstime: 3500000, commercialId: amine.id } })
  await db.opportunity.create({ data: { clientId: drTaleb.id, nomProjet: 'Anesthésie Hôpital Sétif', statut: 'Perdu', montantEstime: 5000000, motifPerte: 'Concurrent choisi', commercialId: sara.id } })
  const opp9 = await db.opportunity.create({ data: { clientId: drKaci.id, nomProjet: 'IRM CHU Béjaïa', statut: 'Intéressé', montantEstime: 18000000, commercialId: amine.id } })
  await db.opportunity.create({ data: { nomProjet: 'Ventilateurs CHU Batna', statut: 'Contacté', montantEstime: 7500000, commercialId: sara.id } })

  // Create operations
  await db.operation.create({ data: { opportunityId: opp1.id, produit: 'Moniteur Patient MIR', marque: 'MIR', responsableId: amine.id, prixEstime: 3500000, marge: 700000, statut: 'en_cours', datePrevue: new Date('2026-02-15'), priorite: 'haute' } })
  await db.operation.create({ data: { opportunityId: opp1.id, produit: 'Défibrillateur BOS', marque: 'BOS', responsableId: amine.id, prixEstime: 5000000, marge: 1000000, statut: 'en_attente', datePrevue: new Date('2026-03-01'), priorite: 'haute' } })
  await db.operation.create({ data: { opportunityId: opp2.id, produit: 'Échographe Yuwell', marque: 'Yuwell', responsableId: sara.id, prixEstime: 7000000, marge: 1400000, statut: 'en_cours', datePrevue: new Date('2026-02-20'), priorite: 'moyenne' } })
  await db.operation.create({ data: { opportunityId: opp3.id, produit: 'Lampe Opératoire BOS', marque: 'BOS', responsableId: amine.id, prixEstime: 6000000, marge: 1200000, statut: 'termine', datePrevue: new Date('2025-12-01'), priorite: 'haute' } })
  await db.operation.create({ data: { opportunityId: opp3.id, produit: 'Table Opératoire Gelenke', marque: 'Gelenke', responsableId: amine.id, prixEstime: 9000000, marge: 1800000, statut: 'termine', priorite: 'haute' } })
  await db.operation.create({ data: { opportunityId: opp5.id, produit: 'Ventilateur Löwenstein', marque: 'Löwenstein', responsableId: amine.id, prixEstime: 8000000, marge: 1600000, statut: 'termine', datePrevue: new Date('2025-11-15'), priorite: 'haute' } })
  await db.operation.create({ data: { opportunityId: opp5.id, produit: 'Système Anesthésie Löwenstein', marque: 'Löwenstein', responsableId: amine.id, prixEstime: 14000000, marge: 2800000, statut: 'en_cours', priorite: 'haute' } })
  await db.operation.create({ data: { opportunityId: opp9.id, produit: 'IRM Yuwell', marque: 'Yuwell', responsableId: amine.id, prixEstime: 18000000, marge: 3600000, statut: 'en_attente', datePrevue: new Date('2026-04-01'), priorite: 'haute' } })

  // Create tasks
  await db.task.create({ data: { titre: 'Relancer Dr. Benahmed pour devis', type: 'commerciale', assigneAId: amine.id, opportunityId: opp1.id, dateEcheance: new Date('2026-01-10'), priorite: 'haute', statut: 'en_attente' } })
  await db.task.create({ data: { titre: 'Préparer devis échographe CHU Oran', type: 'commerciale', assigneAId: sara.id, opportunityId: opp2.id, dateEcheance: new Date('2026-01-15'), priorite: 'haute', statut: 'en_cours' } })
  await db.task.create({ data: { titre: 'Installation lampe opératoire CHU Annaba', type: 'technique', assigneAId: youcef.id, opportunityId: opp3.id, dateEcheance: new Date('2025-12-20'), priorite: 'haute', statut: 'terminee' } })
  await db.task.create({ data: { titre: 'Formation équipe CHU Annaba', type: 'technique', assigneAId: nadia.id, opportunityId: opp3.id, dateEcheance: new Date('2025-12-25'), priorite: 'moyenne', statut: 'terminee' } })
  await db.task.create({ data: { titre: 'Organiser stand MedExpo', type: 'evenement', assigneAId: sara.id, eventId: medExpo.id, dateEcheance: new Date('2025-10-14'), priorite: 'haute', statut: 'terminee' } })
  await db.task.create({ data: { titre: 'Appeler Dr. Taleb pour suivi', type: 'commerciale', assigneAId: sara.id, prospectId: drTaleb.id, dateEcheance: new Date('2025-12-28'), priorite: 'moyenne', statut: 'en_attente' } })
  await db.task.create({ data: { titre: 'Réunion hebdomadaire commerciale', type: 'interne', assigneAId: khaled.id, dateEcheance: new Date('2026-01-06'), priorite: 'basse', statut: 'en_attente' } })
  await db.task.create({ data: { titre: 'Installation système anesthésie clinique Alger', type: 'technique', assigneAId: youcef.id, opportunityId: opp5.id, dateEcheance: new Date('2026-01-20'), priorite: 'haute', statut: 'en_cours' } })
  await db.task.create({ data: { titre: 'Envoyer catalogue Yuwell au Dr. Kaci', type: 'commerciale', assigneAId: amine.id, prospectId: drKaci.id, opportunityId: opp9.id, dateEcheance: new Date('2026-01-08'), priorite: 'moyenne', statut: 'en_attente' } })
  await db.task.create({ data: { titre: 'Préparation démonstration ventilateurs', type: 'technique', assigneAId: youcef.id, dateEcheance: new Date('2026-01-12'), priorite: 'moyenne', statut: 'en_attente' } })

  // Create interactions
  await db.interaction.create({ data: { type: 'appel', prospectId: drBenahmed.id, opportunityId: opp1.id, notes: 'Discussion sur les spécifications du moniteur patient. Très intéressé.', employeId: amine.id, date: new Date('2025-12-15') } })
  await db.interaction.create({ data: { type: 'visite', prospectId: drZerhouni.id, opportunityId: opp2.id, notes: 'Visite du site, mesures pour installation échographe.', employeId: sara.id, date: new Date('2025-12-18') } })
  await db.interaction.create({ data: { type: 'whatsapp', prospectId: drHamidi.id, opportunityId: opp4.id, notes: 'Envoi documentation moniteurs cardiaques MIR.', employeId: sara.id, date: new Date('2025-12-20') } })
  await db.interaction.create({ data: { type: 'email', prospectId: drBouzid.id, opportunityId: opp6.id, notes: 'Envoi devis préliminaire équipement orthopédie.', employeId: sara.id, date: new Date('2025-12-22') } })
  await db.interaction.create({ data: { type: 'appel', prospectId: drKaci.id, opportunityId: opp9.id, notes: 'Premier contact, très intéressée par IRM Yuwell.', employeId: amine.id, date: new Date('2025-12-28') } })

  // Create after-sales
  await db.afterSale.create({ data: { clientId: drMebarki.id, type: 'installation', statut: 'termine', date: new Date('2025-12-10'), employeId: youcef.id, notes: 'Installation lampe et table opératoire terminée avec succès.' } })
  await db.afterSale.create({ data: { clientId: drMebarki.id, type: 'formation', statut: 'termine', date: new Date('2025-12-15'), employeId: nadia.id, notes: 'Formation équipe chirurgicale sur table Gelenke.' } })
  await db.afterSale.create({ data: { clientId: cliniqueAlger.id, type: 'installation', statut: 'en_cours', date: new Date('2026-01-10'), employeId: youcef.id, notes: 'Installation ventilateurs Löwenstein en cours.' } })
  await db.afterSale.create({ data: { clientId: cliniqueAlger.id, type: 'sav', statut: 'en_attente', employeId: youcef.id, notes: 'Demande maintenance moniteur MIR - écran défectueux.' } })

  // Create objectives
  await db.objective.create({ data: { employeId: amine.id, mois: '2026-01', caObjectif: 5000000, nbVentesObjectif: 3, tachesObjectif: 15 } })
  await db.objective.create({ data: { employeId: sara.id, mois: '2026-01', caObjectif: 4000000, nbVentesObjectif: 2, tachesObjectif: 12 } })
  await db.objective.create({ data: { employeId: youcef.id, mois: '2026-01', tachesObjectif: 8 } })
  await db.objective.create({ data: { employeId: nadia.id, mois: '2026-01', tachesObjectif: 6 } })

  console.log('[DB] Seed completed successfully')
}
