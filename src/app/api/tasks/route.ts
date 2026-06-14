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
        { assignees: { some: { employeeId: authUser.employeId } } },
        { opportunity: { commercialId: authUser.employeId } },
      ];
    } else if (authUser.role === 'technicien' && authUser.employeId) {
      where.OR = [
        { assigneAId: authUser.employeId },
        { assignees: { some: { employeeId: authUser.employeId } } },
      ];
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
      // Support filtering by any assigned employee (legacy or junction table)
      where.OR = [
        { assigneAId },
        { assignees: { some: { employeeId: assigneAId } } },
      ];
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
        assignees: {
          include: {
            employee: { select: { id: true, nom: true, role: true } },
          },
        },
        prospect: { select: { id: true, nom: true, wilaya: true } },
        opportunity: { select: { id: true, nomProjet: true, statut: true } },
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
      assigneAIds, // Array of employee IDs for multi-assignment
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

    // Build assignees list
    const employeeIds: string[] = assigneAIds || (assigneAId ? [assigneAId] : []);
    const firstAssigneeId = employeeIds.length > 0 ? employeeIds[0] : null;

    const task = await db.task.create({
      data: {
        titre,
        type: type || 'commerciale',
        assigneAId: firstAssigneeId, // Keep first as legacy field
        prospectId: prospectId || null,
        opportunityId: opportunityId || null,
        operationId: operationId || null,
        eventId: eventId || null,
        description: description || null,
        dateEcheance: dateEcheance ? new Date(dateEcheance) : null,
        priorite: priorite || 'moyenne',
        statut: statut || 'en_attente',
        creeParId: authUser.employeId || null,
        // Create assignees via junction table
        assignees: {
          create: employeeIds.map((empId: string) => ({
            employeeId: empId,
          })),
        },
      },
      include: {
        assigneA: { select: { id: true, nom: true } },
        assignees: {
          include: {
            employee: { select: { id: true, nom: true } },
          },
        },
        prospect: { select: { id: true, nom: true } },
        opportunity: { select: { id: true, nomProjet: true } },
        operation: { select: { id: true, produit: true, marque: true } },
        event: { select: { id: true, nom: true } },
      },
    });

    // Create notifications for assigned employees
    for (const empId of employeeIds) {
      // Don't notify the creator if they assigned it to themselves
      if (empId === authUser.employeId) continue;

      const employee = await db.employee.findUnique({
        where: { id: empId },
        include: { user: true },
      });

      if (employee?.user) {
        await db.notification.create({
          data: {
            userId: employee.user.id,
            type: 'tache_assignee',
            titre: 'Nouvelle tâche assignée',
            message: `La tâche "${titre}" vous a été assignée.`,
            lien: '/?page=tasks',
            referenceId: task.id,
          },
        });
      }
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('[TASKS_POST]', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
