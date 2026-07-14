#!/usr/bin/env python3
"""
Update all Dalia CRM environment variables in Coolify to point to local PostgreSQL.
"""
import json
import requests
import sys

COOLIFY_URL = "http://156.67.26.104:8000"
API_TOKEN = "4|6M2W2uFfoQF3E4XFVTvtRucMqT9hyxYXfh2J8Awj1bb5d300"
HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

# Both Dalia app UUIDs
APP_UUIDS = [
    "ad4uuhzdhxblr5tweze534d8",
    "kjn9no5omysvd3ga747r4qi8",
]

# New PostgreSQL connection strings
NEW_DATABASE_URL = "postgresql://crm:CrmPr0sp!bNnRO9R5aPGJ@m2gr4uesqj3npja5a2exvqql:5432/dalia?sslmode=disable"
NEW_DIRECT_URL = "postgresql://crm:CrmPr0sp!bNnRO9R5aPGJ@m2gr4uesqj3npja5a2exvqql:5432/dalia?sslmode=disable"

def api_call(method, path, **kwargs):
    url = f"{COOLIFY_URL}/api/v1{path}"
    return requests.request(method, url, headers=HEADERS, timeout=60, **kwargs)

def update_env_var(app_uuid, key, new_value):
    """Delete and recreate an environment variable."""
    # Get current envs
    r = api_call("GET", f"/applications/{app_uuid}/envs")
    if r.status_code != 200:
        print(f"  ERROR: Failed to get envs for {app_uuid}: {r.status_code}")
        return False
    
    envs = r.json()
    target_env = None
    for env in envs:
        if env.get('key') == key:
            target_env = env
            break
    
    if not target_env:
        print(f"  WARNING: {key} not found for {app_uuid}, creating...")
        r = api_call("POST", f"/applications/{app_uuid}/envs", json={
            "key": key,
            "value": new_value,
            "is_buildtime": True,
            "is_runtime": True,
            "is_preview": False,
        })
        print(f"  POST {key}: {r.status_code}")
        return r.status_code in (200, 201)
    
    env_uuid = target_env['uuid']
    
    # Delete
    r = api_call("DELETE", f"/applications/{app_uuid}/envs/{env_uuid}")
    if r.status_code not in (200, 201, 204):
        print(f"  ERROR: DELETE {key} failed: {r.status_code} {r.text[:100]}")
        return False
    
    # Recreate
    r = api_call("POST", f"/applications/{app_uuid}/envs", json={
        "key": key,
        "value": new_value,
        "is_buildtime": True,
        "is_runtime": True,
        "is_preview": False,
    })
    if r.status_code in (200, 201):
        print(f"  OK: {key} updated for {app_uuid}")
        return True
    else:
        print(f"  ERROR: POST {key} failed: {r.status_code} {r.text[:100]}")
        return False

def main():
    for app_uuid in APP_UUIDS:
        print(f"\n>>> Updating app: {app_uuid}")
        
        # Update DATABASE_URL
        update_env_var(app_uuid, "DATABASE_URL", NEW_DATABASE_URL)
        
        # Update DIRECT_URL
        update_env_var(app_uuid, "DIRECT_URL", NEW_DIRECT_URL)
    
    # Verify
    print("\n\n>>> Verification:")
    for app_uuid in APP_UUIDS:
        r = api_call("GET", f"/applications/{app_uuid}/envs")
        envs = r.json()
        for env in envs:
            if env.get('key') in ('DATABASE_URL', 'DIRECT_URL'):
                val = env.get('value', '')
                print(f"  {app_uuid[:12]}... {env['key']}: {val[:70]}...")
    
    print("\n>>> Done! Environment variables updated.")

if __name__ == '__main__':
    main()
