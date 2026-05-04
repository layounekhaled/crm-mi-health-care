import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await ensureDbInitialized();
    const { searchParams } = new URL(request.url);
    const employeId = searchParams.get('employeId');
    const mois = searchParams.get('mois');

    const where: Record<string, unknown> = {};

    if (employeId) {
      where.employeId = employeId;
    }

    if (mois) {
      where.mois = mois;
    }

    const objectives = await db.objective.findMany({
      where,
      orderBy: { mois: 'desc' },
      include: {
        employe: { select: { id: true, nom: true, role: true } },
      },
    });

    return NextResponse.json(objectives);
  } catch (error) {
    console.error('[OBJECTIVES_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch objectives' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbInitialized();
    const body = await request.json();
    const { employeId, mois, caObjectif, nbVentesObjectif, tachesObjectif } = body;

    if (!employeId || !mois) {
      return NextResponse.json({ error: 'employeId and mois are required' }, { status: 400 });
    }

    // Verify employee exists
    const employee = await db.employee.findUnique({ where: { id: employeId } });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Upsert: create or update by unique employeId+mois
    const objective = await db.objective.upsert({
      where: {
        employeId_mois: { employeId, mois },
      },
      update: {
        caObjectif: caObjectif ?? 0,
        nbVentesObjectif: nbVentesObjectif ?? 0,
        tachesObjectif: tachesObjectif ?? 0,
      },
      create: {
        employeId,
        mois,
        caObjectif: caObjectif ?? 0,
        nbVentesObjectif: nbVentesObjectif ?? 0,
        tachesObjectif: tachesObjectif ?? 0,
      },
      include: {
        employe: { select: { id: true, nom: true, role: true } },
      },
    });

    return NextResponse.json(objective, { status: 201 });
  } catch (error) {
    console.error('[OBJECTIVES_POST]', error);
    return NextResponse.json({ error: 'Failed to create/update objective' }, { status: 500 });
  }
}
