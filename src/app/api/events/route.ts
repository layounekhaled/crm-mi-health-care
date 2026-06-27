import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, canAccess } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type;
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) (where.date as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.date as Record<string, unknown>).lte = new Date(dateTo);
    }

    const events = await db.event.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        _count: {
          select: { prospects: true, tasks: true, employees: true },
        },
        employees: {
          include: {
            employee: { select: { id: true, nom: true, role: true } },
          },
        },
        creePar: { select: { id: true, nom: true } },
        modifiePar: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error('[EVENTS_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const body = await request.json();
    const { nom, ville, lienMaps, date, dateFin, type, marques, equipe, notes, employeeIds } = body;

    if (!nom || !date) {
      return NextResponse.json({ error: 'Nom and date are required' }, { status: 400 });
    }

    // Validate lienMaps if provided
    const mapsLink = lienMaps && String(lienMaps).trim() ? String(lienMaps).trim() : null;
    if (mapsLink && !mapsLink.startsWith('http')) {
      return NextResponse.json({ error: 'Le lien Google Maps doit commencer par http(s)' }, { status: 400 });
    }

    // Create event with employee assignments
    const event = await db.event.create({
      data: {
        nom,
        ville: ville || null,
        lienMaps: mapsLink,
        date: new Date(date),
        dateFin: dateFin ? new Date(dateFin) : null,
        type: type || 'congres',
        marques: marques || null,
        equipe: equipe || null,
        notes: notes || null,
        creeParId: authUser.employeId || null,
        employees: employeeIds && employeeIds.length > 0
          ? {
              create: employeeIds.map((empId: string) => ({
                employeeId: empId,
                notified: false,
              })),
            }
          : undefined,
      },
      include: {
        employees: {
          include: {
            employee: { select: { id: true, nom: true } },
          },
        },
        creePar: { select: { id: true, nom: true } },
      },
    });

    // Send notifications to assigned employees
    if (employeeIds && employeeIds.length > 0) {
      try {
        const users = await db.user.findMany({
          where: {
            employeId: { in: employeeIds },
            actif: true,
          },
          select: { id: true, employeId: true },
        });

        const dateStr = new Date(date).toLocaleDateString('fr-FR', {
          day: 'numeric', month: 'long', year: 'numeric',
        });
        const dateFinStr = dateFin
          ? new Date(dateFin).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'long', year: 'numeric',
            })
          : null;
        const periodeStr = dateFinStr
          ? `du ${dateStr} au ${dateFinStr}`
          : `le ${dateStr}`;

        for (const user of users) {
          await db.notification.create({
            data: {
              userId: user.id,
              type: 'evenement_assigne',
              titre: 'Événement assigné',
              message: `Vous avez été assigné(e) à l'événement « ${nom} » ${periodeStr}${ville ? ` à ${ville}` : ''}.`,
              lien: '/?page=calendar',
              referenceId: event.id,
            },
          });
        }

        // Mark as notified
        await db.eventEmployee.updateMany({
          where: {
            eventId: event.id,
            employeeId: { in: employeeIds },
          },
          data: { notified: true },
        });
      } catch (notifErr) {
        console.error('[EVENTS_POST_NOTIFY]', notifErr);
        // Don't fail the request if notification fails
      }
    }

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('[EVENTS_POST]', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
