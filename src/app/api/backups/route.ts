import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isAdmin } from '@/lib/auth-helpers'
import { createBackup, getBackupHistory, cleanupOldBackups } from '@/lib/backup'

// GET /api/backups — List backup history
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    if (!isAdmin(authUser)) {
      return NextResponse.json({ error: 'Accès refusé. Réservé aux administrateurs.' }, { status: 403 })
    }

    const history = await getBackupHistory(30)
    return NextResponse.json({ data: history })
  } catch (error) {
    console.error('[BACKUPS_GET]', error)
    return NextResponse.json({ error: 'Erreur lors du chargement des sauvegardes' }, { status: 500 })
  }
}

// POST /api/backups — Create a new backup
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    if (!isAdmin(authUser)) {
      return NextResponse.json({ error: 'Accès refusé. Réservé aux administrateurs.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const type = body.type || 'manual'

    const result = await createBackup({
      type,
      triggeredBy: authUser.employeId,
    })

    // Cleanup old backups (keep last 30)
    const deleted = await cleanupOldBackups(30)

    return NextResponse.json({
      success: true,
      message: `Sauvegarde créée avec succès (${result.recordCount} enregistrements, ${(result.fileSize / 1024).toFixed(1)} KB)`,
      backup: result,
      cleanedUp: deleted > 0 ? `${deleted} anciennes sauvegardes supprimées` : null,
    })
  } catch (error) {
    console.error('[BACKUPS_POST]', error)
    const message = error instanceof Error ? error.message : 'Erreur lors de la sauvegarde'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
