import asyncio
import json
from odf.opendocument import load
from odf.table import Table, TableRow, TableCell

# ─── ODS Reader ─────────────────────────────────────────────────

def get_cell_text(cell):
    texts = []
    for child in cell.childNodes:
        if hasattr(child, 'childNodes'):
            for sub in child.childNodes:
                if hasattr(sub, 'data') and isinstance(sub.data, str):
                    texts.append(sub.data)
                elif hasattr(sub, 'childNodes'):
                    for sub2 in sub.childNodes:
                        if hasattr(sub2, 'data') and isinstance(sub2.data, str):
                            texts.append(sub2.data)
    return ''.join(texts).strip()

def get_row_values(row, max_cols=12):
    cells = row.getElementsByType(TableCell)
    result = []
    for cell in cells:
        val = get_cell_text(cell)
        repeat = cell.getAttribute('numbercolumnsrepeated')
        repeat = int(repeat) if repeat else 1
        result.extend([val] * min(repeat, 5))
    return result[:max_cols]

def clean_value(val):
    if not val:
        return None
    val = val.strip()
    if val.lower() in ['info manquante', '', '-', 'n/a']:
        return None
    return val

def clean_phone(phone):
    if not phone:
        return None
    phone = phone.strip()
    if phone.lower() in ['info manquante', '', '-', 'n/a']:
        return None
    phone = ' '.join(phone.split())
    return phone

# ─── Sheet-specific parsers ─────────────────────────────────────

def parse_pneumologues(rows):
    """NOM | MAIL | PHONE 1 | PHONE 2 | PHONE 3 | ADRESSE | VILLE"""
    prospects = []
    for row in rows[5:]:  # Data starts after row 4 (header)
        vals = get_row_values(row)
        nom = clean_value(vals[1] if len(vals) > 1 else None)
        if not nom:
            continue
        email = clean_value(vals[2] if len(vals) > 2 else None)
        phone1 = clean_phone(vals[3] if len(vals) > 3 else None)
        phone2 = clean_phone(vals[4] if len(vals) > 4 else None)
        phone3 = clean_phone(vals[5] if len(vals) > 5 else None)
        adresse = clean_value(vals[6] if len(vals) > 6 else None)
        ville = clean_value(vals[7] if len(vals) > 7 else None)
        
        notes_parts = []
        if email: notes_parts.append(f"Email: {email}")
        if adresse and adresse != ville: notes_parts.append(f"Adresse: {adresse}")
        
        prospects.append({
            'nom': nom, 'specialite': 'Pneumologue', 'wilaya': ville,
            'telephone': phone1, 'telephone2': phone2, 'whatsapp': phone3,
            'etablissement': None, 'source': 'import_bdd', 'isClient': True,
            'notes': ' | '.join(notes_parts) if notes_parts else None,
        })
    return prospects

def parse_distributeur(rows):
    """NOM | MAIL | ADRESSE | VILLE | SPECIALITE"""
    prospects = []
    for row in rows[5:]:
        vals = get_row_values(row)
        nom = clean_value(vals[0] if len(vals) > 0 else None)
        if not nom:
            continue
        email = clean_value(vals[1] if len(vals) > 1 else None)
        adresse = clean_value(vals[2] if len(vals) > 2 else None)
        ville = clean_value(vals[3] if len(vals) > 3 else None)
        specialite = clean_value(vals[4] if len(vals) > 4 else None) or 'Distributeur'
        
        notes_parts = []
        if email: notes_parts.append(f"Email: {email}")
        if adresse and adresse != ville: notes_parts.append(f"Adresse: {adresse}")
        
        prospects.append({
            'nom': nom, 'specialite': specialite, 'wilaya': ville,
            'telephone': None, 'telephone2': None, 'whatsapp': None,
            'etablissement': None, 'source': 'import_bdd', 'isClient': True,
            'notes': ' | '.join(notes_parts) if notes_parts else None,
        })
    return prospects

