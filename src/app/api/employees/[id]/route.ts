import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, canAccess } from '@/lib/auth-helpers';
import bcrypt from 'bcryptjs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const { id } = await params;

    const employee = await db.employee.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, actif: true } },
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

    const { user, ...rest } = employee;
    return NextResponse.json({
      ...rest,
      hasUserAccount: !!user,
      userAccountEmail: user?.email || null,
      userAccountActif: user?.actif ?? null,
    });
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
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { nom, email, telephone, role, actif, permissions, motDePasse } = body;

    const existing = await db.employee.findUnique({
      where: { id },
      include: { user: true },
    });
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
          { error: 'Un employé avec cet email existe déjà' },
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
        ...(permissions !== undefined && { permissions }),
        ...(actif !== undefined && { actif }),
      },
    });

    // Sync to linked User account
    if (existing.user) {
      const userUpdateData: Record<string, unknown> = {};
      if (role !== undefined) userUpdateData.role = role;
      if (permissions !== undefined) userUpdateData.permissions = permissions;
      if (actif !== undefined) userUpdateData.actif = actif;
      if (email !== undefined && email !== existing.user.email) {
        // Check if the new email is already taken by another user
        const emailTaken = await db.user.findFirst({
          where: { email, NOT: { id: existing.user.id } },
        });
        if (emailTaken) {
          return NextResponse.json(
            { error: 'Un compte utilisateur avec cet email existe déjà' },
            { status: 409 }
          );
        }
        userUpdateData.email = email;
      }
      // Update password if provided
      if (motDePasse && motDePasse.trim().length >= 6) {
        const salt = await bcrypt.genSalt(10);
        userUpdateData.motDePasse = await bcrypt.hash(motDePasse, salt);
      }

      if (Object.keys(userUpdateData).length > 0) {
        await db.user.update({
          where: { id: existing.user.id },
          data: userUpdateData,
        });
      }
    } else if (email && motDePasse && motDePasse.trim().length >= 6) {
      // No user account exists yet — create one
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(motDePasse, salt);
      await db.user.create({
        data: {
          email,
          motDePasse: hashedPassword,
          employeId: existing.id,
          role: role || existing.role,
          permissions: permissions || existing.permissions,
          actif: actif ?? existing.actif,
        },
      });
    }

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
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const { id } = await params;

    const existing = await db.employee.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Delete linked User account first (if exists)
    const linkedUser = await db.user.findUnique({ where: { employeId: id } });
    if (linkedUser) {
      await db.user.delete({ where: { id: linkedUser.id } });
    }

    await db.employee.delete({ where: { id } });

    return NextResponse.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('[EMPLOYEE_DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}
