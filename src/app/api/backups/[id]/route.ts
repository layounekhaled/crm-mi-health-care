import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { deleteFile } from '@/lib/storage'

// DELETE /api/backups/[id] — Delete a backup
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    if (!isAdmin(authUser)) {
      return NextResponse.json({ error: 'Accès refusé. Réservé aux administrateurs.' }, { status: 403 })
    }

    const { id } = await params
    const backup = await db.backupRecord.findUnique({ where: { id } })

    if (!backup) {
      return NextResponse.json({ error: 'Sauvegarde introuvable' }, { status: 404 })
    }

    // Delete backup file from MinIO (or skip if old Vercel Blob URL)
    if (backup.blobUrl) {
      try {
        await deleteFile(backup.blobUrl, 'backups')
      } catch (err) {
        console.error('[BACKUP_DELETE] Error deleting file:', err)
      }
    }

    // Delete DB record
    await db.backupRecord.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Sauvegarde supprimée' })
  } catch (error) {
    console.error('[BACKUP_DELETE]', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}
