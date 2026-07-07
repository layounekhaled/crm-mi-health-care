'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Wallet,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Landmark,
  FileText,
  Search,
  Filter,
  Loader2,
  Eye,
  ChevronDown,
  Fuel,
  Package,
  Car,
  UtensilsCrossed,
  HelpCircle,
  AlertTriangle,
  BarChart3,
  History,
  Receipt,
  Building2,
  RefreshCw,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'

// ─── Types ───────────────────────────────────────────────────────

interface CashPayment {
  id: string
  prospectId?: string | null
  opportunityId?: string | null
  reference?: string | null
  montant: number
  datePaiement: string
  modePaiement: string
  description?: string | null
  justificatifUrl?: string | null
  statut: string
  motifRefus?: string | null
  creeParId: string
  valideParId?: string | null
  dateValidation?: string | null
  createdAt: string
  prospect?: { id: string; nom: string } | null
  opportunity?: { id: string; nomProjet: string } | null
  creePar: { id: string; nom: string }
  validePar?: { id: string; nom: string } | null
  modifiePar?: { id: string; nom: string } | null
}

interface CashJournalEntry {
  id: string
  type: string
  reference?: string | null
  montantEntree: number
  montantSortie: number
  soldeApres: number
  description?: string | null
  employeId: string
  cashPaymentId?: string | null
  bankDepositId?: string | null
  cashExpenseId?: string | null
  dateOperation: string
  employe: { id: string; nom: string }
}

interface CashExpense {
  id: string
  categorie: string
  montant: number
  description?: string | null
  justificatifUrl?: string | null
  creeParId: string
  createdAt: string
  creePar: { id: string; nom: string }
}

interface BankDeposit {
  id: string
  montant: number
  banque: string
  compte?: string | null
  reference?: string | null
  observation?: string | null
  creeParId: string
  createdAt: string
  creePar: { id: string; nom: string }
}

interface CashAuditLog {
  id: string
  entityType: string
  entityId: string
  action: string
  details?: Record<string, unknown> | null
  employeId: string
  createdAt: string
  employe: { id: string; nom: string }
}

interface DashboardStats {
  soldeActuel: number
  enAttente: number
  nbEnAttente: number
  validesAujourdhui: number
  validesCeMois: number
  depensesCeMois: number
  depotsCeMois: number
  topEmploye: { employeId: string; nom: string; total: number; count: number } | null
  tauxValidation: number
  statsByEmployee: { employeId: string; nom: string; total: number; count: number }[]
}

// ─── Constants ───────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  { value: 'carburant', label: 'Carburant', icon: Fuel, color: 'bg-amber-100 text-amber-700' },
  { value: 'fournitures', label: 'Fournitures', icon: Package, color: 'bg-blue-100 text-blue-700' },
  { value: 'deplacement', label: 'Déplacement', icon: Car, color: 'bg-green-100 text-green-700' },
  { value: 'restauration', label: 'Restauration', icon: UtensilsCrossed, color: 'bg-rose-100 text-rose-700' },
  { value: 'divers', label: 'Divers', icon: HelpCircle, color: 'bg-slate-100 text-slate-700' },
]

const STATUS_CONFIG = {
  en_attente: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock },
  valide: { label: 'Validé', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle2 },
  refuse: { label: 'Refusé', color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle },
}

