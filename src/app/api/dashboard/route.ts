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
      },
      recentActivities: {
        interactions: recentInteractions,
        tasks: recentTasks,
      },
    });
  } catch (error) {
    console.error('[DASHBOARD_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
