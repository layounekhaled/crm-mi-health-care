// Server-only backup utility — exports all DB data to a compressed JSON backup
// Uploads the backup file to Vercel Blob for persistent storage

import { put } from '@vercel/blob'
import { db } from '@/lib/db'

// All Prisma model names in dependency order (parent tables first for restore)
const BACKUP_TABLES = [
  'employee',
  'user',
  'prospect',
  'event',
  'eventProspect',
  'eventEmployee',
  'opportunity',
  'operation',
  'product',
  'task',
  'taskAssignee',
  'interaction',
  'interactionPhoto',
  'afterSale',
  'objective',
  'emailConfig',
  'chatConversation',
  'chatParticipant',
  'chatMessage',
  'notification',
  'calendarDay',
  'document',
  'documentSend',
  'charge',
  'prospectPhoto',
  'leaveRequest',
  'leaveMovement',
  'cashPayment',
  'cashJournalEntry',
  'cashExpense',
  'bankDeposit',
  'cashAuditLog',
  'backupRecord',
] as const

type TableName = typeof BACKUP_TABLES[number]

// Map table names to Prisma delegate accessors
// Prisma uses camelCase model names as delegate properties
const TABLE_TO_DELEGATE: Record<TableName, string> = {
  'employee': 'employee',
  'user': 'user',
  'prospect': 'prospect',
  'event': 'event',
  'eventProspect': 'eventProspect',
  'eventEmployee': 'eventEmployee',
  'opportunity': 'opportunity',
  'operation': 'operation',
  'product': 'product',
  'task': 'task',
  'taskAssignee': 'taskAssignee',
  'interaction': 'interaction',
  'interactionPhoto': 'interactionPhoto',
  'afterSale': 'afterSale',
  'objective': 'objective',
  'emailConfig': 'emailConfig',
  'chatConversation': 'chatConversation',
  'chatParticipant': 'chatParticipant',
  'chatMessage': 'chatMessage',
  'notification': 'notification',
  'calendarDay': 'calendarDay',
  'document': 'document',
  'documentSend': 'documentSend',
  'charge': 'charge',
  'prospectPhoto': 'prospectPhoto',
  'leaveRequest': 'leaveRequest',
  'leaveMovement': 'leaveMovement',
  'cashPayment': 'cashPayment',
  'cashJournalEntry': 'cashJournalEntry',
  'cashExpense': 'cashExpense',
  'bankDeposit': 'bankDeposit',
  'cashAuditLog': 'cashAuditLog',
  'backupRecord': 'backupRecord',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaDelegate = { findMany: (args?: any) => Promise<any[]> }

function getDelegate(tableName: TableName): PrismaDelegate {
  const delegateName = TABLE_TO_DELEGATE[tableName] as keyof typeof db
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db[delegateName] as any
}

export interface BackupResult {
  recordCount: number
  tableCount: number
  fileSize: number
  blobUrl: string
  blobPathname: string
  durationMs: number
}

export async function createBackup(options: {
  type: string
  triggeredBy?: string | null
}): Promise<BackupResult> {
  const startTime = Date.now()

  // Create a backup record to track progress
  const backupRecord = await db.backupRecord.create({
    data: {
      type: options.type,
      statut: 'in_progress',
      declenchePar: options.triggeredBy || null,
    },
  })

  try {
    // Export all tables
    const exportedData: Record<string, unknown[]> = {}
    let totalRecords = 0
    let tablesExported = 0

    for (const tableName of BACKUP_TABLES) {
      try {
        const delegate = getDelegate(tableName)
        const records = await delegate.findMany()
        // Serialize dates to ISO strings for JSON compatibility
        exportedData[tableName] = records.map(serializeRecord)
        totalRecords += records.length
        tablesExported++
      } catch (err) {
        console.error(`[BACKUP] Error exporting ${tableName}:`, err)
        // Continue with other tables
        exportedData[tableName] = []
        tablesExported++
      }
    }

    // Create the backup JSON with metadata
    const backupPayload = {
      version: '1.0',
      appName: 'DALIA CRM',
      exportedAt: new Date().toISOString(),
      type: options.type,
      tables: tablesExported,
      totalRecords,
      data: exportedData,
    }

    const jsonStr = JSON.stringify(backupPayload, null, 0) // Compact JSON
    const jsonBuffer = Buffer.from(jsonStr, 'utf-8')
    const fileSize = jsonBuffer.length

    // Upload to Vercel Blob
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const blobPath = `backups/dalia-backup-${timestamp}.json`

    const blob = await put(blobPath, jsonBuffer, {
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: false,
    })

    const durationMs = Date.now() - startTime

    // Update backup record as completed
    await db.backupRecord.update({
      where: { id: backupRecord.id },
      data: {
        statut: 'completed',
        blobUrl: blob.url,
        blobPathname: blob.pathname,
        fileSize,
        recordCount: totalRecords,
        tableCount: tablesExported,
        durationMs,
      },
    })

    console.log(`[BACKUP] Completed: ${totalRecords} records, ${tablesExported} tables, ${(fileSize / 1024).toFixed(1)}KB, ${durationMs}ms`)

    return {
      recordCount: totalRecords,
      tableCount: tablesExported,
      fileSize,
      blobUrl: blob.url,
      blobPathname: blob.pathname,
      durationMs,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'

    // Update backup record as failed
    await db.backupRecord.update({
      where: { id: backupRecord.id },
      data: {
        statut: 'failed',
        erreur: errorMessage,
        durationMs,
      },
    })

    console.error(`[BACKUP] Failed:`, error)
    throw error
  }
}

// Serialize a Prisma record for JSON storage (converts Date objects to ISO strings)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeRecord(record: any): any {
  if (!record || typeof record !== 'object') return record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {}
  for (const [key, value] of Object.entries(record)) {
    if (value instanceof Date) {
      result[key] = value.toISOString()
    } else if (value !== null && typeof value === 'object') {
      // Prisma Json fields are already plain objects, keep as-is
      result[key] = value
    } else {
      result[key] = value
    }
  }
  return result
}

// Get backup history (most recent first)
export async function getBackupHistory(limit = 20) {
  return db.backupRecord.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      employe: { select: { id: true, nom: true } },
    },
  })
}

// Get a single backup record by ID
export async function getBackupById(id: string) {
  return db.backupRecord.findUnique({
    where: { id },
    include: {
      employe: { select: { id: true, nom: true } },
    },
  })
}

// Clean up old backups (keep last N)
export async function cleanupOldBackups(keepCount = 30) {
  const allBackups = await db.backupRecord.findMany({
    where: {
      statut: 'completed',
      blobUrl: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, blobUrl: true },
  })

  if (allBackups.length <= keepCount) return 0

  const toDelete = allBackups.slice(keepCount)

  // Delete blob files
  const { del } = await import('@vercel/blob')
  for (const backup of toDelete) {
    if (backup.blobUrl) {
      try {
        await del(backup.blobUrl)
      } catch (err) {
        console.error(`[BACKUP_CLEANUP] Error deleting blob ${backup.blobUrl}:`, err)
      }
    }
  }

  // Delete DB records
  await db.backupRecord.deleteMany({
    where: { id: { in: toDelete.map(b => b.id) } },
  })

  return toDelete.length
}
