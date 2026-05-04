import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const { id } = await params;

    const task = await db.task.findUnique({
      where: { id },
      include: {
        assigneA: { select: { id: true, nom: true, role: true } },
        prospect: { select: { id: true, nom: true, wilaya: true } },
        opportunity: { select: { id: true, nomProjet: true, statut: true } },
        operation: { select: { id: true, produit: true, marque: true } },
        event: { select: { id: true, nom: true, date: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
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
    await ensureDbInitialized();
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
    await ensureDbInitialized();
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
