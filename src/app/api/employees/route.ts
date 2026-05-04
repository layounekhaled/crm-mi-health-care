import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const actif = searchParams.get('actif');

    const where: Record<string, unknown> = {};

    if (role) {
      where.role = role;
    }

    if (actif !== null) {
      where.actif = actif === 'true';
    }

    const employees = await db.employee.findMany({
      where,
      orderBy: { nom: 'asc' },
      include: {
        _count: {
          select: {
            opportunities: true,
            operations: true,
            tasksAssigned: true,
            interactions: true,
            afterSales: true,
            objectives: true,
          },
        },
        opportunities: {
          select: {
            statut: true,
            montantEstime: true,
          },
        },
        tasksAssigned: {
          select: {
            statut: true,
          },
        },
      },
    });

    // Compute additional stats
    const employeesWithStats = employees.map((emp) => {
      const caGenere = emp.opportunities
        .filter((o) => o.statut === 'Gagné')
        .reduce((sum, o) => sum + (o.montantEstime || 0), 0);

      const tachesRealisees = emp.tasksAssigned.filter(
        (t) => t.statut === 'termine'
      ).length;

      const { opportunities, tasksAssigned, ...rest } = emp;

      return {
        ...rest,
        caGenere,
        tachesRealisees,
        nbOpportunites: emp._count.opportunities,
        nbOperations: emp._count.operations,
      };
    });

    return NextResponse.json(employeesWithStats);
  } catch (error) {
    console.error('[EMPLOYEES_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nom, email, telephone, role, actif } = body;

    if (!nom) {
      return NextResponse.json({ error: 'Nom is required' }, { status: 400 });
    }

    // Check for duplicate email
    if (email) {
      const existing = await db.employee.findFirst({ where: { email } });
      if (existing) {
        return NextResponse.json(
          { error: 'An employee with this email already exists' },
          { status: 409 }
        );
      }
    }

    const employee = await db.employee.create({
      data: {
        nom,
        email: email || null,
        telephone: telephone || null,
        role: role || 'commercial',
        actif: actif ?? true,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error('[EMPLOYEES_POST]', error);
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}
