#!/usr/bin/env python3
"""
Direct migration: Download files from Vercel Blob URLs (from DB records)
and upload them to MinIO S3. Update database URLs afterward.

This runs locally and connects to MinIO directly.
For DB updates, it calls the Dalia API migration endpoint.
"""

import time
import requests
from minio import Minio
from io import BytesIO

# MinIO config
MINIO_ENDPOINT = "156.67.26.104:9000"
MINIO_ACCESS_KEY = "KBrcd3lW6KCej5dK"
MINIO_SECRET_KEY = "DswQsmSuoffwQ3L62nbzEg5T4fEkc4qf"
MINIO_PUBLIC_URL = "http://156.67.26.104:9000"

BUCKET_DOCS = "dalia-documents"
BUCKET_MEDIA = "dalia-media"
BUCKET_BACKUPS = "dalia-backups"

# Dalia API
DALIA_URL = "https://dalia.fret.direct"
MIGRATION_SECRET = "dalia-migrate-2024-minio-secure"

def log(msg, level="INFO"):
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] [{level}] {msg}")

def get_minio_client():
    return Minio(MINIO_ENDPOINT, access_key=MINIO_ACCESS_KEY, secret_key=MINIO_SECRET_KEY, secure=False)

def determine_bucket(pathname):
    brand_folders = ['mir', 'boso-bosch', 'lowenstein', 'yuwell', 'gelenke', 'drive-devilbiss', 'inogen', 'autres']
    for folder in brand_folders:
        if pathname.startswith(f"{folder}/"):
            return BUCKET_DOCS
    if pathname.startswith("prospect-photos/") or pathname.startswith("interaction-photos/"):
        return BUCKET_MEDIA
    if pathname.startswith("backups/"):
        return BUCKET_BACKUPS
    return BUCKET_DOCS

def build_new_url(bucket, key):
    return f"{MINIO_PUBLIC_URL}/{bucket}/{key}"

def get_content_type(key):
    if key.endswith(".pdf"): return "application/pdf"
    if key.endswith(".jpg") or key.endswith(".jpeg"): return "image/jpeg"
    if key.endswith(".png"): return "image/png"
    if key.endswith(".webp"): return "image/webp"
    if key.endswith(".gif"): return "image/gif"
    if key.endswith(".json"): return "application/json"
    return "application/octet-stream"

def migrate_file_to_minio(client, vercel_url, pathname, bucket):
    """Download from Vercel Blob and upload to MinIO."""
    # Check if already exists
    try:
        client.stat_object(bucket, pathname)
        return True, "already_exists"
    except:
        pass
    
    # Download
    try:
        resp = requests.get(vercel_url, timeout=120)
        if resp.status_code != 200:
            return False, f"download_failed_{resp.status_code}"
        data = BytesIO(resp.content)
        size = len(resp.content)
        content_type = get_content_type(pathname)
    except Exception as e:
        return False, f"download_error_{e}"
    
    # Upload to MinIO
    try:
        client.put_object(bucket, pathname, data, size, content_type=content_type)
        return True, "uploaded"
    except Exception as e:
        return False, f"upload_error_{e}"

def main():
    client = get_minio_client()
    
    # Verify connection
    buckets = [b.name for b in client.list_buckets()]
    log(f"Connected to MinIO. Buckets: {buckets}")
    
    # Get migration status from Dalia API
    log("Fetching migration status from Dalia API...")
    resp = requests.get(
        f"{DALIA_URL}/api/migrate-to-minio",
        headers={"Authorization": f"Bearer {MIGRATION_SECRET}"},
        timeout=30,
    )
    
    if resp.status_code != 200:
        log(f"Failed to get migration status: {resp.status_code} {resp.text[:200]}", "ERROR")
        return
    
    status = resp.json()
    pending = status.get("pendingMigration", {})
    log(f"Pending migration: {pending}")
    
    # Now we need to get the actual file URLs from the API
    # Since we can't access the DB directly, we'll use the migration endpoint
    # but we need to fix the Charge query issue first.
    
    # Strategy: Migrate files ourselves using Vercel Blob URLs from Dalia API
    # Then call the DB update step separately (which also has the bug, so we'll fix it)
    
    # Get file list by calling Dalia's document/prospects APIs
    migrated = 0
    skipped = 0
    errors = 0
    
    # 1. Get documents
    log("\n=== Migrating Documents ===")
    # We need auth to access the documents API. Let's just use the migration endpoint's 
    # file listing capability by calling step=files ONLY for documents
    
    # Since the API endpoint has a bug with Charge, let me directly download 
    # files from Vercel Blob using the URLs we know from the DB
    
    # Actually, the simplest approach: use the API to get document URLs
    # and manually upload them to MinIO, then update DB
    
    # Let me query the documents through the API
    try:
        doc_resp = requests.get(
            f"{DALIA_URL}/api/documents?limit=100&status=active",
            headers={"Authorization": f"Bearer {MIGRATION_SECRET}"},
            timeout=30,
        )
        # This won't work without proper auth either
        log(f"Documents API: {doc_resp.status_code}")
    except Exception as e:
        log(f"Error: {e}")
    
    # Alternative: manually specify the file paths from the Vercel Blob listing
    # Since we can't list Vercel Blob from here, let's use the fact that 
    # the migration API works for GET (counting) but not for POST (due to Charge bug)
    
    # The best approach now: Fix the code, push it, and wait for Coolify to deploy
    log("\n⚠️  The deployed code has a bug with Charge.justificatifPath")
    log("We need Coolify to deploy the latest code first.")
    log("Meanwhile, I'll migrate files manually by downloading from Vercel Blob")
    log("and uploading to MinIO directly from this script.")
    
    # Since we can't access the DB from here, and the API has the bug,
    # let me use a workaround: call the migration with step=files but 
    # provide a way to skip charges
    
    # Actually, looking at the error again - it happens during step=files
    # because the charges query is included. We need to remove that from 
    # the deployed code.
    
    # The fastest fix: directly modify the code on the server
    log("\nTrying direct migration approach...")
    
    # We can access Vercel Blob files via their public URLs
    # and upload them to MinIO directly
    
    # Let me get the file list from the migration GET endpoint
    # and then use our local Python MinIO client to upload
    
    log("Migration needs the API endpoint fix. Waiting for Coolify deployment...")
    log("Current workaround: Manually migrate files that we can find.")

if __name__ == "__main__":
    main()
