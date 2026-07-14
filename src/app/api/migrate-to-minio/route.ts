import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min timeout

import { getAuthUser, isAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

// Migration can be authenticated via user session OR via MIGRATION_SECRET token
const MIGRATION_SECRET = process.env.MIGRATION_SECRET || ''

function isAuthorized(request: NextRequest): boolean {
  // Check for bearer token first
  const authHeader = request.headers.get('authorization')
  if (authHeader && MIGRATION_SECRET) {
    const token = authHeader.replace('Bearer ', '')
    if (token === MIGRATION_SECRET) return true
  }
  return false // Will check user auth separately
}
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

// ─── S3 Configuration ──────────────────────────────────────────────────────

function getS3Client() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT || 'http://156.67.26.104:9000',
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
    forcePathStyle: true,
  })
}

function getPublicUrl(bucket: string, key: string): string {
  const base = process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || 'http://156.67.26.104:9000'
  return `${base}/${bucket}/${key}`
}

// ─── Migrate a single file ─────────────────────────────────────────────────

async function migrateFile(
  client: S3Client,
  oldUrl: string,
  pathname: string,
  bucket: string
): Promise<{ newUrl: string; key: string; success: boolean }> {
  const key = pathname || oldUrl.split('/').slice(-2).join('/')

  // Check if already in MinIO
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return { newUrl: getPublicUrl(bucket, key), key, success: true }
  } catch {
    // Not in MinIO yet, need to download and upload
  }

  // Download from Vercel Blob
  try {
    const response = await fetch(oldUrl)
    if (!response.ok) {
      console.error(`[MIGRATE] Failed to download: ${oldUrl} → HTTP ${response.status}`)
      return { newUrl: oldUrl, key, success: false }
    }

    const body = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'application/octet-stream'

    // Upload to MinIO
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }))

    return { newUrl: getPublicUrl(bucket, key), key, success: true }
  } catch (err) {
    console.error(`[MIGRATE] Error migrating ${oldUrl}:`, err)
    return { newUrl: oldUrl, key, success: false }
  }
}

function determineBucket(pathname: string): string {
  const brandFolders = ['mir', 'boso-bosch', 'lowenstein', 'yuwell', 'gelenke', 'drive-devilbiss', 'inogen', 'autres']
  
  for (const folder of brandFolders) {
    if (pathname.startsWith(`${folder}/`)) return 'dalia-documents'
  }
  if (pathname.startsWith('prospect-photos/') || pathname.startsWith('interaction-photos/')) return 'dalia-media'
  if (pathname.startsWith('backups/')) return 'dalia-backups'
  
  return 'dalia-documents'
}

