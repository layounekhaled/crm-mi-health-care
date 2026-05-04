import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const { id } = await params;

    const employee = await db.employee.findUnique({
      where: { id },
      include: {
        opportunities: {
          select: { id: true, nomProjet: true, statut: true, montantEstime: true },
        },
        operations: {
          select: { id: true, produit: true, marque: true, statut: true },
        },
        tasksAssigned: {
          select: { id: true, titre: true, statut: true, priorite: true },
        },
        interactions: {
          select: { id: true, type: true, date: true },
          take: 20,
          orderBy: { date: 'desc' },
        },
        afterSales: {
          select: { id: true, type: true, statut: true },
        },
        objectives: {
          orderBy: { mois: 'desc' },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error('[EMPLOYEE_GET_BY_ID]', error);
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 });
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
    const { nom, email, telephone, role, actif } = body;

    const existing = await db.employee.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Check for duplicate email if updating
    if (email && email !== existing.email) {
      const duplicate = await db.employee.findFirst({
        where: { email, NOT: { id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'An employee with this email already exists' },
          { status: 409 }
        );
      }
    }

    const employee = await db.employee.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom }),
        ...(email !== undefined && { email }),
        ...(telephone !== undefined && { telephone }),
        ...(role !== undefined && { role }),
        ...(actif !== undefined && { actif }),
      },
    });

    return NextResponse.json(employee);
  } catch (error) {
    console.error('[EMPLOYEE_PUT]', error);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const { id } = await params;

    const existing = await db.employee.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    await db.employee.delete({ where: { id } });

    return NextResponse.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('[EMPLOYEE_DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}
