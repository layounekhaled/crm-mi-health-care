import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, canAccess, isAdmin } from '@/lib/auth-helpers';

const INCLUDE = {
  employe: { select: { id: true, nom: true, role: true } },
  prospect: { select: { id: true, nom: true, specialite: true, etablissement: true, wilaya: true } },
  creePar: { select: { id: true, nom: true } },
  modifiePar: { select: { id: true, nom: true } },
};

// ─── GET /api/deplacements/[id] ─────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial', 'technicien'])) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { id } = await params;

    const deplacement = await db.deplacement.findUnique({
      where: { id },
      include: INCLUDE,
    });

    if (!deplacement) {
      return NextResponse.json({ error: 'Déplacement non trouvé' }, { status: 404 });
    }

    // Non-admin : uniquement ses propres déplacements
    if (!isAdmin(authUser) && deplacement.employeId !== authUser.employeId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    return NextResponse.json(deplacement);
  } catch (error) {
    console.error('[DEPLACEMENT_GET_BY_ID]', error);
    return NextResponse.json({ error: 'Échec de récupération du déplacement' }, { status: 500 });
  }
}

// ─── PUT /api/deplacements/[id] ─────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial', 'technicien'])) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      employeId,
      prospectId,
      motif,
      statut,
      moyenTransport,
      villeDepart,
      villeArrivee,
      date,
      heureDepart,
      heureRetour,
      distanceKm,
      montant,
      notes,
    } = body;

    const existing = await db.deplacement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Déplacement non trouvé' }, { status: 404 });
    }

    // Non-admin : uniquement ses propres déplacements
    if (!isAdmin(authUser) && existing.employeId !== authUser.employeId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Non-admin : ne peut pas réaffecter à un autre employé
    const finalEmployeId = isAdmin(authUser)
      ? (employeId !== undefined ? employeId : existing.employeId)
      : existing.employeId;

    const deplacement = await db.deplacement.update({
      where: { id },
      data: {
        ...(finalEmployeId !== undefined && { employeId: finalEmployeId }),
        ...(prospectId !== undefined && { prospectId: prospectId || null }),
        ...(motif !== undefined && { motif }),
        ...(statut !== undefined && { statut }),
        ...(moyenTransport !== undefined && { moyenTransport }),
        ...(villeDepart !== undefined && { villeDepart: villeDepart || null }),
        ...(villeArrivee !== undefined && { villeArrivee: villeArrivee || null }),
        ...(date !== undefined && { date: date ? new Date(date) : existing.date }),
        ...(heureDepart !== undefined && { heureDepart: heureDepart || null }),
        ...(heureRetour !== undefined && { heureRetour: heureRetour || null }),
        ...(distanceKm !== undefined && {
          distanceKm: distanceKm != null && distanceKm !== '' ? parseFloat(distanceKm) : null,
        }),
        ...(montant !== undefined && {
          montant: montant != null && montant !== '' ? parseFloat(montant) : 0,
        }),
        ...(notes !== undefined && { notes: notes || null }),
        modifieParId: authUser.employeId || null,
      },
      include: INCLUDE,
    });

    return NextResponse.json(deplacement);
  } catch (error) {
    console.error('[DEPLACEMENT_PUT]', error);
    return NextResponse.json({ error: 'Échec de mise à jour du déplacement' }, { status: 500 });
  }
}

// ─── DELETE /api/deplacements/[id] ──────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial', 'technicien'])) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.deplacement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Déplacement non trouvé' }, { status: 404 });
    }

    // Non-admin : uniquement ses propres déplacements
    if (!isAdmin(authUser) && existing.employeId !== authUser.employeId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    await db.deplacement.delete({ where: { id } });

    return NextResponse.json({ message: 'Déplacement supprimé avec succès' });
  } catch (error) {
    console.error('[DEPLACEMENT_DELETE]', error);
    return NextResponse.json({ error: 'Échec de suppression du déplacement' }, { status: 500 });
  }
}