def parse_diabetologues(rows):
    """NOM | MAIL | PHONE 1 | PHONE 2 | ADRESSE | SPECIALITE"""
    prospects = []
    for row in rows[5:]:
        vals = get_row_values(row)
        nom = clean_value(vals[1] if len(vals) > 1 else None)
        if not nom:
            continue
        email = clean_value(vals[2] if len(vals) > 2 else None)
        phone1 = clean_phone(vals[3] if len(vals) > 3 else None)
        phone2 = clean_phone(vals[4] if len(vals) > 4 else None)
        adresse = clean_value(vals[5] if len(vals) > 5 else None)
        specialite = clean_value(vals[6] if len(vals) > 6 else None) or 'Diabétologue'
        
        ville = None
        if adresse:
            parts = [p.strip() for p in adresse.split(',')]
            if len(parts) > 1:
                ville = parts[-1].strip()
        
        notes_parts = []
        if email: notes_parts.append(f"Email: {email}")
        if adresse: notes_parts.append(f"Adresse: {adresse}")
        
        prospects.append({
            'nom': nom, 'specialite': specialite, 'wilaya': ville,
            'telephone': phone1, 'telephone2': phone2, 'whatsapp': None,
            'etablissement': None, 'source': 'import_bdd', 'isClient': True,
            'notes': ' | '.join(notes_parts) if notes_parts else None,
        })
    return prospects

def parse_gynecologue(rows):
    """Similar to diabetologues"""
    prospects = []
    for row in rows[5:]:
        vals = get_row_values(row)
        nom = clean_value(vals[1] if len(vals) > 1 else None)
        if not nom:
            continue
        email = clean_value(vals[2] if len(vals) > 2 else None)
        phone1 = clean_phone(vals[3] if len(vals) > 3 else None)
        phone2 = clean_phone(vals[4] if len(vals) > 4 else None)
        adresse = clean_value(vals[5] if len(vals) > 5 else None)
        
        ville = None
        if adresse:
            parts = [p.strip() for p in adresse.split(',')]
            if len(parts) > 1:
                ville = parts[-1].strip()
        
        notes_parts = []
        if email: notes_parts.append(f"Email: {email}")
        if adresse: notes_parts.append(f"Adresse: {adresse}")
        
        prospects.append({
            'nom': nom, 'specialite': 'Gynécologue', 'wilaya': ville,
            'telephone': phone1, 'telephone2': phone2, 'whatsapp': None,
            'etablissement': None, 'source': 'import_bdd', 'isClient': True,
            'notes': ' | '.join(notes_parts) if notes_parts else None,
        })
    return prospects

def parse_med_travail(rows):
    """NOM | MAIL | PHONE 1 | PHONE 2 | ADRESSE"""
    prospects = []
    for row in rows[5:]:
        vals = get_row_values(row)
        nom = clean_value(vals[1] if len(vals) > 1 else None)
        if not nom:
            continue
        email = clean_value(vals[2] if len(vals) > 2 else None)
        phone1 = clean_phone(vals[3] if len(vals) > 3 else None)
        phone2 = clean_phone(vals[4] if len(vals) > 4 else None)
        adresse = clean_value(vals[5] if len(vals) > 5 else None)
        
        ville = None
        if adresse:
            parts = [p.strip() for p in adresse.split(',')]
            if len(parts) > 1:
                ville = parts[-1].strip()
            else:
                ville = adresse  # Sometimes just the city name
        
        notes_parts = []
        if email: notes_parts.append(f"Email: {email}")
        if adresse: notes_parts.append(f"Adresse: {adresse}")
        
        prospects.append({
            'nom': nom, 'specialite': 'Médecine du travail', 'wilaya': ville,
            'telephone': phone1, 'telephone2': phone2, 'whatsapp': None,
            'etablissement': None, 'source': 'import_bdd', 'isClient': True,
            'notes': ' | '.join(notes_parts) if notes_parts else None,
        })
    return prospects

