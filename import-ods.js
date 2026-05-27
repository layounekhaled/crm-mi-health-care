const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

// ─── WILAYA MAPPING ─────────────────────────────────────────────────────────
const WILAYA_MAP = {
  'adrar': 'Adrar', 'ain defla': "Aïn Defla", 'aïn defla': "Aïn Defla", 'aindefla': "Aïn Defla",
  'alger': 'Alger', 'algiers': 'Alger', 'algercentre': 'Alger', 'bab el oued': 'Alger',
  'bir Mourad Rais'.toLowerCase(): 'Alger', 'hydra': 'Alger', 'el biar': 'Alger',
  'bab ezzouar': 'Alger', 'babezouar': 'Alger', 'kouba': 'Alger', 'dely ibrahim': 'Alger',
  'cheraga': 'Alger', 'draria': 'Alger', 'reghaia': 'Alger', 'rouiba': 'Alger',
  'dar el beida': 'Alger', 'birtouta': 'Alger', 'bouzareah': 'Alger', 'bourouba': 'Alger',
  'hussen dey': 'Alger', 'hussain dey': 'Alger', 'mohammadia': 'Alger',
  'eliadia': 'Alger', 'birkhadem': 'Alger', 'telemly': 'Alger', 'zeralda': 'Alger',
  'sidi moussa': 'Alger', 'les eucalyptus': 'Alger', 'baraki': 'Alger',
  'annaba': 'Annaba', 'batna': 'Batna', 'béjaïa': 'Béjaïa', 'bejaia': 'Béjaïa',
  'blida': 'Blida', 'biskra': 'Biskra', 'boumerdès': 'Boumerdès', 'boumerdes': 'Boumerdès',
  'constantine': 'Constantine', 'djelfa': 'Djelfa', 'ghardaia': 'Ghardaïa',
  'ghardaïa': 'Ghardaïa', 'jijel': 'Jijel', 'médéa': 'Médéa', 'medea': 'Médéa',
  'mostaganem': 'Mostaganem', "m'sila": "M'Sila", 'msila': "M'Sila",
  'naâma': 'Naâma', 'naama': 'Naâma', 'oran': 'Oran', 'ouargla': 'Ouargla',
  'saïda': 'Saïda', 'saida': 'Saïda', 'sétif': 'Sétif', 'setif': 'Sétif',
  'sidi bel abbès': 'Sidi Bel Abbès', 'skikda': 'Skikda',
  'tamanrasset': 'Tamanrasset', 'tiaret': 'Tiaret', 'tébessa': 'Tébessa',
  'tebessa': 'Tébessa', 'tipaza': 'Tipaza', 'tizi ouzou': 'Tizi Ouzou',
  'tlemcen': 'Tlemcen', 'touggourt': 'Ouargla', 'oued': 'El Oued',
  'sidi abdellah': 'Alger', 'chlef': 'Chlef', 'el oued': 'El Oued',
  'bordj bou arreridj': 'Bordj Bou Arreridj', 'bou arreridj': 'Bordj Bou Arreridj',
  'mascara': 'Mascara', 'tissemsilt': 'Tissemsilt', 'souk ahras': 'Souk Ahras',
  'ain temouchent': "Aïn Témouchent", 'aïn témouchent': "Aïn Témouchent",
  'tindouf': 'Tindouf', 'illizi': 'Illizi', 'toggourt': 'Ouargla',
  'reliZane': 'Relizane', 'relizane': 'Relizane', 'laghouat': 'Laghouat',
  'khenchela': 'Khenchela', 'mila': 'Mila', 'aïn défla': "Aïn Defla",
  'beni saf': "Aïn Témouchent", 'tlemcen': 'Tlemcen',
};

function extractWilaya(text) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();
  
  // Direct match
  for (const [key, val] of Object.entries(WILAYA_MAP)) {
    if (lower === key || lower.includes(key)) return val;
  }
  
  // Try last word/segment (common pattern: "address, CITY")
  const parts = lower.split(/[,\s]+/);
  const lastParts = parts.slice(-3).join(' ');
  for (const [key, val] of Object.entries(WILAYA_MAP)) {
    if (lastParts.includes(key)) return val;
  }
  
  return null;
}

// ─── PHONE CLEANUP ──────────────────────────────────────────────────────────
function cleanPhone(phone) {
  if (!phone) return null;
  let p = phone.replace(/[\s\-\.\/]/g, '').replace(/^00213/, '0').replace(/^213/, '0');
  if (p.startsWith('0') && p.length >= 9 && p.length <= 12) return p;
  // Try adding 0 prefix
  if (/^[5-7]\d{8}$/.test(p)) return '0' + p;
  if (/^\d{9,12}$/.test(p)) return '0' + p;
  // Likely a phone if it starts with 0
  if (p.startsWith('0') && p.length >= 8) return p;
  return null;
}

function isPhone(text) {
  if (!text) return false;
  const cleaned = text.replace(/[\s\-\.\/]/g, '');
  return /^0[5-7]\d{8}$/.test(cleaned) || /^0[2-4]\d{7,8}$/.test(cleaned) || /^\d{9,10}$/.test(cleaned);
}

