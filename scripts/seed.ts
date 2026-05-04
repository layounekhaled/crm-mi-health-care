import { db } from '../src/lib/db'

async function seed() {
  // Check if data already exists
  const existingOpps = await db.opportunity.count()
  if (existingOpps > 0) {
    console.log('Data already exists, skipping seed.')
    return
  }

  // Create employees (commercials)
  const com1 = await db.employee.create({
    data: { nom: 'Karim Benali', email: 'karim@mihealthcare.dz', telephone: '0555123456', role: 'commercial', actif: true },
  })
  const com2 = await db.employee.create({
    data: { nom: 'Amina Cherif', email: 'amina@mihealthcare.dz', telephone: '0666789012', role: 'commercial', actif: true },
  })
  const com3 = await db.employee.create({
    data: { nom: 'Youcef Hadj', email: 'youcef@mihealthcare.dz', telephone: '0777345678', role: 'commercial', actif: true },
  })

  // Create prospects (clients)
  const client1 = await db.prospect.create({
    data: { nom: 'Hôpital Mustapha Pacha', specialite: 'Chirurgie', wilaya: 'Alger', telephone: '021234567', isClient: true, source: 'congres', etablissement: 'CHU' },
  })
  const client2 = await db.prospect.create({
    data: { nom: 'Clinique El Azhar', specialite: 'Cardiologie', wilaya: 'Oran', telephone: '041234567', isClient: true, source: 'propection', etablissement: 'Clinique privée' },
  })
  const client3 = await db.prospect.create({
    data: { nom: 'EHS Rouiba', specialite: 'Pédiatrie', wilaya: 'Alger', telephone: '021987654', isClient: true, source: 'referral', etablissement: 'EHS' },
  })
  const client4 = await db.prospect.create({
    data: { nom: 'CHU Beni Messous', specialite: 'Neurologie', wilaya: 'Alger', telephone: '021876543', isClient: true, source: 'congres', etablissement: 'CHU' },
  })
  const client5 = await db.prospect.create({
    data: { nom: 'Clinique Les Oliviers', specialite: 'Orthopédie', wilaya: 'Constantine', telephone: '031234567', isClient: true, source: 'site_web', etablissement: 'Clinique privée' },
  })

  // Create opportunities in different stages
  const opp1 = await db.opportunity.create({
    data: { clientId: client1.id, nomProjet: 'Équipement bloc opératoire', statut: 'Nouveau', montantEstime: 2500000, commercialId: com1.id },
  })
  const opp2 = await db.opportunity.create({
    data: { clientId: client2.id, nomProjet: 'Système monitoring cardiaque', statut: 'Contacté', montantEstime: 1800000, commercialId: com2.id },
  })
  const opp3 = await db.opportunity.create({
    data: { clientId: client3.id, nomProjet: 'Unité soins intensifs pédiatriques', statut: 'Intéressé', montantEstime: 3200000, commercialId: com1.id },
  })
  const opp4 = await db.opportunity.create({
    data: { clientId: client1.id, nomProjet: 'Équipement imagerie médicale', statut: 'Devis', montantEstime: 5500000, commercialId: com3.id },
  })
  const opp5 = await db.opportunity.create({
    data: { clientId: client4.id, nomProjet: 'Système EEG avancé', statut: 'Négociation', montantEstime: 1200000, commercialId: com2.id },
  })
  const opp6 = await db.opportunity.create({
    data: { clientId: client5.id, nomProjet: 'Tables orthopédiques', statut: 'Gagné', montantEstime: 800000, commercialId: com3.id },
  })
  const opp7 = await db.opportunity.create({
    data: { clientId: client2.id, nomProjet: 'Défibrillateurs', statut: 'Perdu', montantEstime: 950000, commercialId: com1.id, motifPerte: 'Concurrent choisi' },
  })
  const opp8 = await db.opportunity.create({
    data: { clientId: client4.id, nomProjet: 'Système ventilation mécanique', statut: 'Nouveau', montantEstime: 4100000, commercialId: com2.id },
  })
  const opp9 = await db.opportunity.create({
    data: { clientId: client3.id, nomProjet: 'Incubateurs néonatals', statut: 'Contacté', montantEstime: 1600000, commercialId: com3.id },
  })
  const opp10 = await db.opportunity.create({
    data: { clientId: client5.id, nomProjet: 'Arceaux de traction', statut: 'Intéressé', montantEstime: 650000, commercialId: com1.id },
  })

  // Create some operations
  await db.operation.createMany({
    data: [
      { opportunityId: opp4.id, produit: 'Scanner CT', marque: 'Siemens', prixEstime: 4500000, marge: 15, statut: 'en_attente', priorite: 'haute' },
      { opportunityId: opp4.id, produit: 'Échographe', marque: 'GE Healthcare', prixEstime: 1000000, marge: 12, statut: 'en_cours', priorite: 'moyenne' },
      { opportunityId: opp6.id, produit: 'Table orthopédique', marque: 'Maquet', prixEstime: 800000, marge: 18, statut: 'terminee', priorite: 'haute' },
      { opportunityId: opp3.id, produit: 'Moniteur patient', marque: 'Philips', prixEstime: 1800000, marge: 14, statut: 'en_attente', priorite: 'haute' },
      { opportunityId: opp3.id, produit: 'Pousse-seringue', marque: 'Braun', prixEstime: 350000, marge: 20, statut: 'en_attente', priorite: 'moyenne' },
    ],
  })

  // Create some tasks
  await db.task.createMany({
    data: [
      { titre: 'Préparer devis détaillé', opportunityId: opp4.id, priorite: 'haute', statut: 'en_cours', assigneAId: com3.id, type: 'commerciale' },
      { titre: 'Planifier visite technique', opportunityId: opp1.id, priorite: 'moyenne', statut: 'en_attente', assigneAId: com1.id, type: 'technique' },
      { titre: 'Envoyer documentation produit', opportunityId: opp2.id, priorite: 'basse', statut: 'en_attente', assigneAId: com2.id, type: 'commerciale' },
      { titre: 'Suivi offre concurrentielle', opportunityId: opp5.id, priorite: 'haute', statut: 'en_cours', assigneAId: com2.id, type: 'commerciale' },
    ],
  })

  // Create some interactions
  await db.interaction.createMany({
    data: [
      { opportunityId: opp1.id, type: 'appel', notes: 'Premier contact avec le directeur des achats', employeId: com1.id, date: new Date() },
      { opportunityId: opp2.id, type: 'email', notes: 'Envoi de la documentation technique', employeId: com2.id, date: new Date() },
      { opportunityId: opp4.id, type: 'rendez_vous', notes: 'Visite sur site pour évaluation des besoins', employeId: com3.id, date: new Date() },
      { opportunityId: opp6.id, type: 'note', notes: 'Contrat signé, livraison prévue dans 3 semaines', employeId: com3.id, date: new Date() },
    ],
  })

  console.log('Seed completed successfully!')
  console.log('Created:', 3, 'commercials,', 5, 'clients,', 10, 'opportunities')
}

seed().catch(console.error)