def parse_urologues(rows):
    """NOM | MAIL | PHONE 1 | PHONE 2 | ADRESSE"""
    return parse_med_travail(rows)  # Same structure, different specialite
    # Override specialite after
    prospects = parse_med_travail(rows)
    for p in prospects:
        p['specialite'] = 'Urologue'
    return prospects

def parse_med_divers(rows):
    """Nom | MAIL | Tel 1 | Tel 2 | Specialite | ADRESSE"""
    prospects = []
    for row in rows[5:]:
        vals = get_row_values(row)
        nom = clean_value(vals[1] if len(vals) > 1 else None)
        if not nom:
            continue
        email = clean_value(vals[2] if len(vals) > 2 else None)
        phone1 = clean_phone(vals[3] if len(vals) > 3 else None)
        phone2 = clean_phone(vals[4] if len(vals) > 4 else None)
        specialite = clean_value(vals[5] if len(vals) > 5 else None) or 'Médecin divers'
        adresse = clean_value(vals[6] if len(vals) > 6 else None)
        
        ville = None
        if adresse:
            parts = [p.strip() for p in adresse.split(',')]
            if len(parts) > 1:
                ville = parts[-1].strip()
        
        notes_parts = []
        if email: notes_parts.append(f"Email: {email}")
        if adresse: notes_parts.append(f"Adresse: {adresse}")
        
        prospects.append({
            'nom': nom, 'specialite': specialite, 'wilaya': ville,
            'telephone': phone1, 'telephone2': phone2, 'whatsapp': None,
            'etablissement': None, 'source': 'import_bdd', 'isClient': True,
            'notes': ' | '.join(notes_parts) if notes_parts else None,
        })
    return prospects

def parse_pediatres(rows):
    """NOM | MAIL | PHONE 1 | PHONE 2 | ADRESSE"""
    prospects = []
    for row in rows[5:]:
        vals = get_row_values(row)
        nom = clean_value(vals[1] if len(vals) > 1 else None)
        if not nom:
            continue
        email = clean_value(vals[2] if len(vals) > 2 else None)
        phone1 = clean_phone(vals[3] if len(vals) > 3 else None)
        phone2 = clean_phone(vals[4] if len(vals) > 4 else None)
        adresse = clean_value(vals[5] if len(vals) > 5 else None)
        
        ville = None
        if adresse:
            parts = [p.strip() for p in adresse.split(',')]
            if len(parts) > 1:
                ville = parts[-1].strip()
        
        notes_parts = []
        if email: notes_parts.append(f"Email: {email}")
        if adresse: notes_parts.append(f"Adresse: {adresse}")
        
        prospects.append({
            'nom': nom, 'specialite': 'Pédiatre', 'wilaya': ville,
            'telephone': phone1, 'telephone2': phone2, 'whatsapp': None,
            'etablissement': None, 'source': 'import_bdd', 'isClient': True,
            'notes': ' | '.join(notes_parts) if notes_parts else None,
        })
    return prospects

def parse_radiologues(rows):
    """NOM (CENTRES D'IMAGERIES) | MAIL | TEL 1 | TEL2 | TEL 3 | ADRESSE"""
    prospects = []
    for row in rows[5:]:
        vals = get_row_values(row)
        nom = clean_value(vals[2] if len(vals) > 2 else None)
        if not nom:
            continue
        email = clean_value(vals[3] if len(vals) > 3 else None)
        phone1 = clean_phone(vals[4] if len(vals) > 4 else None)
        phone2 = clean_phone(vals[5] if len(vals) > 5 else None)
        phone3 = clean_phone(vals[6] if len(vals) > 6 else None)
        adresse = clean_value(vals[7] if len(vals) > 7 else None)
        
        ville = None
        if adresse:
            parts = [p.strip() for p in adresse.split(',')]
            if len(parts) > 1:
                ville = parts[-1].strip()
        
        notes_parts = []
        if email: notes_parts.append(f"Email: {email}")
        if adresse: notes_parts.append(f"Adresse: {adresse}")
        
        prospects.append({
            'nom': nom, 'specialite': 'Radiologue', 'wilaya': ville,
            'telephone': phone1, 'telephone2': phone2, 'whatsapp': phone3,
            'etablissement': None, 'source': 'import_bdd', 'isClient': True,
            'notes': ' | '.join(notes_parts) if notes_parts else None,
        })
    return prospects

