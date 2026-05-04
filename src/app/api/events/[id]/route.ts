import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const event = await db.event.findUnique({
      where: { id },
      include: {
        prospects: {
          include: {
            prospect: true,
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
    const { id } = await params;
    const body = await request.json();
    const { nom, ville, date, type, marques, equipe, notes } = body;

    const existing = await db.event.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = await db.event.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom }),
        ...(ville !== undefined && { ville }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(type !== undefined && { type }),
        ...(marques !== undefined && { marques }),
        ...(equipe !== undefined && { equipe }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json(event);
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
