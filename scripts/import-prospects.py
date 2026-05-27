import asyncio
import aiohttp
import json
from odf.opendocument import load
from odf.table import Table, TableRow, TableCell

# ─── Config ─────────────────────────────────────────────────────
API_BASE = "https://dalia.wistyty.com"
# API_BASE = "http://localhost:3000"  # For local testing

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
    """Clean a cell value - remove 'info manquante' and strip whitespace"""
    if not val:
        return None
    val = val.strip()
    if val.lower() in ['info manquante', '', '-']:
        return None
    return val

def clean_phone(phone):
    """Clean phone number - remove spaces, normalize format"""
    if not phone:
        return None
    phone = phone.strip()
    if phone.lower() in ['info manquante', '', '-']:
        return None
    # Remove extra spaces but keep the number
    phone = ' '.join(phone.split())
    return phone

# ─── Sheet Parsers ──────────────────────────────────────────────
# Each parser receives all rows of a sheet and returns a list of prospect dicts

def find_header_row(rows):
    """Find the row that contains column headers"""
    header_keywords = ['nom', 'mail', 'phone', 'tel', 'adresse', 'ville', 'specialite', 'societe', 'clinique', 'association']
    for i, row in enumerate(rows):
        values = get_row_values(row)
        values_lower = [v.lower() for v in values if v]
        match_count = sum(1 for kw in header_keywords if any(kw in v for v in values_lower))
        if match_count >= 2:
            return i, values
    return None, None

def parse_sheet_generic(sheet_name, rows):
    """Generic parser that auto-detects column mapping"""
    header_idx, headers = find_header_row(rows)
    
    if header_idx is None:
        print(f"  ⚠️  {sheet_name}: Could not find header row, skipping")
        return []
    
    headers_lower = [h.lower().strip() for h in headers]
    
    # Map columns by detecting keywords
    col_map = {}
    for i, h in enumerate(headers_lower):
        if not h:
            continue
        if h in ['nom', 'nom et prénom', 'societe', 'clinique', 'association'] or \
           'nom' in h and 'contact' not in h and 'prénom' not in h and h != 'nom. contact':
            if 'nom' not in col_map:  # First NOM column
                col_map['nom'] = i
        if 'societe' in h and 'contact' not in h:
            col_map['nom'] = i  # Override: Societe name goes to nom
        if 'clinique' in h:
            col_map['nom'] = i  # Clinique name goes to nom
        if 'association' in h:
            col_map['nom'] = i
        if "nom (centres d'imageries)" in h:
            col_map['nom'] = i
        if h in ['mail', 'e-mail', 'email']:
            col_map['email'] = i
        if h in ['phone 1', 'tel 1', 'phone1', 'tel1'] or h == 'phone':
            col_map['phone1'] = i
        if h in ['phone 2', 'tel 2', 'phone2', 'tel2'] or h == 'tel':
            col_map['phone2'] = i
        if h in ['phone 3', 'tel 3', 'phone3', 'tel3'] or h == 'tel3':
            col_map['phone3'] = i
        if h in ['adresse', 'address']:
            col_map['adresse'] = i
        if h in ['ville', 'city']:
            col_map['ville'] = i
        if h in ['specialite', 'spécialité', 'spécialite']:
            col_map['specialite'] = i
        if 'contact' in h and 'nom' in h:
            col_map['contact'] = i
    
    prospects = []
    for row in rows[header_idx + 1:]:
        values = get_row_values(row)
        
        # Get nom
        nom = clean_value(values[col_map.get('nom', -1)]) if col_map.get('nom', -1) < len(values) else None
        if not nom:
            continue  # Skip rows without a name
        
        # Determine specialite from sheet name if not in columns
        sheet_specialite_map = {
            'Pneumologues': 'Pneumologue',
            'Distributeur_': 'Distributeur',
            'Diabetologues': 'Diabétologue',
            'gynecologue': 'Gynécologue',
            'Medecine_du_travail': 'Médecine du travail',
            'Urologues': 'Urologue',
            'Medecins_divers': 'Médecin divers',
            'Pediatres': 'Pédiatre',
            'Radiologues': 'Radiologue',
            'Généralistes': 'Généraliste',
            'Societes': 'Société',
            'ORL': 'ORL',
            'cardiologue': 'Cardiologue',
            'Associations': 'Association',
            'Cliniques': 'Clinique',
            'medecins_internes': 'Médecin interne',
            'pharmacies': 'Pharmacie',
            'laboratoire': 'Laboratoire',
        }
        
        default_specialite = sheet_specialite_map.get(sheet_name, '')
        
        # Get specialite from column or default to sheet name
        specialite = clean_value(values[col_map.get('specialite', -1)]) if col_map.get('specialite', -1) < len(values) else None
        if not specialite:
            specialite = default_specialite
        
        # Get phone numbers
        phone1 = clean_phone(values[col_map.get('phone1', -1)]) if col_map.get('phone1', -1) < len(values) else None
        phone2 = clean_phone(values[col_map.get('phone2', -1)]) if col_map.get('phone2', -1) < len(values) else None
        phone3 = clean_phone(values[col_map.get('phone3', -1)]) if col_map.get('phone3', -1) < len(values) else None
        
        # Get email
        email = clean_value(values[col_map.get('email', -1)]) if col_map.get('email', -1) < len(values) else None
        
        # Get address and ville
        adresse = clean_value(values[col_map.get('adresse', -1)]) if col_map.get('adresse', -1) < len(values) else None
        ville = clean_value(values[col_map.get('ville', -1)]) if col_map.get('ville', -1) < len(values) else None
        
        # Extract wilaya from adresse or ville
        wilaya = ville or None
        if not wilaya and adresse:
            # Try to extract wilaya from address (usually the last part after comma)
            parts = [p.strip() for p in adresse.split(',')]
            if len(parts) > 1:
                wilaya = parts[-1].strip()
        
        # Determine source
        source = 'import_bdd'
        
        # Build notes
        notes_parts = []
        if email:
            notes_parts.append(f"Email: {email}")
        contact = clean_value(values[col_map.get('contact', -1)]) if col_map.get('contact', -1) < len(values) else None
        if contact:
            notes_parts.append(f"Contact: {contact}")
        if adresse:
            notes_parts.append(f"Adresse: {adresse}")
        notes = ' | '.join(notes_parts) if notes_parts else None
        
        prospect = {
            'nom': nom,
            'specialite': specialite,
            'wilaya': wilaya,
            'telephone': phone1,
            'telephone2': phone2,
            'whatsapp': phone3,
            'etablissement': None,
            'source': source,
            'isClient': True,  # They are already clients in the database
            'notes': notes,
        }
        
        prospects.append(prospect)
    
    return prospects

