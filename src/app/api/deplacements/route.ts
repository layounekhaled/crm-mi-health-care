import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, canAccess, isAdmin } from '@/lib/auth-helpers';

// ─── GET /api/deplacements ──────────────────────────────────────
// Liste des déplacements avec filtres + mode stats
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial', 'technicien'])) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const employeId = searchParams.get('employeId');
    const prospectId = searchParams.get('prospectId');
    const motif = searchParams.get('motif');
    const statut = searchParams.get('statut');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const stats = searchParams.get('stats');

    const where: Record<string, unknown> = {};

    // Non-admin : uniquement ses propres déplacements
    if (!isAdmin(authUser)) {
      where.employeId = authUser.employeId;
    } else if (employeId) {
      where.employeId = employeId;
    }

    if (prospectId) where.prospectId = prospectId;
    if (motif) where.motif = motif;
    if (statut) where.statut = statut;

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.date = dateFilter;
    }

    const include = {
      employe: { select: { id: true, nom: true, role: true } },
      prospect: { select: { id: true, nom: true, specialite: true, etablissement: true, wilaya: true } },
      creePar: { select: { id: true, nom: true } },
      modifiePar: { select: { id: true, nom: true } },
    };

    // ─── Mode stats ───
    if (stats === 'true') {
      const deplacements = await db.deplacement.findMany({ where, include, orderBy: { date: 'desc' } });

      const totalKm = deplacements.reduce((sum, d) => sum + (d.distanceKm || 0), 0);
      const totalMontant = deplacements.reduce((sum, d) => sum + (d.montant || 0), 0);
      const totalVisites = deplacements.filter((d) => d.motif === 'visite' && d.statut === 'termine').length;

      // Par motif
      const byMotifMap = new Map<string, { total: number; count: number; km: number }>();
      for (const d of deplacements) {
        const entry = byMotifMap.get(d.motif) || { total: 0, count: 0, km: 0 };
        entry.total += d.montant || 0;
        entry.count += 1;
        entry.km += d.distanceKm || 0;
        byMotifMap.set(d.motif, entry);
      }
      const byMotif = Array.from(byMotifMap.entries()).map(([motif, data]) => ({ motif, ...data }));

      // Par employé
      const byEmployeeMap = new Map<string, { employeId: string; nom: string; count: number; km: number; total: number; visites: number }>();
      for (const d of deplacements) {
        const eId = d.employeId;
        const entry = byEmployeeMap.get(eId) || { employeId: eId, nom: d.employe?.nom || '—', count: 0, km: 0, total: 0, visites: 0 };
        entry.count += 1;
        entry.km += d.distanceKm || 0;
        entry.total += d.montant || 0;
        if (d.motif === 'visite' && d.statut === 'termine') entry.visites += 1;
        byEmployeeMap.set(eId, entry);
      }
      const byEmployee = Array.from(byEmployeeMap.values()).sort((a, b) => b.count - a.count);

      // Top médecins / établissements visités
      const byProspectMap = new Map<string, { prospectId: string; nom: string; count: number }>();
      for (const d of deplacements) {
        if (!d.prospectId) continue;
        const entry = byProspectMap.get(d.prospectId) || { prospectId: d.prospectId, nom: d.prospect?.nom || '—', count: 0 };
        entry.count += 1;
        byProspectMap.set(d.prospectId, entry);
      }
      const topProspects = Array.from(byProspectMap.values()).sort((a, b) => b.count - a.count).slice(0, 10);

      // Par statut
      const byStatutMap = new Map<string, number>();
      for (const d of deplacements) {
        byStatutMap.set(d.statut, (byStatutMap.get(d.statut) || 0) + 1);
      }
      const byStatut = Array.from(byStatutMap.entries()).map(([statut, count]) => ({ statut, count }));

      return NextResponse.json({
        total: deplacements.length,
        totalKm,
        totalMontant,
        totalVisites,
        byMotif,
        byEmployee,
        topProspects,
        byStatut,
      });
    }

    // ─── Mode liste ───
    const deplacements = await db.deplacement.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include,
    });

    return NextResponse.json(deplacements);
  } catch (error) {
    console.error('[DEPLACEMENTS_GET]', error);
    return NextResponse.json({ error: 'Échec de récupération des déplacements' }, { status: 500 });
  }
}

// ─── POST /api/deplacements ─────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial', 'technicien'])) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

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

    if (!date) {
      return NextResponse.json({ error: 'La date du déplacement est requise' }, { status: 400 });
    }

    // Non-admin : forcé à son propre employéId
    const finalEmployeId = isAdmin(authUser) ? (employeId || authUser.employeId) : authUser.employeId;
    if (!finalEmployeId) {
      return NextResponse.json({ error: 'employeId requis' }, { status: 400 });
    }

    const deplacement = await db.deplacement.create({
      data: {
        employeId: finalEmployeId,
        prospectId: prospectId || null,
        motif: motif || 'visite',
        statut: statut || 'planifie',
        moyenTransport: moyenTransport || 'vehicule_personnel',
        villeDepart: villeDepart || null,
        villeArrivee: villeArrivee || null,
        date: new Date(date),
        heureDepart: heureDepart || null,
        heureRetour: heureRetour || null,
        distanceKm: distanceKm != null && distanceKm !== '' ? parseFloat(distanceKm) : null,
        montant: montant != null && montant !== '' ? parseFloat(montant) : 0,
        notes: notes || null,
        creeParId: authUser.employeId,
      },
      include: {
        employe: { select: { id: true, nom: true, role: true } },
        prospect: { select: { id: true, nom: true, specialite: true, etablissement: true, wilaya: true } },
        creePar: { select: { id: true, nom: true } },
        modifiePar: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(deplacement, { status: 201 });
  } catch (error) {
    console.error('[DEPLACEMENTS_POST]', error);
    return NextResponse.json({ error: 'Échec de création du déplacement' }, { status: 500 });
  }
}
