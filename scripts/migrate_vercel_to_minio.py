#!/usr/bin/env python3
"""
Migration script: Transfer all files from Vercel Blob to MinIO S3 Storage.
Uses database records to find file URLs instead of Vercel Blob API.
Downloads each file and uploads to the correct MinIO bucket.
Updates database records to point to the new MinIO URLs.

Usage:
  python3 migrate_vercel_to_minio.py [--dry-run]
"""

import os
import sys
import time
import argparse
import requests
import psycopg2
from minio import Minio
from minio.error import S3Error
from io import BytesIO

# ─── Configuration ──────────────────────────────────────────────────────────

MINIO_ENDPOINT = "156.67.26.104:9000"
MINIO_ACCESS_KEY = "KBrcd3lW6KCej5dK"
MINIO_SECRET_KEY = "DswQsmSuoffwQ3L62nbzEg5T4fEkc4qf"
MINIO_PUBLIC_URL = "http://156.67.26.104:9000"

# Bucket names
BUCKET_DOCS = "dalia-documents"
BUCKET_MEDIA = "dalia-media"
BUCKET_BACKUPS = "dalia-backups"

# Database connection
DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://705XInzPkEjPnO6Y:jW3NaQWQmcBU8NSWJ9YgipKc03gqrFbh@postgresql-bwj97q1aao9793pgif71u3ou:5432/dalia?sslmode=disable"
)

# ─── Helpers ────────────────────────────────────────────────────────────────

def log(msg, level="INFO"):
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] [{level}] {msg}")

def get_minio_client():
    return Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=False,
    )

def determine_bucket_and_key(pathname, url):
    """Determine which MinIO bucket and key to use."""
    brand_folders = ['mir', 'boso-bosch', 'lowenstein', 'yuwell', 'gelenke', 'drive-devilbiss', 'inogen', 'autres']
    
    if pathname:
        for folder in brand_folders:
            if pathname.startswith(f"{folder}/"):
                return BUCKET_DOCS, pathname
        
        if pathname.startswith("prospect-photos/") or pathname.startswith("interaction-photos/"):
            return BUCKET_MEDIA, pathname
        
        if pathname.startswith("backups/"):
            return BUCKET_BACKUPS, pathname
    
    # Fallback: check URL path
    if url:
        for folder in brand_folders:
            if f'/{folder}/' in url:
                # Extract key from URL path after the folder
                idx = url.find(f'/{folder}/')
                key = url[idx+1:]
                if '?' in key:
                    key = key.split('?')[0]
                return BUCKET_DOCS, key
        
        if 'prospect-photos' in url:
            idx = url.find('prospect-photos/')
            if idx >= 0:
                key = url[idx:]
                if '?' in key:
                    key = key.split('?')[0]
                return BUCKET_MEDIA, key
        
        if 'interaction-photos' in url:
            idx = url.find('interaction-photos/')
            if idx >= 0:
                key = url[idx:]
                if '?' in key:
                    key = key.split('?')[0]
                return BUCKET_MEDIA, key
        
        if 'backups/' in url:
            idx = url.find('backups/')
            if idx >= 0:
                key = url[idx:]
                if '?' in key:
                    key = key.split('?')[0]
                return BUCKET_BACKUPS, key
    
    return BUCKET_DOCS, pathname or "unknown/file"

def build_new_url(bucket, key):
    """Build the new MinIO public URL."""
    return f"{MINIO_PUBLIC_URL}/{bucket}/{key}"

def download_file(url):
    """Download a file from a URL."""
    try:
        resp = requests.get(url, timeout=120, stream=True)
        if resp.status_code == 200:
            return BytesIO(resp.content), len(resp.content)
        else:
            log(f"  Failed to download: HTTP {resp.status_code}", "ERROR")
            return None, 0
    except Exception as e:
        log(f"  Download error: {e}", "ERROR")
        return None, 0

def get_content_type(key):
    """Determine content type from file extension."""
    if key.endswith(".pdf"):
        return "application/pdf"
    elif key.endswith(".jpg") or key.endswith(".jpeg"):
        return "image/jpeg"
    elif key.endswith(".png"):
        return "image/png"
    elif key.endswith(".webp"):
        return "image/webp"
    elif key.endswith(".gif"):
        return "image/gif"
    elif key.endswith(".json"):
        return "application/json"
    return "application/octet-stream"

# ─── Migration Steps ────────────────────────────────────────────────────────