# ─── Main Import Logic ──────────────────────────────────────────

async def create_prospect(session, prospect, retry_count=0):
    """Create a single prospect via the API"""
    try:
        async with session.post(
            f"{API_BASE}/api/prospects",
            json=prospect,
            headers={"Content-Type": "application/json"},
            timeout=aiohttp.ClientTimeout(total=15)
        ) as resp:
            if resp.status == 201:
                return 'created', None
            elif resp.status == 409:
                # Duplicate phone number - skip
                data = await resp.json()
                return 'duplicate', data.get('existingId')
            else:
                data = await resp.json()
                error = data.get('error', f'HTTP {resp.status}')
                return 'error', error
    except asyncio.TimeoutError:
        if retry_count < 2:
            return await create_prospect(session, prospect, retry_count + 1)
        return 'timeout', None
    except Exception as e:
        if retry_count < 2:
            return await create_prospect(session, prospect, retry_count + 1)
        return 'error', str(e)

async def main():
    # Load ODS
    print("📂 Chargement du fichier ODS...")
    doc = load("/home/z/my-project/upload/Base de données MI HEALTHCARE.ods")
    
    import_sheets = [
        'Pneumologues', 'Distributeur_', 'Diabetologues', 'gynecologue',
        'Medecine_du_travail', 'Urologues', 'Medecins_divers', 'Pediatres',
        'Radiologues', 'Généralistes', 'Societes', 'ORL', 'cardiologue',
        'Associations', 'Cliniques', 'medecins_internes', 'pharmacies', 'laboratoire'
    ]
    
    # Parse all sheets
    all_prospects = []
    sheet_stats = {}
    
    for sheet_name in import_sheets:
        sheet = None
        for s in doc.spreadsheet.getElementsByType(Table):
            if s.getAttribute('name') == sheet_name:
                sheet = s
                break
        
        if not sheet:
            print(f"  ⚠️  Sheet '{sheet_name}' not found, skipping")
            continue
        
        rows = sheet.getElementsByType(TableRow)
        prospects = parse_sheet_generic(sheet_name, rows)
        sheet_stats[sheet_name] = len(prospects)
        all_prospects.extend(prospects)
        print(f"  ✓ {sheet_name}: {len(prospects)} prospects extraits")
    
    print(f"\n📊 Total: {len(all_prospects)} prospects à importer")
    
    # Deduplicate by name (case-insensitive)
    seen_names = {}
    unique_prospects = []
    duplicates_removed = 0
    
    for p in all_prospects:
        name_key = p['nom'].lower().strip()
        if name_key in seen_names:
            # Merge: keep the one with more info
            existing = seen_names[name_key]
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
            duplicates_removed += 1
        else:
            seen_names[name_key] = p
            unique_prospects.append(p)
    
    print(f"🔄 Déduplication: {duplicates_removed} doublons fusionnés")
    print(f"📋 {len(unique_prospects)} prospects uniques à importer\n")
    
    # Import via API with concurrency
    print("🚀 Import en cours...")
    connector = aiohttp.TCPConnector(limit=5)  # 5 concurrent requests
    async with aiohttp.ClientSession(connector=connector) as session:
        # Import in batches
        batch_size = 20
        created = 0
        duplicates = 0
        errors = 0
        total = len(unique_prospects)
        
        for i in range(0, total, batch_size):
            batch = unique_prospects[i:i+batch_size]
            tasks = [create_prospect(session, p) for p in batch]
            results = await asyncio.gather(*tasks)
            
            for status, detail in results:
                if status == 'created':
                    created += 1
                elif status == 'duplicate':
                    duplicates += 1
                else:
                    errors += 1
                    if detail and errors <= 10:
                        print(f"  ❌ Erreur: {detail}")
            
            progress = min(i + batch_size, total)
            pct = (progress / total) * 100
            print(f"  [{progress}/{total}] {pct:.1f}% - Créés: {created} | Doublons: {duplicates} | Erreurs: {errors}")
    
    print(f"\n✅ Import terminé !")
    print(f"  🟢 Créés: {created}")
    print(f"  🟡 Doublons (ignorés): {duplicates}")
    print(f"  🔴 Erreurs: {errors}")
    print(f"  📊 Total traité: {created + duplicates + errors}")

if __name__ == '__main__':
    asyncio.run(main())
