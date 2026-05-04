import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, canAccess, isAdmin } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { id } = await params;

    const operation = await db.operation.findUnique({
      where: { id },
      include: {
        opportunity: {
          include: {
            client: { select: { id: true, nom: true } },
            commercial: { select: { id: true, nom: true } },
          },
        },
        responsable: { select: { id: true, nom: true, role: true } },
        tasks: {
          include: { assigneA: { select: { id: true, nom: true } } },
        },
      },
    });

    if (!operation) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    // Role-based access check for individual operation
    if (authUser.role === 'commercial' && authUser.employeId && operation.opportunity?.commercialId !== authUser.employeId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    } else if (authUser.role === 'technicien' && authUser.employeId && operation.responsableId !== authUser.employeId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    return NextResponse.json(operation);
  } catch (error) {
    console.error('[OPERATION_GET_BY_ID]', error);
    return NextResponse.json({ error: 'Failed to fetch operation' }, { status: 500 });
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
    const { produit, marque, responsableId, prixEstime, marge, statut, datePrevue, priorite } = body;

    const existing = await db.operation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    // Validate status transition
    if (statut !== undefined && statut !== existing.statut) {
      const VALID_TRANSITIONS: Record<string, string[]> = {
        en_attente: ['en_cours'],
        en_cours: ['termine'],
        termine: [],
      };
      const allowed = VALID_TRANSITIONS[existing.statut] || [];
      if (!allowed.includes(statut)) {
        return NextResponse.json(
          { error: `Transition de statut non autorisée : ${existing.statut} → ${statut}` },
          { status: 400 }
        );
      }
    }

    const operation = await db.operation.update({
      where: { id },
      data: {
        ...(produit !== undefined && { produit }),
        ...(marque !== undefined && { marque }),
        ...(responsableId !== undefined && { responsableId }),
        ...(prixEstime !== undefined && { prixEstime }),
        ...(marge !== undefined && { marge }),
        ...(statut !== undefined && { statut }),
        ...(datePrevue !== undefined && { datePrevue: datePrevue ? new Date(datePrevue) : null }),
        ...(priorite !== undefined && { priorite }),
      },
      include: {
        opportunity: { select: { id: true, nomProjet: true } },
        responsable: { select: { id: true, nom: true } },
      },
    });

    // Check if all operations of the parent opportunity are now complete
    let allOperationsComplete = false;
    if (statut === 'termine') {
      const allOps = await db.operation.findMany({
        where: { opportunityId: operation.opportunityId },
        select: { statut: true },
      });
      allOperationsComplete = allOps.length > 0 && allOps.every(op => op.statut === 'termine');
    }

    return NextResponse.json({
      ...operation,
      allOperationsComplete,
    });
  } catch (error) {
    console.error('[OPERATION_PUT]', error);
    return NextResponse.json({ error: 'Failed to update operation' }, { status: 500 });
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

    const existing = await db.operation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    await db.operation.delete({ where: { id } });

    return NextResponse.json({ message: 'Operation deleted successfully' });
  } catch (error) {
    console.error('[OPERATION_DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete operation' }, { status: 500 });
  }
}
