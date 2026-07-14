import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { db } from '@/lib/db'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const MIGRATION_SECRET = process.env.MIGRATION_SECRET || ''

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

function determineBucket(pathname: string): string {
  const brandFolders = ['mir', 'boso-bosch', 'lowenstein', 'yuwell', 'gelenke', 'drive-devilbiss', 'inogen', 'autres']
  for (const folder of brandFolders) {
    if (pathname.startsWith(`${folder}/`)) return 'dalia-documents'
  }
  if (pathname.startsWith('prospect-photos/') || pathname.startsWith('interaction-photos/')) return 'dalia-media'
  if (pathname.startsWith('backups/')) return 'dalia-backups'
  return 'dalia-documents'
}

async function migrateFile(client: S3Client, oldUrl: string, pathname: string, bucket: string) {
  const key = pathname
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return { success: true, status: 'already_exists' }
  } catch {}

  try {
    const response = await fetch(oldUrl)
    if (!response.ok) return { success: false, status: `download_${response.status}` }
    const body = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }))
    return { success: true, status: 'uploaded' }
  } catch (err) {
    return { success: false, status: `error` }
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!MIGRATION_SECRET || token !== MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  if (!process.env.S3_ACCESS_KEY) {
    return NextResponse.json({ error: 'S3 non configure' }, { status: 500 })
  }

  const client = getS3Client()
  const results: Record<string, any> = {}

  // Documents
  const docStats = { total: 0, migrated: 0, skipped: 0, errors: 0 }
  const documents = await db.document.findMany({
    where: { fileUrl: { contains: 'vercel-storage.com' } },
    select: { id: true, fileUrl: true, filePath: true },
  })
  docStats.total = documents.length
  for (const doc of documents) {
    const bucket = determineBucket(doc.filePath)
    const { success } = await migrateFile(client, doc.fileUrl, doc.filePath, bucket)
    if (success) {
      docStats.migrated++
      const newUrl = getPublicUrl(bucket, doc.filePath)
      await db.document.update({ where: { id: doc.id }, data: { fileUrl: newUrl } })
    } else {
      docStats.errors++
    }
  }
  results.documents = docStats

  // Prospect Photos
  const photoStats = { total: 0, migrated: 0, skipped: 0, errors: 0 }
  const photos = await db.prospectPhoto.findMany({
    where: { url: { contains: 'vercel-storage.com' } },
    select: { id: true, url: true, pathname: true },
  })
  photoStats.total = photos.length
  for (const photo of photos) {
    const bucket = determineBucket(photo.pathname)
    const { success } = await migrateFile(client, photo.url, photo.pathname, bucket)
    if (success) {
      photoStats.migrated++
      const newUrl = getPublicUrl(bucket, photo.pathname)
      await db.prospectPhoto.update({ where: { id: photo.id }, data: { url: newUrl } })
    } else {
      photoStats.errors++
    }
  }
  results.prospectPhotos = photoStats

  // Interaction Photos
  const intStats = { total: 0, migrated: 0, skipped: 0, errors: 0 }
  const intPhotos = await db.interactionPhoto.findMany({
    where: { url: { contains: 'vercel-storage.com' } },
    select: { id: true, url: true, pathname: true },
  })
  intStats.total = intPhotos.length
  for (const photo of intPhotos) {
    const bucket = determineBucket(photo.pathname)
    const { success } = await migrateFile(client, photo.url, photo.pathname, bucket)
    if (success) {
      intStats.migrated++
      const newUrl = getPublicUrl(bucket, photo.pathname)
      await db.interactionPhoto.update({ where: { id: photo.id }, data: { url: newUrl } })
    } else {
      intStats.errors++
    }
  }
  results.interactionPhotos = intStats

  // Backup Records
  const backupStats = { total: 0, migrated: 0, skipped: 0, errors: 0 }
  const backups = await db.backupRecord.findMany({
    where: { blobUrl: { contains: 'vercel-storage.com' } },
    select: { id: true, blobUrl: true, blobPathname: true },
  })
  backupStats.total = backups.length
  for (const backup of backups) {
    const pathname = backup.blobPathname || 'backups/unknown'
    const bucket = 'dalia-backups'
    const { success } = await migrateFile(client, backup.blobUrl!, pathname, bucket)
    if (success) {
      backupStats.migrated++
      const newUrl = getPublicUrl(bucket, pathname)
      await db.backupRecord.update({ where: { id: backup.id }, data: { blobUrl: newUrl } })
    } else {
      backupStats.errors++
    }
  }
  results.backupRecords = backupStats

  return NextResponse.json({ success: true, results })
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!MIGRATION_SECRET || token !== MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const [documents, prospectPhotos, interactionPhotos, backupRecords] = await Promise.all([
    db.document.count({ where: { fileUrl: { contains: 'vercel-storage.com' } } }),
    db.prospectPhoto.count({ where: { url: { contains: 'vercel-storage.com' } } }),
    db.interactionPhoto.count({ where: { url: { contains: 'vercel-storage.com' } } }),
    db.backupRecord.count({ where: { blobUrl: { contains: 'vercel-storage.com' } } }),
  ])

  return NextResponse.json({
    pendingMigration: { total: documents + prospectPhotos + interactionPhotos + backupRecords, documents, prospectPhotos, interactionPhotos, backupRecords },
    s3Configured: !!process.env.S3_ACCESS_KEY,
  })
}