def parse_generalistes(rows):
    """NOM | MAIL | TEL 1 | TEL2 | TEL 3 | ADRESSE | SPECIALITE"""
    prospects = []
    for row in rows[4:]:  # Different header row
        vals = get_row_values(row)
        nom = clean_value(vals[0] if len(vals) > 0 else None)
        if not nom:
            continue
        email = clean_value(vals[1] if len(vals) > 1 else None)
        phone1 = clean_phone(vals[2] if len(vals) > 2 else None)
        phone2 = clean_phone(vals[3] if len(vals) > 3 else None)
        phone3 = clean_phone(vals[4] if len(vals) > 4 else None)
        adresse = clean_value(vals[5] if len(vals) > 5 else None)
        specialite = clean_value(vals[6] if len(vals) > 6 else None) or 'Généraliste'
        
        ville = None
        if adresse:
            parts = [p.strip() for p in adresse.split(',')]
            if len(parts) > 1:
                ville = parts[-1].strip()
            else:
                ville = adresse
        
        notes_parts = []
        if email: notes_parts.append(f"Email: {email}")
        if adresse and adresse != ville: notes_parts.append(f"Adresse: {adresse}")
        
        prospects.append({
            'nom': nom, 'specialite': specialite, 'wilaya': ville,
            'telephone': phone1, 'telephone2': phone2, 'whatsapp': phone3,
            'etablissement': None, 'source': 'import_bdd', 'isClient': True,
            'notes': ' | '.join(notes_parts) if notes_parts else None,
        })
    return prospects

def parse_societes(rows):
    """SOCIETE | MAIL | TEL 1 | TEL2 | TEL 3 | ADRESSE | Nom. CONTACT"""
    prospects = []
    for row in rows[5:]:
        vals = get_row_values(row)
        nom = clean_value(vals[1] if len(vals) > 1 else None)
        if not nom:
            continue
        email = clean_value(vals[2] if len(vals) > 2 else None)
        phone1 = clean_phone(vals[3] if len(vals) > 3 else None)
        phone2 = clean_phone(vals[4] if len(vals) > 4 else None)
        phone3 = clean_phone(vals[5] if len(vals) > 5 else None)
        adresse = clean_value(vals[6] if len(vals) > 6 else None)
        contact = clean_value(vals[7] if len(vals) > 7 else None)
        
        ville = None
        if adresse:
            parts = [p.strip() for p in adresse.split(',')]
            if len(parts) > 1:
                ville = parts[-1].strip()
        
        notes_parts = []
        if email: notes_parts.append(f"Email: {email}")
        if adresse: notes_parts.append(f"Adresse: {adresse}")
        if contact: notes_parts.append(f"Contact: {contact}")
        
        prospects.append({
            'nom': nom, 'specialite': 'Société', 'wilaya': ville,
            'telephone': phone1, 'telephone2': phone2, 'whatsapp': phone3,
            'etablissement': None, 'source': 'import_bdd', 'isClient': True,
            'notes': ' | '.join(notes_parts) if notes_parts else None,
        })
    return prospects

