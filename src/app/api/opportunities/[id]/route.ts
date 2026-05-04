import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const opportunity = await db.opportunity.findUnique({
      where: { id },
      include: {
        client: true,
        commercial: { select: { id: true, nom: true, role: true } },
        operations: {
          include: {
            responsable: { select: { id: true, nom: true } },
            tasks: true,
          },
        },
        tasks: {
          include: { assigneA: { select: { id: true, nom: true } } },
        },
        interactions: {
          orderBy: { date: 'desc' },
          include: { employe: { select: { id: true, nom: true } } },
        },
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    return NextResponse.json(opportunity);
  } catch (error) {
    console.error('[OPPORTUNITY_GET_BY_ID]', error);
    return NextResponse.json({ error: 'Failed to fetch opportunity' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nomProjet, clientId, statut, montantEstime, commercialId, motifPerte } = body;

    const existing = await db.opportunity.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const opportunity = await db.opportunity.update({
      where: { id },
      data: {
        ...(nomProjet !== undefined && { nomProjet }),
        ...(clientId !== undefined && { clientId }),
        ...(statut !== undefined && { statut }),
        ...(montantEstime !== undefined && { montantEstime }),
        ...(commercialId !== undefined && { commercialId }),
        ...(motifPerte !== undefined && { motifPerte }),
      },
      include: {
        client: { select: { id: true, nom: true } },
        commercial: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(opportunity);
  } catch (error) {
    console.error('[OPPORTUNITY_PUT]', error);
    return NextResponse.json({ error: 'Failed to update opportunity' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.opportunity.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    await db.opportunity.delete({ where: { id } });

    return NextResponse.json({ message: 'Opportunity deleted successfully' });
  } catch (error) {
    console.error('[OPPORTUNITY_DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete opportunity' }, { status: 500 });
  }
}
