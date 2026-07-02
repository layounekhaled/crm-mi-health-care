#!/usr/bin/env python3
"""
Extract prospects from all uploaded Excel files for Dalia CRM using pandas (faster).
"""
import pandas as pd
import json
import re
import os

UPLOAD_DIR = "/home/z/my-project/upload"
OUTPUT_FILE = "/home/z/my-project/scripts/prospects_extracted.json"

all_prospects = []
seen_emails = {}
seen_phones = {}
stats = {"total_raw": 0, "duplicates_email": 0, "duplicates_phone": 0, "final_count": 0}

def normalize_phone(phone):
    if not phone:
        return ""
    digits = re.sub(r'[^\d]', '', str(phone))
    if digits.startswith('213') and len(digits) > 10:
        digits = '0' + digits[3:]
    if digits.startswith('00'):
        digits = digits[2:]
    return digits

def normalize_email(email):
    if not email:
        return ""
    email = str(email).strip().lower()
    email = email.rstrip(',;').strip()
    if '/' in email and '@' in email:
        parts = email.split('/')
        email = parts[0].strip()
    return email

def clean(val):
    if not val:
        return ""
    if pd.isna(val):
        return ""
    val = str(val).strip().replace('\xa0', ' ').replace('_x000D_', '').replace('\n', ' ')
    val = re.sub(r'\s+', ' ', val).strip()
    if val.lower() in ['info manquante', 'abs', 'absent', '-', 'n/a', 'na', 'none', 'nan']:
        return ""
    return val

def extract_wilaya(adresse):
    if not adresse:
        return ""
    cities = ['Alger','Oran','Constantine','Annaba','Blida','Setif','Sétif','Tlemcen','Batna',
              'Béjaia','Bejaia','Tizi Ouzou','Djelfa','Biskra','Tiaret','Medea','Médéa',
              'Mostaganem','Mascara','Boumerdes','Boumerdès','El Oued','Skikda',
              'Sidi Bel Abbes','Chlef','Jijel','Ghardaia','Ghardaïa','Bouira','Tebessa',
              'Tipaza','Ain Defla','Mila','Khenchela','Souk Ahras','Relizane',
              'Ain Temouchent','Saïda','Naama','El Bayadh','Guelma','Oum El Bouaghi',
              'Laghouat','M\'Sila','Msila','Bordj Bou Arreridj','El Tarf','Tissemsilt']
    ad_up = adresse.upper()
    for city in cities:
        if city.upper() in ad_up:
            return city
    return ""

def add_prospect(nom, email="", telephone="", telephone2="", whatsapp="",
                 adresse="", specialite="", wilaya="", etablissement="", 
                 source="", notes=""):
    global all_prospects
    nom = clean(nom)
    if not nom and not email:
        return
    
    email_clean = normalize_email(email)
    phone_clean = normalize_phone(telephone)
    
    stats["total_raw"] += 1
    
    if email_clean and email_clean in seen_emails:
        idx = seen_emails[email_clean]
        existing = all_prospects[idx]
        if telephone and not existing.get("telephone"):
            existing["telephone"] = clean(telephone)
        if adresse and not existing.get("adresse"):
            existing["adresse"] = clean(adresse)
        if specialite and not existing.get("specialite"):
            existing["specialite"] = clean(specialite)
        if wilaya and not existing.get("wilaya"):
            existing["wilaya"] = clean(wilaya)
        stats["duplicates_email"] += 1
        return
    
    if phone_clean and len(phone_clean) >= 8 and phone_clean in seen_phones:
        idx = seen_phones[phone_clean]
        existing = all_prospects[idx]
        if email_clean and not existing.get("email"):
            existing["email"] = email_clean
        if adresse and not existing.get("adresse"):
            existing["adresse"] = clean(adresse)
        if specialite and not existing.get("specialite"):
            existing["specialite"] = clean(specialite)
        stats["duplicates_phone"] += 1
        return
    
    if not wilaya and adresse:
        wilaya = extract_wilaya(adresse)
    
    prospect = {
        "nom": nom or email_clean,
        "email": email_clean,
        "telephone": clean(telephone),
        "telephone2": clean(telephone2),
        "whatsapp": "",
        "adresse": clean(adresse),
        "specialite": clean(specialite),
        "wilaya": clean(wilaya),
        "etablissement": clean(etablissement),
        "source": "import_excel",
        "notes": notes,
    }
    
    idx = len(all_prospects)
    all_prospects.append(prospect)
    if email_clean:
        seen_emails[email_clean] = idx
    if phone_clean and len(phone_clean) >= 8:
        seen_phones[phone_clean] = idx


