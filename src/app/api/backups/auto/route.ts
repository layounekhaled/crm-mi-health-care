import { NextRequest, NextResponse } from 'next/server'
import { createBackup, cleanupOldBackups } from '@/lib/backup'
import { db } from '@/lib/db'

// POST /api/backups/auto — Triggered by cron job (daily at 2am)
// Protected by a secret token to prevent unauthorized calls
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'dalia-crm-auto-backup-2026'

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Check if we already have an auto backup in the last 20 hours
    const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000)
    const recentAutoBackup = await db.backupRecord.findFirst({
      where: {
        type: 'auto',
        statut: 'completed',
        createdAt: { gte: twentyHoursAgo },
      },
    })

    if (recentAutoBackup) {
      return NextResponse.json({
        message: 'Sauvegarde automatique récente déjà existante',
        lastBackup: recentAutoBackup.createdAt,
        skipped: true,
      })
    }

    // Create auto backup
    const result = await createBackup({
      type: 'auto',
      triggeredBy: null, // System-triggered
    })

    // Cleanup old backups (keep last 30)
    const deleted = await cleanupOldBackups(30)

    console.log(`[AUTO_BACKUP] Completed: ${result.recordCount} records, ${deleted} old backups cleaned`)

    return NextResponse.json({
      success: true,
      message: `Sauvegarde automatique créée (${result.recordCount} enregistrements)`,
      backup: result,
      cleanedUp: deleted,
    })
  } catch (error) {
    console.error('[AUTO_BACKUP] Failed:', error)
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde automatique' }, { status: 500 })
  }
}
