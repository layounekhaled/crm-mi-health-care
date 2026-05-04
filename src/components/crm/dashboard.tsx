'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  Users,
  UserCheck,
  Briefcase,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Phone,
  Mail,
  CalendarCheck,
  ClipboardList,
  MessageSquare,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardData {
  prospects: {
    total: number
    clients: number
    nonClients: number
    tauxConversion: number
  }
  opportunities: {
    total: number
    byStatut: { statut: string; count: number; montantEstime: number }[]
    caEstime: number
    caReel: number
  }
  operations: {
    total: number
    byMarque: { marque: string; count: number; prixEstime: number; marge: number }[]
  }
  prospectsBySource: { source: string; count: number }[]
  tasks: {
    total: number
    enRetard: number
    enRetardDetails: {
      id: string
      titre: string
      dateEcheance: string
      assigneA: { id: string; nom: string } | null
      prospect: { id: string; nom: string } | null
    }[]
    byStatut: { statut: string; count: number }[]
    byPriorite: { priorite: string; count: number }[]
  }
  afterSales: {
    pending: number
  }
  recentActivities: {
    interactions: {
      id: string
      type: string
      notes: string | null
      date: string
      prospect: { id: string; nom: string } | null
      employe: { id: string; nom: string } | null
    }[]
    tasks: {
      id: string
      titre: string
      type: string
      statut: string
      createdAt: string
      assigneA: { id: string; nom: string } | null
      prospect: { id: string; nom: string } | null
    }[]
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUT_ORDER = ['Nouveau', 'Contacté', 'Intéressé', 'Devis', 'Négociation', 'Gagnée', 'Perdu']

const STATUT_COLORS: Record<string, string> = {
  Nouveau: '#003366',
  'Contacté': '#004080',
  'Intéressé': '#336699',
  Devis: '#FF9900',
  Négociation: '#CC7A00',
  'Gagnée': '#059669',
  'Perdu': '#dc2626',
}

const MARQUE_COLORS: Record<string, string> = {
  MIR: '#003366',
  BOS: '#FF9900',
  Löwenstein: '#336699',
  Yuwell: '#004080',
  Gelenke: '#CC7A00',
}

const SOURCE_COLORS = ['#003366', '#FF9900', '#336699', '#004080', '#CC7A00']

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  appel: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  reunion: <CalendarCheck className="h-4 w-4" />,
  visite: <Activity className="h-4 w-4" />,
  commerciale: <Briefcase className="h-4 w-4" />,
  suivi: <ClipboardList className="h-4 w-4" />,
  administrative: <CheckCircle2 className="h-4 w-4" />,
  technique: <MessageSquare className="h-4 w-4" />,
}

const ACTIVITY_COLORS: Record<string, string> = {
  appel: 'bg-blue-100 text-blue-700',
  email: 'bg-sky-100 text-sky-700',
  reunion: 'bg-amber-100 text-amber-700',
  visite: 'bg-[#003366]/10 text-[#003366]',
  commerciale: 'bg-violet-100 text-violet-700',
  suivi: 'bg-rose-100 text-rose-700',
  administrative: 'bg-slate-100 text-slate-700',
  technique: 'bg-orange-100 text-orange-700',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(value: number): string {
  return value.toLocaleString('fr-FR')
}

function formatCurrency(value: number): string {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function isOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode
  value: string
  label: string
  iconBgColor: string
  iconTextColor: string
}

function KpiCard({ icon, value, label, iconBgColor, iconTextColor }: KpiCardProps) {
  return (
    <Card className="py-4 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="flex items-center gap-4 px-4 pt-0 pb-0">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconBgColor}`}
        >
          <span className={iconTextColor}>{icon}</span>
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight truncate">{value}</p>
          <p className="text-sm text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Loading Skeletons ──────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <Card className="py-4 shadow-sm">
      <CardContent className="flex items-center gap-4 px-4 pt-0 pb-0">
        <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardContent>
    </Card>
  )
}

function ChartSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

function ListSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </CardContent>
    </Card>
  )
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function CustomBarTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="mb-1 text-sm font-semibold">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatNumber(entry.value)}
        </p>
      ))}
    </div>
  )
}

function CustomPieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill: string } }> }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="text-sm font-semibold">{payload[0].name}</p>
      <p className="text-sm" style={{ color: payload[0].payload.fill }}>
        {formatNumber(payload[0].value)}
      </p>
    </div>
  )
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/dashboard')
        if (!res.ok) throw new Error('Failed to fetch')
        const json = await res.json()
        setData(json)
      } catch (err) {
        console.error('[Dashboard] fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  // ─── Prepare chart data ────────────────────────────────────────────────

  const opportunitiesChartData = data
    ? STATUT_ORDER.map((statut) => {
        const found = data.opportunities.byStatut.find((s) => s.statut === statut)
        return {
          statut,
          count: found?.count ?? 0,
          montant: found?.montantEstime ?? 0,
        }
      })
    : []

  const marquesChartData = data
    ? data.operations.byMarque.map((item) => ({
        marque: item.marque,
        count: item.count,
      }))
    : []

  const sourceChartData = data
    ? data.prospectsBySource.map((item) => ({
        name: item.source || 'Non renseigné',
        value: item.count,
      }))
    : []

  const caChartData = data
    ? [
        { name: "CA Estimé", estimé: data.opportunities.caEstime, réel: data.opportunities.caReel },
      ]
    : []

  // Merge activities and sort by date
  const allActivities = data
    ? [
        ...data.recentActivities.interactions.map((i) => ({
          id: i.id,
          type: i.type,
          description: i.notes || `Interaction avec ${i.prospect?.nom || 'N/A'}`,
          date: i.date,
          who: i.employe?.nom || null,
          category: 'interaction' as const,
        })),
        ...data.recentActivities.tasks.map((t) => ({
          id: t.id,
          type: t.type,
          description: t.titre,
          date: t.createdAt,
          who: t.assigneA?.nom || null,
          category: 'task' as const,
        })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8)
    : []

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="MI HEALTH CARE" className="h-10 w-auto object-contain" />
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold tracking-tight text-[#003366]">
                  Tableau de bord
                </h1>
                <p className="text-xs text-muted-foreground">Solutions Santé — Algérie</p>
              </div>
            </div>
            <Badge variant="outline" className="hidden sm:flex gap-1.5 border-[#003366]/20 bg-[#003366]/5 text-[#003366]">
              <div className="h-2 w-2 rounded-full bg-[#FF9900] animate-pulse" />
              En direct
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* ─── KPI Cards ─────────────────────────────────────────────── */}
        <section aria-label="Indicateurs clés de performance">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
            ) : (
              <>
                <KpiCard
                  icon={<Users className="h-5 w-5" />}
                  value={formatNumber(data?.prospects.total ?? 0)}
                  label="Total Prospects"
                  iconBgColor="bg-blue-100"
                  iconTextColor="text-blue-600"
                />
                <KpiCard
                  icon={<UserCheck className="h-5 w-5" />}
                  value={formatNumber(data?.prospects.clients ?? 0)}
                  label="Total Clients"
                  iconBgColor="bg-green-100"
                  iconTextColor="text-green-600"
                />
                <KpiCard
                  icon={<Briefcase className="h-5 w-5" />}
                  value={formatNumber(
                    data?.opportunities.byStatut
                      .filter((s) => !['Gagnée', 'Perdu'].includes(s.statut))
                      .reduce((sum, s) => sum + s.count, 0) ?? 0
                  )}
                  label="Opportunités Actives"
                  iconBgColor="bg-amber-100"
                  iconTextColor="text-amber-600"
                />
                <KpiCard
                  icon={<DollarSign className="h-5 w-5" />}
                  value={formatCurrency(data?.opportunities.caEstime ?? 0)}
                  label="CA Estimé"
                  iconBgColor="bg-[#003366]/10"
                  iconTextColor="text-[#003366]"
                />
                <KpiCard
                  icon={<TrendingUp className="h-5 w-5" />}
                  value={`${(data?.prospects.tauxConversion ?? 0).toFixed(1)}%`}
                  label="Taux de Conversion"
                  iconBgColor="bg-purple-100"
                  iconTextColor="text-purple-600"
                />
                <KpiCard
                  icon={<AlertTriangle className="h-5 w-5" />}
                  value={formatNumber(data?.tasks.enRetard ?? 0)}
                  label="Tâches en Retard"
                  iconBgColor="bg-red-100"
                  iconTextColor="text-red-600"
                />
              </>
            )}
          </div>
        </section>

        {/* ─── Charts Row 1 ──────────────────────────────────────────── */}
        <section aria-label="Graphiques - partie 1">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Opportunités par Statut */}
            {loading ? (
              <ChartSkeleton />
            ) : (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-gray-800">
                    Opportunités par Statut
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={opportunitiesChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="statut"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        angle={-30}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Bar dataKey="count" name="Nombre" radius={[4, 4, 0, 0]} maxBarSize={48}>
                        {opportunitiesChartData.map((entry, index) => (
                          <Cell
                            key={`cell-statut-${index}`}
                            fill={STATUT_COLORS[entry.statut] || '#0d9488'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Performance par Marque */}
            {loading ? (
              <ChartSkeleton />
            ) : (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-gray-800">
                    Performance par Marque
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={marquesChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="marque"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        angle={-20}
                        textAnchor="end"
                        height={55}
                      />
                      <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Bar dataKey="count" name="Opérations" radius={[4, 4, 0, 0]} maxBarSize={56}>
                        {marquesChartData.map((entry, index) => (
                          <Cell
                            key={`cell-marque-${index}`}
                            fill={MARQUE_COLORS[entry.marque] || '#6b7280'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {/* ─── Charts Row 2 ──────────────────────────────────────────── */}
        <section aria-label="Graphiques - partie 2">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Prospects par Source - Pie/Donut */}
            {loading ? (
              <ChartSkeleton />
            ) : (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-gray-800">
                    Prospects par Source
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={sourceChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                        stroke="none"
                      >
                        {sourceChartData.map((_, index) => (
                          <Cell
                            key={`cell-source-${index}`}
                            fill={SOURCE_COLORS[index % SOURCE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value: string) => (
                          <span className="text-xs text-gray-600">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center text overlay for donut */}
                  <div className="pointer-events-none relative -mt-[200px] flex flex-col items-center justify-center" style={{ height: 0 }}>
                    <p className="text-2xl font-bold text-gray-800">
                      {formatNumber(sourceChartData.reduce((s, d) => s + d.value, 0))}
                    </p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* CA Estimé vs Réel */}
            {loading ? (
              <ChartSkeleton />
            ) : (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-gray-800">
                    CA Estimé vs Réel
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={[
                        {
                          name: 'Chiffre d&apos;affaires',
                          'Estimé': data?.opportunities.caEstime ?? 0,
                          'Réel': data?.opportunities.caReel ?? 0,
                        },
                      ]}
                      margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(v: number) => formatNumber(v)} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="Estimé" fill="#003366" radius={[4, 4, 0, 0]} maxBarSize={64} />
                      <Bar dataKey="Réel" fill="#004080" radius={[4, 4, 0, 0]} maxBarSize={64} />
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Summary below chart */}
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-[#003366]/5 p-3 text-center">
                      <p className="text-xs text-muted-foreground">Estimé</p>
                      <p className="text-lg font-bold text-[#003366]">
                        {formatCurrency(data?.opportunities.caEstime ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#004080]/5 p-3 text-center">
                      <p className="text-xs text-muted-foreground">Réel</p>
                      <p className="text-lg font-bold text-[#004080]">
                        {formatCurrency(data?.opportunities.caReel ?? 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {/* ─── Bottom section ────────────────────────────────────────── */}
        <section aria-label="Tâches et activités">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Tâches en Retard */}
            {loading ? (
              <ListSkeleton />
            ) : (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-gray-800">
                      Tâches en Retard
                    </CardTitle>
                    <Badge variant="destructive" className="text-xs">
                      {data?.tasks.enRetard ?? 0}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {data && data.tasks.enRetardDetails.length > 0 ? (
                    <div className="max-h-96 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                      {data.tasks.enRetardDetails.slice(0, 5).map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50/50 p-3 transition-colors hover:bg-red-50"
                        >
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {task.titre}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {task.assigneA && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {task.assigneA.nom}
                                </span>
                              )}
                              <span className="flex items-center gap-1 text-red-600 font-medium">
                                <Clock className="h-3 w-3" />
                                {formatDate(task.dateEcheance)}
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-red-400" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <CheckCircle2 className="mb-2 h-10 w-10 text-green-400" />
                      <p className="text-sm text-muted-foreground">Aucune tâche en retard</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Activité Récente */}
            {loading ? (
              <ListSkeleton />
            ) : (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-gray-800">
                    Activité Récente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {allActivities.length > 0 ? (
                    <div className="max-h-96 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
                      {allActivities.map((activity, index) => {
                        const iconKey = activity.type.toLowerCase()
                        const iconNode =
                          ACTIVITY_ICONS[iconKey] || <Activity className="h-4 w-4" />
                        const colorClass =
                          ACTIVITY_COLORS[iconKey] || 'bg-gray-100 text-gray-700'
                        const isLast = index === allActivities.length - 1

                        return (
                          <div key={activity.id} className="flex gap-3">
                            {/* Timeline column */}
                            <div className="flex flex-col items-center">
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colorClass}`}
                              >
                                {iconNode}
                              </div>
                              {!isLast && (
                                <div className="w-px flex-1 bg-gray-200" />
                              )}
                            </div>
                            {/* Content */}
                            <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                              <p className="truncate text-sm font-medium text-gray-900">
                                {activity.description}
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {activity.category === 'interaction'
                                    ? 'Interaction'
                                    : 'Tâche'}
                                </Badge>
                                {activity.who && <span>{activity.who}</span>}
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(activity.date)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Activity className="mb-2 h-10 w-10 text-gray-300" />
                      <p className="text-sm text-muted-foreground">
                        Aucune activité récente
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-white/60">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-center gap-3">
          <img src="/logo.png" alt="MI HEALTH CARE" className="h-6 w-auto object-contain opacity-60" />
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} — Tous droits réservés
          </p>
        </div>
      </footer>
    </div>
  )
}