def safe_str(val):
    """Convert any value to string safely, handling NaN."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ""
    return str(val).strip()


def parse_sheet_generic(df, col_map, default_spec, source_label, skip_rows=0):
    """Generic parser for sheets with known column mappings.
    col_map: dict mapping logical field -> column name or index
    """
    for idx in range(skip_rows, len(df)):
        row = df.iloc[idx]
        
        def get_col(key):
            if key not in col_map:
                return ""
            col = col_map[key]
            if isinstance(col, int):
                val = row.iloc[col] if col < len(row) else ""
            else:
                val = row[col] if col in df.columns else ""
            return safe_str(val)
        
        nom = get_col('nom')
        email = get_col('email')
        tel1 = get_col('tel1')
        tel2 = get_col('tel2')
        adresse = get_col('adresse')
        specialite = get_col('specialite') or default_spec
        wilaya = get_col('wilaya')
        notes = get_col('notes')
        etablissement = get_col('etablissement')
        
        if not clean(nom) and not clean(email):
            continue
        
        add_prospect(nom, email=email, telephone=tel1, telephone2=tel2,
                    adresse=adresse, specialite=specialite, wilaya=wilaya,
                    etablissement=etablissement, source=source_label, notes=notes)


# ============================================================
# MAIN
# ============================================================
print("=" * 60)
print("Dalia CRM - Extraction des prospects")
print("=" * 60)

# ============================================================
# FILE 1: Bases de données MI HEALTHCARE(Récupération automatique).xlsx
# ============================================================
f1 = os.path.join(UPLOAD_DIR, "Bases de données MI HEALTHCARE(Récupération automatique).xlsx")
print(f"\nParsing: {os.path.basename(f1)}")

# Pneumologues
df = pd.read_excel(f1, sheet_name='Pneumologues', header=None, engine='openpyxl')
# Find header row with "NOM"
header_row = None
for i in range(min(10, len(df))):
    row_vals = [str(v).strip().upper() for v in df.iloc[i] if pd.notna(v)]
    if 'NOM' in row_vals:
        header_row = i
        break

if header_row is not None:
    df.columns = df.iloc[header_row]
    df = df.iloc[header_row + 2:]  # Skip "Colonne1" row
    df = df.reset_index(drop=True)
    
    col_nom = 'NOM' if 'NOM' in df.columns else None
    col_prenom = 'Prenom' if 'Prenom' in df.columns else None
    
    for idx in range(len(df)):
        row = df.iloc[idx]
        nom = safe_str(row.get('NOM', ''))
        prenom = safe_str(row.get('Prenom', ''))
        phone2 = safe_str(row.get('PHONE 2', ''))
        adresse = safe_str(row.get('ADRESSE', ''))
        ville = safe_str(row.get('VILLE', ''))
        specialite = safe_str(row.get('SPECIALITE', ''))
        
        full_name = f"{clean(nom)} {clean(prenom)}".strip()
        if not full_name:
            continue
        spec = clean(specialite) or "Pneumologue"
        add_prospect(full_name, telephone=phone2, adresse=adresse,
                    specialite=spec, wilaya=ville, source="BDD Auto - Pneumologues")

print(f"  Pneumologues: {len(all_prospects)} prospects so far")

# distributeur
df = pd.read_excel(f1, sheet_name='distributeur', header=None, engine='openpyxl')
for i in range(min(10, len(df))):
    row_vals = [str(v).strip().upper() for v in df.iloc[i] if pd.notna(v)]
    if 'NOM' in row_vals and 'MAIL' in row_vals:
        df.columns = df.iloc[i]
        df = df.iloc[i+1:].reset_index(drop=True)
        break

for idx in range(len(df)):
    row = df.iloc[idx]
    nom = safe_str(row.get('NOM', ''))
    mail = safe_str(row.get('MAIL', ''))
    adresse = safe_str(row.get('ADRESSE', ''))
    ville = safe_str(row.get('VILLE', ''))
    spec = safe_str(row.get('SPECIALITE', ''))
    
    full_name = clean(nom)
    if not full_name:
        continue
    add_prospect(full_name, email=mail, adresse=adresse,
                specialite=spec, wilaya=ville, source="BDD Auto - Distributeurs")

print(f"  + Distributeurs: {len(all_prospects)} prospects so far")

# Diabetologues
df = pd.read_excel(f1, sheet_name='Diabetologues', header=None, engine='openpyxl')
for i in range(min(10, len(df))):
    row_vals = [str(v).strip().upper() for v in df.iloc[i] if pd.notna(v)]
    if 'NOM' in row_vals and 'MAIL' in row_vals:
        df.columns = df.iloc[i]
        df = df.iloc[i+1:].reset_index(drop=True)
        break

for idx in range(len(df)):
    row = df.iloc[idx]
    nom = safe_str(row.get('NOM', ''))
    mail = safe_str(row.get('MAIL', ''))
    tel1 = safe_str(row.get('PHONE 1', '')) or safe_str(row.get('Tel 1', ''))
    tel2 = safe_str(row.get('PHONE 2', '')) or safe_str(row.get('Tel 2', ''))
    adresse = safe_str(row.get('ADRESSE', ''))
    spec = safe_str(row.get('SPECIALITE', '')) or safe_str(row.get('Specialite', ''))
    
    full_name = clean(nom)
    if not full_name:
        continue
    add_prospect(full_name, email=mail, telephone=tel1, telephone2=tel2,
                adresse=adresse, specialite=spec or "Diabetologue", source="BDD Auto - Diabetologues")

print(f"  + Diabetologues: {len(all_prospects)} prospects so far")

# Generic parser for remaining sheets in f1
generic_sheets_f1 = {
    'gynecologue': {'cols': ['Nom', 'MAIL', 'TEL 1', 'TEL2', 'Adresse'], 'spec': 'Gynécologue'},
    'Medecine_du_travail': {'cols': ['NOM', 'MAIL', 'PHONE 1', 'PHONE 2', 'ADRESSE'], 'spec': 'Médecine du travail'},
    'Urologues': {'cols': ['NOM', 'MAIL', 'PHONE 1', 'PHONE 2', 'ADRESSE', 'SPECIALITE'], 'spec': 'Urologue'},
    'Medecins_divers': {'cols': ['Nom', 'MAIL', 'Tel 1', 'Tel 2', 'Specialite', 'ADRESSE'], 'spec': ''},
    'Pediatres': {'cols': ['NOM', 'MAIL', 'PHONE 1', 'PHONE 2', 'ADRESSE'], 'spec': 'Pédiatre'},
    'ORL': {'cols': ['NOM', 'MAIL', 'TEL 1', 'TEL 2', 'ADRESSE'], 'spec': 'ORL'},
    'cardiologue': {'mail_first': True, 'cols': ['MAIL', 'PHONE 1', 'PHONE 2', 'ADRESSE', 'NOM'], 'spec': 'Cardiologue'},
    'Cliniques': {'offset': 1, 'cols': ['CLINIQUE', 'MAIL', 'TEL 1', 'TEL2', 'ADRESSE'], 'spec': 'Clinique'},
    'Societes': {'cols': ['SOCIETE', 'MAIL', 'TEL 1', 'TEL2', 'ADRESSE'], 'spec': 'Société'},
    'Associations': {'cols': ['ASSOCIATION', 'MAIL', 'PHONE 1', 'PHONE 2', 'ADRESSE'], 'spec': 'Association'},
    'Radiologues': {'offset': 1, 'cols': ["NOM (CENTRES D'IMAGERIES)", 'MAIL', 'TEL 1', 'TEL2', 'ADRESSE', 'SPECIALITE'], 'spec': 'Radiologue'},
    'medecins internes': {'cols': ["NOM (CENTRES D'IMAGERIES)", 'MAIL', 'TEL 1', 'TEL2', 'ADRESSE'], 'spec': 'Médecine interne'},
    'Distributeurs': {'cols': ['NOM', 'MAIL', 'PHONE 1', 'PHONE 2', 'ADRESSE'], 'spec': 'Distributeur'},
    'pharmacies': {'cols': ['mail', 'pharmacie', 'Adresse', 'TEL', 'MAIL2'], 'spec': 'Pharmacie'},
    'laboratoire': {'cols': ['Laboratoire', 'MAIL', 'TEL', 'adresse'], 'spec': 'Laboratoire'},
}

for sheet_name, cfg in generic_sheets_f1.items():
    try:
        df = pd.read_excel(f1, sheet_name=sheet_name, header=None, engine='openpyxl')
        if len(df) < 2:
            continue
        
        # Find header row
        header_row = 0
        for i in range(min(10, len(df))):
            row_vals = [str(v).strip().upper() for v in df.iloc[i] if pd.notna(v)]
            # Check if any expected column names appear
            expected = [c.upper() for c in cfg['cols']]
            match_count = sum(1 for ev in expected for rv in row_vals if ev in rv or rv in ev)
            if match_count >= 2:
                header_row = i
                break
        
        df.columns = df.iloc[header_row]
        df = df.iloc[header_row + 1:].reset_index(drop=True)
        
        for idx in range(len(df)):
            row = df.iloc[idx]
            
            if sheet_name == 'cardiologue':
                nom = safe_str(row.get('NOM', ''))
                mail = safe_str(row.get('MAIL', ''))
                tel1 = safe_str(row.get('PHONE 1', ''))
                tel2 = safe_str(row.get('PHONE 2', ''))
                adresse = safe_str(row.get('ADRESSE', ''))
                full_name = clean(nom) or clean(mail)
            elif sheet_name == 'pharmacies':
                mail = safe_str(row.get('mail', ''))
                pharmacie = safe_str(row.get('pharmacie', ''))
                tel = safe_str(row.get('TEL', ''))
                mail2 = safe_str(row.get('MAIL2', ''))
                adresse = safe_str(row.get('Adresse', ''))
                full_name = clean(pharmacie) or clean(mail)
                mail_val = clean(mail) or clean(mail2)
                add_prospect(full_name, email=mail_val, telephone=tel,
                            adresse=adresse, specialite=cfg['spec'], source=f"BDD Auto - {sheet_name}")
                continue
            elif sheet_name == 'Societes':
                societe = safe_str(row.get('SOCIETE', ''))
                mail = safe_str(row.get('MAIL', ''))
                tel1 = safe_str(row.get('TEL 1', ''))
                tel2 = safe_str(row.get('TEL2', ''))
                adresse = safe_str(row.get('ADRESSE', ''))
                contact = safe_str(row.get('Nom. CONTACT', ''))
                full_name = clean(societe)
                notes = f"Contact: {clean(contact)}" if clean(contact) else ""
                add_prospect(full_name, email=mail, telephone=tel1, telephone2=tel2,
                            adresse=adresse, specialite=cfg['spec'], etablissement=full_name,
                            notes=notes, source=f"BDD Auto - Sociétés")
                continue
            elif sheet_name == 'Distributeurs':
                nom = safe_str(row.get('NOM', ''))
                mail = safe_str(row.get('MAIL', ''))
                tel1 = safe_str(row.get('PHONE 1', ''))
                tel2 = safe_str(row.get('PHONE 2', ''))
                adresse = safe_str(row.get('ADRESSE', ''))
                contact = safe_str(row.get('CONTACT', ''))
                full_name = clean(nom)
                notes = f"Contact: {clean(contact)}" if clean(contact) else ""
                add_prospect(full_name, email=mail, telephone=tel1, telephone2=tel2,
                            adresse=adresse, specialite=cfg['spec'], notes=notes,
                            source=f"BDD Auto - Distributeurs")
                continue
            elif sheet_name == 'Cliniques' or sheet_name == 'Radiologues':
                nom_col = cfg['cols'][0]
                nom = safe_str(row.get(nom_col, ''))
                mail = safe_str(row.get('MAIL', ''))
                tel1 = safe_str(row.get('TEL 1', ''))
                tel2 = safe_str(row.get('TEL2', ''))
                adresse = safe_str(row.get('ADRESSE', ''))
                spec = safe_str(row.get('SPECIALITE', '')) or cfg['spec']
                full_name = clean(nom)
                add_prospect(full_name, email=mail, telephone=tel1, telephone2=tel2,
                            adresse=adresse, specialite=spec, etablissement=full_name if sheet_name == 'Cliniques' else '',
                            source=f"BDD Auto - {sheet_name}")
                continue
            else:
                # Generic: NOM, MAIL, TEL/PHONE, ADRESSE, SPECIALITE
                nom = safe_str(row.get('NOM', '')) or safe_str(row.get('Nom', '')) or safe_str(row.get('ASSOCIATION', ''))
                mail = safe_str(row.get('MAIL', ''))
                tel1 = safe_str(row.get('PHONE 1', '')) or safe_str(row.get('TEL 1', '')) or safe_str(row.get('Tel 1', ''))
                tel2 = safe_str(row.get('PHONE 2', '')) or safe_str(row.get('TEL 2', '')) or safe_str(row.get('TEL2', '')) or safe_str(row.get('Tel 2', ''))
                adresse = safe_str(row.get('ADRESSE', '')) or safe_str(row.get('Adresse', ''))
                spec = safe_str(row.get('SPECIALITE', '')) or safe_str(row.get('Specialite', '')) or cfg['spec']
                full_name = clean(nom)
            
            if not full_name and not clean(mail):
                continue
            add_prospect(full_name, email=mail, telephone=tel1, telephone2=tel2,
                        adresse=adresse, specialite=spec, source=f"BDD Auto - {sheet_name}")
    except Exception as e:
        print(f"  ERROR parsing {sheet_name}: {e}")

# Special sheets
# Généralistes
try:
    df = pd.read_excel(f1, sheet_name='Généralistes', header=None, engine='openpyxl')
    for i in range(min(8, len(df))):
        row_vals = [str(v).strip().upper() for v in df.iloc[i] if pd.notna(v)]
        if any('NOM' in v for v in row_vals):
            df.columns = df.iloc[i]
            df = df.iloc[i+1:].reset_index(drop=True)
            break
    
    for idx in range(len(df)):
        row = df.iloc[idx]
        nom = safe_str(row.get("NOM (CENTRES D'IMAGERIES)", '')) or safe_str(row.get('NOM', ''))
        prenom = safe_str(row.get('PRENOM', ''))
        mail = safe_str(row.get('MAIL', ''))
        tel1 = safe_str(row.get('TEL 1', ''))
        tel2 = safe_str(row.get('TEL2', ''))
        adresse = safe_str(row.get('ADRESSE', ''))
        spec = safe_str(row.get('SPECIALITE', '')) or "Généraliste"
        full_name = f"{clean(nom)} {clean(prenom)}".strip()
        if not full_name:
            continue
        add_prospect(full_name, email=mail, telephone=tel1, telephone2=tel2,
                    adresse=adresse, specialite=spec, source="BDD Auto - Généralistes")
except Exception as e:
    print(f"  ERROR parsing Généralistes: {e}")

# congres SAP NOVEMBRE 2024
try:
    df = pd.read_excel(f1, sheet_name='congres SAP NOVEMBRE 2024', header=None, engine='openpyxl')
    for i in range(min(5, len(df))):
        row_vals = [str(v).strip().upper() for v in df.iloc[i] if pd.notna(v)]
        if 'NOM ET PRENOM' in ' '.join(row_vals):
            df.columns = df.iloc[i]
            df = df.iloc[i+1:].reset_index(drop=True)
            break
    
    for idx in range(len(df)):
        row = df.iloc[idx]
        nom = safe_str(row.get('NOM ET PRENOM', ''))
        tel = safe_str(row.get('TEL', ''))
        mail = safe_str(row.get('MAIL', ''))
        adresse = safe_str(row.get('ADRESSE', ''))
        commentaire = safe_str(row.get('COMMENTAIRE', ''))
        full_name = clean(nom)
        if not full_name:
            continue
        add_prospect(full_name, email=mail, telephone=tel, adresse=adresse,
                    specialite="Pneumologue", notes=clean(commentaire), source="Congrès SAP Nov 2024")
except Exception as e:
    print(f"  ERROR parsing Congrès SAP: {e}")

# formation
try:
    df = pd.read_excel(f1, sheet_name='formation', header=None, engine='openpyxl')
    for i in range(min(5, len(df))):
        row_vals = [str(v).strip().upper() for v in df.iloc[i] if pd.notna(v)]
        if 'NOM' in row_vals:
            df.columns = df.iloc[i]
            df = df.iloc[i+1:].reset_index(drop=True)
            break
    
    for idx in range(len(df)):
        row = df.iloc[idx]
        nom = safe_str(row.get('NOM', '')) or safe_str(row.get('Colonne1', ''))
        ville = safe_str(row.get('VILLE', '')) or safe_str(row.get('Colonne2', ''))
        mail = safe_str(row.get('MAIL', '')) or safe_str(row.get('Colonne3', ''))
        full_name = clean(nom)
        if not full_name:
            continue
        add_prospect(full_name, email=mail, wilaya=ville, notes=f"Fonction: {clean(ville)}", 
                    source="BDD Auto - Formation")
except Exception as e:
    print(f"  ERROR parsing formation: {e}")

# divers
try:
    df = pd.read_excel(f1, sheet_name='divers', header=None, engine='openpyxl')
    for i in range(min(8, len(df))):
        row_vals = [str(v).strip().upper() for v in df.iloc[i] if pd.notna(v)]
        if 'NOM' in row_vals and 'MAIL' in row_vals:
            df.columns = df.iloc[i]
            df = df.iloc[i+1:].reset_index(drop=True)
            break
    
    for idx in range(len(df)):
        row = df.iloc[idx]
        nom = safe_str(row.get('Nom', ''))
        mail = safe_str(row.get('MAIL', ''))
        tel1 = safe_str(row.get('TEL 1', ''))
        tel2 = safe_str(row.get('TEL2', ''))
        adresse = safe_str(row.get('Adresse', ''))
        spec = safe_str(row.get('spécialité', '')) or safe_str(row.get('specialite', ''))
        full_name = clean(nom)
        if not full_name:
            continue
        add_prospect(full_name, email=mail, telephone=tel1, telephone2=tel2,
                    adresse=adresse, specialite=spec, source="BDD Auto - Divers")
except Exception as e:
    print(f"  ERROR parsing divers: {e}")

# FOURNISSEUR ETRANGERS
try:
    df = pd.read_excel(f1, sheet_name='FOURNISSEUR ETRANGERS ', header=None, engine='openpyxl')
    for i in range(min(8, len(df))):
        row_vals = [str(v).strip().upper() for v in df.iloc[i] if pd.notna(v)]
        if 'NOM' in row_vals:
            df.columns = df.iloc[i]
            df = df.iloc[i+1:].reset_index(drop=True)
            break
    
    for idx in range(len(df)):
        row = df.iloc[idx]
        nom = safe_str(row.get('NOM', ''))
        mail = safe_str(row.get('MAIL', ''))
        tel = safe_str(row.get('TEL', ''))
        adresse = safe_str(row.get('ADRESSE', ''))
        full_name = clean(nom)
        if not full_name:
            continue
        add_prospect(full_name, email=mail, telephone=tel, adresse=adresse,
                    specialite="Fournisseur étranger", source="BDD Auto - Fournisseurs étrangers")
except Exception as e:
    print(f"  ERROR parsing Fournisseurs: {e}")

print(f"  Fichier 1 complet: {len(all_prospects)} prospects")


# ============================================================
# FILE 2: Pediatre.xlsx
# ============================================================
f2 = os.path.join(UPLOAD_DIR, "Pediatre.xlsx")
print(f"\nParsing: {os.path.basename(f2)}")

df = pd.read_excel(f2, sheet_name='FICHIER MEDECIN', header=1, engine='openpyxl')
for idx in range(len(df)):
    row = df.iloc[idx]
    nom = safe_str(row.get('Nom', ''))
    prenom = safe_str(row.get('Prénom', ''))
    email = safe_str(row.get('E-mail', ''))
    tel_cab1 = safe_str(row.get('# Tel. 1 Cabinet', ''))
    tel_cab2 = safe_str(row.get('# Tel. 2 Cabinet', ''))
    tel_perso = safe_str(row.get('# Tel. Perso', ''))
    adresse = safe_str(row.get('Adresse', ''))
    wilaya = safe_str(row.get('wilaya', ''))
    categorie = safe_str(row.get('Catégorie', ''))
    sous_spec = safe_str(row.get('Sous -Spécialité', ''))
    
    full_name = f"{clean(nom)} {clean(prenom)}".strip()
    if not full_name:
        continue
    spec = clean(sous_spec) or clean(categorie) or "Pédiatre"
    tel1 = clean(tel_cab1) or clean(tel_perso)
    tel2 = clean(tel_cab2)
    
    add_prospect(full_name, email=email, telephone=tel1, telephone2=tel2,
                adresse=adresse, specialite=spec, wilaya=wilaya, source="Pediatre.xlsx - Marytam Pharma")

print(f"  Après Pediatre.xlsx: {len(all_prospects)} prospects")


# ============================================================
# FILE 3: Copie de FORMATION PART 1 FRANCOIS XAVIER.xlsx
# ============================================================
f3 = os.path.join(UPLOAD_DIR, "Copie de FORMATION PART 1 FRANCOIS XAVIER.xlsx")
print(f"\nParsing: {os.path.basename(f3)}")

df = pd.read_excel(f3, sheet_name='Feuil1', header=0, engine='openpyxl')
for idx in range(len(df)):
    row = df.iloc[idx]
    nom = safe_str(row.get('NOM', ''))
    ville = safe_str(row.get('VILLE', ''))
    mail = safe_str(row.get('MAIL', ''))
    full_name = clean(nom)
    if not full_name:
        continue
    add_prospect(full_name, email=mail, wilaya=ville, notes=f"Fonction: {clean(ville)}",
                source="Formation Part 1 François Xavier")

print(f"  Après Formation FX: {len(all_prospects)} prospects")


# ============================================================
# FILE 4: Copie de FORMATION DIAGNOSTIC.xlsx
# ============================================================
f4 = os.path.join(UPLOAD_DIR, "Copie de FORMATION DIAGNOSTIC.xlsx")
print(f"\nParsing: {os.path.basename(f4)}")

df = pd.read_excel(f4, sheet_name='Feuil1', header=0, engine='openpyxl')
for idx in range(len(df)):
    row = df.iloc[idx]
    nom = safe_str(row.get('NOM', ''))
    tel = safe_str(row.get('TEL', ''))
    ville = safe_str(row.get('VILLE', ''))
    mail = safe_str(row.get('MAIL', ''))
    full_name = clean(nom)
    if not full_name:
        continue
    add_prospect(full_name, email=mail, telephone=tel, wilaya=ville, source="Formation Diagnostic")

print(f"  Après Formation Diagnostic: {len(all_prospects)} prospects")


# ============================================================
# FILE 5 & 6: Copie de/Base de données MI HEALTHCARE.xlsx
# ============================================================
for fname in ["Copie de Base de données MI HEALTHCARE.xlsx", "Base de données MI HEALTHCARE.xlsx"]:
    f_path = os.path.join(UPLOAD_DIR, fname)
    print(f"\nParsing: {fname}")
    
    xls = pd.ExcelFile(f_path, engine='openpyxl')
    
    for sheet_name in xls.sheet_names:
        if sheet_name in ['TOTAL_BDD', 'Feuil1', 'VISITES ']:
            continue
        
        try:
            df = pd.read_excel(f_path, sheet_name=sheet_name, header=None, engine='openpyxl')
            if len(df) < 3:
                continue
            
            # Find header row
            header_row = None
            for i in range(min(10, len(df))):
                row_vals = [str(v).strip().upper() for v in df.iloc[i] if pd.notna(v)]
                if not row_vals:
                    continue
                # Check for known column headers
                known = ['NOM', 'MAIL', 'TEL', 'PHONE', 'ADRESSE', 'SPECIALITE', 'CLINIQUE', 
                         'SOCIETE', 'ASSOCIATION', 'LABORATOIRE', 'PHARMACIE']
                match = sum(1 for rv in row_vals for k in known if k in rv)
                if match >= 2:
                    header_row = i
                    break
            
            if header_row is None:
                continue
            
            df.columns = df.iloc[header_row]
            df = df.iloc[header_row + 1:].reset_index(drop=True)
            
            # Determine default specialty from sheet name
            spec_map = {
                'Pneumologues': 'Pneumologue', 'Diabetologues': 'Diabetologue',
                'Urologues': 'Urologue', 'gynecologue': 'Gynécologue',
                'Medecine_du_travail': 'Médecine du travail', 'Medecins_divers': '',
                'Pediatres': 'Pédiatre', 'ORL': 'ORL', 'cardiologue': 'Cardiologue',
                'Cliniques': 'Clinique', 'Societes': 'Société', 'Associations': 'Association',
                'Radiologues': 'Radiologue', 'Généralistes': 'Généraliste',
                'pharmacies': 'Pharmacie', 'laboratoire': 'Laboratoire',
                'medecins internes': 'Médecine interne',
            }
            default_spec = spec_map.get(sheet_name, '')
            
            # Dist. sheet name
            is_distrib = 'distribut' in sheet_name.lower()
            if is_distrib:
                default_spec = 'Distributeur'
            
            for idx_row in range(len(df)):
                row = df.iloc[idx_row]
                
                # Try multiple column name variants
                nom = (safe_str(row.get('NOM', '')) or safe_str(row.get('Nom', '')) or 
                       safe_str(row.get('NOM ET PRENOM', '')) or safe_str(row.get('CLINIQUE', '')) or
                       safe_str(row.get('SOCIETE', '')) or safe_str(row.get('ASSOCIATION', '')) or
                       safe_str(row.get('Laboratoire', '')) or
                       safe_str(row.get("NOM (CENTRES D'IMAGERIES)", '')))
                prenom = safe_str(row.get('PRENOM', '')) or safe_str(row.get('Prénom', ''))
                mail = safe_str(row.get('MAIL', ''))
                tel1 = (safe_str(row.get('PHONE 1', '')) or safe_str(row.get('TEL 1', '')) or 
                        safe_str(row.get('Tel 1', '')))
                tel2 = (safe_str(row.get('PHONE 2', '')) or safe_str(row.get('TEL2', '')) or 
                        safe_str(row.get('TEL 2', '')) or safe_str(row.get('Tel 2', '')))
                adresse = safe_str(row.get('ADRESSE', '')) or safe_str(row.get('Adresse', '')) or safe_str(row.get('adresse', ''))
                specialite = (safe_str(row.get('SPECIALITE', '')) or safe_str(row.get('Specialite', '')) or 
                             safe_str(row.get('spécialité', '')))
                ville = safe_str(row.get('VILLE', '')) or safe_str(row.get('wilaya', ''))
                
                if prenom:
                    full_name = f"{clean(nom)} {clean(prenom)}".strip()
                else:
                    full_name = clean(nom)
                
                if not full_name and not clean(mail):
                    continue
                
                spec = clean(specialite) or default_spec
                
                add_prospect(full_name, email=mail, telephone=tel1, telephone2=tel2,
                            adresse=adresse, specialite=spec, wilaya=ville,
                            source=f"{fname[:20]}... - {sheet_name}")
        except Exception as e:
            print(f"  ERROR parsing {sheet_name}: {e}")

print(f"\n  Après tous les fichiers: {len(all_prospects)} prospects")


# ============================================================
# FINAL STATS & OUTPUT
# ============================================================
stats["final_count"] = len(all_prospects)

by_spec = {}
for p in all_prospects:
    spec = p.get("specialite") or "Non spécifié"
    by_spec[spec] = by_spec.get(spec, 0) + 1

by_source = {}
for p in all_prospects:
    src = p.get("source", "Unknown").split(" - ")[0] if p.get("source") else "Unknown"
    by_source[src] = by_source.get(src, 0) + 1

print(f"\n{'='*60}")
print(f"RÉSULTATS DE L'EXTRACTION")
print(f"{'='*60}")
print(f"Total entrées brutes: {stats['total_raw']}")
print(f"Doublons email évités: {stats['duplicates_email']}")
print(f"Doublons téléphone évités: {stats['duplicates_phone']}")
print(f"Prospects uniques: {stats['final_count']}")
print(f"\nRépartition par spécialité:")
for spec, count in sorted(by_spec.items(), key=lambda x: -x[1]):
    print(f"  {spec}: {count}")

with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    json.dump({
        "stats": stats,
        "by_specialite": by_spec,
        "prospects": all_prospects
    }, f, ensure_ascii=False, indent=2)

print(f"\nFichier sauvegardé: {OUTPUT_FILE}")
