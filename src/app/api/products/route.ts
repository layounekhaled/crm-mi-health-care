import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, canAccess } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const marque = searchParams.get('marque');
    const categorie = searchParams.get('categorie');
    const actif = searchParams.get('actif');
    const stats = searchParams.get('stats');

    // If stats=true, return product sales statistics
    if (stats === 'true') {
      return await getProductStats(authUser, marque);
    }

    const where: Record<string, unknown> = {};

    if (marque) where.marque = marque;
    if (categorie) where.categorie = categorie;
    if (actif !== null && actif !== undefined) where.actif = actif === 'true';

    const products = await db.product.findMany({
      where,
      orderBy: { nom: 'asc' },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error('[PRODUCTS_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

async function getProductStats(authUser: { role: string; employeId: string | null }, marqueFilter: string | null) {
  // Get all operations from won opportunities
  const operations = await db.operation.findMany({
    where: {
      opportunity: { statut: 'Gagné' },
      ...(marqueFilter ? { marque: marqueFilter } : {}),
    },
    include: {
      opportunity: {
        select: {
          id: true,
          nomProjet: true,
          commercialId: true,
          commercial: { select: { id: true, nom: true } },
          client: { select: { id: true, nom: true } },
        },
      },
    },
  });

  // Aggregate by product name + marque
  const productMap = new Map<string, {
    produit: string;
    marque: string;
    totalVentes: number;
    totalCA: number;
    totalMarge: number;
    ventesParCommercial: { commercialId: string; commercialNom: string; nbVentes: number; ca: number }[];
  }>();

  for (const op of operations) {
    const key = `${op.produit}||${op.marque}`;
    if (!productMap.has(key)) {
      productMap.set(key, {
        produit: op.produit,
        marque: op.marque,
        totalVentes: 0,
        totalCA: 0,
        totalMarge: 0,
        ventesParCommercial: [],
      });
    }

    const entry = productMap.get(key)!;
    entry.totalVentes += 1;
    entry.totalCA += op.prixEstime || 0;
    entry.totalMarge += op.marge || 0;

    // Track per-commercial
    const commercialId = op.opportunity.commercialId || 'non-assigne';
    const commercialNom = op.opportunity.commercial?.nom || 'Non assigné';
    const commercialEntry = entry.ventesParCommercial.find(c => c.commercialId === commercialId);
    if (commercialEntry) {
      commercialEntry.nbVentes += 1;
      commercialEntry.ca += op.prixEstime || 0;
    } else {
      entry.ventesParCommercial.push({
        commercialId,
        commercialNom,
        nbVentes: 1,
        ca: op.prixEstime || 0,
      });
    }
  }

  // Sort by totalVentes descending
  const result = Array.from(productMap.values()).sort((a, b) => b.totalVentes - a.totalVentes);

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (!canAccess(authUser, ['admin', 'commercial'])) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const body = await request.json();
    const { nom, marque, categorie, reference, description, prixReference, actif } = body;

    if (!nom || !marque) {
      return NextResponse.json(
        { error: 'nom and marque are required' },
        { status: 400 }
      );
    }

    const product = await db.product.create({
      data: {
        nom,
        marque,
        categorie: categorie || null,
        reference: reference || null,
        description: description || null,
        prixReference: prixReference ?? null,
        actif: actif !== undefined ? actif : true,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('[PRODUCTS_POST]', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
