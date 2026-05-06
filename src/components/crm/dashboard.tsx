'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
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
  Wrench,
  ChevronRight,
  Package,
  MapPin,
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
  prospectsByWilaya: { wilaya: string; count: number }[]
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
    byType: { type: string; count: number }[]
    byStatut: { statut: string; count: number }[]
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
  caByMonth: { month: string; estime: number; reel: number }[]
  topCommercials: { commercialId: string; nom: string; ca: number; nbOpportunites: number }[]
  topProducts: { produit: string; marque: string; ca: number; nbOperations: number }[]
  pipeline: { statut: string; count: number; montant: number }[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUT_ORDER = ['Nouveau', 'Contacté', 'Intéressé', 'Devis', 'Négociation', 'Gagnée', 'Perdu']

const STATUT_COLORS: Record<string, string> = {
  Nouveau: '#134885',
  'Contacté': '#1A5A9E',
  'Intéressé': '#336699',
  Devis: '#F6852A',
  Négociation: '#CC7A00',
  'Gagnée': '#059669',
  'Perdu': '#dc2626',
}

const MARQUE_COLORS: Record<string, string> = {
  MIR: '#134885',
  BOS: '#F6852A',
  'Löwenstein': '#336699',
  Yuwell: '#1A5A9E',
  Gelenke: '#CC7A00',
}

const SOURCE_COLORS = ['#134885', '#F6852A', '#336699', '#1A5A9E', '#CC7A00']

const WILAYA_COLORS = ['#134885', '#1A5A9E', '#336699', '#F6852A', '#CC7A00', '#059669', '#7C3AED', '#dc2626', '#0d9488', '#6b7280']

const SAV_STATUT_COLORS: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700 border-amber-200',
  en_cours: 'bg-blue-100 text-blue-700 border-blue-200',
  terminee: 'bg-green-100 text-green-700 border-green-200',
  cloturee: 'bg-gray-100 text-gray-700 border-gray-200',
}

