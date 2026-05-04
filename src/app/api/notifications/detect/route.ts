import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/notifications/detect - Auto-detect and create notifications
export async function POST() {
  try {
    const now = new Date()
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    let createdCount = 0

    // 1. Tasks with dateEcheance < now AND statut != 'terminee' → "Tâche en retard"
    const overdueTasks = await db.task.findMany({
      where: {
        dateEcheance: { lt: now },
        statut: { not: 'terminee' },
        assigneAId: { not: null },
      },
      include: {
        assigneA: { include: { user: true } },
      },
    })

    for (const task of overdueTasks) {
      if (!task.assigneA?.user) continue

      // Check if notification already exists for this task
      const existing = await db.notification.findFirst({
        where: {
          userId: task.assigneA.user.id,
          type: 'tache_retard',
          referenceId: task.id,
        },
      })
      if (existing) continue

      await db.notification.create({
        data: {
          userId: task.assigneA.user.id,
          type: 'tache_retard',
          titre: 'Tâche en retard',
          message: `La tâche "${task.titre}" est en retard. Échéance dépassée.`,
          lien: '/?page=tasks',
          referenceId: task.id,
        },
      })
      createdCount++
    }

    // 2. Tasks with dateEcheance within 24h AND statut != 'terminee' → "Tâche due bientôt"
    const soonDueTasks = await db.task.findMany({
      where: {
        dateEcheance: { gte: now, lte: in24h },
        statut: { not: 'terminee' },
        assigneAId: { not: null },
      },
      include: {
        assigneA: { include: { user: true } },
      },
    })

    for (const task of soonDueTasks) {
      if (!task.assigneA?.user) continue

      const existing = await db.notification.findFirst({
        where: {
          userId: task.assigneA.user.id,
          type: 'tache_bientot',
          referenceId: task.id,
        },
      })
      if (existing) continue

      await db.notification.create({
        data: {
          userId: task.assigneA.user.id,
          type: 'tache_bientot',
          titre: 'Tâche due bientôt',
          message: `La tâche "${task.titre}" arrive à échéance dans moins de 24h.`,
          lien: '/?page=tasks',
          referenceId: task.id,
        },
      })
      createdCount++
    }

    // 3. Opportunities with no interaction in last 7 days AND statut in specific statuses → "Opportunité stagnante"
    const stagnantStatuts = ['Négociation', 'Devis', 'Contacté', 'Intéressé']
    const stagnantOpportunities = await db.opportunity.findMany({
      where: {
        statut: { in: stagnantStatuts },
        commercialId: { not: null },
      },
      include: {
        commercial: { include: { user: true } },
        interactions: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    })

    for (const opp of stagnantOpportunities) {
      if (!opp.commercial?.user) continue

      // Check if last interaction is older than 7 days (or no interaction at all)
      const lastInteraction = opp.interactions[0]
      if (lastInteraction && new Date(lastInteraction.date) > sevenDaysAgo) continue

      const existing = await db.notification.findFirst({
        where: {
          userId: opp.commercial.user.id,
          type: 'opp_stagnante',
          referenceId: opp.id,
        },
      })
      if (existing) continue

      await db.notification.create({
        data: {
          userId: opp.commercial.user.id,
          type: 'opp_stagnante',
          titre: 'Opportunité stagnante',
          message: `L'opportunité "${opp.nomProjet}" n'a eu aucune interaction depuis plus de 7 jours.`,
          lien: '/?page=opportunities',
          referenceId: opp.id,
        },
      })
      createdCount++
    }

    // 4. Opportunities in 'Devis' status for > 14 days → "Devis sans suivi"
    const devisOpportunities = await db.opportunity.findMany({
      where: {
        statut: 'Devis',
        commercialId: { not: null },
        updatedAt: { lt: fourteenDaysAgo },
      },
      include: {
        commercial: { include: { user: true } },
      },
    })

    for (const opp of devisOpportunities) {
      if (!opp.commercial?.user) continue

      const existing = await db.notification.findFirst({
        where: {
          userId: opp.commercial.user.id,
          type: 'devis_sans_suivi',
          referenceId: opp.id,
        },
      })
      if (existing) continue

      await db.notification.create({
        data: {
          userId: opp.commercial.user.id,
          type: 'devis_sans_suivi',
          titre: 'Devis sans suivi',
          message: `Le devis pour "${opp.nomProjet}" est sans suivi depuis plus de 14 jours.`,
          lien: '/?page=opportunities',
          referenceId: opp.id,
        },
      })
      createdCount++
    }

    return NextResponse.json({
      success: true,
      createdCount,
      message: `${createdCount} nouvelle(s) notification(s) créée(s)`,
    })
  } catch (error) {
    console.error('Error detecting notifications:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
