#!/usr/bin/env python3
"""
Déploiement de DALIA CRM sur Coolify dans le projet DALIA CRM dédié.
- Crée l'application
- Configure le FQDN via PATCH sur custom_labels
- Ajoute toutes les variables d'environnement
- Déclenche le déploiement
"""

import json
import requests
import time
import sys

COOLIFY_URL = "http://156.67.26.104:8000"
API_TOKEN = "4|6M2W2uFfoQF3E4XFVTvtRucMqT9hyxYXfh2J8Awj1bb5d300"
HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

PROJECT_UUID = "gt5aub58hzuacjyien1h2ydh"  # DALIA CRM
ENV_NAME = "production"
SERVER_UUID = "xsoe6lkg0cbqc8u7fs1a5hev"
DEST_UUID = "urtrpvysyb2k2k9n9xwv2kjj"

# Variables d'environnement (récupérées de l'ancienne app)
ENV_VARS = [
    {"key": "DATABASE_URL", "value": "postgresql://neondb_owner:npg_N2ESji9uVPfL@ep-divine-darkness-an3iu4co-pooler.c-6.us-east-1.aws.neon.tech/crm_dalia?sslmode=require"},
    {"key": "DIRECT_URL", "value": "postgresql://neondb_owner:npg_N2ESji9uVPfL@ep-divine-darkness-an3iu4co.c-6.us-east-1.aws.neon.tech/crm_dalia?sslmode=require"},
    {"key": "NEXTAUTH_SECRET", "value": "crm-dalia-nextauth-secret-2024-mi-health-care-secure"},
    {"key": "NEXTAUTH_URL", "value": "https://dalia.fret.direct"},
    {"key": "NEXT_PUBLIC_SUPABASE_URL", "value": "https://vsxzdvecxcnijojmaund.supabase.co"},
    {"key": "NEXT_PUBLIC_SUPABASE_ANON_KEY", "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzeHpkdmVjeGNuaWpvam1hdW5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjI0ODcyOTYsImV4cCI6MjAzODA2MzI5Nn0.7CjfS5Fsa8_Jx1GwU5R2nJBsJc4IJ3pOjM"},
    {"key": "SUPABASE_SERVICE_ROLE_KEY", "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzeHpkdmVjeGNuaWpvam1hdW5kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMjQ4NzI5NiwiZXhwIjoyMDM4MDYzMjk2fQ.rJXsG-t_G2b6sqV3YLzeGKjO9VhE-TklgNlJi7PcNsk"},
    {"key": "NODE_ENV", "value": "production"},
    {"key": "NEXT_TELEMETRY_DISABLED", "value": "1"},
    {"key": "HOSTNAME", "value": "0.0.0.0"},
    {"key": "PORT", "value": "3000"},
    {"key": "BLOB_READ_WRITE_TOKEN", "value": "placeholder_link_blob_store"},
]

def step(msg):
    print(f"\n>>> {msg}")
    print("-" * 60)

def api_call(method, path, **kwargs):
    url = f"{COOLIFY_URL}/api/v1{path}"
    resp = requests.request(method, url, headers=HEADERS, timeout=60, **kwargs)
    return resp

# 1. Créer l'application
step("1. Création de l'application DALIA CRM dans le nouveau projet")
payload = {
    "project_uuid": PROJECT_UUID,
    "environment_name": ENV_NAME,
    "server_uuid": SERVER_UUID,
    "destination_uuid": DEST_UUID,
    "type": "public",
    "name": "DALIA CRM",
    "description": "CRM DALIA - MI HEALTH CARE (PostgreSQL + Prisma + Next.js 16) - CRM pour matériel médical en Algérie",
    "git_repository": "https://github.com/layounekhaled/crm-mi-health-care.git",
    "git_branch": "main",
    "build_pack": "dockerfile",
    "ports_exposes": "3000",
    "redirect": "both",
}
r = api_call("POST", "/applications/public", json=payload)
print(f"Status: {r.status_code}")
data = r.json()
print(json.dumps(data, indent=2, ensure_ascii=False))
if "uuid" not in data:
    print("ERREUR: UUID non retourné")
    sys.exit(1)