function isEmail(text) {
  return text && text.includes('@') && text.includes('.');
}

function isMissingInfo(text) {
  if (!text) return true;
  const lower = text.toLowerCase().trim();
  return lower === 'info manquante' || lower === '' || lower === 'na' || lower === 'n/a' || lower === '-';
}

// ─── SPEC NORMALIZE ─────────────────────────────────────────────────────────
const SPEC_MAP = {
  'pneumo': 'Pneumologue', 'pneumologue': 'Pneumologue', 'pneumplogue': 'Pneumologue',
  'pneumologues': 'Pneumologue', 'pneumologie': 'Pneumologue',
  'diabeto': 'Diabétologue', 'diabétologue': 'Diabétologue', 'diabetologue': 'Diabétologue',
  'diabetologues': 'Diabétologue', 'diabétologues': 'Diabétologue',
  'med travail': 'Médecine du travail', 'médecine du travail': 'Médecine du travail',
  'm. du travail': 'Médecine du travail', 'medecine du travail': 'Médecine du travail',
  'medecin du travail': 'Médecine du travail', 'med travail': 'Médecine du travail',
  'distributeur': 'Distributeur', 'distributeurs': 'Distributeur',
  'particulier': 'Particulier',
  'radio': 'Radiologue', 'radiologue': 'Radiologue', 'radiologues': 'Radiologue',
  'radiologie': 'Radiologue',
  'uro': 'Urologue', 'urologue': 'Urologue', 'urologues': 'Urologue',
  'urologie': 'Urologue',
  'gyneco': 'Gynécologue', 'gynecologue': 'Gynécologue', 'gynécologue': 'Gynécologue',
  'guneco': 'Gynécologue', 'gynécologues': 'Gynécologue',
  'cardio': 'Cardiologue', 'cardiologue': 'Cardiologue', 'cardiologues': 'Cardiologue',
  'cardiologie': 'Cardiologue',
  'orl': 'ORL',
  'pediatre': 'Pédiatre', 'pédiatre': 'Pédiatre', 'pediatres': 'Pédiatre',
  'pédiatres': 'Pédiatre', 'pediatrie': 'Pédiatre', 'pédiatrie': 'Pédiatre',
  'generaliste': 'Généraliste', 'généraliste': 'Généraliste', 'généralistes': 'Généraliste',
  'generalistes': 'Généraliste', 'medecine generale': 'Généraliste',
  'médecine générale': 'Généraliste', 'mg': 'Généraliste',
  'clinique': 'Clinique', 'cliniques': 'Clinique',
  'societe': 'Société', 'société': 'Société',
  'medecins divers': 'Médecin divers', 'médecin divers': 'Médecin divers',
  'medecin divers': 'Médecin divers', 'medecin': 'Médecin', 'médecin': 'Médecin',
  'médecine esthétique': 'Médecine esthétique', 'medecine esthetique': 'Médecine esthétique',
  'medecins internes': 'Médecin interne', 'médecin interne': 'Médecin interne',
  'medecin interne': 'Médecin interne', 'interne en medecine': 'Médecin interne',
  'interne': 'Médecin interne',
  'pharmacie': 'Pharmacie', 'pharmacies': 'Pharmacie',
  'laboratoire': 'Laboratoire', 'labo': 'Laboratoire',
  'association': 'Association',
  'orthopedie': 'Orthopédiste', 'orthopédiste': 'Orthopédiste', 'orthopediste': 'Orthopédiste',
  'orthopédie': 'Orthopédiste',
  'endocrinologue': 'Endocrinologue', 'endocrinologues': 'Endocrinologue',
  'neurologue': 'Neurologue', 'neurologie': 'Neurologue',
  'interniste': 'Interniste',
  'anesthésie': 'Anesthésiste', 'anesthésiste': 'Anesthésiste',
  'chirurgie': 'Chirurgien', 'chirurgien': 'Chirurgien',
  'rééducateur': 'Rééducateur', 'reeducateur': 'Rééducateur',
  'cancérologue': 'Cancérologue', 'gastro-entérologue': 'Gastro-entérologue',
  'rhumatologue': 'Rhumatologue', 'dermatologue': 'Dermatologue',
  'néphrologue': 'Néphrologue',
};

function normalizeSpec(spec) {
  if (!spec) return null;
  const lower = spec.toLowerCase().trim();
  if (SPEC_MAP[lower]) return SPEC_MAP[lower];
  // Partial match
  for (const [key, val] of Object.entries(SPEC_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  // Return capitalized
  return spec.charAt(0).toUpperCase() + spec.slice(1);
}

// ─── EXTRACT ADDRESS (without wilaya) ───────────────────────────────────────
function extractAddress(text) {
  if (!text || isMissingInfo(text)) return null;
  return text.trim();
}

// ─── MAIN IMPORT ────────────────────────────────────────────────────────────
async function main() {
  console.log('🗑️  Deleting all existing prospects...');
  await db.prospect.deleteMany({});
  console.log('✅ All prospects deleted');

  const { Opendocument } = require('odsjs');
  // We'll use a different approach - parse with Python and pipe JSON
}
