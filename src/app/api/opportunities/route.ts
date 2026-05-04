import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statut = searchParams.get('statut');
    const clientId = searchParams.get('clientId');
    const commercialId = searchParams.get('commercialId');

    const where: Record<string, unknown> = {};

    if (statut) {
      where.statut = statut;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (commercialId) {
      where.commercialId = commercialId;
    }

    const opportunities = await db.opportunity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: { id: true, nom: true, wilaya: true, telephone: true },
        },
        commercial: {
          select: { id: true, nom: true, role: true },
        },
        operations: {
          include: {
            responsable: { select: { id: true, nom: true } },
          },
        },
      },
    });

    return NextResponse.json(opportunities);
  } catch (error) {
    console.error('[OPPORTUNITIES_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, nomProjet, statut, montantEstime, commercialId, motifPerte } = body;

    if (!nomProjet) {
      return NextResponse.json({ error: 'nomProjet is required' }, { status: 400 });
    }

    const opportunity = await db.opportunity.create({
      data: {
        clientId: clientId || null,
        nomProjet,
        statut: statut || 'Nouveau',
        montantEstime: montantEstime ?? null,
        commercialId: commercialId || null,
        motifPerte: motifPerte || null,
      },
      include: {
        client: { select: { id: true, nom: true } },
        commercial: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(opportunity, { status: 201 });
  } catch (error) {
    console.error('[OPPORTUNITIES_POST]', error);
    return NextResponse.json({ error: 'Failed to create opportunity' }, { status: 500 });
  }
}
