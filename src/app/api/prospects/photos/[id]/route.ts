import { NextRequest, NextResponse } from 'next/server';
import { deleteFile } from '@/lib/storage';
import { db } from '@/lib/db';
import { getAuthUser, canAccess, isAdmin } from '@/lib/auth-helpers';

// DELETE /api/prospects/photos/[id] — Delete a photo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const { id } = await params;

    const photo = await db.prospectPhoto.findUnique({ where: { id } });
    if (!photo) {
      return NextResponse.json({ error: 'Photo non trouvée' }, { status: 404 });
    }

    // Only admin or the uploader can delete
    if (!isAdmin(authUser) && photo.uploadedBy !== authUser.employeId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Delete the file from MinIO
    try {
      await deleteFile(photo.url, 'media');
    } catch (s3Err) {
      console.error('[PROSPECT_PHOTO_DELETE_S3]', s3Err);
      // Continue with DB deletion even if S3 delete fails
    }

    await db.prospectPhoto.delete({ where: { id } });

    return NextResponse.json({ message: 'Photo supprimée avec succès' });
  } catch (error) {
    console.error('[PROSPECT_PHOTO_DELETE]', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 });
  }
}

// PATCH /api/prospects/photos/[id] — Update photo legend
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { legend } = body;

    const photo = await db.prospectPhoto.findUnique({ where: { id } });
    if (!photo) {
      return NextResponse.json({ error: 'Photo non trouvée' }, { status: 404 });
    }

    const updated = await db.prospectPhoto.update({
      where: { id },
      data: { legend: legend !== undefined ? legend : photo.legend },
      include: {
        uploader: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PROSPECT_PHOTO_PATCH]', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  }
}
