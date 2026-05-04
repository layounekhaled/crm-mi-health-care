import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const afterSale = await db.afterSale.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, nom: true, wilaya: true, telephone: true } },
        employe: { select: { id: true, nom: true, role: true } },
      },
    });

    if (!afterSale) {
      return NextResponse.json({ error: 'After-sale not found' }, { status: 404 });
    }

    return NextResponse.json(afterSale);
  } catch (error) {
    console.error('[AFTER_SALE_GET_BY_ID]', error);
    return NextResponse.json({ error: 'Failed to fetch after-sale' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { clientId, type, statut, notes, date, employeId } = body;

    const existing = await db.afterSale.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'After-sale not found' }, { status: 404 });
    }

    const afterSale = await db.afterSale.update({
      where: { id },
      data: {
        ...(clientId !== undefined && { clientId }),
        ...(type !== undefined && { type }),
        ...(statut !== undefined && { statut }),
        ...(notes !== undefined && { notes }),
        ...(date !== undefined && { date: date ? new Date(date) : null }),
        ...(employeId !== undefined && { employeId }),
      },
      include: {
        client: { select: { id: true, nom: true } },
        employe: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(afterSale);
  } catch (error) {
    console.error('[AFTER_SALE_PUT]', error);
    return NextResponse.json({ error: 'Failed to update after-sale' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.afterSale.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'After-sale not found' }, { status: 404 });
    }

    await db.afterSale.delete({ where: { id } });

    return NextResponse.json({ message: 'After-sale deleted successfully' });
  } catch (error) {
    console.error('[AFTER_SALE_DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete after-sale' }, { status: 500 });
  }
}
