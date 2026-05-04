import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const source = searchParams.get('source');
    const wilaya = searchParams.get('wilaya');
    const isClient = searchParams.get('isClient');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { nom: { contains: search } },
        { telephone: { contains: search } },
        { whatsapp: { contains: search } },
        { etablissement: { contains: search } },
        { specialite: { contains: search } },
      ];
    }

    if (source) {
      where.source = source;
    }

    if (wilaya) {
      where.wilaya = wilaya;
    }

    if (isClient !== null) {
      where.isClient = isClient === 'true';
    }

    const [prospects, total] = await Promise.all([
      db.prospect.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { interactions: true, opportunities: true, afterSales: true },
          },
        },
      }),
      db.prospect.count({ where }),
    ]);

    return NextResponse.json({
      data: prospects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[PROSPECTS_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nom, specialite, wilaya, telephone, whatsapp, etablissement, source, isClient, notes } = body;

    if (!nom) {
      return NextResponse.json({ error: 'Nom is required' }, { status: 400 });
    }

    // Check for duplicate telephone
    if (telephone) {
      const existing = await db.prospect.findFirst({
        where: { telephone },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'A prospect with this telephone number already exists', existingId: existing.id },
          { status: 409 }
        );
      }
    }

    const prospect = await db.prospect.create({
      data: {
        nom,
        specialite: specialite || null,
        wilaya: wilaya || null,
        telephone: telephone || null,
        whatsapp: whatsapp || null,
        etablissement: etablissement || null,
        source: source || 'prospection',
        isClient: isClient ?? false,
        notes: notes || null,
      },
    });

    return NextResponse.json(prospect, { status: 201 });
  } catch (error) {
    console.error('[PROSPECTS_POST]', error);
    return NextResponse.json({ error: 'Failed to create prospect' }, { status: 500 });
  }
}
