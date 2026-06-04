import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { db } from '@/lib/db';
import { getAuthUser, canAccess } from '@/lib/auth-helpers';

// POST /api/interactions/photos — Upload photos for an interaction
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial', 'technicien'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[INTERACTION_PHOTOS_UPLOAD] BLOB_READ_WRITE_TOKEN is not set');
      return NextResponse.json({ error: 'Configuration manquante : token de stockage non trouvé' }, { status: 500 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const interactionId = formData.get('interactionId') as string | null;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    if (!interactionId) {
      return NextResponse.json({ error: 'interactionId requis' }, { status: 400 });
    }

    // Verify interaction exists
    const interaction = await db.interaction.findUnique({ where: { id: interactionId } });
    if (!interaction) {
      return NextResponse.json({ error: 'Interaction non trouvée' }, { status: 404 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const uploadedPhotos = [];

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        continue; // Skip invalid files
      }

      if (file.size > 10 * 1024 * 1024) {
        continue; // Skip files > 10MB
      }

      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const pathname = `interaction-photos/${interactionId}/${timestamp}-${sanitizedName}`;

      const blob = await put(pathname, file, {
        access: 'public',
        contentType: file.type,
        allowOverwrite: false,
      });

      const photo = await db.interactionPhoto.create({
        data: {
          interactionId,
          url: blob.url,
          pathname: blob.pathname,
          fileName: file.name,
          fileSize: file.size,
        },
      });

      uploadedPhotos.push(photo);
    }

    return NextResponse.json(uploadedPhotos, { status: 201 });
  } catch (error) {
    console.error('[INTERACTION_PHOTOS_UPLOAD]', error);
    const message = error instanceof Error ? error.message : 'Upload échoué';
    return NextResponse.json({ error: `Upload échoué : ${message}` }, { status: 500 });
  }
}