def parse_orl(rows):
    """NOM | MAIL | TEL 1 | TEL 2 | TEL3 | ADRESSE"""
    prospects = []
    for row in rows[5:]:
        vals = get_row_values(row)
        nom = clean_value(vals[1] if len(vals) > 1 else None)
        if not nom:
            continue
        email = clean_value(vals[2] if len(vals) > 2 else None)
        phone1 = clean_phone(vals[3] if len(vals) > 3 else None)
        phone2 = clean_phone(vals[4] if len(vals) > 4 else None)
        phone3 = clean_phone(vals[5] if len(vals) > 5 else None)
        adresse = clean_value(vals[6] if len(vals) > 6 else None)
        
        ville = None
        if adresse:
            parts = [p.strip() for p in adresse.split(',')]
            if len(parts) > 1:
                ville = parts[-1].strip()
        
        notes_parts = []
        if email: notes_parts.append(f"Email: {email}")
        if adresse: notes_parts.append(f"Adresse: {adresse}")
        
        prospects.append({
            'nom': nom, 'specialite': 'ORL', 'wilaya': ville,
            'telephone': phone1, 'telephone2': phone2, 'whatsapp': phone3,
            'etablissement': None, 'source': 'import_bdd', 'isClient': True,
            'notes': ' | '.join(notes_parts) if notes_parts else None,
        })
    return prospects

def parse_cardiologue(rows):
    """Nom et prénom | MAIL | PHONE 1 | PHONE 2 | ADRESSE"""
    prospects = []
    for row in rows[4:]:  # Header at row 3
        vals = get_row_values(row)
        nom = clean_value(vals[0] if len(vals) > 0 else None)
        if not nom:
            continue
        email = clean_value(vals[1] if len(vals) > 1 else None)
        phone1 = clean_phone(vals[2] if len(vals) > 2 else None)
        phone2 = clean_phone(vals[3] if len(vals) > 3 else None)
        adresse = clean_value(vals[4] if len(vals) > 4 else None)
        
        ville = None
        if adresse:
            parts = [p.strip() for p in adresse.split(',')]
            if len(parts) > 1:
                ville = parts[-1].strip()
        
        notes_parts = []
        if email: notes_parts.append(f"Email: {email}")
        if adresse: notes_parts.append(f"Adresse: {adresse}")
        
        prospects.append({
            'nom': nom, 'specialite': 'Cardiologue', 'wilaya': ville,
            'telephone': phone1, 'telephone2': phone2, 'whatsapp': None,
            'etablissement': None, 'source': 'import_bdd', 'isClient': True,
            'notes': ' | '.join(notes_parts) if notes_parts else None,
        })
    return prospects

def parse_associations(rows):
    """ASSOCIATION | MAIL | PHONE 1 | PHONE 2 | PHONE 3 | ADRESSE | CONTACT"""
    prospects = []
    for row in rows[5:]:
        vals = get_row_values(row)
        nom = clean_value(vals[1] if len(vals) > 1 else None)
        if not nom:
            continue
        email = clean_value(vals[2] if len(vals) > 2 else None)
        phone1 = clean_phone(vals[3] if len(vals) > 3 else None)
        phone2 = clean_phone(vals[4] if len(vals) > 4 else None)
        phone3 = clean_phone(vals[5] if len(vals) > 5 else None)
        adresse = clean_value(vals[6] if len(vals) > 6 else None)
        contact = clean_value(vals[7] if len(vals) > 7 else None)
        
        ville = None
        if adresse:
            parts = [p.strip() for p in adresse.split(',')]
            if len(parts) > 1:
                ville = parts[-1].strip()
        
        notes_parts = []
        if email: notes_parts.append(f"Email: {email}")
        if adresse: notes_parts.append(f"Adresse: {adresse}")
        if contact: notes_parts.append(f"Contact: {contact}")
        
        prospects.append({
            'nom': nom, 'specialite': 'Association', 'wilaya': ville,
            'telephone': phone1, 'telephone2': phone2, 'whatsapp': phone3,
            'etablissement': None, 'source': 'import_bdd', 'isClient': True,
            'notes': ' | '.join(notes_parts) if notes_parts else None,
        })
    return prospects

