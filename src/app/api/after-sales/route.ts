import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await ensureDbInitialized();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const statut = searchParams.get('statut');
    const clientId = searchParams.get('clientId');

    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type;
    }

    if (statut) {
      where.statut = statut;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    const afterSales = await db.afterSale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, nom: true, wilaya: true, telephone: true } },
        employe: { select: { id: true, nom: true, role: true } },
      },
    });

    return NextResponse.json(afterSales);
  } catch (error) {
    console.error('[AFTER_SALES_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch after-sales' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbInitialized();
    const body = await request.json();
    const { clientId, type, statut, notes, date, employeId } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    // Verify client exists
    const client = await db.prospect.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const afterSale = await db.afterSale.create({
      data: {
        clientId,
        type: type || 'livraison',
        statut: statut || 'en_attente',
        notes: notes || null,
        date: date ? new Date(date) : null,
        employeId: employeId || null,
      },
      include: {
        client: { select: { id: true, nom: true } },
        employe: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json(afterSale, { status: 201 });
  } catch (error) {
    console.error('[AFTER_SALES_POST]', error);
    return NextResponse.json({ error: 'Failed to create after-sale' }, { status: 500 });
  }
}
