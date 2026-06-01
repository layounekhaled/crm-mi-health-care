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
    if (!canAccess(authUser, ['admin', 'commercial'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const { id } = await params;

    const event = await db.event.findUnique({
      where: { id },
      include: {
        prospects: {
          include: {
            prospect: true,
          },
        },
        employees: {
          include: {
            employee: { select: { id: true, nom: true, role: true } },
          },
        },
        tasks: {
          include: {
            assigneA: { select: { id: true, nom: true } },
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error('[EVENT_GET_BY_ID]', error);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { nom, ville, date, dateFin, type, marques, equipe, notes, employeeIds } = body;

    const existing = await db.event.findUnique({
      where: { id },
      include: { employees: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Update basic fields
    const event = await db.event.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom }),
        ...(ville !== undefined && { ville }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(dateFin !== undefined && { dateFin: dateFin ? new Date(dateFin) : null }),
        ...(type !== undefined && { type }),
        ...(marques !== undefined && { marques }),
        ...(equipe !== undefined && { equipe }),
        ...(notes !== undefined && { notes }),
      },
    });

    // Handle employee assignments if provided
    if (employeeIds !== undefined) {
      const currentEmployeeIds = existing.employees.map(e => e.employeeId);
      const newEmployeeIds: string[] = employeeIds;

      // Employees to add
      const toAdd = newEmployeeIds.filter(eid => !currentEmployeeIds.includes(eid));
      // Employees to remove
      const toRemove = currentEmployeeIds.filter(eid => !newEmployeeIds.includes(eid));

      // Remove unassigned employees
      if (toRemove.length > 0) {
        await db.eventEmployee.deleteMany({
          where: {
            eventId: id,
            employeeId: { in: toRemove },
          },
        });
      }

      // Add new employees
      if (toAdd.length > 0) {
        await db.eventEmployee.createMany({
          data: toAdd.map(empId => ({
            eventId: id,
            employeeId: empId,
            notified: false,
          })),
          skipDuplicates: true,
        });

        // Send notifications to newly assigned employees
        try {
          const users = await db.user.findMany({
            where: {
              employeId: { in: toAdd },
              actif: true,
            },
            select: { id: true, employeId: true },
          });

          const dateStr = (date ? new Date(date) : existing.date).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric',
          });
          const eventNom = nom || existing.nom;
          const eventVille = ville !== undefined ? ville : existing.ville;

          for (const user of users) {
            await db.notification.create({
              data: {
                userId: user.id,
                type: 'evenement_assigne',
                titre: 'Événement assigné',
                message: `Vous avez été assigné(e) à l'événement « ${eventNom} » le ${dateStr}${eventVille ? ` à ${eventVille}` : ''}.`,
                lien: '/?page=calendar',
                referenceId: id,
              },
            });
          }

          // Mark new assignments as notified
          await db.eventEmployee.updateMany({
            where: {
              eventId: id,
              employeeId: { in: toAdd },
            },
            data: { notified: true },
          });
        } catch (notifErr) {
          console.error('[EVENT_PUT_NOTIFY]', notifErr);
        }
      }
    }

    // Return updated event with employees
    const updatedEvent = await db.event.findUnique({
      where: { id },
      include: {
        employees: {
          include: {
            employee: { select: { id: true, nom: true, role: true } },
          },
        },
      },
    });

    return NextResponse.json(updatedEvent);
  } catch (error) {
    console.error('[EVENT_PUT]', error);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
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

    const existing = await db.event.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    await db.event.delete({ where: { id } });

    return NextResponse.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('[EVENT_DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
