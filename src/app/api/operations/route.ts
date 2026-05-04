import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statut = searchParams.get('statut');
    const marque = searchParams.get('marque');
    const opportunityId = searchParams.get('opportunityId');

    const where: Record<string, unknown> = {};

    if (statut) {
      where.statut = statut;
    }

    if (marque) {
      where.marque = marque;
    }

    if (opportunityId) {
      where.opportunityId = opportunityId;
    }

    const operations = await db.operation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        opportunity: {
          select: {
            id: true,
            nomProjet: true,
            statut: true,
            client: { select: { id: true, nom: true } },
          },
        },
        responsable: {
          select: { id: true, nom: true, role: true },
        },
      },
    });

    return NextResponse.json(operations);
  } catch (error) {
    console.error('[OPERATIONS_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch operations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { opportunityId, produit, marque, responsableId, prixEstime, marge, statut, datePrevue, priorite } = body;

    if (!opportunityId || !produit || !marque) {
      return NextResponse.json(
        { error: 'opportunityId, produit, and marque are required' },
        { status: 400 }
      );
    }

    // Verify opportunity exists
    const opportunity = await db.opportunity.findUnique({ where: { id: opportunityId } });
    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const operation = await db.operation.create({
      data: {
        opportunityId,
        produit,
        marque,
        responsableId: responsableId || null,
        prixEstime: prixEstime ?? null,
        marge: marge ?? null,
        statut: statut || 'en_attente',
        datePrevue: datePrevue ? new Date(datePrevue) : null,
        priorite: priorite || 'moyenne',
      },
      include: {
        opportunity: {
          select: { id: true, nomProjet: true },
        },
        responsable: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(operation, { status: 201 });
  } catch (error) {
    console.error('[OPERATIONS_POST]', error);
    return NextResponse.json({ error: 'Failed to create operation' }, { status: 500 });
  }
}
