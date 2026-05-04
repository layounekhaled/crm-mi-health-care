import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const { id } = await params;

    const prospect = await db.prospect.findUnique({
      where: { id },
      include: {
        interactions: {
          orderBy: { date: 'desc' },
          include: { employe: { select: { id: true, nom: true } } },
        },
        opportunities: {
          orderBy: { createdAt: 'desc' },
          include: {
            commercial: { select: { id: true, nom: true } },
            operations: true,
          },
        },
        afterSales: {
          orderBy: { createdAt: 'desc' },
          include: { employe: { select: { id: true, nom: true } } },
        },
        eventLinks: {
          include: { event: true },
        },
        tasks: {
          orderBy: { createdAt: 'desc' },
          include: { assigneA: { select: { id: true, nom: true } } },
        },
      },
    });

    if (!prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    return NextResponse.json(prospect);
  } catch (error) {
    console.error('[PROSPECT_GET_BY_ID]', error);
    return NextResponse.json({ error: 'Failed to fetch prospect' }, { status: 500 });
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
    const { nom, specialite, wilaya, telephone, whatsapp, etablissement, source, isClient, notes } = body;

    // Check if prospect exists
    const existing = await db.prospect.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    // Check for duplicate telephone if being updated
    if (telephone && telephone !== existing.telephone) {
      const duplicate = await db.prospect.findFirst({
        where: { telephone, NOT: { id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'A prospect with this telephone number already exists' },
          { status: 409 }
        );
      }
    }

    const prospect = await db.prospect.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom }),
        ...(specialite !== undefined && { specialite }),
        ...(wilaya !== undefined && { wilaya }),
        ...(telephone !== undefined && { telephone }),
        ...(whatsapp !== undefined && { whatsapp }),
        ...(etablissement !== undefined && { etablissement }),
        ...(source !== undefined && { source }),
        ...(isClient !== undefined && { isClient }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json(prospect);
  } catch (error) {
    console.error('[PROSPECT_PUT]', error);
    return NextResponse.json({ error: 'Failed to update prospect' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const { id } = await params;

    const existing = await db.prospect.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    await db.prospect.delete({ where: { id } });

    return NextResponse.json({ message: 'Prospect deleted successfully' });
  } catch (error) {
    console.error('[PROSPECT_DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete prospect' }, { status: 500 });
  }
}
