import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, canAccess, isAdmin } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { id } = await params;

    const task = await db.task.findUnique({
      where: { id },
      include: {
        assigneA: { select: { id: true, nom: true, role: true } },
        prospect: { select: { id: true, nom: true, wilaya: true } },
        opportunity: { select: { id: true, nomProjet: true, statut: true, commercialId: true } },
        operation: { select: { id: true, produit: true, marque: true } },
        event: { select: { id: true, nom: true, date: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Role-based access check for individual task
    if (authUser.role === 'commercial' && authUser.employeId) {
      const isAssigned = task.assigneAId === authUser.employeId;
      const isOwnOpportunity = task.opportunity?.commercialId === authUser.employeId;
      if (!isAssigned && !isOwnOpportunity) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
      }
    } else if (authUser.role === 'technicien' && authUser.employeId) {
      if (task.assigneAId !== authUser.employeId) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
      }
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('[TASK_GET_BY_ID]', error);
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { id } = await params;
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

    // Technicien can only update statut and only for tasks assigned to them
    if (authUser.role === 'technicien') {
      const existing = await db.task.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      if (existing.assigneAId !== authUser.employeId) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
      }
      // Technicien can only update statut
      const task = await db.task.update({
        where: { id },
        data: { ...(statut !== undefined && { statut }) },
        include: {
          assigneA: { select: { id: true, nom: true } },
          prospect: { select: { id: true, nom: true } },
          opportunity: { select: { id: true, nomProjet: true } },
          operation: { select: { id: true, produit: true, marque: true } },
          event: { select: { id: true, nom: true } },
        },
      });
      return NextResponse.json(task);
    }

    // Admin and commercial can update all fields
    if (!canAccess(authUser, ['admin', 'commercial'])) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const existing = await db.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = await db.task.update({
      where: { id },
      data: {
        ...(titre !== undefined && { titre }),
        ...(type !== undefined && { type }),
        ...(assigneAId !== undefined && { assigneAId }),
        ...(prospectId !== undefined && { prospectId }),
        ...(opportunityId !== undefined && { opportunityId }),
        ...(operationId !== undefined && { operationId }),
        ...(eventId !== undefined && { eventId }),
        ...(description !== undefined && { description }),
        ...(dateEcheance !== undefined && { dateEcheance: dateEcheance ? new Date(dateEcheance) : null }),
        ...(priorite !== undefined && { priorite }),
        ...(statut !== undefined && { statut }),
      },
      include: {
        assigneA: { select: { id: true, nom: true } },
        prospect: { select: { id: true, nom: true } },
        opportunity: { select: { id: true, nomProjet: true } },
        operation: { select: { id: true, produit: true, marque: true } },
        event: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error('[TASK_PUT]', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const { id } = await params;

    const existing = await db.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    await db.task.delete({ where: { id } });

    return NextResponse.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('[TASK_DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
