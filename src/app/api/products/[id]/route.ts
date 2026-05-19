import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, canAccess } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const { id } = await params;

    const product = await db.product.findUnique({ where: { id } });
    if (!product) return NextResponse.json({ error: 'Produit non trouvé' }, { status: 404 });

    return NextResponse.json(product);
  } catch (error) {
    console.error('[PRODUCT_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { nom, marque, categorie, reference, description, prixReference, actif } = body;

    const product = await db.product.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom }),
        ...(marque !== undefined && { marque }),
        ...(categorie !== undefined && { categorie }),
        ...(reference !== undefined && { reference }),
        ...(description !== undefined && { description }),
        ...(prixReference !== undefined && { prixReference }),
        ...(actif !== undefined && { actif }),
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('[PRODUCT_PUT]', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin'])) return NextResponse.json({ error: 'Accès refusé - Admin uniquement' }, { status: 403 });

    const { id } = await params;

    // Soft delete - just deactivate
    const product = await db.product.update({
      where: { id },
      data: { actif: false },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('[PRODUCT_DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
