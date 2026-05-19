import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, canAccess } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const { id } = await params;

    const charge = await db.charge.findUnique({
      where: { id },
      include: {
        employe: { select: { id: true, nom: true, role: true } },
        opportunity: { select: { id: true, nomProjet: true, montantEstime: true } },
        creator: { select: { id: true, nom: true } },
      },
    });

    if (!charge) {
      return NextResponse.json({ error: 'Charge not found' }, { status: 404 });
    }

    return NextResponse.json(charge);
  } catch (error) {
    console.error('[CHARGE_GET_BY_ID]', error);
    return NextResponse.json({ error: 'Failed to fetch charge' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { type, montant, description, date, employeId, opportunityId } = body;

    const existing = await db.charge.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Charge not found' }, { status: 404 });
    }

    if (type && !['hotel', 'restaurant', 'transport', 'divers'].includes(type)) {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
    }

    const charge = await db.charge.update({
      where: { id },
      data: {
        ...(type !== undefined && { type }),
        ...(montant !== undefined && { montant: parseFloat(montant) }),
        ...(description !== undefined && { description: description || null }),
        ...(date !== undefined && { date: date ? new Date(date) : existing.date }),
        ...(employeId !== undefined && { employeId }),
        ...(opportunityId !== undefined && { opportunityId: opportunityId || null }),
      },
      include: {
        employe: { select: { id: true, nom: true } },
        opportunity: { select: { id: true, nomProjet: true } },
        creator: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(charge);
  } catch (error) {
    console.error('[CHARGE_PUT]', error);
    return NextResponse.json({ error: 'Failed to update charge' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const { id } = await params;

    const existing = await db.charge.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Charge not found' }, { status: 404 });
    }

    await db.charge.delete({ where: { id } });

    return NextResponse.json({ message: 'Charge deleted successfully' });
  } catch (error) {
    console.error('[CHARGE_DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete charge' }, { status: 500 });
  }
}
