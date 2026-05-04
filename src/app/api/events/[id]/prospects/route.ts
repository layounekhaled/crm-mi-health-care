import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET: List prospects linked to an event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const event = await db.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const prospects = await db.eventProspect.findMany({
      where: { eventId: id },
      include: {
        prospect: true,
      },
    });

    return NextResponse.json(prospects);
  } catch (error) {
    console.error('[EVENT_PROSPECTS_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch event prospects' }, { status: 500 });
  }
}

// POST: Add prospect(s) to an event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { prospectIds } = body as { prospectIds?: string[] };

    if (!prospectIds || !Array.isArray(prospectIds) || prospectIds.length === 0) {
      return NextResponse.json({ error: 'prospectIds array is required' }, { status: 400 });
    }

    const event = await db.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Verify all prospects exist
    const prospects = await db.prospect.findMany({
      where: { id: { in: prospectIds } },
    });
    if (prospects.length !== prospectIds.length) {
      return NextResponse.json({ error: 'One or more prospects not found' }, { status: 404 });
    }

    // Create links (skip duplicates via upsert pattern)
    const results = await Promise.all(
      prospectIds.map((prospectId) =>
        db.eventProspect.upsert({
          where: {
            eventId_prospectId: { eventId: id, prospectId },
          },
          update: {},
          create: {
            eventId: id,
            prospectId,
          },
        })
      )
    );

    return NextResponse.json({ added: results.length, links: results }, { status: 201 });
  } catch (error) {
    console.error('[EVENT_PROSPECTS_POST]', error);
    return NextResponse.json({ error: 'Failed to add prospects to event' }, { status: 500 });
  }
}

// DELETE: Remove prospect(s) from an event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const prospectIdsParam = searchParams.get('prospectIds');

    if (!prospectIdsParam) {
      return NextResponse.json({ error: 'prospectIds query parameter is required' }, { status: 400 });
    }

    const prospectIds = prospectIdsParam.split(',');

    const result = await db.eventProspect.deleteMany({
      where: {
        eventId: id,
        prospectId: { in: prospectIds },
      },
    });

    return NextResponse.json({ removed: result.count });
  } catch (error) {
    console.error('[EVENT_PROSPECTS_DELETE]', error);
    return NextResponse.json({ error: 'Failed to remove prospects from event' }, { status: 500 });
  }
}
