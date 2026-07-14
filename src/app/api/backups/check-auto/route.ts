import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isAdmin } from '@/lib/auth-helpers'
import { createBackup, cleanupOldBackups } from '@/lib/backup'
import { db } from '@/lib/db'

// GET /api/backups/check-auto — Called on app load to check if auto backup is needed
// Only creates a backup if the last auto backup is older than 20 hours
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ needed: false })
    }
    // Only admins trigger auto backup check
    if (!isAdmin(authUser)) {
      return NextResponse.json({ needed: false })
    }

    // Check if auto backup is needed
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
        needed: false,
        lastAutoBackup: recentAutoBackup.createdAt,
      })
    }

    // Auto backup is needed — create it in the background
    // Don't await to avoid blocking the response
    createBackup({ type: 'auto', triggeredBy: null })
      .then(() => cleanupOldBackups(30))
      .then((deleted) => {
        console.log(`[AUTO_BACKUP] Completed via check-auto. Cleaned ${deleted} old backups.`)
      })
      .catch((err) => {
        console.error('[AUTO_BACKUP] Failed via check-auto:', err)
      })

    return NextResponse.json({ needed: true, triggered: true })
  } catch (error) {
    console.error('[BACKUP_CHECK_AUTO]', error)
    return NextResponse.json({ needed: false })
  }
}
