import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, canAccess } from '@/lib/auth-helpers';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
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
        user: { select: { id: true, email: true, actif: true } },
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

      const { opportunities, tasksAssigned, user, ...rest } = emp;

      return {
        ...rest,
        caGenere,
        tachesRealisees,
        nbOpportunites: emp._count.opportunities,
        nbOperations: emp._count.operations,
        hasUserAccount: !!user,
        userAccountEmail: user?.email || null,
        userAccountActif: user?.actif ?? null,
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
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const body = await request.json();
    const { nom, email, telephone, role, actif, permissions, motDePasse } = body;

    if (!nom) {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "L'email est requis pour créer les accès" }, { status: 400 });
    }

    if (!motDePasse) {
      return NextResponse.json({ error: 'Le mot de passe est requis pour créer les accès' }, { status: 400 });
    }

    if (motDePasse.length < 6) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, { status: 400 });
    }

    // Check for duplicate email in Employee
    const existingEmployee = await db.employee.findFirst({ where: { email } });
    if (existingEmployee) {
      return NextResponse.json(
        { error: 'Un employé avec cet email existe déjà' },
        { status: 409 }
      );
    }

    // Check for duplicate email in User
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Un compte utilisateur avec cet email existe déjà' },
        { status: 409 }
      );
    }

    // Create employee
    const employee = await db.employee.create({
      data: {
        nom,
        email: email || null,
        telephone: telephone || null,
        role: role || 'commercial',
        permissions: permissions || null,
        actif: actif ?? true,
      },
    });

    // Create linked User account with hashed password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(motDePasse, salt);

    await db.user.create({
      data: {
        email,
        motDePasse: hashedPassword,
        employeId: employee.id,
        role: role || 'commercial',
        permissions: permissions || null,
        actif: actif ?? true,
      },
    });

    return NextResponse.json({ ...employee, hasUserAccount: true, userAccountEmail: email }, { status: 201 });
  } catch (error) {
    console.error('[EMPLOYEES_POST]', error);
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}