def parse_cliniques(rows):
    """CLINIQUE | MAIL | TEL 1 | TEL2 | TEL 3 | ADRESSE"""
    prospects = []
    for row in rows[5:]:
        vals = get_row_values(row)
        nom = clean_value(vals[2] if len(vals) > 2 else None)
        if not nom:
            continue
        email = clean_value(vals[3] if len(vals) > 3 else None)
        phone1 = clean_phone(vals[4] if len(vals) > 4 else None)
        phone2 = clean_phone(vals[5] if len(vals) > 5 else None)
        phone3 = clean_phone(vals[6] if len(vals) > 6 else None)
        adresse = clean_value(vals[7] if len(vals) > 7 else None)
        
        ville = None
        if adresse:
            parts = [p.strip() for p in adresse.split(',')]
            if len(parts) > 1:
                ville = parts[-1].strip()
        
        notes_parts = []
        if email: notes_parts.append(f"Email: {email}")
        if adresse: notes_parts.append(f"Adresse: {adresse}")
        
        prospects.append({
            'nom': nom, 'specialite': 'Clinique', 'wilaya': ville,
            'telephone': phone1, 'telephone2': phone2, 'whatsapp': phone3,
            'etablissement': None, 'source': 'import_bdd', 'isClient': True,
            'notes': ' | '.join(notes_parts) if notes_parts else None,
        })
    return prospects

def parse_medecins_internes(rows):
    # Need to check structure first
    prospects = []
    for i, row in enumerate(rows):
        vals = get_row_values(row)
        # Skip header rows
        if i < 4:
            continue
        # Try to find data rows
        nom = None
        for v in vals:
            if v and v.lower() not in ['info manquante', '', '-'] and len(v) > 2:
                nom = clean_value(v)
                break
        if not nom:
            continue
        prospects.append({
            'nom': nom, 'specialite': 'Médecin interne', 'wilaya': None,
            'telephone': None, 'telephone2': None, 'whatsapp': None,
            'etablissement': None, 'source': 'import_bdd', 'isClient': True,
            'notes': None,
        })
    return prospects

def parse_pharmacies(rows):
    prospects = []
    for i, row in enumerate(rows):
        vals = get_row_values(row)
        if i < 4:
            continue
        nom = clean_value(vals[0] if len(vals) > 0 else None)
        if not nom:
            continue
        email = clean_value(vals[1] if len(vals) > 1 else None)
        phone1 = clean_phone(vals[2] if len(vals) > 2 else None)
        adresse = clean_value(vals[3] if len(vals) > 3 else None)
        
        ville = None
        if adresse:
            parts = [p.strip() for p in adresse.split(',')]
            if len(parts) > 1:
                ville = parts[-1].strip()
        
        notes_parts = []
        if email: notes_parts.append(f"Email: {email}")
        if adresse: notes_parts.append(f"Adresse: {adresse}")
        
        prospects.append({
            'nom': nom, 'specialite': 'Pharmacie', 'wilaya': ville,
            'telephone': phone1, 'telephone2': None, 'whatsapp': None,
            'etablissement': None, 'source': 'import_bdd', 'isClient': True,
            'notes': ' | '.join(notes_parts) if notes_parts else None,
        })
    return prospects

def parse_laboratoire(rows):
    prospects = []
    for i, row in enumerate(rows):
        vals = get_row_values(row)
        if i < 4:
            continue
        nom = clean_value(vals[0] if len(vals) > 0 else None)
        if not nom:
            continue
        prospects.append({
            'nom': nom, 'specialite': 'Laboratoire', 'wilaya': None,
            'telephone': None, 'telephone2': None, 'whatsapp': None,
            'etablissement': None, 'source': 'import_bdd', 'isClient': True,
            'notes': None,
        })
    return prospects

