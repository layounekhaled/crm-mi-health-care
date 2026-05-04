import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
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
          select: { prospects: true, tasks: true },
        },
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
    const body = await request.json();
    const { nom, ville, date, type, marques, equipe, notes } = body;

    if (!nom || !date) {
      return NextResponse.json({ error: 'Nom and date are required' }, { status: 400 });
    }

    const event = await db.event.create({
      data: {
        nom,
        ville: ville || null,
        date: new Date(date),
        type: type || 'congres',
        marques: marques || null,
        equipe: equipe || null,
        notes: notes || null,
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('[EVENTS_POST]', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
