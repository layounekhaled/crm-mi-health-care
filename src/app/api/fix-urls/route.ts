import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/fix-urls - Convert MinIO direct URLs to /api/files/ proxy URLs
// Protected by MIGRATION_SECRET
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (token !== (process.env.MIGRATION_SECRET || 'dalia-migrate-2024-minio-secure')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const results: string[] = []
  let totalUpdated = 0

  // Helper: convert MinIO URL to /api/files/ proxy URL
  function convertUrl(oldUrl: string): string {
    if (!oldUrl || oldUrl.startsWith('/api/files/')) return oldUrl

    // Pattern: http(s)://ANY_HOST:PORT/dalia-documents/key or /dalia-media/key or /dalia-backups/key
    // Matches both external IP (156.67.26.104:9000) and internal Docker hostname (minio-xxx:9000)
    const minioPattern = /^https?:\/\/[^/]+\/(dalia-documents|dalia-media|dalia-backups)\/(.+)$/
    const match = oldUrl.match(minioPattern)
    if (match) {
      const bucket = match[1]
      const key = match[2]
      const bucketType = bucket === 'dalia-media' ? 'media'
        : bucket === 'dalia-backups' ? 'backups'
        : 'documents'
      return `/api/files/${key}?bucket=${bucketType}`
    }

    return oldUrl // Return unchanged if not a MinIO URL
  }

  try {
    // 1. Fix Document URLs — find all with http:// URLs (MinIO or Vercel Blob)
    const docs = await db.document.findMany({
      where: { fileUrl: { startsWith: 'http' } },
      select: { id: true, fileUrl: true, filePath: true },
    })
    let docUpdated = 0
    for (const doc of docs) {
      const newUrl = convertUrl(doc.fileUrl)
      if (newUrl !== doc.fileUrl) {
        await db.document.update({ where: { id: doc.id }, data: { fileUrl: newUrl } })
        totalUpdated++
        docUpdated++
      }
    }
    results.push(`Documents: ${docs.length} checked, ${docUpdated} updated`)

    // 2. Fix ProspectPhoto URLs
    const photos = await db.prospectPhoto.findMany({
      where: { url: { startsWith: 'http' } },
      select: { id: true, url: true },
    })
    let photoUpdated = 0
    for (const photo of photos) {
      const newUrl = convertUrl(photo.url)
      if (newUrl !== photo.url) {
        await db.prospectPhoto.update({ where: { id: photo.id }, data: { url: newUrl } })
        totalUpdated++
        photoUpdated++
      }
    }
    results.push(`ProspectPhotos: ${photos.length} checked, ${photoUpdated} updated`)

    // 3. Fix InteractionPhoto URLs
    const intPhotos = await db.interactionPhoto.findMany({
      where: { url: { startsWith: 'http' } },
      select: { id: true, url: true },
    })
    let intPhotoUpdated = 0
    for (const photo of intPhotos) {
      const newUrl = convertUrl(photo.url)
      if (newUrl !== photo.url) {
        await db.interactionPhoto.update({ where: { id: photo.id }, data: { url: newUrl } })
        totalUpdated++
        intPhotoUpdated++
      }
    }
    results.push(`InteractionPhotos: ${intPhotos.length} checked, ${intPhotoUpdated} updated`)

    // 4. Fix BackupRecord URLs
    const backups = await db.backupRecord.findMany({
      where: { blobUrl: { startsWith: 'http' } },
      select: { id: true, blobUrl: true },
    })
    let backupUpdated = 0
    for (const backup of backups) {
      const newUrl = convertUrl(backup.blobUrl!)
      if (newUrl !== backup.blobUrl) {
        await db.backupRecord.update({ where: { id: backup.id }, data: { blobUrl: newUrl } })
        totalUpdated++
        backupUpdated++
      }
    }
    results.push(`BackupRecords: ${backups.length} checked, ${backupUpdated} updated`)

    // 5. Fix Charge URLs
    const charges = await db.charge.findMany({
      where: { justificatifUrl: { startsWith: 'http' } },
      select: { id: true, justificatifUrl: true },
    })
    let chargeUpdated = 0
    for (const charge of charges) {
      const newUrl = convertUrl(charge.justificatifUrl!)
      if (newUrl !== charge.justificatifUrl) {
        await db.charge.update({ where: { id: charge.id }, data: { justificatifUrl: newUrl } })
        totalUpdated++
        chargeUpdated++
      }
    }
    results.push(`Charges: ${charges.length} checked, ${chargeUpdated} updated`)

    // 6. Fix ChatMessage URLs (image messages)
    const chatMsgs = await db.chatMessage.findMany({
      where: { imageUrl: { startsWith: 'http' } },
      select: { id: true, imageUrl: true },
    })
    let chatUpdated = 0
    for (const msg of chatMsgs) {
      const newUrl = convertUrl(msg.imageUrl!)
      if (newUrl !== msg.imageUrl) {
        await db.chatMessage.update({ where: { id: msg.id }, data: { imageUrl: newUrl } })
        totalUpdated++
        chatUpdated++
      }
    }
    results.push(`ChatMessages: ${chatMsgs.length} checked, ${chatUpdated} updated`)

    return NextResponse.json({ success: true, totalUpdated, details: results })
  } catch (error: any) {
    console.error('[FIX_URLS]', error)
    return NextResponse.json({ error: error.message, partial: results }, { status: 500 })
  }
}
