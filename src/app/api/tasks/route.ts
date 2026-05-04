import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, canAccess } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const statut = searchParams.get('statut');
    const priorite = searchParams.get('priorite');
    const assigneAId = searchParams.get('assigneAId');
    const prospectId = searchParams.get('prospectId');
    const opportunityId = searchParams.get('opportunityId');
    const operationId = searchParams.get('operationId');
    const eventId = searchParams.get('eventId');

    const where: Record<string, unknown> = {};

    // Role-based filtering for tasks
    if (authUser.role === 'commercial' && authUser.employeId) {
      where.OR = [
        { assigneAId: authUser.employeId },
        { opportunity: { commercialId: authUser.employeId } },
      ];
    } else if (authUser.role === 'technicien' && authUser.employeId) {
      where.assigneAId = authUser.employeId;
    }
    // admin sees everything

    if (type) {
      where.type = type;
    }

    if (statut) {
      where.statut = statut;
    }

    if (priorite) {
      where.priorite = priorite;
    }

    if (assigneAId) {
      where.assigneAId = assigneAId;
    }

    if (prospectId) {
      where.prospectId = prospectId;
    }

    if (opportunityId) {
      where.opportunityId = opportunityId;
    }

    if (operationId) {
      where.operationId = operationId;
    }

    if (eventId) {
      where.eventId = eventId;
    }

    const tasks = await db.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        assigneA: { select: { id: true, nom: true, role: true } },
        prospect: { select: { id: true, nom: true, wilaya: true } },
        opportunity: { select: { id: true, nomProjet: true, statut: true } },
        operation: { select: { id: true, produit: true, marque: true } },
        event: { select: { id: true, nom: true, date: true } },
      },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('[TASKS_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const body = await request.json();
    const {
      titre,
      type,
      assigneAId,
      prospectId,
      opportunityId,
      operationId,
      eventId,
      description,
      dateEcheance,
      priorite,
      statut,
    } = body;

    if (!titre) {
      return NextResponse.json({ error: 'titre is required' }, { status: 400 });
    }

    const task = await db.task.create({
      data: {
        titre,
        type: type || 'commerciale',
        assigneAId: assigneAId || null,
        prospectId: prospectId || null,
        opportunityId: opportunityId || null,
        operationId: operationId || null,
        eventId: eventId || null,
        description: description || null,
        dateEcheance: dateEcheance ? new Date(dateEcheance) : null,
        priorite: priorite || 'moyenne',
        statut: statut || 'en_attente',
      },
      include: {
        assigneA: { select: { id: true, nom: true } },
        prospect: { select: { id: true, nom: true } },
        opportunity: { select: { id: true, nomProjet: true } },
        operation: { select: { id: true, produit: true, marque: true } },
        event: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('[TASKS_POST]', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