APP_UUID = data["uuid"]
print(f"\n✓ App UUID: {APP_UUID}")

# 2. Attendre que l'app soit prête
step("2. Attente initialisation de l'app")
time.sleep(3)

# 3. Configurer le FQDN via PATCH sur custom_labels (avec fqdn vide dans l'URL)
# Selon la doc Coolify v4, on doit PATCH fqdn + custom_labels ensemble pour 
# que Traefik soit correctement configuré. Mais fqdn est "not allowed" en PATCH direct.
# Solution : on patche custom_labels avec les bonnes routes Traefik pour dalia.fret.direct
step("3. Configuration du domaine https://dalia.fret.direct via custom_labels")

# Labels Traefik + Caddy pour dalia.fret.direct (avec SSL Let's Encrypt)
custom_labels = """traefik.enable=true
traefik.http.middlewares.gzip.compress=true
traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https
traefik.http.routers.http-0-{uuid}.entryPoints=http
traefik.http.routers.http-0-{uuid}.middlewares=redirect-to-https
traefik.http.routers.http-0-{uuid}.rule=Host(`dalia.fret.direct`) && PathPrefix(`/`)
traefik.http.routers.http-0-{uuid}.service=http-0-{uuid}
traefik.http.routers.https-0-{uuid}.entryPoints=https
traefik.http.routers.https-0-{uuid}.middlewares=gzip
traefik.http.routers.https-0-{uuid}.rule=Host(`dalia.fret.direct`) && PathPrefix(`/`)
traefik.http.routers.https-0-{uuid}.service=https-0-{uuid}
traefik.http.routers.https-0-{uuid}.tls.certresolver=letsencrypt
traefik.http.routers.https-0-{uuid}.tls=true
traefik.http.services.http-0-{uuid}.loadbalancer.server.port=3000
traefik.http.services.https-0-{uuid}.loadbalancer.server.port=3000
caddy_0.encode=zstd gzip
caddy_0.handle_path.0_reverse_proxy={{{{upstreams 3000}}}}
caddy_0.handle_path=/*
caddy_0.header=-Server
caddy_0.try_files={{{{path}}}} /index.html /index.php
caddy_0=https://dalia.fret.direct
caddy_ingress_network=coolify""".format(uuid=APP_UUID)

# PATCH en mettant custom_labels + fqdn (au cas où ça passerait cette fois avec custom_labels)
patch_data = {
    "custom_labels": custom_labels,
    "redirect": "both",
}
r = api_call("PATCH", f"/applications/{APP_UUID}", json=patch_data)
print(f"Status PATCH: {r.status_code}")
print(r.text[:500])

# Vérifier l'état
r = api_call("GET", f"/applications/{APP_UUID}")
data = r.json()
print(f"\nFQDN actuel: {data.get('fqdn')}")
print(f"Custom labels (premieres lignes):")
labels = data.get('custom_labels', '')
for line in labels.split('\n')[:5]:
    print(f"  {line}")

# 4. Ajouter les variables d'environnement une par une
step("4. Ajout des variables d'environnement")
for ev in ENV_VARS:
    r = api_call("POST", f"/applications/{APP_UUID}/envs", json={
        "key": ev["key"],
        "value": ev["value"],
        "is_buildtime": True,
        "is_runtime": True,
        "is_preview": False,
    })
    status = "✓" if r.status_code in (200, 201) else "✗"
    print(f"  {status} {ev['key']}: HTTP {r.status_code}")

# 5. Déclencher le déploiement
step("5. Déploiement")
r = api_call("POST", f"/deploy", json={"uuid": APP_UUID, "force_rebuild": False})
print(f"Status: {r.status_code}")
print(r.text[:500])

print(f"\n{'='*60}")
print(f"✓ App UUID: {APP_UUID}")
print(f"✓ Projet: DALIA CRM")
print(f"✓ Domaine cible: https://dalia.fret.direct")
print(f"{'='*60}")
print(f"\nURL Coolify: http://156.67.26.104:8000/projects/gt5aub58hzuacjyien1h2ydh")
