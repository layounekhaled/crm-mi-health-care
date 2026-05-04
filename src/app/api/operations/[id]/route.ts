import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
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
    await ensureDbInitialized();
    const { id } = await params;
    const body = await request.json();
    const { produit, marque, responsableId, prixEstime, marge, statut, datePrevue, priorite } = body;

    const existing = await db.operation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
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

    return NextResponse.json(operation);
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
    await ensureDbInitialized();
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
