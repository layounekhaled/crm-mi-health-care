import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';

    // Only search if query is at least 2 characters
    if (q.length < 2) {
      return NextResponse.json({
        prospects: [],
        opportunities: [],
        tasks: [],
        employees: [],
        events: [],
      });
    }

    const admin = isAdmin(authUser);
    const employeId = authUser.employeId;

    // ─── Prospects ───────────────────────────────────────────────────────
    const prospectSearchConditions = {
      OR: [
        { nom: { contains: q, mode: 'insensitive' as const } },
        { telephone: { contains: q, mode: 'insensitive' as const } },
        { whatsapp: { contains: q, mode: 'insensitive' as const } },
        { etablissement: { contains: q, mode: 'insensitive' as const } },
        { specialite: { contains: q, mode: 'insensitive' as const } },
      ],
    };

    let prospectWhere: Record<string, unknown> = { ...prospectSearchConditions };

    if (!admin && authUser.role === 'technicien' && employeId) {
      // Technicien can only search prospects linked to their assigned tasks
      const assignedProspectIds = await db.task.findMany({
        where: { assigneAId: employeId, prospectId: { not: null } },
        select: { prospectId: true },
        distinct: ['prospectId'],
      });
      const pIds = assignedProspectIds.map((t) => t.prospectId!).filter(Boolean);
      prospectWhere = {
        AND: [
          prospectSearchConditions,
          { id: { in: pIds.length > 0 ? pIds : ['__none__'] } },
        ],
      };
    }
    // Commercial & admin can see all prospects (commercial has access per existing API)

    // ─── Opportunities ───────────────────────────────────────────────────
    const opportunitySearchConditions = {
      OR: [
        { nomProjet: { contains: q, mode: 'insensitive' as const } },
        { client: { nom: { contains: q, mode: 'insensitive' as const } } },
        { commercial: { nom: { contains: q, mode: 'insensitive' as const } } },
      ],
    };

    let opportunityWhere: Record<string, unknown> = { ...opportunitySearchConditions };

    if (!admin && authUser.role === 'commercial' && employeId) {
      opportunityWhere = {
        AND: [
          opportunitySearchConditions,
          { commercialId: employeId },
        ],
      };
    } else if (!admin && authUser.role === 'technicien' && employeId) {
      const assignedOppIds = await db.task.findMany({
        where: { assigneAId: employeId, opportunityId: { not: null } },
        select: { opportunityId: true },
        distinct: ['opportunityId'],
      });
      const oIds = assignedOppIds.map((t) => t.opportunityId!).filter(Boolean);
      opportunityWhere = {
        AND: [
          opportunitySearchConditions,
          { id: { in: oIds.length > 0 ? oIds : ['__none__'] } },
        ],
      };
    }

    // ─── Tasks ───────────────────────────────────────────────────────────
    const taskSearchConditions = {
      OR: [
        { titre: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
      ],
    };

    let taskWhere: Record<string, unknown> = { ...taskSearchConditions };

    if (!admin && authUser.role === 'commercial' && employeId) {
      taskWhere = {
        AND: [
          taskSearchConditions,
          {
            OR: [
              { assigneAId: employeId },
              { opportunity: { commercialId: employeId } },
            ],
          },
        ],
      };
    } else if (!admin && authUser.role === 'technicien' && employeId) {
      taskWhere = {
        AND: [
          taskSearchConditions,
          { assigneAId: employeId },
        ],
      };
    }

    // ─── Employees ───────────────────────────────────────────────────────
    let employeeWhere: Record<string, unknown> = {
      OR: [
        { nom: { contains: q, mode: 'insensitive' as const } },
        { email: { contains: q, mode: 'insensitive' as const } },
      ],
    };

    // Only admin can search employees
    if (!admin) {
      employeeWhere = { id: { in: ['__none__'] } };
    }

    // ─── Events ──────────────────────────────────────────────────────────
    const eventSearchConditions = {
      OR: [
        { nom: { contains: q, mode: 'insensitive' as const } },
        { ville: { contains: q, mode: 'insensitive' as const } },
      ],
    };

    let eventWhere: Record<string, unknown> = { ...eventSearchConditions };

    // Technicien can only see events linked to their tasks
    if (!admin && authUser.role === 'technicien' && employeId) {
      const assignedEventIds = await db.task.findMany({
        where: { assigneAId: employeId, eventId: { not: null } },
        select: { eventId: true },
        distinct: ['eventId'],
      });
      const eIds = assignedEventIds.map((t) => t.eventId!).filter(Boolean);
      eventWhere = {
        AND: [
          eventSearchConditions,
          { id: { in: eIds.length > 0 ? eIds : ['__none__'] } },
        ],
      };
    }

    // Execute all searches in parallel with limit of 5 per group
    const [prospects, opportunities, tasks, employees, events] = await Promise.all([
      db.prospect.findMany({
        where: prospectWhere,
        take: 5,
        select: {
          id: true,
          nom: true,
          specialite: true,
          wilaya: true,
          isClient: true,
        },
      }),
      db.opportunity.findMany({
        where: opportunityWhere,
        take: 5,
        select: {
          id: true,
          nomProjet: true,
          statut: true,
          montantEstime: true,
          client: { select: { nom: true } },
        },
      }),
      db.task.findMany({
        where: taskWhere,
        take: 5,
        select: {
          id: true,
          titre: true,
          statut: true,
          priorite: true,
          assigneA: { select: { nom: true } },
        },
      }),
      db.employee.findMany({
        where: employeeWhere,
        take: 5,
        select: {
          id: true,
          nom: true,
          role: true,
        },
      }),
      db.event.findMany({
        where: eventWhere,
        take: 5,
        select: {
          id: true,
          nom: true,
          date: true,
          ville: true,
        },
      }),
    ]);

    return NextResponse.json({
      prospects: prospects.map((p) => ({ ...p, type: 'prospect' as const })),
      opportunities: opportunities.map((o) => ({ ...o, type: 'opportunity' as const })),
      tasks: tasks.map((t) => ({ ...t, type: 'task' as const })),
      employees: employees.map((e) => ({ ...e, type: 'employee' as const })),
      events: events.map((e) => ({ ...e, type: 'event' as const })),
    });
  } catch (error) {
    console.error('[SEARCH_GET]', error);
    return NextResponse.json({ error: 'Erreur lors de la recherche' }, { status: 500 });
  }
}