// ─── Main handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Auth: either MIGRATION_SECRET bearer token OR admin user session
    const authorized = isAuthorized(request)
    const authUser = await getAuthUser(request)
    const isAdminUser = authUser && isAdmin(authUser)
    
    if (!authorized && !isAdminUser) {
      return NextResponse.json({ error: 'Réservé aux administrateurs. Utilisez Authorization: Bearer <MIGRATION_SECRET>' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const dryRun = body.dryRun === true
    const step = body.step || 'all' // 'files', 'db', 'all'

    if (!process.env.S3_ACCESS_KEY) {
      return NextResponse.json({ error: 'S3_ACCESS_KEY non configuré' }, { status: 500 })
    }

    const client = getS3Client()
    const results: Record<string, { total: number; migrated: number; skipped: number; errors: number }> = {}

    // ─── Step 1: Migrate files ─────────────────────────────────────────
    if (step === 'files' || step === 'all') {
      // Documents
      const docResults = { total: 0, migrated: 0, skipped: 0, errors: 0 }
      const documents = await db.document.findMany({
        where: { fileUrl: { contains: 'vercel-storage.com' } },
        select: { id: true, fileUrl: true, filePath: true },
      })
      docResults.total = documents.length

      for (const doc of documents) {
        if (dryRun) { docResults.skipped++; continue }
        const bucket = determineBucket(doc.filePath)
        const { success } = await migrateFile(client, doc.fileUrl, doc.filePath, bucket)
        if (success) docResults.migrated++
        else docResults.errors++
      }
      results.documents = docResults

      // Prospect Photos
      const photoResults = { total: 0, migrated: 0, skipped: 0, errors: 0 }
      const photos = await db.prospectPhoto.findMany({
        where: { url: { contains: 'vercel-storage.com' } },
        select: { id: true, url: true, pathname: true },
      })
      photoResults.total = photos.length

      for (const photo of photos) {
        if (dryRun) { photoResults.skipped++; continue }
        const bucket = determineBucket(photo.pathname)
        const { success } = await migrateFile(client, photo.url, photo.pathname, bucket)
        if (success) photoResults.migrated++
        else photoResults.errors++
      }
      results.prospectPhotos = photoResults

      // Interaction Photos
      const intPhotoResults = { total: 0, migrated: 0, skipped: 0, errors: 0 }
      const intPhotos = await db.interactionPhoto.findMany({
        where: { url: { contains: 'vercel-storage.com' } },
        select: { id: true, url: true, pathname: true },
      })
      intPhotoResults.total = intPhotos.length

      for (const photo of intPhotos) {
        if (dryRun) { intPhotoResults.skipped++; continue }
        const bucket = determineBucket(photo.pathname)
        const { success } = await migrateFile(client, photo.url, photo.pathname, bucket)
        if (success) intPhotoResults.migrated++
        else intPhotoResults.errors++
      }
      results.interactionPhotos = intPhotoResults

      // Backup Records
      const backupResults = { total: 0, migrated: 0, skipped: 0, errors: 0 }
      const backups = await db.backupRecord.findMany({
        where: { blobUrl: { contains: 'vercel-storage.com' } },
        select: { id: true, blobUrl: true, blobPathname: true },
      })
      backupResults.total = backups.length

      for (const backup of backups) {
        if (dryRun) { backupResults.skipped++; continue }
        const bucket = determineBucket(backup.blobPathname || '')
        const { success } = await migrateFile(client, backup.blobUrl!, backup.blobPathname || '', bucket)
        if (success) backupResults.migrated++
        else backupResults.errors++
      }
      results.backupRecords = backupResults

      // Charges (only justificatifUrl, no justificatifPath on this model)
      const chargeResults = { total: 0, migrated: 0, skipped: 0, errors: 0 }
      const charges = await db.charge.findMany({
        where: { justificatifUrl: { contains: 'vercel-storage.com' } },
        select: { id: true, justificatifUrl: true },
      })
      chargeResults.total = charges.length

      for (const charge of charges) {
        if (dryRun) { chargeResults.skipped++; continue }
        // Extract key from URL since there's no separate path field
        const urlObj = new URL(charge.justificatifUrl!)
        const key = urlObj.pathname.split('/').filter(Boolean).slice(1).join('/') // remove bucket name prefix if present
        const bucket = 'dalia-media'
        const { success } = await migrateFile(client, charge.justificatifUrl!, key || 'charges/unknown', bucket)
        if (success) chargeResults.migrated++
        else chargeResults.errors++
      }
      results.charges = chargeResults
    }

    // ─── Step 2: Update database URLs ──────────────────────────────────
    if (step === 'db' || step === 'all') {
      // Update Document URLs
      const docUpdates = { total: 0, updated: 0, errors: 0 }
      const docs = await db.document.findMany({
        where: { fileUrl: { contains: 'vercel-storage.com' } },
        select: { id: true, fileUrl: true, filePath: true },
      })
      docUpdates.total = docs.length

      for (const doc of docs) {
        if (dryRun) continue
        try {
          const bucket = determineBucket(doc.filePath)
          const newUrl = getPublicUrl(bucket, doc.filePath)
          await db.document.update({ where: { id: doc.id }, data: { fileUrl: newUrl } })
          docUpdates.updated++
        } catch (err) {
          docUpdates.errors++
        }
      }
      results.documentUpdates = docUpdates

      // Update ProspectPhoto URLs
      const photoUpdates = { total: 0, updated: 0, errors: 0 }
      const photos = await db.prospectPhoto.findMany({
        where: { url: { contains: 'vercel-storage.com' } },
        select: { id: true, url: true, pathname: true },
      })
      photoUpdates.total = photos.length

      for (const photo of photos) {
        if (dryRun) continue
        try {
          const bucket = determineBucket(photo.pathname)
          const newUrl = getPublicUrl(bucket, photo.pathname)
          await db.prospectPhoto.update({ where: { id: photo.id }, data: { url: newUrl } })
          photoUpdates.updated++
        } catch (err) {
          photoUpdates.errors++
        }
      }
      results.prospectPhotoUpdates = photoUpdates

      // Update InteractionPhoto URLs
      const intPhotoUpdates = { total: 0, updated: 0, errors: 0 }
      const intPhotos = await db.interactionPhoto.findMany({
        where: { url: { contains: 'vercel-storage.com' } },
        select: { id: true, url: true, pathname: true },
      })
      intPhotoUpdates.total = intPhotos.length

      for (const photo of intPhotos) {
        if (dryRun) continue
        try {
          const bucket = determineBucket(photo.pathname)
          const newUrl = getPublicUrl(bucket, photo.pathname)
          await db.interactionPhoto.update({ where: { id: photo.id }, data: { url: newUrl } })
          intPhotoUpdates.updated++
        } catch (err) {
          intPhotoUpdates.errors++
        }
      }
      results.interactionPhotoUpdates = intPhotoUpdates

      // Update BackupRecord URLs
      const backupUpdates = { total: 0, updated: 0, errors: 0 }
      const backups = await db.backupRecord.findMany({
        where: { blobUrl: { contains: 'vercel-storage.com' } },
        select: { id: true, blobUrl: true, blobPathname: true },
      })
      backupUpdates.total = backups.length

      for (const backup of backups) {
        if (dryRun) continue
        try {
          const bucket = determineBucket(backup.blobPathname || '')
          const newUrl = getPublicUrl(bucket, backup.blobPathname || '')
          await db.backupRecord.update({ where: { id: backup.id }, data: { blobUrl: newUrl } })
          backupUpdates.updated++
        } catch (err) {
          backupUpdates.errors++
        }
      }
      results.backupRecordUpdates = backupUpdates

      // Update Charge URLs (no justificatifPath field on Charge model)
      const chargeUpdates = { total: 0, updated: 0, errors: 0 }
      const charges = await db.charge.findMany({
        where: { justificatifUrl: { contains: 'vercel-storage.com' } },
        select: { id: true, justificatifUrl: true },
      })
      chargeUpdates.total = charges.length

      for (const charge of charges) {
        if (dryRun) continue
        try {
          const urlObj = new URL(charge.justificatifUrl!)
          const key = urlObj.pathname.split('/').filter(Boolean).slice(1).join('/')
          const bucket = 'dalia-media'
          const newUrl = getPublicUrl(bucket, key || 'charges/unknown')
          await db.charge.update({ where: { id: charge.id }, data: { justificatifUrl: newUrl } })
          chargeUpdates.updated++
        } catch (err) {
          chargeUpdates.errors++
        }
      }
      results.chargeUpdates = chargeUpdates
    }

    return NextResponse.json({
      success: true,
      dryRun,
      results,
    })
  } catch (error: any) {
    console.error('[MIGRATE_TO_MINIO]', error)
    return NextResponse.json(
      { error: `Migration error: ${error.message}` },
      { status: 500 }
    )
  }
}

// GET - preview mode (dry run)
export async function GET(request: NextRequest) {
  const authorized = isAuthorized(request)
  const authUser = await getAuthUser(request)
  const isAdminUser = authUser && isAdmin(authUser)

  if (!authorized && !isAdminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  // Count files that need migration
  const [
    documents,
    prospectPhotos,
    interactionPhotos,
    backupRecords,
    charges,
  ] = await Promise.all([
    db.document.count({ where: { fileUrl: { contains: 'vercel-storage.com' } } }),
    db.prospectPhoto.count({ where: { url: { contains: 'vercel-storage.com' } } }),
    db.interactionPhoto.count({ where: { url: { contains: 'vercel-storage.com' } } }),
    db.backupRecord.count({ where: { blobUrl: { contains: 'vercel-storage.com' } } }),
    db.charge.count({ where: { justificatifUrl: { contains: 'vercel-storage.com' } } }),
  ])

  const total = documents + prospectPhotos + interactionPhotos + backupRecords + charges

  return NextResponse.json({
    pendingMigration: {
      total,
      documents,
      prospectPhotos,
      interactionPhotos,
      backupRecords,
      charges,
    },
    s3Configured: !!process.env.S3_ACCESS_KEY,
    s3Endpoint: process.env.S3_ENDPOINT || 'not set',
  })
}