const SAV_TYPE_COLORS: Record<string, string> = {
  maintenance: 'bg-[#134885]/10 text-[#134885] border-[#134885]/20',
  reparation: 'bg-[#F6852A]/10 text-[#F6852A] border-[#F6852A]/20',
  installation: 'bg-[#059669]/10 text-[#059669] border-[#059669]/20',
  formation: 'bg-purple-100 text-purple-700 border-purple-200',
  garantie: 'bg-sky-100 text-sky-700 border-sky-200',
}

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
  visite: 'bg-[#134885]/10 text-[#134885]',
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

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} Md DZD`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M DZD`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} k DZD`
  return formatCurrency(value)
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

function PipelineSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-24">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="flex-1 rounded-lg" style={{ height: `${80 - i * 8}%` }} />
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="flex-1 h-3" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function FunnelSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[200px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

// ─── Custom Tooltips ─────────────────────────────────────────────────────────

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

function CustomCurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="mb-1 text-sm font-semibold">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

// ─── Pipeline Funnel Component ───────────────────────────────────────────────

function PipelineFunnel({ pipeline }: { pipeline: DashboardData['pipeline'] }) {
  const maxCount = Math.max(...pipeline.map((p) => p.count), 1)

  return (
    <div className="space-y-3">
      {/* Funnel bars */}
      <div className="flex items-stretch gap-1.5 sm:gap-2 overflow-x-auto pb-2">
        {pipeline.map((stage, index) => {
          const widthPercent = Math.max((stage.count / maxCount) * 100, 12)
          const isNext = index < pipeline.length - 1
          const nextStage = isNext ? pipeline[index + 1] : null
          const conversionRate = isNext && stage.count > 0 && nextStage
            ? ((nextStage.count / stage.count) * 100).toFixed(0)
            : null

          return (
            <div key={stage.statut} className="flex flex-col items-center min-w-[80px] sm:min-w-[100px] flex-1">
              {/* Stage card */}
              <div
                className="w-full rounded-t-lg rounded-b-md p-2 sm:p-3 text-white text-center transition-all hover:scale-105"
                style={{
                  backgroundColor: STATUT_COLORS[stage.statut] || '#6b7280',
                  minHeight: '80px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <p className="text-xl sm:text-2xl font-bold">{stage.count}</p>
                <p className="text-[10px] sm:text-xs font-medium opacity-90 mt-0.5 leading-tight">{stage.statut}</p>
                <p className="text-[9px] sm:text-[10px] opacity-75 mt-1">
                  {formatCompactCurrency(stage.montant)}
                </p>
              </div>

              {/* Conversion rate arrow */}
              {conversionRate !== null && (
                <div className="flex items-center gap-0.5 mt-1.5 text-[10px] text-muted-foreground">
                  <ChevronRight className="h-3 w-3" />
                  <span className="font-medium">{conversionRate}%</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend row */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center pt-1">
        {pipeline.map((stage) => (
          <div key={stage.statut} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: STATUT_COLORS[stage.statut] || '#6b7280' }}
            />
            <span className="text-[10px] text-muted-foreground">{stage.statut}</span>
          </div>
        ))}
      </div>
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

  const wilayaChartData = data
    ? data.prospectsByWilaya.map((item) => ({
        wilaya: item.wilaya || 'Non renseigné',
        count: item.count,
      }))
    : []

  const caByMonthData = data
    ? data.caByMonth.map((item) => ({
        month: item.month,
        Estimé: item.estime,
        Réel: item.reel,
      }))
    : []

  const topCommercialsData = data
    ? data.topCommercials.map((item) => ({
        nom: item.nom,
        ca: item.ca,
        nbOpportunites: item.nbOpportunites,
      }))
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-blue-50/30">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="MI HEALTH CARE" className="h-10 w-auto object-contain" />
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold tracking-tight text-[#134885]">
                  Tableau de bord
                </h1>
                <p className="text-xs text-muted-foreground">Solutions Santé — Algérie</p>
              </div>
            </div>
            <Badge variant="outline" className="hidden sm:flex gap-1.5 border-[#134885]/20 bg-[#134885]/5 text-[#134885]">
              <div className="h-2 w-2 rounded-full bg-[#F6852A] animate-pulse" />
              En direct
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6 flex-1">
        {/* ─── KPI Cards (8 cards) ──────────────────────────────────── */}
        <section aria-label="Indicateurs clés de performance">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-4">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <KpiSkeleton key={i} />)
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
                  iconBgColor="bg-[#134885]/10"
                  iconTextColor="text-[#134885]"
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
                <KpiCard
                  icon={<Wrench className="h-5 w-5" />}
                  value={formatNumber(data?.afterSales.pending ?? 0)}
                  label="SAV en Attente"
                  iconBgColor="bg-orange-100"
                  iconTextColor="text-orange-600"
                />
                <KpiCard
                  icon={<Clock className="h-5 w-5" />}
                  value="—"
                  label="Délai moyen"
                  iconBgColor="bg-teal-100"
                  iconTextColor="text-teal-600"
                />
              </>
            )}
          </div>
        </section>

        {/* ─── Pipeline Funnel ──────────────────────────────────────── */}
        <section aria-label="Pipeline des opportunités">
          {loading ? (
            <PipelineSkeleton />
          ) : (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-gray-800">
                    Pipeline des Opportunités
                  </CardTitle>
                  <Badge variant="outline" className="text-xs border-[#134885]/20 text-[#134885]">
                    {data?.opportunities.total ?? 0} opportunités
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <PipelineFunnel pipeline={data?.pipeline ?? []} />
              </CardContent>
            </Card>
          )}
        </section>

        {/* ─── Charts Row 1 — CA by Month + Top Commercials ────────── */}
        <section aria-label="Graphiques - CA et commerciaux">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* CA par Mois (Line/Area Chart) */}
            {loading ? (
              <ChartSkeleton />
            ) : (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-gray-800">
                    CA par Mois (12 derniers mois)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={caByMonthData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorEstime" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#134885" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#134885" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorReel" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F6852A" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#F6852A" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10, fill: '#6b7280' }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickFormatter={(v: number) => {
                          if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`
                          if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
                          return String(v)
                        }}
                      />
                      <Tooltip content={<CustomCurrencyTooltip />} />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        formatter={(value: string) => (
                          <span className="text-xs text-gray-600">{value}</span>
                        )}
                      />
                      <Area
                        type="monotone"
                        dataKey="Estimé"
                        stroke="#134885"
                        strokeWidth={2}
                        fill="url(#colorEstime)"
                        dot={{ r: 3, fill: '#134885' }}
                        activeDot={{ r: 5, fill: '#134885' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="Réel"
                        stroke="#F6852A"
                        strokeWidth={2}
                        fill="url(#colorReel)"
                        dot={{ r: 3, fill: '#F6852A' }}
                        activeDot={{ r: 5, fill: '#F6852A' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  {/* Summary below chart */}
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-[#134885]/5 p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground">CA Estimé total</p>
                      <p className="text-sm font-bold text-[#134885]">
                        {formatCurrency(data?.opportunities.caEstime ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#F6852A]/5 p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground">CA Réel total</p>
                      <p className="text-sm font-bold text-[#F6852A]">
                        {formatCurrency(data?.opportunities.caReel ?? 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Commerciaux (Horizontal Bar Chart) */}
            {loading ? (
              <ChartSkeleton />
            ) : (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-gray-800">
                    Top Commerciaux
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topCommercialsData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={topCommercialsData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          tickFormatter={(v: number) => {
                            if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`
                            if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
                            return String(v)
                          }}
                        />
                        <YAxis
                          type="category"
                          dataKey="nom"
                          tick={{ fontSize: 11, fill: '#374151' }}
                          width={90}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => {
                            if (name === 'ca') return [formatCurrency(value), 'CA']
                            return [formatNumber(value), name]
                          }}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                        />
                        <Bar dataKey="ca" name="ca" fill="#134885" radius={[0, 4, 4, 0]} maxBarSize={32}>
                          {topCommercialsData.map((_, index) => (
                            <Cell
                              key={`cell-comm-${index}`}
                              fill={['#134885', '#1A5A9E', '#336699', '#5B8DB8', '#8BB8D8'][index % 5]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-center">
                      <Briefcase className="mb-2 h-10 w-10 text-gray-300" />
                      <p className="text-sm text-muted-foreground">Aucune donnée commerciale</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {/* ─── Charts Row 2 — Opportunités par Statut + Performance par Marque ── */}
        <section aria-label="Graphiques - opportunités et marques">
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

        {/* ─── Charts Row 3 — Prospects par Source + Prospects par Wilaya ── */}
        <section aria-label="Graphiques - prospects">
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

            {/* Prospects par Wilaya - Horizontal Bar Chart */}
            {loading ? (
              <ChartSkeleton />
            ) : (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-gray-800">
                      Prospects par Wilaya
                    </CardTitle>
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  {wilayaChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={wilayaChartData}
                        layout="vertical"
                        margin={{ top: 5, right: 10, left: 5, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="wilaya"
                          tick={{ fontSize: 10, fill: '#374151' }}
                          width={85}
                        />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Bar dataKey="count" name="Prospects" radius={[0, 4, 4, 0]} maxBarSize={28}>
                          {wilayaChartData.map((_, index) => (
                            <Cell
                              key={`cell-wilaya-${index}`}
                              fill={WILAYA_COLORS[index % WILAYA_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-center">
                      <MapPin className="mb-2 h-10 w-10 text-gray-300" />
                      <p className="text-sm text-muted-foreground">Aucune donnée par wilaya</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {/* ─── Bottom Row — Overdue Tasks + Recent Activity + Top Products + SAV Stats ── */}
        <section aria-label="Tâches, activités, produits et SAV">
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

            {/* Top Produits */}
            {loading ? (
              <ListSkeleton />
            ) : (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-gray-800">
                      Top Produits
                    </CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  {data && data.topProducts.length > 0 ? (
                    <div className="max-h-96 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                      {data.topProducts.map((product, index) => (
                        <div
                          key={`${product.produit}-${product.marque}`}
                          className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3 transition-colors hover:bg-gray-50"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#134885]/10 text-[#134885] text-sm font-bold">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-gray-900">
                                {product.produit}
                              </p>
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 shrink-0 border-[#F6852A]/30 text-[#F6852A]"
                              >
                                {product.marque}
                              </Badge>
                            </div>
                            <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="font-medium text-[#134885]">
                                {formatCurrency(product.ca)}
                              </span>
                              <span>
                                {product.nbOperations} operation{product.nbOperations > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Package className="mb-2 h-10 w-10 text-gray-300" />
                      <p className="text-sm text-muted-foreground">Aucun produit enregistré</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* SAV Stats */}
            {loading ? (
              <ListSkeleton />
            ) : (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-gray-800">
                      Service Après-Vente
                    </CardTitle>
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Summary */}
                  <div className="rounded-lg bg-orange-50 border border-orange-100 p-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                      <Wrench className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-orange-700">
                        {formatNumber(data?.afterSales.pending ?? 0)}
                      </p>
                      <p className="text-xs text-orange-600">En attente de traitement</p>
                    </div>
                  </div>

                  {/* By Type */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Par Type</p>
                    <div className="flex flex-wrap gap-2">
                      {data && data.afterSales.byType.length > 0 ? (
                        data.afterSales.byType.map((item) => (
                          <Badge
                            key={item.type}
                            variant="outline"
                            className={`text-xs px-2.5 py-1 ${SAV_TYPE_COLORS[item.type?.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
                          >
                            {item.type || 'N/A'}: {item.count}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">Aucun SAV par type</p>
                      )}
                    </div>
                  </div>

                  {/* By Statut */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Par Statut</p>
                    <div className="flex flex-wrap gap-2">
                      {data && data.afterSales.byStatut.length > 0 ? (
                        data.afterSales.byStatut.map((item) => {
                          const statutLabel: Record<string, string> = {
                            en_attente: 'En attente',
                            en_cours: 'En cours',
                            terminee: 'Terminée',
                            cloturee: 'Clôturée',
                          }
                          return (
                            <Badge
                              key={item.statut}
                              variant="outline"
                              className={`text-xs px-2.5 py-1 ${SAV_STATUT_COLORS[item.statut] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
                            >
                              {statutLabel[item.statut] || item.statut}: {item.count}
                            </Badge>
                          )
                        })
                      ) : (
                        <p className="text-xs text-muted-foreground">Aucun SAV par statut</p>
                      )}
                    </div>
                  </div>
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
