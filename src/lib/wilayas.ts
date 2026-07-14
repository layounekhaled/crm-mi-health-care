/**
 * Liste complète des 58 wilayas d'Algérie
 * Triées par code de wilaya (numéro officiel)
 * Source : Code administratif algérien
 */

export const WILAYAS: string[] = [
  'Adrar',
  'Chlef',
  'Laghouat',
  'Oum El Bouaghi',
  'Batna',
  'Béjaïa',
  'Biskra',
  'Béchar',
  'Blida',
  'Bouira',
  'Tamanrasset',
  'Tébessa',
  'Tlemcen',
  'Tiaret',
  'Tizi Ouzou',
  'Alger',
  'Djelfa',
  'Jijel',
  'Sétif',
  'Saïda',
  'Skikda',
  'Sidi Bel Abbès',
  'Annaba',
  'Guelma',
  'Constantine',
  'Médéa',
  'Mostaganem',
  "M'Sila",
  'Mascara',
  'Ouargla',
  'Oran',
  'El Bayadh',
  'Illizi',
  'Bordj Bou Arreridj',
  'Boumerdès',
  'El Tarf',
  'Tindouf',
  'Tissemsilt',
  'El Oued',
  'Khenchela',
  'Souk Ahras',
  'Tipaza',
  'Mila',
  'Aïn Defla',
  'Naâma',
  'Aïn Témouchent',
  'Ghardaïa',
  'Relizane',
  'El M\'Ghair',
  'El Meniaa',
  'Ouled Djellal',
  'Bordj Badji Mokhtar',
  'Béni Abbès',
  'Timimoun',
  'Touggourt',
  'Djanet',
  'In Salah',
  'In Guezzam',
]

/**
 * Map de correspondance : nom alternatif / ancien nom → nom officiel
 * Utile pour normaliser les données importées
 */
export const WILAYA_ALIASES: Record<string, string> = {
  // Noms alternatifs courants
  'Alger Centre': 'Alger',
  'BBA': 'Bordj Bou Arreridj',
  'Bouira': 'Bouira',
  // Anciennes dénominations des nouvelles wilayas (découpage 2019)
  'El M\'Ghair': 'El M\'Ghair',
  'El Meniaa': 'El Meniaa',
  'Ouled Djellal': 'Ouled Djellal',
  'Bordj Badji Mokhtar': 'Bordj Badji Mokhtar',
  'Béni Abbès': 'Béni Abbès',
  'Timimoun': 'Timimoun',
  'Touggourt': 'Touggourt',
  'Djanet': 'Djanet',
  'In Salah': 'In Salah',
  'In Guezzam': 'In Guezzam',
}

/**
 * Vérifie si une chaîne correspond à une wilaya valide
 * (insensible à la casse et aux espaces)
 */
export function isValidWilaya(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return WILAYAS.some(w => w.toLowerCase() === normalized)
}

/**
 * Normalise un nom de wilaya vers le nom officiel
 */
export function normalizeWilaya(value: string): string {
  const normalized = value.trim().toLowerCase()
  const match = WILAYAS.find(w => w.toLowerCase() === normalized)
  if (match) return match
  const alias = WILAYA_ALIASES[value.trim()]
  if (alias) return alias
  return value
}
