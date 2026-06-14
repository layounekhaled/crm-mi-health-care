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
        assignees: {
          include: {
            employee: { select: { id: true, nom: true, role: true } },
          },
        },
        prospect: { select: { id: true, nom: true, wilaya: true } },
        opportunity: { select: { id: true, nomProjet: true, statut: true, commercialId: true } },
        operation: { select: { id: true, produit: true, marque: true } },
        event: { select: { id: true, nom: true, date: true } },
        interactions: {
          orderBy: { date: 'desc' },
          include: {
            employe: { select: { id: true, nom: true, role: true } },
            photos: true,
          },
        },
        creePar: { select: { id: true, nom: true } },
        modifiePar: { select: { id: true, nom: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Role-based access check for individual task
    if (authUser.role === 'commercial' && authUser.employeId) {
      const isAssigned = task.assigneAId === authUser.employeId ||
        task.assignees.some(a => a.employeeId === authUser.employeId);
      const isOwnOpportunity = task.opportunity?.commercialId === authUser.employeId;
      if (!isAssigned && !isOwnOpportunity) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
      }
    } else if (authUser.role === 'technicien' && authUser.employeId) {
      const isAssigned = task.assigneAId === authUser.employeId ||
        task.assignees.some(a => a.employeeId === authUser.employeId);
      if (!isAssigned) {
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
      assigneAIds,
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
      const existing = await db.task.findUnique({
        where: { id },
        include: { assignees: true },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      const isAssigned = existing.assigneAId === authUser.employeId ||
        existing.assignees.some(a => a.employeeId === authUser.employeId);
      if (!isAssigned) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
      }
      // Technicien can only update statut
      const task = await db.task.update({
        where: { id },
        data: { 
          ...(statut !== undefined && { statut }),
          modifieParId: authUser.employeId || null,
        },
        include: {
          assigneA: { select: { id: true, nom: true } },
          assignees: { include: { employee: { select: { id: true, nom: true } } } },
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

    // Handle assignees update
    let assigneeUpdateNeeded = assigneAIds !== undefined;
    const employeeIds: string[] = assigneAIds || [];
    const firstAssigneeId = employeeIds.length > 0 ? employeeIds[0] : null;

    // Build update data
    const updateData: Record<string, unknown> = {
      ...(titre !== undefined && { titre }),
      ...(type !== undefined && { type }),
      ...(prospectId !== undefined && { prospectId }),
      ...(opportunityId !== undefined && { opportunityId }),
      ...(operationId !== undefined && { operationId }),
      ...(eventId !== undefined && { eventId }),
      ...(description !== undefined && { description }),
      ...(dateEcheance !== undefined && { dateEcheance: dateEcheance ? new Date(dateEcheance) : null }),
      ...(priorite !== undefined && { priorite }),
      ...(statut !== undefined && { statut }),
      ...(assigneAIds !== undefined && { assigneAId: firstAssigneeId }),
      ...(!assigneAIds && assigneAId !== undefined && { assigneAId }),
      modifieParId: authUser.employeId || null,
    };

    if (assigneeUpdateNeeded) {
      // Delete existing assignees and recreate
      await db.taskAssignee.deleteMany({ where: { taskId: id } });
    }

    const task = await db.task.update({
      where: { id },
      data: {
        ...updateData,
        ...(assigneeUpdateNeeded && {
          assignees: {
            create: employeeIds.map((empId: string) => ({
              employeeId: empId,
            })),
          },
        }),
      },
      include: {
        assigneA: { select: { id: true, nom: true } },
        assignees: { include: { employee: { select: { id: true, nom: true } } } },
        prospect: { select: { id: true, nom: true } },
        opportunity: { select: { id: true, nomProjet: true } },
        operation: { select: { id: true, produit: true, marque: true } },
        event: { select: { id: true, nom: true } },
      },
    });

    // Send notifications to newly assigned employees
    if (assigneeUpdateNeeded && employeeIds.length > 0) {
      for (const empId of employeeIds) {
        if (empId === authUser.employeId) continue;

        const employee = await db.employee.findUnique({
          where: { id: empId },
          include: { user: true },
        });

        if (employee?.user) {
          // Check if notification already exists for this task+employee
          const existingNotif = await db.notification.findFirst({
            where: {
              userId: employee.user.id,
              type: 'tache_assignee',
              referenceId: id,
            },
          });
          if (!existingNotif) {
            await db.notification.create({
              data: {
                userId: employee.user.id,
                type: 'tache_assignee',
                titre: 'Nouvelle tâche assignée',
                message: `La tâche "${task.titre}" vous a été assignée.`,
                lien: '/?page=tasks',
                referenceId: id,
              },
            });
          }
        }
      }
    }

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