# ─── Urologues parser (same structure as med_travail) ───────────
def parse_urologues(rows):
    prospects = parse_med_travail(rows)
    for p in prospects:
        p['specialite'] = 'Urologue'
    return prospects

# ─── Main ───────────────────────────────────────────────────────

async def main():
    print("📂 Chargement du fichier ODS...")
    doc = load("/home/z/my-project/upload/Base de données MI HEALTHCARE.ods")
    
    sheet_parsers = {
        'Pneumologues': parse_pneumologues,
        'Distributeur_': parse_distributeur,
        'Diabetologues': parse_diabetologues,
        'gynecologue': parse_gynecologue,
        'Medecine_du_travail': parse_med_travail,
        'Urologues': parse_urologues,
        'Medecins_divers': parse_med_divers,
        'Pediatres': parse_pediatres,
        'Radiologues': parse_radiologues,
        'Généralistes': parse_generalistes,
        'Societes': parse_societes,
        'ORL': parse_orl,
        'cardiologue': parse_cardiologue,
        'Associations': parse_associations,
        'Cliniques': parse_cliniques,
        'medecins_internes': parse_medecins_internes,
        'pharmacies': parse_pharmacies,
        'laboratoire': parse_laboratoire,
    }
    
    all_prospects = []
    
    for sheet_name, parser in sheet_parsers.items():
        sheet = None
        for s in doc.spreadsheet.getElementsByType(Table):
            if s.getAttribute('name') == sheet_name:
                sheet = s
                break
        
        if not sheet:
            print(f"  ⚠️  Sheet '{sheet_name}' not found, skipping")
            continue
        
        rows = sheet.getElementsByType(TableRow)
        prospects = parser(rows)
        all_prospects.extend(prospects)
        print(f"  ✓ {sheet_name}: {len(prospects)} prospects")
    
    print(f"\n📊 Total extrait: {len(all_prospects)} prospects")
    
    # Deduplicate by name (case-insensitive)
    seen_names = {}
    unique_prospects = []
    duplicates_removed = 0
    
    for p in all_prospects:
        name_key = p['nom'].lower().strip()
        if name_key in seen_names:
            existing = seen_names[name_key]
            # Merge: keep the one with more info
            if not existing.get('telephone') and p.get('telephone'):
                existing['telephone'] = p['telephone']
            if not existing.get('telephone2') and p.get('telephone2'):
                existing['telephone2'] = p['telephone2']
            if not existing.get('whatsapp') and p.get('whatsapp'):
                existing['whatsapp'] = p['whatsapp']
            if not existing.get('wilaya') and p.get('wilaya'):
                existing['wilaya'] = p['wilaya']
            if not existing.get('notes') and p.get('notes'):
                existing['notes'] = p['notes']
            # If new one has phone and existing doesn't, keep new specialite
            if p.get('telephone') and not existing.get('telephone'):
                existing['specialite'] = p['specialite']
            duplicates_removed += 1
        else:
            seen_names[name_key] = p
            unique_prospects.append(p)
    
    print(f"🔄 Déduplication: {duplicates_removed} doublons fusionnés")
    print(f"📋 {len(unique_prospects)} prospects uniques à importer")
    
    # Remove duplicate telephone check - import directly via Prisma
    # Save to JSON for Prisma import
    with open('/home/z/my-project/upload/prospects_to_import.json', 'w', encoding='utf-8') as f:
        json.dump(unique_prospects, f, ensure_ascii=False, indent=2)
    
    print(f"\n💾 Sauvegardé dans prospects_to_import.json")
    print(f"🚀 Prêt pour l'import direct via Prisma")
    
    # Print sample
    print(f"\n📋 Aperçu (5 premiers):")
    for p in unique_prospects[:5]:
        print(f"  • {p['nom']} | {p['specialite']} | {p.get('telephone', 'N/A')} | {p.get('wilaya', 'N/A')}")

if __name__ == '__main__':
    asyncio.run(main())
