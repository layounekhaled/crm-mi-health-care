import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { db } from '@/lib/db';
import { getAuthUser, canAccess } from '@/lib/auth-helpers';

// GET /api/prospects/photos?prospectId=xxx — List photos for a prospect
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const prospectId = searchParams.get('prospectId');
    if (!prospectId) {
      return NextResponse.json({ error: 'prospectId requis' }, { status: 400 });
    }

    const photos = await db.prospectPhoto.findMany({
      where: { prospectId },
      orderBy: { createdAt: 'desc' },
      include: {
        uploader: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(photos);
  } catch (error) {
    console.error('[PROSPECT_PHOTOS_GET]', error);
    return NextResponse.json({ error: 'Erreur lors du chargement des photos' }, { status: 500 });
  }
}

// POST /api/prospects/photos — Upload a photo for a prospect
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[PROSPECT_PHOTOS_UPLOAD] BLOB_READ_WRITE_TOKEN is not set');
      return NextResponse.json({ error: 'Configuration manquante : token de stockage non trouvé' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const prospectId = formData.get('prospectId') as string | null;
    const legend = formData.get('legend') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    if (!prospectId) {
      return NextResponse.json({ error: 'prospectId requis' }, { status: 400 });
    }

    // Verify prospect exists
    const prospect = await db.prospect.findUnique({ where: { id: prospectId } });
    if (!prospect) {
      return NextResponse.json({ error: 'Prospect non trouvé' }, { status: 404 });
    }

    // Validate file type (images only)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Type de fichier non autorisé (images uniquement)' }, { status: 400 });
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 400 });
    }

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const pathname = `prospect-photos/${prospectId}/${timestamp}-${sanitizedName}`;

    const blob = await put(pathname, file, {
      access: 'public',
      contentType: file.type,
      allowOverwrite: false,
    });

    const photo = await db.prospectPhoto.create({
      data: {
        prospectId,
        url: blob.url,
        pathname: blob.pathname,
        fileName: file.name,
        fileSize: file.size,
        legend: legend || null,
        uploadedBy: authUser.employeId || null,
      },
      include: {
        uploader: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    console.error('[PROSPECT_PHOTOS_UPLOAD]', error);
    const message = error instanceof Error ? error.message : 'Upload échoué';
    return NextResponse.json({ error: `Upload échoué : ${message}` }, { status: 500 });
  }
}
