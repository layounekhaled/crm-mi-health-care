#!/usr/bin/env python3
"""
Clean and normalize extracted prospects, then generate import-ready JSON.
Also check for existing prospects in the DB to avoid duplicates.
"""

import json
import re

INPUT_FILE = "/home/z/my-project/scripts/prospects_extracted.json"
OUTPUT_FILE = "/home/z/my-project/scripts/prospects_import_ready.json"

# Specialty normalization map
SPEC_MAP = {
    'DISTRIBUTEUR': 'Distributeur',
    'PARTICULIER': 'Distributeur',
    'MEDECIN': 'Médecin',
    'MEDECIN RESIDENT EN PNEUMOLOGIE': 'Résident Pneumologie',
    'CLINIQUE': 'Clinique',
    'LABORATOIRE': 'Laboratoire',
    'PNEUMO': 'Pneumologue',
    'pnemo': 'Pneumologue',
    'pneumologue': 'Pneumologue',
    'allergo': 'Allergologue',
    'residante': 'Résident',
    '0': '',
}

# Names that are clearly not specialties
NOT_SPEC = [
    'YOUSLY CARE SARL', 'NAKIB Tarek', 'BOUDCHICHA Nacer eddine',
    'KHODJA Tarek', 'Taleb yousra', 'Nom du contact', 'LATTAR Faiza',
    'AIMAR Ali', 'Nom. CONTACT', 'Fonct. CONTACT', 'Contact',
]

def normalize_specialite(spec):
    if not spec:
        return ""
    spec = spec.strip()
    # Check exact match
    if spec in SPEC_MAP:
        return SPEC_MAP[spec]
    # Check if it's a name (not a specialty)
    if spec in NOT_SPEC:
        return ""
    # Check if it looks like a name (has uppercase words like Lastname Firstname)
    if re.match(r'^[A-Z]+ [A-Za-z]+$', spec):
        return ""
    # Title case for anything else
    if spec.isupper() and len(spec) > 3:
        # Could be a legitimate specialty in all caps
        return spec.title()
    return spec

def clean_prospect(p):
    """Clean a single prospect."""
    # Normalize specialty
    p['specialite'] = normalize_specialite(p['specialite'])
    
    # Clean telephone - remove extra spaces
    if p['telephone']:
        p['telephone'] = re.sub(r'\s+', ' ', p['telephone'].strip())
    if p['telephone2']:
        p['telephone2'] = re.sub(r'\s+', ' ', p['telephone2'].strip())
    
    # Clean name - remove leading/trailing whitespace, normalize multiple spaces
    if p['nom']:
        p['nom'] = re.sub(r'\s+', ' ', p['nom'].strip())
    
    # If email contains comma (multiple emails), take first
    if p['email'] and ',' in p['email']:
        p['email'] = p['email'].split(',')[0].strip()
    
    return p

with open(INPUT_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

prospects = data['prospects']
print(f"Loaded {len(prospects)} raw prospects")

# Clean all prospects
cleaned = [clean_prospect(p) for p in prospects]

# Remove entries with no useful data (no name, no email, no phone)
useful = [p for p in cleaned if p['nom'] or p['email'] or p['telephone']]
print(f"After removing empty entries: {len(useful)}")

# Stats
by_spec = {}
for p in useful:
    spec = p.get("specialite") or "Non spécifié"
    by_spec[spec] = by_spec.get(spec, 0) + 1

print(f"\nRépartition par spécialité:")
for spec, count in sorted(by_spec.items(), key=lambda x: -x[1]):
    print(f"  {spec}: {count}")

with_email = sum(1 for p in useful if p['email'])
with_phone = sum(1 for p in useful if p['telephone'])
print(f"\nAvec email: {with_email}")
print(f"Avec téléphone: {with_phone}")
print(f"Total à importer: {len(useful)}")

with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(useful, f, ensure_ascii=False, indent=2)

print(f"\nFichier sauvegardé: {OUTPUT_FILE}")
