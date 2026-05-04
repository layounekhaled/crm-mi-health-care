import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { caObjectif, nbVentesObjectif, tachesObjectif, mois } = body;

    const existing = await db.objective.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Objective not found' }, { status: 404 });
    }

    const objective = await db.objective.update({
      where: { id },
      data: {
        ...(mois !== undefined && { mois }),
        ...(caObjectif !== undefined && { caObjectif }),
        ...(nbVentesObjectif !== undefined && { nbVentesObjectif }),
        ...(tachesObjectif !== undefined && { tachesObjectif }),
      },
      include: {
        employe: { select: { id: true, nom: true, role: true } },
      },
    });

    return NextResponse.json(objective);
  } catch (error) {
    console.error('[OBJECTIVE_PUT]', error);
    return NextResponse.json({ error: 'Failed to update objective' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.objective.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Objective not found' }, { status: 404 });
    }

    await db.objective.delete({ where: { id } });

    return NextResponse.json({ message: 'Objective deleted successfully' });
  } catch (error) {
    console.error('[OBJECTIVE_DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete objective' }, { status: 500 });
  }
}
