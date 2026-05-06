import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    // Build base filters based on user role
    const prospectWhere: Record<string, unknown> = {};
    const opportunityWhere: Record<string, unknown> = {};
    const operationWhere: Record<string, unknown> = {};
    const taskWhere: Record<string, unknown> = {};
    const afterSaleWhere: Record<string, unknown> = {};
    const interactionWhere: Record<string, unknown> = {};

    if (authUser.role === 'commercial' && authUser.employeId) {
      opportunityWhere.commercialId = authUser.employeId;
      operationWhere.opportunity = { commercialId: authUser.employeId };
      taskWhere.OR = [
        { assigneAId: authUser.employeId },
        { opportunity: { commercialId: authUser.employeId } },
      ];
      afterSaleWhere.client = { opportunities: { some: { commercialId: authUser.employeId } } };
      interactionWhere.employeId = authUser.employeId;
    } else if (authUser.role === 'technicien' && authUser.employeId) {
      operationWhere.responsableId = authUser.employeId;
      taskWhere.assigneAId = authUser.employeId;
      afterSaleWhere.employeId = authUser.employeId;
    }
    // admin sees everything (no filters)

    // 1. Total prospects and clients
    const [totalProspects, totalClients] = await Promise.all([
      db.prospect.count({ where: prospectWhere }),
      db.prospect.count({ where: { ...prospectWhere, isClient: true } }),
    ]);

    // 2. Opportunities by statut
    const opportunitiesByStatut = await db.opportunity.groupBy({
      by: ['statut'],
      _count: { statut: true },
      _sum: { montantEstime: true },
      where: opportunityWhere,
    });

    // 3. CA estimé vs réel (opportunities gagnées)
    const wonOpportunities = await db.opportunity.findMany({
      where: { ...opportunityWhere, statut: 'Gagné' },
      include: {
        operations: {
          select: { prixEstime: true, marge: true },
        },
      },
    });

    const caEstime = wonOpportunities.reduce(
      (sum, opp) => sum + (opp.montantEstime || 0),
      0
    );

    const caReel = wonOpportunities.reduce(
      (sum, opp) =>
        sum + opp.operations.reduce((opSum, op) => opSum + (op.prixEstime || 0), 0),
      0
    );

    // 4. Performance by marque (operations group by marque)
    const performanceByMarque = await db.operation.groupBy({
      by: ['marque'],
      _count: { id: true },
      _sum: { prixEstime: true, marge: true },
      where: operationWhere,
    });

    // 5. Performance by source (prospects group by source)
    const performanceBySource = await db.prospect.groupBy({
      by: ['source'],
      _count: { id: true },
      where: prospectWhere,
    });

    // 6. Taux de conversion (prospects devenus clients / total prospects)
    const tauxConversion = totalProspects > 0
      ? (totalClients / totalProspects) * 100
      : 0;

    // 7. Tâches en retard (tasks where dateEcheance < now and statut != terminee)
    const tasksEnRetard = await db.task.count({
      where: {
        ...taskWhere,
        dateEcheance: { lt: new Date() },
        statut: { not: 'terminee' },
      },
    });

    const tasksEnRetardDetails = await db.task.findMany({
      where: {
        ...taskWhere,
        dateEcheance: { lt: new Date() },
        statut: { not: 'terminee' },
      },
      take: 10,
      orderBy: { dateEcheance: 'asc' },
      include: {
        assigneA: { select: { id: true, nom: true } },
        prospect: { select: { id: true, nom: true } },
      },
    });

    // 8. Recent activities (last 10 interactions + tasks)
    const [recentInteractions, recentTasks] = await Promise.all([
      db.interaction.findMany({
        where: interactionWhere,
        take: 10,
        orderBy: { date: 'desc' },
        include: {
          prospect: { select: { id: true, nom: true } },
          opportunity: { select: { id: true, nomProjet: true } },
          employe: { select: { id: true, nom: true } },
        },
      }),
      db.task.findMany({
        where: taskWhere,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          assigneA: { select: { id: true, nom: true } },
          prospect: { select: { id: true, nom: true } },
          opportunity: { select: { id: true, nomProjet: true } },
        },
      }),
    ]);

    // 9. Additional stats
    const [totalOpportunities, totalOperations, totalTasks, pendingAfterSales] =
      await Promise.all([
        db.opportunity.count({ where: opportunityWhere }),
        db.operation.count({ where: operationWhere }),
        db.task.count({ where: taskWhere }),
        db.afterSale.count({ where: { ...afterSaleWhere, statut: 'en_attente' } }),
      ]);

    // 10. Tasks by statut
    const tasksByStatut = await db.task.groupBy({
      by: ['statut'],
      _count: { statut: true },
      where: taskWhere,
    });

    // 11. Tasks by priorite
    const tasksByPriorite = await db.task.groupBy({
      by: ['priorite'],
      _count: { priorite: true },
      where: taskWhere,
    });

    // ── NEW: CA by month (last 12 months) ──────────────────────────────
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const opportunitiesForCA = await db.opportunity.findMany({
      where: {
        ...opportunityWhere,
        statut: 'Gagné',
        createdAt: { gte: twelveMonthsAgo },
      },
      select: {
        montantEstime: true,
        createdAt: true,
        operations: { select: { prixEstime: true } },
      },
    });

    // Group by month
    const caByMonth: { month: string; estime: number; reel: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      const monthOpps = opportunitiesForCA.filter(
        (o) => new Date(o.createdAt) >= monthStart && new Date(o.createdAt) <= monthEnd
      );

      caByMonth.push({
        month: monthKey,
        estime: monthOpps.reduce((s, o) => s + (o.montantEstime || 0), 0),
        reel: monthOpps.reduce((s, o) => s + o.operations.reduce((os, op) => os + (op.prixEstime || 0), 0), 0),
      });
    }

    // ── NEW: Top commercials (by CA won) ──────────────────────────────
    const topCommercials = await db.opportunity.groupBy({
      by: ['commercialId'],
      _sum: { montantEstime: true },
      _count: { id: true },
      where: {
        ...opportunityWhere,
        statut: 'Gagné',
        commercialId: { not: null },
      },
      orderBy: { _sum: { montantEstime: 'desc' } },
      take: 5,
    });

    // Get commercial names
    const commercialIds = topCommercials.map((t) => t.commercialId).filter(Boolean) as string[];
    const commercialNames = await db.employee.findMany({
      where: { id: { in: commercialIds } },
      select: { id: true, nom: true },
    });
    const commercialMap = Object.fromEntries(commercialNames.map((c) => [c.id, c.nom]));

    const topCommercialsData = topCommercials.map((t) => ({
      commercialId: t.commercialId,
      nom: commercialMap[t.commercialId || ''] || 'N/A',
      ca: t._sum.montantEstime || 0,
      nbOpportunites: t._count.id,
    }));

    // ── NEW: Top products (operations by prix) ─────────────────────────
    const topProducts = await db.operation.groupBy({
      by: ['produit', 'marque'],
      _sum: { prixEstime: true },
      _count: { id: true },
      where: operationWhere,
      orderBy: { _sum: { prixEstime: 'desc' } },
      take: 5,
    });

    const topProductsData = topProducts.map((p) => ({
      produit: p.produit,
      marque: p.marque,
      ca: p._sum.prixEstime || 0,
      nbOperations: p._count.id,
    }));

    // ── NEW: SAV by type ───────────────────────────────────────────────
    const savByType = await db.afterSale.groupBy({
      by: ['type'],
      _count: { id: true },
      where: afterSaleWhere,
    });

    const savByStatut = await db.afterSale.groupBy({
      by: ['statut'],
      _count: { id: true },
      where: afterSaleWhere,
    });

    // ── NEW: Prospects by wilaya (top 10) ──────────────────────────────
    const prospectsByWilaya = await db.prospect.groupBy({
      by: ['wilaya'],
      _count: { id: true },
      where: prospectWhere,
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // ── NEW: Pipeline conversion rates ─────────────────────────────────
    const pipelineData = STATUT_ORDER.map((statut) => {
      const found = opportunitiesByStatut.find((s) => s.statut === statut);
      return {
        statut,
        count: found?._count.statut ?? 0,
        montant: found?._sum.montantEstime ?? 0,
      };
    });

    return NextResponse.json({
      prospects: {
        total: totalProspects,
        clients: totalClients,
        nonClients: totalProspects - totalClients,
        tauxConversion: Math.round(tauxConversion * 100) / 100,
      },
      opportunities: {
        total: totalOpportunities,
        byStatut: opportunitiesByStatut.map((item) => ({
          statut: item.statut,
          count: item._count.statut,
          montantEstime: item._sum.montantEstime || 0,
        })),
        caEstime,
        caReel,
      },
      operations: {
        total: totalOperations,
        byMarque: performanceByMarque.map((item) => ({
          marque: item.marque,
          count: item._count.id,
          prixEstime: item._sum.prixEstime || 0,
          marge: item._sum.marge || 0,
        })),
      },
      prospectsBySource: performanceBySource.map((item) => ({
        source: item.source,
        count: item._count.id,
      })),
      prospectsByWilaya: prospectsByWilaya.map((item) => ({
        wilaya: item.wilaya || 'Non renseigné',
        count: item._count.id,
      })),
      tasks: {
        total: totalTasks,
        enRetard: tasksEnRetard,
        enRetardDetails: tasksEnRetardDetails,
        byStatut: tasksByStatut.map((item) => ({
          statut: item.statut,
          count: item._count.statut,
        })),
        byPriorite: tasksByPriorite.map((item) => ({
          priorite: item.priorite,
          count: item._count.priorite,
        })),
      },
      afterSales: {
        pending: pendingAfterSales,
        byType: savByType.map((item) => ({
          type: item.type,
          count: item._count.id,
        })),
        byStatut: savByStatut.map((item) => ({
          statut: item.statut,
          count: item._count.id,
        })),
      },
      recentActivities: {
        interactions: recentInteractions,
        tasks: recentTasks,
      },
      // New enriched data
      caByMonth,
      topCommercials: topCommercialsData,
      topProducts: topProductsData,
      pipeline: pipelineData,
    });
  } catch (error) {
    console.error('[DASHBOARD_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}

const STATUT_ORDER = ['Nouveau', 'Contacté', 'Intéressé', 'Devis', 'Négociation', 'Gagnée', 'Perdu'];
