import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, canAccess } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial', 'technicien'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const prospectId = searchParams.get('prospectId');
    const opportunityId = searchParams.get('opportunityId');
    const taskId = searchParams.get('taskId');
    const afterSaleId = searchParams.get('afterSaleId');
    const employeId = searchParams.get('employeId');
    const type = searchParams.get('type');

    const where: Record<string, unknown> = {};
    if (prospectId) where.prospectId = prospectId;
    if (opportunityId) where.opportunityId = opportunityId;
    if (taskId) where.taskId = taskId;
    if (afterSaleId) where.afterSaleId = afterSaleId;
    if (employeId) where.employeId = employeId;
    if (type) where.type = type;

    const interactions = await db.interaction.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        prospect: { select: { id: true, nom: true, telephone: true } },
        opportunity: { select: { id: true, nomProjet: true } },
        task: { select: { id: true, titre: true } },
        afterSale: { select: { id: true, type: true, client: { select: { nom: true } } } },
        employe: { select: { id: true, nom: true, role: true } },
      },
    });

    return NextResponse.json(interactions);
  } catch (error) {
    console.error('[INTERACTIONS_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch interactions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial', 'technicien'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const body = await request.json();
    const { type, prospectId, opportunityId, taskId, afterSaleId, notes, date, employeId } = body;

    if (!notes && !type) {
      return NextResponse.json({ error: 'Au moins le type ou les notes sont requis' }, { status: 400 });
    }

    // Auto-fill employeId from session if not provided
    const finalEmployeId = employeId || authUser.employeId || null;

    const interaction = await db.interaction.create({
      data: {
        type: type || 'appel',
        prospectId: prospectId || null,
        opportunityId: opportunityId || null,
        taskId: taskId || null,
        afterSaleId: afterSaleId || null,
        notes: notes || null,
        date: date ? new Date(date) : new Date(),
        employeId: finalEmployeId,
      },
      include: {
        prospect: { select: { id: true, nom: true } },
        opportunity: { select: { id: true, nomProjet: true } },
        task: { select: { id: true, titre: true } },
        afterSale: { select: { id: true, type: true } },
        employe: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(interaction, { status: 201 });
  } catch (error) {
    console.error('[INTERACTIONS_POST]', error);
    return NextResponse.json({ error: 'Failed to create interaction' }, { status: 500 });
  }
}
