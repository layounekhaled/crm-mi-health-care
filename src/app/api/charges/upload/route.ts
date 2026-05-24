import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getAuthUser, canAccess } from '@/lib/auth-helpers';

// POST /api/charges/upload — Upload a justificatif file for a charge
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial', 'technicien'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    // Check Vercel Blob token
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[CHARGES_UPLOAD] BLOB_READ_WRITE_TOKEN is not set');
      return NextResponse.json(
        { error: 'Configuration manquante : token de stockage non trouvé. Veuillez contacter l\'administrateur.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    // Validate file type (images + PDF)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Type de fichier non autorisé (images et PDF uniquement)' },
        { status: 400 }
      );
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Fichier trop volumineux (max 10 Mo)' },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const pathname = `charges-justificatifs/${timestamp}-${sanitizedName}`;

    const blob = await put(pathname, file, {
      access: 'public',
      contentType: file.type,
      allowOverwrite: false,
    });

    return NextResponse.json({ url: blob.url }, { status: 201 });
  } catch (error) {
    console.error('[CHARGES_UPLOAD]', error);
    const message = error instanceof Error ? error.message : 'Upload échoué';
    return NextResponse.json(
      { error: `Upload échoué : ${message}` },
      { status: 500 }
    );
  }
}
