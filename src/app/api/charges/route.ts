import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, canAccess, isAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial', 'technicien'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const employeId = searchParams.get('employeId');
    const opportunityId = searchParams.get('opportunityId');
    const type = searchParams.get('type');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const stats = searchParams.get('stats');

    const where: Record<string, unknown> = {};

    // If user is NOT admin, they can only see their own charges
    if (!isAdmin(authUser)) {
      where.employeId = authUser.employeId;
    } else if (employeId) {
      where.employeId = employeId;
    }

    if (opportunityId) where.opportunityId = opportunityId;
    if (type) where.type = type;

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.date = dateFilter;
    }

    // Stats mode
    if (stats === 'true') {
      const charges = await db.charge.findMany({
        where,
        include: {
          employe: { select: { id: true, nom: true } },
          opportunity: { select: { id: true, nomProjet: true, montantEstime: true } },
        },
        orderBy: { date: 'desc' },
      });

      const totalCharges = charges.reduce((sum, c) => sum + c.montant, 0);

      // By type
      const byTypeMap = new Map<string, { total: number; count: number }>();
      for (const c of charges) {
        const entry = byTypeMap.get(c.type) || { total: 0, count: 0 };
        entry.total += c.montant;
        entry.count += 1;
        byTypeMap.set(c.type, entry);
      }
      const byType = Array.from(byTypeMap.entries()).map(([type, data]) => ({ type, ...data }));

      // By employee (admin only gets this)
      const byEmployeeMap = new Map<string, { employeId: string; nom: string; total: number; count: number; byType: Map<string, number> }>();
      for (const c of charges) {
        const eId = c.employeId;
        const entry = byEmployeeMap.get(eId) || { employeId: eId, nom: c.employe.nom, total: 0, count: 0, byType: new Map<string, number>() };
        entry.total += c.montant;
        entry.count += 1;
        entry.byType.set(c.type, (entry.byType.get(c.type) || 0) + c.montant);
        byEmployeeMap.set(eId, entry);
      }
      const byEmployee = Array.from(byEmployeeMap.values())
        .sort((a, b) => b.total - a.total)
        .map(({ byType: empByType, ...rest }) => ({
          ...rest,
          byType: Array.from(empByType.entries()).map(([type, total]) => ({ type, total })),
        }));

      // By opportunity
      const byOpportunityMap = new Map<string, { opportunityId: string; nomProjet: string; montantEstime: number | null; total: number; count: number; byType: Map<string, number> }>();
      for (const c of charges) {
        if (!c.opportunityId) continue;
        const oId = c.opportunityId;
        const entry = byOpportunityMap.get(oId) || {
          opportunityId: oId,
          nomProjet: c.opportunity?.nomProjet || '—',
          montantEstime: c.opportunity?.montantEstime ?? null,
          total: 0,
          count: 0,
          byType: new Map<string, number>(),
        };
        entry.total += c.montant;
        entry.count += 1;
        entry.byType.set(c.type, (entry.byType.get(c.type) || 0) + c.montant);
        byOpportunityMap.set(oId, entry);
      }
      const byOpportunity = Array.from(byOpportunityMap.values())
        .sort((a, b) => b.total - a.total)
        .map(({ byType: oppByType, ...rest }) => ({
          ...rest,
          byType: Array.from(oppByType.entries()).map(([type, total]) => ({ type, total })),
        }));

      return NextResponse.json({
        totalCharges,
        byType,
        byEmployee,
        byOpportunity,
      });
    }

    // List mode
    const charges = await db.charge.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        employe: { select: { id: true, nom: true, role: true } },
        opportunity: { select: { id: true, nomProjet: true, montantEstime: true } },
        creator: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(charges);
  } catch (error) {
    console.error('[CHARGES_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch charges' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial', 'technicien'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const body = await request.json();
    const { type, montant, description, date, employeId, opportunityId, justificatifUrl } = body;

    if (!type || !montant) {
      return NextResponse.json({ error: 'type et montant sont requis' }, { status: 400 });
    }

    if (!['hotel', 'restaurant', 'transport', 'divers'].includes(type)) {
      return NextResponse.json({ error: 'Type invalide (hotel, restaurant, transport, divers)' }, { status: 400 });
    }

    // For non-admin, force employeId to their own
    const finalEmployeId = isAdmin(authUser) ? (employeId || authUser.employeId) : authUser.employeId;

    if (!finalEmployeId) {
      return NextResponse.json({ error: 'employeId requis' }, { status: 400 });
    }

    const charge = await db.charge.create({
      data: {
        type,
        montant: parseFloat(montant),
        description: description || null,
        date: date ? new Date(date) : new Date(),
        employeId: finalEmployeId,
        opportunityId: opportunityId || null,
        createdBy: authUser.employeId,
        justificatifUrl: justificatifUrl || null,
      },
      include: {
        employe: { select: { id: true, nom: true } },
        opportunity: { select: { id: true, nomProjet: true } },
        creator: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(charge, { status: 201 });
  } catch (error) {
    console.error('[CHARGES_POST]', error);
    return NextResponse.json({ error: 'Failed to create charge' }, { status: 500 });
  }
}
