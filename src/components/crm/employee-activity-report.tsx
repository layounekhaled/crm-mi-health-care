'use client'

import { useState, useRef } from 'react'
import {
  Users,
  Briefcase,
  Phone,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  CalendarCheck,
  Package,
  FileText,
  Wrench,
  Printer,
  BarChart3,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  ClipboardList,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmployeeOption {
  id: string
  nom: string
  role: string
}

interface ReportData {
  employee: {
    id: string
    nom: string
    role: string
    email: string | null
    telephone: string | null
  }
  periode: { dateFrom: string; dateTo: string }
  resume: {
    totalTaches: number
    tachesRealisees: number
    tachesEnRetard: number
    totalInteractions: number
    visites: number
    appels: number
    prospectsAjoutes: number
    opportunitesCreees: number
    opportunitesGagnees: number
    opportunitesPerdues: number
    montantGagne: number
    evenementsParticipes: number
    operationsCreees: number
    afterSalesCount: number
    totalCharges: number
    documentsUploades: number
    produitsConcernes: number
  }
  details: {
    tasks: any[]
    interactions: any[]
    prospects: any[]
    opportunities: any[]
    events: any[]
    operations: any[]
    afterSales: any[]
    charges: any[]
    documents: any[]
    produitsConcernes: { produit: string; marque: string }[]
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const TASK_STATUT_COLORS: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  en_cours: 'bg-blue-100 text-blue-700',
  termine: 'bg-green-100 text-green-700',
}

const OPP_STATUT_COLORS: Record<string, string> = {
  Nouveau: 'bg-blue-100 text-blue-700',
  Contacté: 'bg-cyan-100 text-cyan-700',
  Intéressé: 'bg-indigo-100 text-indigo-700',
  Devis: 'bg-amber-100 text-amber-700',
  Négociation: 'bg-orange-100 text-orange-700',
  Gagnée: 'bg-green-100 text-green-700',
  Perdu: 'bg-red-100 text-red-700',
}

const INTERACTION_COLORS: Record<string, string> = {
  appel: 'bg-blue-100 text-blue-700',
  email: 'bg-sky-100 text-sky-700',
  visite: 'bg-[#134885]/10 text-[#134885]',
  reunion: 'bg-amber-100 text-amber-700',
  autre: 'bg-slate-100 text-slate-700',
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiProps {
  icon: React.ReactNode
  value: string | number
  label: string
  iconBgColor: string
  iconTextColor: string
}

function ReportKpi({ icon, value, label, iconBgColor, iconTextColor }: KpiProps) {
  return (
    <Card className="py-3 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="flex items-center gap-3 px-3 pt-0 pb-0">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBgColor}`}>
          <span className={iconTextColor}>{icon}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold tracking-tight truncate">{value}</p>
          <p className="text-xs text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Section Toggle ──────────────────────────────────────────────────────────

function SectionToggle({ title, icon, count, children, defaultOpen = false }: {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="shadow-sm">
      <CardHeader
        className="pb-2 cursor-pointer select-none hover:bg-slate-50/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-sm font-semibold text-gray-800">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{count}</Badge>
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function EmployeeActivityReport({ employees }: { employees: EmployeeOption[] }) {
  const [selectedEmployeId, setSelectedEmployeId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  const generateReport = async () => {
    setError(null)
    setReport(null)

    if (!selectedEmployeId) {
      setError('Veuillez sélectionner un employé.')
      return
    }
    if (!dateFrom || !dateTo) {
      setError('Veuillez sélectionner une période (date début et date fin).')
      return
    }
    if (new Date(dateTo) < new Date(dateFrom)) {
      setError('La date de fin ne peut pas être antérieure à la date de début.')
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        employeId: selectedEmployeId,
        dateFrom,
        dateTo,
      })
      const res = await fetch(`/api/reports/employee-activity?${params}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors du chargement du rapport')
      }
      const data = await res.json()
      setReport(data)
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement du rapport')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    const printContent = reportRef.current
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const employeeName = report?.employee.nom || ''
    const period = report?.periode
      ? `${formatDate(report.periode.dateFrom)} - ${formatDate(report.periode.dateTo)}`
      : ''

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapport d'activité - ${employeeName}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 20mm 15mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #1e293b; line-height: 1.5; }
          
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #134885; padding-bottom: 12px; margin-bottom: 16px; }
          .header-left { display: flex; align-items: center; gap: 12px; }
          .header-logo { height: 36px; }
          .header-title { font-size: 16px; font-weight: 700; color: #134885; }
          .header-subtitle { font-size: 10px; color: #64748b; }
          .header-right { text-align: right; font-size: 9px; color: #64748b; }
          
          .employee-info { background: #f0f7ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
          .employee-name { font-size: 14px; font-weight: 700; color: #134885; }
          .employee-role { font-size: 10px; color: #0369a1; }
          .period { font-size: 10px; color: #64748b; }
          
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
          .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; text-align: center; }
          .kpi-value { font-size: 16px; font-weight: 700; color: #134885; }
          .kpi-label { font-size: 9px; color: #64748b; }
          
          .section-title { font-size: 12px; font-weight: 700; color: #134885; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 14px 0 8px; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; }
          th { background: #134885; color: white; padding: 5px 8px; text-align: left; font-weight: 600; }
          td { padding: 4px 8px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          
          .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; }
          .badge-green { background: #dcfce7; color: #166534; }
          .badge-red { background: #fee2e2; color: #991b1b; }
          .badge-amber { background: #fef3c7; color: #92400e; }
          .badge-blue { background: #dbeafe; color: #1e40af; }
          
          .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8px; color: #94a3b8; padding: 6px; border-top: 1px solid #e2e8f0; }
          
          .no-data { text-align: center; padding: 16px; color: #94a3b8; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <img src="${window.location.origin}/logo.png" class="header-logo" onerror="this.style.display='none'" />
            <div>
              <div class="header-title">DALIA CRM — Rapport d'Activité Employé</div>
              <div class="header-subtitle">MI HEALTH CARE — Solutions Santé</div>
            </div>
          </div>
          <div class="header-right">
            Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        
        <div class="employee-info">
          <div>
            <div class="employee-name">${employeeName}</div>
            <div class="employee-role">${report?.employee.role || ''}${report?.employee.email ? ' — ' + report.employee.email : ''}</div>
          </div>
          <div class="period">Période : ${period}</div>
        </div>
        
        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-value">${report?.resume.tachesRealisees ?? 0}</div><div class="kpi-label">Tâches réalisées</div></div>
          <div class="kpi-card"><div class="kpi-value">${report?.resume.tachesEnRetard ?? 0}</div><div class="kpi-label">Tâches en retard</div></div>
          <div class="kpi-card"><div class="kpi-value">${report?.resume.visites ?? 0}</div><div class="kpi-label">Visites</div></div>
          <div class="kpi-card"><div class="kpi-value">${report?.resume.appels ?? 0}</div><div class="kpi-label">Appels</div></div>
          <div class="kpi-card"><div class="kpi-value">${report?.resume.prospectsAjoutes ?? 0}</div><div class="kpi-label">Prospects ajoutés</div></div>
          <div class="kpi-card"><div class="kpi-value">${report?.resume.opportunitesGagnees ?? 0}</div><div class="kpi-label">Opport. gagnées</div></div>
          <div class="kpi-card"><div class="kpi-value">${report?.resume.opportunitesPerdues ?? 0}</div><div class="kpi-label">Opport. perdues</div></div>
          <div class="kpi-card"><div class="kpi-value">${report ? formatCurrency(report.resume.montantGagne) : '0'}</div><div class="kpi-label">Montant gagné</div></div>
        </div>
        
        ${report?.details.tasks && report.details.tasks.length > 0 ? `
        <div class="section-title">Tâches (${report.details.tasks.length})</div>
        <table>
          <tr><th>Date</th><th>Titre</th><th>Type</th><th>Statut</th><th>Prospect</th></tr>
          ${report.details.tasks.map((t: any) => `<tr><td>${formatDate(t.createdAt)}</td><td>${t.titre}</td><td>${t.type}</td><td><span class="badge ${t.statut === 'termine' ? 'badge-green' : t.statut === 'en_cours' ? 'badge-blue' : 'badge-amber'}">${t.statut}</span></td><td>${t.prospect?.nom || '—'}</td></tr>`).join('')}
        </table>
        ` : ''}
        
        ${report?.details.interactions && report.details.interactions.length > 0 ? `
        <div class="section-title">Interactions (${report.details.interactions.length})</div>
        <table>
          <tr><th>Date</th><th>Type</th><th>Prospect</th><th>Notes</th></tr>
          ${report.details.interactions.map((i: any) => `<tr><td>${formatDate(i.date)}</td><td>${i.type}</td><td>${i.prospect?.nom || '—'}</td><td>${i.notes ? i.notes.substring(0, 60) + (i.notes.length > 60 ? '...' : '') : '—'}</td></tr>`).join('')}
        </table>
        ` : ''}
        
        ${report?.details.opportunities && report.details.opportunities.length > 0 ? `
        <div class="section-title">Opportunités (${report.details.opportunities.length})</div>
        <table>
          <tr><th>Date</th><th>Projet</th><th>Client</th><th>Statut</th><th>Montant</th></tr>
          ${report.details.opportunities.map((o: any) => `<tr><td>${formatDate(o.createdAt)}</td><td>${o.nomProjet}</td><td>${o.client?.nom || '—'}</td><td><span class="badge ${o.statut === 'Gagnée' ? 'badge-green' : o.statut === 'Perdu' ? 'badge-red' : 'badge-blue'}">${o.statut}</span></td><td>${o.montantEstime ? formatCurrency(o.montantEstime) : '—'}</td></tr>`).join('')}
        </table>
        ` : ''}
        
        ${report?.details.events && report.details.events.length > 0 ? `
        <div class="section-title">Événements (${report.details.events.length})</div>
        <table>
          <tr><th>Nom</th><th>Date</th><th>Ville</th><th>Type</th></tr>
          ${report.details.events.map((e: any) => `<tr><td>${e.nom}</td><td>${formatDate(e.date)}</td><td>${e.ville || '—'}</td><td>${e.type}</td></tr>`).join('')}
        </table>
        ` : ''}
        
        ${report?.details.prospects && report.details.prospects.length > 0 ? `
        <div class="section-title">Prospects ajoutés (${report.details.prospects.length})</div>
        <table>
          <tr><th>Date</th><th>Nom</th><th>Wilaya</th><th>Client</th></tr>
          ${report.details.prospects.map((p: any) => `<tr><td>${formatDate(p.createdAt)}</td><td>${p.nom}</td><td>${p.wilaya || '—'}</td><td>${p.isClient ? 'Oui' : 'Non'}</td></tr>`).join('')}
        </table>
        ` : ''}
        
        ${report?.details.operations && report.details.operations.length > 0 ? `
        <div class="section-title">Opérations (${report.details.operations.length})</div>
        <table>
          <tr><th>Date</th><th>Produit</th><th>Marque</th><th>Statut</th><th>Prix</th></tr>
          ${report.details.operations.map((o: any) => `<tr><td>${formatDate(o.createdAt)}</td><td>${o.produit}</td><td>${o.marque}</td><td><span class="badge ${o.statut === 'termine' ? 'badge-green' : 'badge-amber'}">${o.statut}</span></td><td>${o.prixEstime ? formatCurrency(o.prixEstime) : '—'}</td></tr>`).join('')}
        </table>
        ` : ''}
        
        <div class="footer">
          DALIA CRM — MI HEALTH CARE | Rapport généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} | Document confidentiel
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }

  const selectedEmployee = employees.find(e => e.id === selectedEmployeId)
  const hasReport = report !== null
  const hasAnyActivity = report && (
    report.resume.totalTaches > 0 ||
    report.resume.totalInteractions > 0 ||
    report.resume.prospectsAjoutes > 0 ||
    report.resume.opportunitesCreees > 0 ||
    report.resume.evenementsParticipes > 0 ||
    report.resume.operationsCreees > 0 ||
    report.resume.afterSalesCount > 0 ||
    report.resume.documentsUploades > 0
  )

  return (
    <div className="space-y-6">
      {/* ─── Filter Section ──────────────────────────────────── */}
      <Card className="shadow-sm border-[#134885]/10">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#134885]" />
            <CardTitle className="text-base font-semibold text-[#134885]">
              Rapport d'activité employé
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Sélectionnez un employé et une période pour générer un rapport détaillé de ses activités.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            {/* Employee Select */}
            <div className="flex flex-col gap-1 min-w-[200px]">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Employé</label>
              <select
                value={selectedEmployeId}
                onChange={(e) => setSelectedEmployeId(e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:border-[#134885] focus:outline-none focus:ring-1 focus:ring-[#134885]/30"
              >
                <option value="">Sélectionner un employé</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nom} ({emp.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Date début</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:border-[#134885] focus:outline-none focus:ring-1 focus:ring-[#134885]/30"
              />
            </div>

            {/* Date To */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Date fin</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:border-[#134885] focus:outline-none focus:ring-1 focus:ring-[#134885]/30"
              />
            </div>

            {/* Generate Button */}
            <Button
              onClick={generateReport}
              disabled={loading}
              className="gap-1.5 bg-[#134885] hover:bg-[#0f3a6e] h-9"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {loading ? 'Chargement...' : 'Générer le rapport'}
            </Button>

            {/* Print Button */}
            {hasReport && (
              <Button
                variant="outline"
                onClick={handlePrint}
                className="gap-1.5 h-9 border-[#134885]/20 text-[#134885] hover:bg-[#134885]/5"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimer
              </Button>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Report Content ──────────────────────────────────── */}
      {hasReport && (
        <div ref={reportRef}>
          {/* No Activity */}
          {!hasAnyActivity && (
            <Card className="shadow-sm">
              <CardContent className="py-12 text-center">
                <Activity className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-base font-medium text-slate-500">Aucune activité trouvée</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Aucune activité trouvée pour <span className="font-semibold">{report.employee.nom}</span> durant la période du {formatDate(report.periode.dateFrom)} au {formatDate(report.periode.dateTo)}.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Employee Header */}
          {hasAnyActivity && (
            <>
              {/* Employee Info Banner */}
              <Card className="shadow-sm border-[#134885]/10 bg-gradient-to-r from-[#134885]/5 to-[#F6852A]/5">
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-[#134885]">{report.employee.nom}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="capitalize">{report.employee.role}</span>
                        {report.employee.email && <span>• {report.employee.email}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-600">Période</p>
                      <p className="text-sm text-[#F6852A] font-semibold">
                        {formatDate(report.periode.dateFrom)} — {formatDate(report.periode.dateTo)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ReportKpi
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  value={report.resume.tachesRealisees}
                  label="Tâches réalisées"
                  iconBgColor="bg-green-100"
                  iconTextColor="text-green-600"
                />
                <ReportKpi
                  icon={<AlertTriangle className="h-4 w-4" />}
                  value={report.resume.tachesEnRetard}
                  label="Tâches en retard"
                  iconBgColor="bg-red-100"
                  iconTextColor="text-red-600"
                />
                <ReportKpi
                  icon={<MapPin className="h-4 w-4" />}
                  value={report.resume.visites}
                  label="Visites effectuées"
                  iconBgColor="bg-[#134885]/10"
                  iconTextColor="text-[#134885]"
                />
                <ReportKpi
                  icon={<Phone className="h-4 w-4" />}
                  value={report.resume.appels}
                  label="Appels effectués"
                  iconBgColor="bg-blue-100"
                  iconTextColor="text-blue-600"
                />
                <ReportKpi
                  icon={<Users className="h-4 w-4" />}
                  value={report.resume.prospectsAjoutes}
                  label="Prospects ajoutés"
                  iconBgColor="bg-purple-100"
                  iconTextColor="text-purple-600"
                />
                <ReportKpi
                  icon={<TrendingUp className="h-4 w-4" />}
                  value={report.resume.opportunitesGagnees}
                  label="Opport. gagnées"
                  iconBgColor="bg-emerald-100"
                  iconTextColor="text-emerald-600"
                />
                <ReportKpi
                  icon={<XCircle className="h-4 w-4" />}
                  value={report.resume.opportunitesPerdues}
                  label="Opport. perdues"
                  iconBgColor="bg-rose-100"
                  iconTextColor="text-rose-600"
                />
                <ReportKpi
                  icon={<DollarSign className="h-4 w-4" />}
                  value={formatCurrency(report.resume.montantGagne)}
                  label="Montant gagné"
                  iconBgColor="bg-amber-100"
                  iconTextColor="text-amber-600"
                />
              </div>

              {/* Secondary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ReportKpi
                  icon={<CalendarCheck className="h-4 w-4" />}
                  value={report.resume.evenementsParticipes}
                  label="Événements"
                  iconBgColor="bg-cyan-100"
                  iconTextColor="text-cyan-600"
                />
                <ReportKpi
                  icon={<Briefcase className="h-4 w-4" />}
                  value={report.resume.operationsCreees}
                  label="Opérations"
                  iconBgColor="bg-indigo-100"
                  iconTextColor="text-indigo-600"
                />
                <ReportKpi
                  icon={<Wrench className="h-4 w-4" />}
                  value={report.resume.afterSalesCount}
                  label="Après-vente"
                  iconBgColor="bg-orange-100"
                  iconTextColor="text-orange-600"
                />
                <ReportKpi
                  icon={<FileText className="h-4 w-4" />}
                  value={report.resume.documentsUploades}
                  label="Documents"
                  iconBgColor="bg-slate-100"
                  iconTextColor="text-slate-600"
                />
              </div>

              {/* ─── Detailed Sections ──────────────────────────────── */}

              {/* Tasks */}
              {report.details.tasks.length > 0 && (
                <SectionToggle
                  title="Tâches"
                  icon={<ClipboardList className="h-4 w-4 text-[#134885]" />}
                  count={report.details.tasks.length}
                  defaultOpen={true}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-left p-2 font-medium text-slate-600">Date</th>
                          <th className="text-left p-2 font-medium text-slate-600">Titre</th>
                          <th className="text-left p-2 font-medium text-slate-600">Type</th>
                          <th className="text-left p-2 font-medium text-slate-600">Statut</th>
                          <th className="text-left p-2 font-medium text-slate-600">Prospect</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.details.tasks.map((t: any) => (
                          <tr key={t.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-2 text-xs text-muted-foreground">{formatDate(t.createdAt)}</td>
                            <td className="p-2 font-medium">{t.titre}</td>
                            <td className="p-2"><Badge variant="outline" className="text-[10px]">{t.type}</Badge></td>
                            <td className="p-2">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${TASK_STATUT_COLORS[t.statut] || 'bg-slate-100 text-slate-700'}`}>
                                {t.statut === 'termine' ? 'Terminé' : t.statut === 'en_cours' ? 'En cours' : 'En attente'}
                              </span>
                            </td>
                            <td className="p-2 text-xs">{t.prospect?.nom || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionToggle>
              )}

              {/* Interactions */}
              {report.details.interactions.length > 0 && (
                <SectionToggle
                  title="Interactions"
                  icon={<Phone className="h-4 w-4 text-[#134885]" />}
                  count={report.details.interactions.length}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-left p-2 font-medium text-slate-600">Date</th>
                          <th className="text-left p-2 font-medium text-slate-600">Type</th>
                          <th className="text-left p-2 font-medium text-slate-600">Prospect</th>
                          <th className="text-left p-2 font-medium text-slate-600">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.details.interactions.map((i: any) => (
                          <tr key={i.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-2 text-xs text-muted-foreground">{formatDateTime(i.date)}</td>
                            <td className="p-2">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${INTERACTION_COLORS[i.type] || INTERACTION_COLORS.autre}`}>
                                {i.type}
                              </span>
                            </td>
                            <td className="p-2">{i.prospect?.nom || '—'}</td>
                            <td className="p-2 text-xs text-muted-foreground max-w-[200px] truncate">{i.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionToggle>
              )}

              {/* Opportunities */}
              {report.details.opportunities.length > 0 && (
                <SectionToggle
                  title="Opportunités"
                  icon={<Briefcase className="h-4 w-4 text-[#134885]" />}
                  count={report.details.opportunities.length}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-left p-2 font-medium text-slate-600">Date</th>
                          <th className="text-left p-2 font-medium text-slate-600">Projet</th>
                          <th className="text-left p-2 font-medium text-slate-600">Client</th>
                          <th className="text-left p-2 font-medium text-slate-600">Statut</th>
                          <th className="text-left p-2 font-medium text-slate-600">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.details.opportunities.map((o: any) => (
                          <tr key={o.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-2 text-xs text-muted-foreground">{formatDate(o.createdAt)}</td>
                            <td className="p-2 font-medium">{o.nomProjet}</td>
                            <td className="p-2">{o.client?.nom || '—'}</td>
                            <td className="p-2">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${OPP_STATUT_COLORS[o.statut] || 'bg-slate-100 text-slate-700'}`}>
                                {o.statut}
                              </span>
                            </td>
                            <td className="p-2 font-medium">{o.montantEstime ? formatCurrency(o.montantEstime) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionToggle>
              )}

              {/* Events */}
              {report.details.events.length > 0 && (
                <SectionToggle
                  title="Événements"
                  icon={<CalendarCheck className="h-4 w-4 text-[#134885]" />}
                  count={report.details.events.length}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-left p-2 font-medium text-slate-600">Nom</th>
                          <th className="text-left p-2 font-medium text-slate-600">Date</th>
                          <th className="text-left p-2 font-medium text-slate-600">Ville</th>
                          <th className="text-left p-2 font-medium text-slate-600">Type</th>
                          <th className="text-left p-2 font-medium text-slate-600">Marques</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.details.events.map((e: any) => (
                          <tr key={e.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-2 font-medium">{e.nom}</td>
                            <td className="p-2 text-xs text-muted-foreground">{formatDate(e.date)}</td>
                            <td className="p-2">{e.ville || '—'}</td>
                            <td className="p-2"><Badge variant="outline" className="text-[10px]">{e.type}</Badge></td>
                            <td className="p-2 text-xs">{e.marques || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionToggle>
              )}

              {/* Prospects */}
              {report.details.prospects.length > 0 && (
                <SectionToggle
                  title="Prospects ajoutés"
                  icon={<Users className="h-4 w-4 text-[#134885]" />}
                  count={report.details.prospects.length}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-left p-2 font-medium text-slate-600">Date</th>
                          <th className="text-left p-2 font-medium text-slate-600">Nom</th>
                          <th className="text-left p-2 font-medium text-slate-600">Wilaya</th>
                          <th className="text-left p-2 font-medium text-slate-600">Client</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.details.prospects.map((p: any) => (
                          <tr key={p.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-2 text-xs text-muted-foreground">{formatDate(p.createdAt)}</td>
                            <td className="p-2 font-medium">{p.nom}</td>
                            <td className="p-2">{p.wilaya || '—'}</td>
                            <td className="p-2">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${p.isClient ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                                {p.isClient ? 'Oui' : 'Non'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionToggle>
              )}

              {/* Operations */}
              {report.details.operations.length > 0 && (
                <SectionToggle
                  title="Opérations"
                  icon={<Package className="h-4 w-4 text-[#134885]" />}
                  count={report.details.operations.length}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-left p-2 font-medium text-slate-600">Date</th>
                          <th className="text-left p-2 font-medium text-slate-600">Produit</th>
                          <th className="text-left p-2 font-medium text-slate-600">Marque</th>
                          <th className="text-left p-2 font-medium text-slate-600">Statut</th>
                          <th className="text-left p-2 font-medium text-slate-600">Prix estimé</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.details.operations.map((o: any) => (
                          <tr key={o.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-2 text-xs text-muted-foreground">{formatDate(o.createdAt)}</td>
                            <td className="p-2 font-medium">{o.produit}</td>
                            <td className="p-2"><Badge variant="outline" className="text-[10px]">{o.marque}</Badge></td>
                            <td className="p-2">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${TASK_STATUT_COLORS[o.statut] || 'bg-slate-100 text-slate-700'}`}>
                                {o.statut}
                              </span>
                            </td>
                            <td className="p-2 font-medium">{o.prixEstime ? formatCurrency(o.prixEstime) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionToggle>
              )}

              {/* After-Sales */}
              {report.details.afterSales.length > 0 && (
                <SectionToggle
                  title="Après-vente"
                  icon={<Wrench className="h-4 w-4 text-[#134885]" />}
                  count={report.details.afterSales.length}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-left p-2 font-medium text-slate-600">Date</th>
                          <th className="text-left p-2 font-medium text-slate-600">Client</th>
                          <th className="text-left p-2 font-medium text-slate-600">Type</th>
                          <th className="text-left p-2 font-medium text-slate-600">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.details.afterSales.map((a: any) => (
                          <tr key={a.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-2 text-xs text-muted-foreground">{formatDate(a.createdAt)}</td>
                            <td className="p-2 font-medium">{a.client?.nom || '—'}</td>
                            <td className="p-2"><Badge variant="outline" className="text-[10px]">{a.type}</Badge></td>
                            <td className="p-2">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${TASK_STATUT_COLORS[a.statut] || 'bg-slate-100 text-slate-700'}`}>
                                {a.statut}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionToggle>
              )}

              {/* Products Concerned */}
              {report.details.produitsConcernes.length > 0 && (
                <SectionToggle
                  title="Produits concernés"
                  icon={<Package className="h-4 w-4 text-[#134885]" />}
                  count={report.details.produitsConcernes.length}
                >
                  <div className="flex flex-wrap gap-2">
                    {report.details.produitsConcernes.map((p: any, i: number) => (
                      <div key={i} className="rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                        <span className="font-medium">{p.produit}</span>
                        <span className="text-muted-foreground"> — {p.marque}</span>
                      </div>
                    ))}
                  </div>
                </SectionToggle>
              )}

              {/* Documents */}
              {report.details.documents.length > 0 && (
                <SectionToggle
                  title="Documents uploadés"
                  icon={<FileText className="h-4 w-4 text-[#134885]" />}
                  count={report.details.documents.length}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-left p-2 font-medium text-slate-600">Date</th>
                          <th className="text-left p-2 font-medium text-slate-600">Titre</th>
                          <th className="text-left p-2 font-medium text-slate-600">Marque</th>
                          <th className="text-left p-2 font-medium text-slate-600">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.details.documents.map((d: any) => (
                          <tr key={d.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-2 text-xs text-muted-foreground">{formatDate(d.createdAt)}</td>
                            <td className="p-2 font-medium">{d.title}</td>
                            <td className="p-2"><Badge variant="outline" className="text-[10px]">{d.brand}</Badge></td>
                            <td className="p-2"><Badge variant="outline" className="text-[10px]">{d.documentType}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionToggle>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