const JOURNAL_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  encaissement: { label: 'Encaissement', color: 'text-emerald-700 bg-emerald-50', icon: TrendingUp },
  depense: { label: 'Dépense', color: 'text-red-700 bg-red-50', icon: TrendingDown },
  depot_banque: { label: 'Dépôt bancaire', color: 'text-blue-700 bg-blue-50', icon: Landmark },
  ajustement: { label: 'Ajustement', color: 'text-purple-700 bg-purple-50', icon: ArrowRightLeft },
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: 'Création',
  validate: 'Validation',
  refuse: 'Refus',
  modify: 'Modification',
  archive: 'Archivage',
}

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  cash_payment: 'Encaissement',
  cash_expense: 'Dépense',
  bank_deposit: 'Dépôt bancaire',
  cash_adjustment: 'Ajustement',
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatDA(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('fr-DZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' DA'
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusConfig(statut: string) {
  return STATUS_CONFIG[statut as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.en_attente
}

function getExpenseCategoryConfig(categorie: string) {
  return EXPENSE_CATEGORIES.find(c => c.value === categorie) || EXPENSE_CATEGORIES[4]
}

// ─── Status Badge ────────────────────────────────────────────────

function StatusBadge({ statut }: { statut: string }) {
  const config = getStatusConfig(statut)
  const Icon = config.icon
  return (
    <Badge variant="outline" className={`gap-1 font-medium ${config.color}`}>
      <Icon className="size-3" />
      {config.label}
    </Badge>
  )
}

// ─── Journal Type Badge ──────────────────────────────────────────

function JournalTypeBadge({ type }: { type: string }) {
  const config = JOURNAL_TYPE_CONFIG[type] || { label: type, color: 'text-slate-700 bg-slate-50', icon: ArrowRightLeft }
  const Icon = config.icon
  return (
    <Badge variant="outline" className={`gap-1 font-medium ${config.color}`}>
      <Icon className="size-3" />
      {config.label}
    </Badge>
  )
}

// ─── Main Component ──────────────────────────────────────────────

export function CashManagement() {
  const { user, hasPermission } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isResponsable = user?.role === 'responsable'

  // State
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [payments, setPayments] = useState<CashPayment[]>([])
  const [journalEntries, setJournalEntries] = useState<CashJournalEntry[]>([])
  const [expenses, setExpenses] = useState<CashExpense[]>([])
  const [deposits, setDeposits] = useState<BankDeposit[]>([])
  const [auditLogs, setAuditLogs] = useState<CashAuditLog[]>([])
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)

  // Dialogs
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showExpenseDialog, setShowExpenseDialog] = useState(false)
  const [showDepositDialog, setShowDepositDialog] = useState(false)
  const [showRefuseDialog, setShowRefuseDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<CashPayment | null>(null)
  const [refuseMotif, setRefuseMotif] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [paymentForm, setPaymentForm] = useState({
    montant: '',
    reference: '',
    description: '',
    datePaiement: new Date().toISOString().split('T')[0],
  })
  const [expenseForm, setExpenseForm] = useState({
    categorie: 'carburant',
    montant: '',
    description: '',
  })
  const [depositForm, setDepositForm] = useState({
    montant: '',
    banque: '',
    compte: '',
    reference: '',
    observation: '',
  })

  // Filters
  const [paymentFilters, setPaymentFilters] = useState({
    statut: 'all',
    dateFrom: '',
    dateTo: '',
  })
  const [journalFilters, setJournalFilters] = useState({
    type: 'all',
    dateFrom: '',
    dateTo: '',
  })

  // ─── Fetch functions ────────────────────────────────────────

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cash/dashboard')
      if (res.ok) {
        const data = await res.json()
        setDashboardStats(data)
      }
    } catch (err) {
      console.error('Fetch dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (paymentFilters.statut && paymentFilters.statut !== 'all') params.set('statut', paymentFilters.statut)
      if (paymentFilters.dateFrom) params.set('dateFrom', paymentFilters.dateFrom)
      if (paymentFilters.dateTo) params.set('dateTo', paymentFilters.dateTo)
      const res = await fetch(`/api/cash/payments?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPayments(data.payments || data)
      }
    } catch (err) {
      console.error('Fetch payments error:', err)
    } finally {
      setLoading(false)
    }
  }, [paymentFilters])

  const fetchJournal = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (journalFilters.type && journalFilters.type !== 'all') params.set('type', journalFilters.type)
      if (journalFilters.dateFrom) params.set('dateFrom', journalFilters.dateFrom)
      if (journalFilters.dateTo) params.set('dateTo', journalFilters.dateTo)
      const res = await fetch(`/api/cash/journal?${params}`)
      if (res.ok) {
        const data = await res.json()
        setJournalEntries(data.entries || data)
      }
    } catch (err) {
      console.error('Fetch journal error:', err)
    } finally {
      setLoading(false)
    }
  }, [journalFilters])

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cash/expenses')
      if (res.ok) {
        const data = await res.json()
        setExpenses(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Fetch expenses error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchDeposits = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cash/deposits')
      if (res.ok) {
        const data = await res.json()
        setDeposits(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Fetch deposits error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cash/audit')
      if (res.ok) {
        const data = await res.json()
        setAuditLogs(data.logs || data)
      }
    } catch (err) {
      console.error('Fetch audit logs error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // ─── Effects ────────────────────────────────────────────────

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  useEffect(() => {
    if (activeTab === 'encaissements') fetchPayments()
    else if (activeTab === 'journal') fetchJournal()
    else if (activeTab === 'depenses') fetchExpenses()
    else if (activeTab === 'depots') fetchDeposits()
    else if (activeTab === 'historique') fetchAuditLogs()
  }, [activeTab, fetchPayments, fetchJournal, fetchExpenses, fetchDeposits, fetchAuditLogs])

  // ─── Action handlers ───────────────────────────────────────

  const handleCreatePayment = async () => {
    if (!paymentForm.montant || parseFloat(paymentForm.montant) <= 0) {
      toast.error('Le montant doit être positif')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/cash/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentForm),
      })
      if (res.ok) {
        toast.success('Encaissement déclaré avec succès')
        setShowPaymentDialog(false)
        setPaymentForm({ montant: '', reference: '', description: '', datePaiement: new Date().toISOString().split('T')[0] })
        fetchPayments()
        fetchDashboard()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la déclaration')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  const handleValidatePayment = async (paymentId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/cash/payments/${paymentId}/validate`, { method: 'POST' })
      if (res.ok) {
        toast.success('Encaissement validé')
        fetchPayments()
        fetchDashboard()
        setShowDetailDialog(false)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRefusePayment = async () => {
    if (!selectedPayment || !refuseMotif.trim()) {
      toast.error('Le motif de refus est requis')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/cash/payments/${selectedPayment.id}/refuse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motifRefus: refuseMotif }),
      })
      if (res.ok) {
        toast.success('Encaissement refusé')
        setShowRefuseDialog(false)
        setShowDetailDialog(false)
        setRefuseMotif('')
        setSelectedPayment(null)
        fetchPayments()
        fetchDashboard()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateExpense = async () => {
    if (!expenseForm.montant || parseFloat(expenseForm.montant) <= 0) {
      toast.error('Le montant doit être positif')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/cash/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseForm),
      })
      if (res.ok) {
        toast.success('Dépense enregistrée')
        setShowExpenseDialog(false)
        setExpenseForm({ categorie: 'carburant', montant: '', description: '' })
        fetchExpenses()
        fetchDashboard()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateDeposit = async () => {
    if (!depositForm.montant || parseFloat(depositForm.montant) <= 0) {
      toast.error('Le montant doit être positif')
      return
    }
    if (!depositForm.banque.trim()) {
      toast.error('La banque est requise')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/cash/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(depositForm),
      })
      if (res.ok) {
        toast.success('Dépôt bancaire enregistré')
        setShowDepositDialog(false)
        setDepositForm({ montant: '', banque: '', compte: '', reference: '', observation: '' })
        fetchDeposits()
        fetchDashboard()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Animation variants ────────────────────────────────────

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  }

  // ─── Render: Dashboard Tab ─────────────────────────────────

  const renderDashboard = () => {
    if (!dashboardStats) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#134885]" />
        </div>
      )
    }

    const stats = dashboardStats

    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        {/* Main Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div variants={itemVariants}>
            <Card className="border-l-4 border-l-[#134885] shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Solde actuel</p>
                    <p className="mt-1 text-2xl font-bold text-[#134885]">{formatDA(stats.soldeActuel)}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#134885]/10">
                    <Wallet className="h-6 w-6 text-[#134885]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="border-l-4 border-l-amber-400 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">En attente</p>
                    <p className="mt-1 text-2xl font-bold text-amber-600">{formatDA(stats.enAttente)}</p>
                    <p className="text-xs text-amber-500">{stats.nbEnAttente} déclaration(s)</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
                    <Clock className="h-6 w-6 text-amber-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="border-l-4 border-l-emerald-400 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Validés ce mois</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-600">{formatDA(stats.validesCeMois)}</p>
                    <p className="text-xs text-emerald-500">Aujourd&apos;hui: {formatDA(stats.validesAujourdhui)}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="border-l-4 border-l-[#F6852A] shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Taux validation</p>
                    <p className="mt-1 text-2xl font-bold text-[#F6852A]">{stats.tauxValidation}%</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F6852A]/10">
                    <BarChart3 className="h-6 w-6 text-[#F6852A]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Admin-only stats */}
        {isAdmin && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <motion.div variants={itemVariants}>
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Dépenses ce mois</p>
                      <p className="mt-1 text-xl font-bold text-red-600">{formatDA(stats.depensesCeMois)}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Dépôts bancaires ce mois</p>
                      <p className="mt-1 text-xl font-bold text-blue-600">{formatDA(stats.depotsCeMois)}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                      <Landmark className="h-5 w-5 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Top encaisseur ce mois</p>
                      <p className="mt-1 text-xl font-bold text-[#134885]">
                        {stats.topEmploye ? stats.topEmploye.nom : '—'}
                      </p>
                      {stats.topEmploye && (
                        <p className="text-xs text-slate-500">{formatDA(stats.topEmploye.total)} ({stats.topEmploye.count} paiements)</p>
                      )}
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#134885]/10">
                      <TrendingUp className="h-5 w-5 text-[#134885]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Stats by employee */}
        {isAdmin && stats.statsByEmployee && stats.statsByEmployee.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700">Classement des encaisseurs ce mois</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-3">
                  {stats.statsByEmployee.slice(0, 5).map((emp, index) => {
                    const maxTotal = stats.statsByEmployee[0]?.total || 1
                    const percentage = Math.round((emp.total / maxTotal) * 100)
                    return (
                      <div key={emp.employeId} className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#134885] text-xs font-bold text-white">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-700">{emp.nom}</span>
                            <span className="text-sm font-semibold text-[#134885]">{formatDA(emp.total)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.6, delay: index * 0.1 }}
                              className="h-full rounded-full bg-gradient-to-r from-[#134885] to-[#F6852A]"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    )
  }

  // ─── Render: Payments Tab ──────────────────────────────────

  const renderPayments = () => (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      {/* Header with filters and action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={paymentFilters.statut} onValueChange={(v) => setPaymentFilters(prev => ({ ...prev, statut: v }))}>
            <SelectTrigger className="w-[150px] h-9 text-sm">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="en_attente">En attente</SelectItem>
              <SelectItem value="valide">Validé</SelectItem>
              <SelectItem value="refuse">Refusé</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={paymentFilters.dateFrom}
            onChange={(e) => setPaymentFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
            className="w-[140px] h-9 text-sm"
            placeholder="Du"
          />
          <Input
            type="date"
            value={paymentFilters.dateTo}
            onChange={(e) => setPaymentFilters(prev => ({ ...prev, dateTo: e.target.value }))}
            className="w-[140px] h-9 text-sm"
            placeholder="Au"
          />
          {(paymentFilters.statut !== 'all' || paymentFilters.dateFrom || paymentFilters.dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPaymentFilters({ statut: 'all', dateFrom: '', dateTo: '' })}
              className="h-9 text-xs text-slate-500"
            >
              Réinitialiser
            </Button>
          )}
        </div>
        <Button
          onClick={() => setShowPaymentDialog(true)}
          className="bg-[#F6852A] hover:bg-[#e8751a] text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          Déclarer un encaissement
        </Button>
      </div>

      {/* Payments list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#134885]" />
        </div>
      ) : payments.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Wallet className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-sm text-slate-500">Aucun encaissement trouvé</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm overflow-hidden">
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="text-xs font-semibold">Date</TableHead>
                  <TableHead className="text-xs font-semibold">Employé</TableHead>
                  <TableHead className="text-xs font-semibold">Client</TableHead>
                  <TableHead className="text-xs font-semibold">Référence</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Montant</TableHead>
                  <TableHead className="text-xs font-semibold">Statut</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment, i) => (
                  <motion.tr
                    key={payment.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="group hover:bg-slate-50/80 transition-colors"
                  >
                    <TableCell className="text-sm">{formatDate(payment.datePaiement)}</TableCell>
                    <TableCell className="text-sm font-medium">{payment.creePar.nom}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {payment.prospect ? payment.prospect.nom : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{payment.reference || '—'}</TableCell>
                    <TableCell className="text-sm font-semibold text-right text-[#134885]">{formatDA(payment.montant)}</TableCell>
                    <TableCell><StatusBadge statut={payment.statut} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => { setSelectedPayment(payment); setShowDetailDialog(true) }}
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                        </Button>
                        {isAdmin && payment.statut === 'en_attente' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleValidatePayment(payment.id)}
                              disabled={submitting}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => { setSelectedPayment(payment); setShowRefuseDialog(true) }}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}
    </motion.div>
  )

  // ─── Render: Journal Tab ───────────────────────────────────

  const renderJournal = () => (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={journalFilters.type} onValueChange={(v) => setJournalFilters(prev => ({ ...prev, type: v }))}>
          <SelectTrigger className="w-[170px] h-9 text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="encaissement">Encaissement</SelectItem>
            <SelectItem value="depense">Dépense</SelectItem>
            <SelectItem value="depot_banque">Dépôt bancaire</SelectItem>
            <SelectItem value="ajustement">Ajustement</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={journalFilters.dateFrom}
          onChange={(e) => setJournalFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
          className="w-[140px] h-9 text-sm"
        />
        <Input
          type="date"
          value={journalFilters.dateTo}
          onChange={(e) => setJournalFilters(prev => ({ ...prev, dateTo: e.target.value }))}
          className="w-[140px] h-9 text-sm"
        />
        {(journalFilters.type !== 'all' || journalFilters.dateFrom || journalFilters.dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setJournalFilters({ type: 'all', dateFrom: '', dateTo: '' })}
            className="h-9 text-xs text-slate-500"
          >
            Réinitialiser
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#134885]" />
        </div>
      ) : journalEntries.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-sm text-slate-500">Aucune entrée dans le journal</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm overflow-hidden">
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="text-xs font-semibold">Date</TableHead>
                  <TableHead className="text-xs font-semibold">Heure</TableHead>
                  <TableHead className="text-xs font-semibold">Type</TableHead>
                  <TableHead className="text-xs font-semibold">Référence</TableHead>
                  <TableHead className="text-xs font-semibold">Utilisateur</TableHead>
                  <TableHead className="text-xs font-semibold">Description</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Entrée</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Sortie</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Solde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journalEntries.map((entry, i) => (
                  <motion.tr
                    key={entry.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <TableCell className="text-sm">{formatDate(entry.dateOperation)}</TableCell>
                    <TableCell className="text-sm text-slate-500">{formatTime(entry.dateOperation)}</TableCell>
                    <TableCell><JournalTypeBadge type={entry.type} /></TableCell>
                    <TableCell className="text-sm text-slate-500">{entry.reference || '—'}</TableCell>
                    <TableCell className="text-sm font-medium">{entry.employe.nom}</TableCell>
                    <TableCell className="text-sm text-slate-600 max-w-[200px] truncate">{entry.description || '—'}</TableCell>
                    <TableCell className="text-sm font-semibold text-right text-emerald-600">
                      {entry.montantEntree > 0 ? formatDA(entry.montantEntree) : '—'}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-right text-red-600">
                      {entry.montantSortie > 0 ? formatDA(entry.montantSortie) : '—'}
                    </TableCell>
                    <TableCell className="text-sm font-bold text-right text-[#134885]">{formatDA(entry.soldeApres)}</TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}
    </motion.div>
  )

  // ─── Render: Expenses Tab ──────────────────────────────────

  const renderExpenses = () => (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-600">
          {expenses.length} dépense(s) enregistrée(s)
        </h3>
        <Button
          onClick={() => setShowExpenseDialog(true)}
          className="bg-[#F6852A] hover:bg-[#e8751a] text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          Ajouter une dépense
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#134885]" />
        </div>
      ) : expenses.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Receipt className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-sm text-slate-500">Aucune dépense enregistrée</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {expenses.map((expense, i) => {
            const catConfig = getExpenseCategoryConfig(expense.categorie)
            const CatIcon = catConfig.icon
            return (
              <motion.div
                key={expense.id}
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: i * 0.05 }}
              >
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${catConfig.color}`}>
                          <CatIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{catConfig.label}</p>
                          <p className="text-xs text-slate-500">{formatDate(expense.createdAt)}</p>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-red-600">{formatDA(expense.montant)}</p>
                    </div>
                    {expense.description && (
                      <p className="mt-2 text-xs text-slate-500 line-clamp-2">{expense.description}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-400">Par {expense.creePar.nom}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.div>
  )

  // ─── Render: Deposits Tab ──────────────────────────────────

  const renderDeposits = () => (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-600">
          {deposits.length} dépôt(s) bancaire(s)
        </h3>
        <Button
          onClick={() => setShowDepositDialog(true)}
          className="bg-[#F6852A] hover:bg-[#e8751a] text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          Effectuer un dépôt
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#134885]" />
        </div>
      ) : deposits.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-sm text-slate-500">Aucun dépôt bancaire enregistré</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm overflow-hidden">
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="text-xs font-semibold">Date</TableHead>
                  <TableHead className="text-xs font-semibold">Banque</TableHead>
                  <TableHead className="text-xs font-semibold">Compte</TableHead>
                  <TableHead className="text-xs font-semibold">Référence</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Montant</TableHead>
                  <TableHead className="text-xs font-semibold">Observation</TableHead>
                  <TableHead className="text-xs font-semibold">Par</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deposits.map((deposit, i) => (
                  <motion.tr
                    key={deposit.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <TableCell className="text-sm">{formatDate(deposit.createdAt)}</TableCell>
                    <TableCell className="text-sm font-medium">{deposit.banque}</TableCell>
                    <TableCell className="text-sm text-slate-500">{deposit.compte || '—'}</TableCell>
                    <TableCell className="text-sm text-slate-500">{deposit.reference || '—'}</TableCell>
                    <TableCell className="text-sm font-semibold text-right text-red-600">{formatDA(deposit.montant)}</TableCell>
                    <TableCell className="text-sm text-slate-500 max-w-[200px] truncate">{deposit.observation || '—'}</TableCell>
                    <TableCell className="text-sm text-slate-600">{deposit.creePar.nom}</TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}
    </motion.div>
  )

  // ─── Render: Audit Tab ─────────────────────────────────────

  const renderAudit = () => (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#134885]" />
        </div>
      ) : auditLogs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <History className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-sm text-slate-500">Aucune activité enregistrée</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm overflow-hidden">
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="text-xs font-semibold">Date</TableHead>
                  <TableHead className="text-xs font-semibold">Type d&apos;entité</TableHead>
                  <TableHead className="text-xs font-semibold">Action</TableHead>
                  <TableHead className="text-xs font-semibold">Utilisateur</TableHead>
                  <TableHead className="text-xs font-semibold">Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log, i) => (
                  <motion.tr
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <TableCell className="text-sm">{formatDateTime(log.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {AUDIT_ENTITY_LABELS[log.entityType] || log.entityType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          log.action === 'validate' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          log.action === 'refuse' ? 'bg-red-50 text-red-700 border-red-200' :
                          log.action === 'create' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {AUDIT_ACTION_LABELS[log.action] || log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{log.employe.nom}</TableCell>
                    <TableCell className="text-sm text-slate-500 max-w-[250px] truncate">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}
    </motion.div>
  )

  // ─── Main Render ───────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur-sm">
        <div className="px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#134885]/10">
              <Wallet className="h-5 w-5 text-[#134885]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Gestion de Caisse</h1>
              <p className="text-xs text-slate-500">Suivi des encaissements, dépenses et dépôts bancaires</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 flex h-auto flex-wrap gap-1 bg-slate-100/80 p-1 rounded-lg">
            <TabsTrigger value="dashboard" className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#134885]">
              <BarChart3 className="h-3.5 w-3.5" />
              Tableau de bord
            </TabsTrigger>
            <TabsTrigger value="encaissements" className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#134885]">
              <TrendingUp className="h-3.5 w-3.5" />
              Encaissements
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="journal" className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#134885]">
                <FileText className="h-3.5 w-3.5" />
                Journal de caisse
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="depenses" className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#134885]">
                <Receipt className="h-3.5 w-3.5" />
                Dépenses
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="depots" className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#134885]">
                <Landmark className="h-3.5 w-3.5" />
                Dépôts bancaires
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="historique" className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#134885]">
                <History className="h-3.5 w-3.5" />
                Historique
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="dashboard">{renderDashboard()}</TabsContent>
          <TabsContent value="encaissements">{renderPayments()}</TabsContent>
          <TabsContent value="journal">{renderJournal()}</TabsContent>
          <TabsContent value="depenses">{renderExpenses()}</TabsContent>
          <TabsContent value="depots">{renderDeposits()}</TabsContent>
          <TabsContent value="historique">{renderAudit()}</TabsContent>
        </Tabs>
      </div>

      {/* ─── Dialog: Create Payment ─────────────────────────── */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#134885]">
              <Wallet className="h-5 w-5" />
              Déclarer un encaissement
            </DialogTitle>
            <DialogDescription>
              Remplissez les informations de l&apos;encaissement. Il sera soumis à validation par un administrateur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="payment-montant" className="text-sm font-medium">
                Montant (DA) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="payment-montant"
                type="number"
                min="0"
                step="100"
                placeholder="0"
                value={paymentForm.montant}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, montant: e.target.value }))}
                className="text-lg font-semibold"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payment-reference" className="text-sm font-medium">Référence</Label>
                <Input
                  id="payment-reference"
                  placeholder="N° facture, bon..."
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-date" className="text-sm font-medium">Date de paiement</Label>
                <Input
                  id="payment-date"
                  type="date"
                  value={paymentForm.datePaiement}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, datePaiement: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="payment-description"
                placeholder="Détails sur l'encaissement..."
                rows={3}
                value={paymentForm.description}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              onClick={handleCreatePayment}
              disabled={submitting}
              className="bg-[#F6852A] hover:bg-[#e8751a] text-white gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Déclarer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Payment Detail ─────────────────────────── */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[550px]">
          {selectedPayment && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-[#134885]" />
                  Détail de l&apos;encaissement
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Montant</p>
                    <p className="text-2xl font-bold text-[#134885]">{formatDA(selectedPayment.montant)}</p>
                  </div>
                  <StatusBadge statut={selectedPayment.statut} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Employé</p>
                    <p className="text-sm font-medium">{selectedPayment.creePar.nom}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Date de paiement</p>
                    <p className="text-sm font-medium">{formatDate(selectedPayment.datePaiement)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Client</p>
                    <p className="text-sm font-medium">
                      {selectedPayment.prospect ? selectedPayment.prospect.nom : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Référence</p>
                    <p className="text-sm font-medium">{selectedPayment.reference || '—'}</p>
                  </div>
                  {selectedPayment.validePar && (
                    <div>
                      <p className="text-xs text-slate-500">Validé par</p>
                      <p className="text-sm font-medium">{selectedPayment.validePar.nom}</p>
                    </div>
                  )}
                  {selectedPayment.dateValidation && (
                    <div>
                      <p className="text-xs text-slate-500">Date de validation</p>
                      <p className="text-sm font-medium">{formatDateTime(selectedPayment.dateValidation)}</p>
                    </div>
                  )}
                </div>

                {selectedPayment.description && (
                  <div>
                    <p className="text-xs text-slate-500">Description</p>
                    <p className="text-sm text-slate-700 mt-1">{selectedPayment.description}</p>
                  </div>
                )}

                {selectedPayment.motifRefus && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      <p className="text-xs font-semibold uppercase">Motif de refus</p>
                    </div>
                    <p className="mt-1 text-sm text-red-600">{selectedPayment.motifRefus}</p>
                  </div>
                )}
              </div>

              {isAdmin && selectedPayment.statut === 'en_attente' && (
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => { setShowDetailDialog(false); setShowRefuseDialog(true) }}
                  >
                    <XCircle className="h-4 w-4" />
                    Refuser
                  </Button>
                  <Button
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleValidatePayment(selectedPayment.id)}
                    disabled={submitting}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Valider
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Refuse Payment ─────────────────────────── */}
      <Dialog open={showRefuseDialog} onOpenChange={setShowRefuseDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Refuser l&apos;encaissement
            </DialogTitle>
            <DialogDescription>
              Veuillez indiquer le motif de refus. L&apos;employé sera notifié.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedPayment && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Montant</p>
                <p className="text-lg font-bold text-[#134885]">{formatDA(selectedPayment.montant)}</p>
                <p className="text-xs text-slate-500 mt-1">Par {selectedPayment.creePar.nom}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="refuse-motif" className="text-sm font-medium">
                Motif de refus <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="refuse-motif"
                placeholder="Expliquez la raison du refus..."
                rows={3}
                value={refuseMotif}
                onChange={(e) => setRefuseMotif(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRefuseDialog(false); setRefuseMotif('') }}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleRefusePayment}
              disabled={submitting || !refuseMotif.trim()}
              className="gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Create Expense ─────────────────────────── */}
      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#134885]">
              <Receipt className="h-5 w-5" />
              Ajouter une dépense
            </DialogTitle>
            <DialogDescription>
              Enregistrez une sortie de caisse. Le solde sera mis à jour automatiquement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Catégorie <span className="text-red-500">*</span></Label>
              <Select value={expenseForm.categorie} onValueChange={(v) => setExpenseForm(prev => ({ ...prev, categorie: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="flex items-center gap-2">
                        {cat.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-montant" className="text-sm font-medium">
                Montant (DA) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="expense-montant"
                type="number"
                min="0"
                step="100"
                placeholder="0"
                value={expenseForm.montant}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, montant: e.target.value }))}
                className="text-lg font-semibold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="expense-description"
                placeholder="Détails de la dépense..."
                rows={3}
                value={expenseForm.description}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExpenseDialog(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateExpense}
              disabled={submitting}
              className="bg-[#F6852A] hover:bg-[#e8751a] text-white gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Create Deposit ─────────────────────────── */}
      <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#134885]">
              <Landmark className="h-5 w-5" />
              Effectuer un dépôt bancaire
            </DialogTitle>
            <DialogDescription>
              Enregistrez un dépôt en banque. Le montant sera déduit du solde de caisse.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deposit-montant" className="text-sm font-medium">
                Montant (DA) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="deposit-montant"
                type="number"
                min="0"
                step="100"
                placeholder="0"
                value={depositForm.montant}
                onChange={(e) => setDepositForm(prev => ({ ...prev, montant: e.target.value }))}
                className="text-lg font-semibold"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deposit-banque" className="text-sm font-medium">
                  Banque <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="deposit-banque"
                  placeholder="BNA, CPA, BDL..."
                  value={depositForm.banque}
                  onChange={(e) => setDepositForm(prev => ({ ...prev, banque: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deposit-compte" className="text-sm font-medium">N° Compte</Label>
                <Input
                  id="deposit-compte"
                  placeholder="Numéro de compte"
                  value={depositForm.compte}
                  onChange={(e) => setDepositForm(prev => ({ ...prev, compte: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deposit-reference" className="text-sm font-medium">Référence</Label>
              <Input
                id="deposit-reference"
                placeholder="N° de bordereau..."
                value={depositForm.reference}
                onChange={(e) => setDepositForm(prev => ({ ...prev, reference: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deposit-observation" className="text-sm font-medium">Observation</Label>
              <Textarea
                id="deposit-observation"
                placeholder="Notes supplémentaires..."
                rows={2}
                value={depositForm.observation}
                onChange={(e) => setDepositForm(prev => ({ ...prev, observation: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepositDialog(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateDeposit}
              disabled={submitting}
              className="bg-[#F6852A] hover:bg-[#e8751a] text-white gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Enregistrer le dépôt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CashManagement