def migrate_files_from_db(client, cur, dry_run=False):
    """Migrate all files referenced in the database from Vercel Blob to MinIO."""
    log("=" * 60)
    log("STEP 1: Migrating files from Vercel Blob to MinIO")
    log("=" * 60)
    
    migrated = 0
    skipped = 0
    errors = 0
    
    # Collect all unique file URLs from the database
    tables_to_migrate = [
        {
            "name": "Document",
            "query": 'SELECT id, "fileUrl", "filePath" FROM "Document" WHERE "fileUrl" LIKE \'%vercel-storage.com%\'',
            "url_col": "fileUrl",
            "path_col": "filePath",
        },
        {
            "name": "ProspectPhoto",
            "query": 'SELECT id, url, pathname FROM "ProspectPhoto" WHERE url LIKE \'%vercel-storage.com%\'',
            "url_col": "url",
            "path_col": "pathname",
        },
        {
            "name": "InteractionPhoto",
            "query": 'SELECT id, url, pathname FROM "InteractionPhoto" WHERE url LIKE \'%vercel-storage.com%\'',
            "url_col": "url",
            "path_col": "pathname",
        },
        {
            "name": "BackupRecord",
            "query": 'SELECT id, "blobUrl", "blobPathname" FROM "BackupRecord" WHERE "blobUrl" LIKE \'%vercel-storage.com%\'',
            "url_col": "blobUrl",
            "path_col": "blobPathname",
        },
        {
            "name": "Charge",
            "query": 'SELECT id, "justificatifUrl", "justificatifPath" FROM "Charge" WHERE "justificatifUrl" LIKE \'%vercel-storage.com%\'',
            "url_col": "justificatifUrl",
            "path_col": "justificatifPath",
        },
    ]
    
    for table_info in tables_to_migrate:
        table_name = table_info["name"]
        log(f"\n--- {table_name} ---")
        
        try:
            cur.execute(table_info["query"])
            rows = cur.fetchall()
        except Exception as e:
            log(f"  Query error: {e}", "ERROR")
            continue
        
        log(f"  Found {len(rows)} records with Vercel Blob URLs")
        
        for row in rows:
            record_id = row[0]
            url = row[1]
            pathname = row[2]
            
            if not url:
                skipped += 1
                continue
            
            bucket, key = determine_bucket_and_key(pathname, url)
            new_url = build_new_url(bucket, key)
            
            log(f"  [{record_id[:8]}...] {pathname or key[:40]}...")
            
            if dry_run:
                log(f"    [DRY] Would upload to {bucket}/{key}")
                skipped += 1
                continue
            
            # Check if already in MinIO
            try:
                client.stat_object(bucket, key)
                log(f"    Already exists in MinIO")
                skipped += 1
                continue
            except:
                pass
            
            # Download from Vercel Blob
            data, size = download_file(url)
            if data is None:
                errors += 1
                continue
            
            # Upload to MinIO
            content_type = get_content_type(key)
            try:
                client.put_object(
                    bucket, key, data, size,
                    content_type=content_type,
                )
                migrated += 1
                log(f"    ✓ Uploaded ({size} bytes) → {bucket}/{key}")
            except Exception as e:
                errors += 1
                log(f"    ✗ Upload failed: {e}", "ERROR")
    
    log(f"\nFile migration summary: {migrated} migrated, {skipped} skipped, {errors} errors")
    return migrated, skipped, errors

def update_database_records(cur, conn, dry_run=False):
    """Update database records to point to MinIO URLs."""
    log("\n" + "=" * 60)
    log("STEP 2: Updating database URLs to MinIO")
    log("=" * 60)
    
    updated = 0
    skipped = 0
    errors = 0
    
    update_queries = [
        {
            "name": "Document",
            "select": 'SELECT id, "fileUrl", "filePath" FROM "Document" WHERE "fileUrl" LIKE \'%vercel-storage.com%\'',
            "update": 'UPDATE "Document" SET "fileUrl" = %s, "filePath" = %s WHERE id = %s',
            "url_idx": 1,
            "path_idx": 2,
        },
        {
            "name": "ProspectPhoto",
            "select": 'SELECT id, url, pathname FROM "ProspectPhoto" WHERE url LIKE \'%vercel-storage.com%\'',
            "update": 'UPDATE "ProspectPhoto" SET url = %s, pathname = %s WHERE id = %s',
            "url_idx": 1,
            "path_idx": 2,
        },
        {
            "name": "InteractionPhoto",
            "select": 'SELECT id, url, pathname FROM "InteractionPhoto" WHERE url LIKE \'%vercel-storage.com%\'',
            "update": 'UPDATE "InteractionPhoto" SET url = %s, pathname = %s WHERE id = %s',
            "url_idx": 1,
            "path_idx": 2,
        },
        {
            "name": "BackupRecord",
            "select": 'SELECT id, "blobUrl", "blobPathname" FROM "BackupRecord" WHERE "blobUrl" LIKE \'%vercel-storage.com%\'',
            "update": 'UPDATE "BackupRecord" SET "blobUrl" = %s, "blobPathname" = %s WHERE id = %s',
            "url_idx": 1,
            "path_idx": 2,
        },
        {
            "name": "Charge",
            "select": 'SELECT id, "justificatifUrl", "justificatifPath" FROM "Charge" WHERE "justificatifUrl" LIKE \'%vercel-storage.com%\'',
            "update": 'UPDATE "Charge" SET "justificatifUrl" = %s, "justificatifPath" = %s WHERE id = %s',
            "url_idx": 1,
            "path_idx": 2,
        },
    ]
    
    for table_info in update_queries:
        table_name = table_info["name"]
        log(f"\n--- {table_name} ---")
        
        try:
            cur.execute(table_info["select"])
            rows = cur.fetchall()
        except Exception as e:
            log(f"  Query error: {e}", "ERROR")
            continue
        
        log(f"  Found {len(rows)} records to update")
        
        for row in rows:
            record_id = row[0]
            url = row[table_info["url_idx"]]
            pathname = row[table_info["path_idx"]]
            
            if not url:
                continue
            
            bucket, key = determine_bucket_and_key(pathname, url)
            new_url = build_new_url(bucket, key)
            
            if dry_run:
                log(f"  [DRY] {record_id[:8]}... → {new_url[:60]}")
                skipped += 1
                continue
            
            try:
                cur.execute(table_info["update"], (new_url, key, record_id))
                updated += 1
            except Exception as e:
                errors += 1
                log(f"  ✗ Error: {e}", "ERROR")
    
    if not dry_run:
        conn.commit()
        log(f"\n✓ Database changes committed")
    
    log(f"\nDatabase update summary: {updated} updated, {skipped} skipped, {errors} errors")
    return updated, skipped, errors

# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Migrate Dalia files from Vercel Blob to MinIO")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without making them")
    parser.add_argument("--skip-files", action="store_true", help="Skip file migration (only update DB)")
    parser.add_argument("--skip-db", action="store_true", help="Skip DB update (only migrate files)")
    args = parser.parse_args()
    
    if args.dry_run:
        log("DRY RUN MODE - No changes will be made")
    
    client = get_minio_client()
    
    # Verify MinIO connection
    try:
        buckets = client.list_buckets()
        log(f"Connected to MinIO at {MINIO_ENDPOINT}")
        log(f"  Buckets: {[b.name for b in buckets]}")
    except Exception as e:
        log(f"Cannot connect to MinIO: {e}", "ERROR")
        sys.exit(1)
    
    # Connect to database
    # The DB URL uses a Docker hostname, which isn't accessible from outside.
    # We need to connect via SSH tunnel or use the external IP.
    # Try to connect via the server's public IP with port forwarding.
    
    # First, try direct connection (might work if on same network)
    conn = None
    db_urls_to_try = [
        DB_URL,
        # Try with external IP
        "postgresql://705XInzPkEjPnO6Y:jW3NaQWQmcBU8NSWJ9YgipKc03gqrFbh@156.67.26.104:5432/dalia?sslmode=disable",
    ]
    
    for url in db_urls_to_try:
        try:
            log(f"Trying database connection: {url[:60]}...")
            conn = psycopg2.connect(url, connect_timeout=5)
            log(f"Connected to database!")
            break
        except Exception as e:
            log(f"  Failed: {e}")
            continue
    
    if not conn:
        log("Cannot connect to database. Trying via SSH...", "ERROR")
        # Try using SSH to create a tunnel
        log("Attempting to connect through Docker on the server...")
        
        # Use the Coolify API to run a command in the Dalia container
        # Or use a direct approach: run the migration from within the Docker network
        
        # For now, let's try to set up an SSH tunnel
        log("Setting up SSH tunnel to PostgreSQL...")
        import subprocess
        try:
            # Start SSH tunnel in background
            tunnel = subprocess.Popen(
                ["ssh", "-o", "StrictHostKeyChecking=no", "-L", "15432:postgresql-bwj97q1aao9793pgif71u3ou:5432", "root@156.67.26.104", "-N"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            time.sleep(2)
            
            tunnel_url = "postgresql://705XInzPkEjPnO6Y:jW3NaQWQmcBU8NSWJ9YgipKc03gqrFbh@localhost:15432/dalia?sslmode=disable"
            conn = psycopg2.connect(tunnel_url, connect_timeout=10)
            log(f"Connected via SSH tunnel!")
        except Exception as e:
            log(f"SSH tunnel failed: {e}", "ERROR")
            log("Cannot connect to database. Aborting.", "ERROR")
            sys.exit(1)
    
    cur = conn.cursor()
    
    # Step 1: Migrate files
    if not args.skip_files:
        migrate_files_from_db(client, cur, dry_run=args.dry_run)
    else:
        log("Skipping file migration (--skip-files)")
    
    # Step 2: Update database records
    if not args.skip_db:
        update_database_records(cur, conn, dry_run=args.dry_run)
    else:
        log("Skipping database update (--skip-db)")
    
    cur.close()
    conn.close()
    
    log("\n" + "=" * 60)
    log("Migration complete!")
    log("=" * 60)

if __name__ == "__main__":
    main()
