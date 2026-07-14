import { NextRequest, NextResponse } from 'next/server';
import { uploadFile } from '@/lib/storage';
import { db } from '@/lib/db';
import { getAuthUser, canAccess } from '@/lib/auth-helpers';

// POST /api/interactions/photos — Upload photos for an interaction
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial', 'technicien'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    if (!process.env.S3_ACCESS_KEY) {
      console.error('[INTERACTION_PHOTOS_UPLOAD] S3_ACCESS_KEY is not set');
      return NextResponse.json({ error: 'Configuration manquante : stockage S3 non configuré' }, { status: 500 });
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
    const uploadedPhotos: Array<{
      id: string; interactionId: string; url: string; pathname: string;
      fileName: string; fileSize: number; createdAt: Date;
    }> = [];

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

      // Upload to MinIO via storage module
      const { url: fileUrl } = await uploadFile(pathname, file, file.type, 'media');

      const photo = await db.interactionPhoto.create({
        data: {
          interactionId,
          url: fileUrl,
          pathname,
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
