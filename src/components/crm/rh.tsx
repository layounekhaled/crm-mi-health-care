'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useCRMStore } from '@/lib/store'
import { ModuleHeader } from '@/components/crm/module-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Filter,
  Sun,
  Moon,
  PartyPopper,
  Plane,
  Briefcase,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Users,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────
interface LeaveRequest {
  id: string
  employeeId: string
  type: string
  startDate: string
  endDate: string
  daysCount: number
  reason: string | null
  attachmentUrl: string | null
  status: string
  adminComment: string | null
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
  employee?: { id: string; nom: string; email: string | null }
  approver?: { id: string; nom: string } | null
}

interface LeaveMovement {
  id: string
  employeeId: string
  type: string
  value: number
  sourceId: string | null
  date: string
  createdAt: string
  employee?: { id: string; nom: string; email: string | null }
  source?: { id: string; type: string; status: string } | null
}

interface CalendarDay {
  id: string
  date: string
  type: string
  label: string | null
  createdAt: string
}

interface BalanceData {
  employeeId: string
  employeeNom: string
  solde: number
  breakdown: {
    annualCredit: number
    leaveTaken: number
    absenceTaken: number
    recoveryEarned: number
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────
const typeLabels: Record<string, string> = {
  leave: 'Congé',
  absence: 'Absence',
  recovery_work: 'Récupération',
}

const movementTypeLabels: Record<string, string> = {
  leave: 'Congé pris',
  absence: 'Absence',
  recovery: 'Récupération',
  annual_credit: 'Crédit annuel',
  adjustment: 'Ajustement',
}

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Refusée',
}

const statusBadgeClass: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

const dayTypeLabels: Record<string, string> = {
  working_day: 'Jour ouvré',
  weekend: 'Week-end (Ven-Sam)',
  holiday: 'Jour férié',
}

const dayTypeColors: Record<string, string> = {
  working_day: 'bg-green-100 text-green-800 border-green-200',
  weekend: 'bg-slate-100 text-slate-600 border-slate-200',
  holiday: 'bg-red-100 text-red-800 border-red-200',
}

const dayTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  working_day: Sun,
  weekend: Moon,
  holiday: PartyPopper,
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'leave':
      return Plane
    case 'absence':
      return AlertCircle
    case 'recovery_work':
      return Briefcase
    default:
      return Calendar
  }
}

// ─── Component ───────────────────────────────────────────────────────
export default function RHModule() {
  const { user } = useAuth()
  const isAdminUser = user?.role === 'admin'

  // ─── State ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(
    isAdminUser ? 'dashboard' : 'dashboard'
  )
  const [loading, setLoading] = useState(false)

  // Requests
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [requestTotal, setRequestTotal] = useState(0)
  const [requestPage, setRequestPage] = useState(1)
  const [requestFilter, setRequestFilter] = useState({
    status: '',
    type: '',
    employeeId: '',
  })

  // Balances
  const [balances, setBalances] = useState<BalanceData[]>([])
  const [myBalance, setMyBalance] = useState<BalanceData | null>(null)
  const [balanceSearch, setBalanceSearch] = useState('')

  // Movements
  const [movements, setMovements] = useState<LeaveMovement[]>([])
  const [movementPage, setMovementPage] = useState(1)
  const [movementTotal, setMovementTotal] = useState(0)
  const [movementFilter, setMovementFilter] = useState({
    employeeId: '',
    type: '',
  })

  // Calendar
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())

  // Dialogs
  const [showNewRequest, setShowNewRequest] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [showAddHoliday, setShowAddHoliday] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
  const [adminComment, setAdminComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // New request form
  const [newRequest, setNewRequest] = useState({
    type: 'leave',
    startDate: '',
    endDate: '',
    daysCount: 1,
    reason: '',
  })

  // Holiday form
  const [holidayForm, setHolidayForm] = useState({
    date: '',
    label: '',
  })

  // ─── Fetch functions ──────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(requestPage))
      params.set('limit', '20')
      if (requestFilter.status) params.set('status', requestFilter.status)
      if (requestFilter.type) params.set('type', requestFilter.type)
      if (requestFilter.employeeId) params.set('employeeId', requestFilter.employeeId)

      const res = await fetch(`/api/rh/requests?${params}`, {
        credentials: 'same-origin',
      })
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests || [])
        setRequestTotal(data.pagination?.total || 0)
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoading(false)
    }
  }, [requestPage, requestFilter])

  const fetchBalances = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/rh/balances', {
        credentials: 'same-origin',
      })
      if (res.ok) {
        const data = await res.json()
        if (isAdminUser) {
          setBalances(data.employees || [])
        } else {
          setMyBalance(data)
        }
      }
    } catch (error) {
      console.error('Error fetching balances:', error)
    } finally {
      setLoading(false)
    }
  }, [isAdminUser])

  const fetchMovements = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(movementPage))
      params.set('limit', '20')
      if (movementFilter.employeeId) params.set('employeeId', movementFilter.employeeId)
      if (movementFilter.type) params.set('type', movementFilter.type)

      const res = await fetch(`/api/rh/movements?${params}`, {
        credentials: 'same-origin',
      })
      if (res.ok) {
        const data = await res.json()
        setMovements(data.movements || [])
        setMovementTotal(data.pagination?.total || 0)
      }
    } catch (error) {
      console.error('Error fetching movements:', error)
    } finally {
      setLoading(false)
    }
  }, [movementPage, movementFilter])

  const fetchCalendar = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('year', String(calendarYear))
      params.set('month', String(calendarMonth + 1))

      const res = await fetch(`/api/rh/calendar?${params}`, {
        credentials: 'same-origin',
      })
      if (res.ok) {
        const data = await res.json()
        setCalendarDays(data.days || [])
      }
    } catch (error) {
      console.error('Error fetching calendar:', error)
    }
  }, [calendarYear, calendarMonth])

  // ─── Effects ─────────────────────────────────────────────────────
  useEffect(() => {
    fetchBalances()
  }, [fetchBalances])

  useEffect(() => {
    if (activeTab === 'dashboard' || activeTab === 'demandes' || activeTab === 'mes-demandes') {
      fetchRequests()
    }
  }, [activeTab, fetchRequests])

  useEffect(() => {
    if (activeTab === 'mouvements') {
      fetchMovements()
    }
  }, [activeTab, fetchMovements])

  useEffect(() => {
    if (activeTab === 'calendrier') {
      fetchCalendar()
    }
  }, [activeTab, fetchCalendar])

  // ─── Actions ─────────────────────────────────────────────────────
  const handleCreateRequest = async () => {
    if (!newRequest.startDate || !newRequest.endDate) {
      toast.error('Veuillez remplir les dates')
      return
    }
    if (new Date(newRequest.startDate) > new Date(newRequest.endDate)) {
      toast.error('La date de début doit être antérieure à la date de fin')
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch('/api/rh/requests', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newRequest.type,
          startDate: newRequest.startDate,
          endDate: newRequest.endDate,
          daysCount: newRequest.daysCount,
          reason: newRequest.reason || null,
        }),
      })

      if (res.ok) {
        toast.success('Demande créée avec succès')
        setShowNewRequest(false)
        setNewRequest({ type: 'leave', startDate: '', endDate: '', daysCount: 1, reason: '' })
        fetchRequests()
        fetchBalances()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la création')
      }
    } catch (error) {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedRequest) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/rh/requests/${selectedRequest.id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', adminComment }),
      })
      if (res.ok) {
        toast.success('Demande approuvée')
        setShowApproveDialog(false)
        setAdminComment('')
        setSelectedRequest(null)
        fetchRequests()
        fetchBalances()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedRequest) return
    if (!adminComment.trim()) {
      toast.error('Un commentaire est requis pour refuser')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(`/api/rh/requests/${selectedRequest.id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', adminComment }),
      })
      if (res.ok) {
        toast.success('Demande refusée')
        setShowRejectDialog(false)
        setAdminComment('')
        setSelectedRequest(null)
        fetchRequests()
        fetchBalances()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddHoliday = async () => {
    if (!holidayForm.date) {
      toast.error('Veuillez sélectionner une date')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch('/api/rh/calendar', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: [{ date: holidayForm.date, type: 'holiday', label: holidayForm.label || undefined }],
        }),
      })
      if (res.ok) {
        toast.success('Jour férié ajouté')
        setShowAddHoliday(false)
        setHolidayForm({ date: '', label: '' })
        fetchCalendar()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(false)
    }
  }

  // Jours fériés officiels d'Algérie
  // Les dates religieuses (Aïd, Achoura, Mawloud, Nouvel an hidjri) changent chaque année
  const getAlgeriaHolidays = (year: number): Record<string, string> => {
    const holidays: Record<string, string> = {}

    // ── Jours fériés fixes ──
    holidays[`${year}-01-01`] = 'Nouvel an'
    holidays[`${year}-01-12`] = 'Yennayer (Nouvel an amazigh)'
    holidays[`${year}-05-01`] = 'Fête du travail'
    holidays[`${year}-07-05`] = "Fête de l'indépendance"
    holidays[`${year}-11-01`] = 'Fête de la Révolution'

    // ── Jours fériés religieux 2025 ──
    if (year === 2025) {
      holidays['2025-03-30'] = 'Aïd el-Fitr'
      holidays['2025-03-31'] = 'Aïd el-Fitr (2ème jour)'
      holidays['2025-04-01'] = 'Aïd el-Fitr (3ème jour)'
      holidays['2025-06-06'] = 'Aïd el-Adha'
      holidays['2025-06-07'] = 'Aïd el-Adha (2ème jour)'
      holidays['2025-06-08'] = 'Aïd el-Adha (3ème jour)'
      holidays['2025-06-27'] = 'Nouvel an hidjri'
      holidays['2025-07-06'] = 'Achoura'
      holidays['2025-09-05'] = 'Mawlid nabaoui'
    }

    // ── Jours fériés religieux 2026 ──
    if (year === 2026) {
      holidays['2026-03-20'] = 'Aïd el-Fitr'
      holidays['2026-03-21'] = 'Aïd el-Fitr (2ème jour)'
      holidays['2026-03-22'] = 'Aïd el-Fitr (3ème jour)'
      holidays['2026-05-27'] = 'Aïd el-Adha'
      holidays['2026-05-28'] = 'Aïd el-Adha (2ème jour)'
      holidays['2026-05-29'] = 'Aïd el-Adha (3ème jour)'
      holidays['2026-06-17'] = 'Nouvel an hidjri'
      holidays['2026-06-26'] = 'Achoura'
      holidays['2026-08-26'] = 'Mawlid nabaoui'
    }

    // ── Jours fériés religieux 2027 ──
    if (year === 2027) {
      holidays['2027-03-09'] = 'Aïd el-Fitr'
      holidays['2027-03-10'] = 'Aïd el-Fitr (2ème jour)'
      holidays['2027-03-11'] = 'Aïd el-Fitr (3ème jour)'
      holidays['2027-05-16'] = 'Aïd el-Adha'
      holidays['2027-05-17'] = 'Aïd el-Adha (2ème jour)'
      holidays['2027-05-18'] = 'Aïd el-Adha (3ème jour)'
      holidays['2027-06-07'] = 'Nouvel an hidjri'
      holidays['2027-06-16'] = 'Achoura'
      holidays['2027-08-15'] = 'Mawlid nabaoui'
    }

    return holidays
  }

  const handleGenerateCalendar = async () => {
    setActionLoading(true)
    try {
      const days: { date: string; type: string; label?: string }[] = []
      const year = calendarYear
      const holidays = getAlgeriaHolidays(year)

      for (let m = 0; m < 12; m++) {
        const daysInMonth = new Date(year, m + 1, 0).getDate()
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const date = new Date(year, m, d)
          const dayOfWeek = date.getDay()

          // En Algérie, le weekend est vendredi (5) et samedi (6)
          const isWeekend = dayOfWeek === 5 || dayOfWeek === 6
          const holidayLabel = holidays[dateStr]

          if (holidayLabel) {
            days.push({ date: dateStr, type: 'holiday', label: holidayLabel })
          } else if (isWeekend) {
            days.push({ date: dateStr, type: 'weekend' })
          } else {
            days.push({ date: dateStr, type: 'working_day' })
          }
        }
      }

      const res = await fetch('/api/rh/calendar', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      })
      if (res.ok) {
        const data = await res.json()
        const holidayCount = days.filter(d => d.type === 'holiday').length
        const weekendCount = days.filter(d => d.type === 'weekend').length
        toast.success(`Calendrier ${year} généré : ${holidayCount} jour(s) férié(s), ${weekendCount} week-end(s) (ven-sam)`, { duration: 5000 })
        fetchCalendar()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAnnualCredit = async () => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/rh/annual-credit', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: new Date().getFullYear() }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`${data.creditsCreated} crédit(s) créé(s), ${data.creditsSkipped} déjà existant(s)`)
        fetchBalances()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setActionLoading(false)
    }
  }

  // Auto-calculate days count based on date range
  const calculateDaysCount = (start: string, end: string): number => {
    if (!start || !end) return 1
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (startDate > endDate) return 1
    const diffTime = endDate.getTime() - startDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
    return Math.max(1, diffDays)
  }

  // ─── Calendar helpers ────────────────────────────────────────────
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay()
  }

  const getCalendarDayType = (day: number): string | null => {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const found = calendarDays.find((cd) => {
      const cdDate = new Date(cd.date)
      const cdStr = `${cdDate.getFullYear()}-${String(cdDate.getMonth() + 1).padStart(2, '0')}-${String(cdDate.getDate()).padStart(2, '0')}`
      return cdStr === dateStr
    })
    return found?.type || null
  }

  const getCalendarDayLabel = (day: number): string | null => {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const found = calendarDays.find((cd) => {
      const cdDate = new Date(cd.date)
      const cdStr = `${cdDate.getFullYear()}-${String(cdDate.getMonth() + 1).padStart(2, '0')}-${String(cdDate.getDate()).padStart(2, '0')}`
      return cdStr === dateStr
    })
    return found?.label || null
  }

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ]

  // Stats for admin dashboard
  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const approvedThisMonth = requests.filter((r) => {
    if (r.status !== 'approved') return false
    const d = new Date(r.createdAt)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  // Filter balances
  const filteredBalances = balances.filter((b) =>
    b.employeeNom.toLowerCase().includes(balanceSearch.toLowerCase())
  )

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <ModuleHeader
        title="Ressources Humaines"
        subtitle="Gestion des congés, absences & récupération"
        actions={
          <div className="flex items-center gap-2">
            {isAdminUser && (
              <Button
                onClick={handleAnnualCredit}
                disabled={actionLoading}
                variant="outline"
                className="border-[#134885] text-[#134885] hover:bg-[#134885] hover:text-white"
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Crédit annuel
              </Button>
            )}
            {!isAdminUser && (
              <Button
                onClick={() => setActiveTab('nouvelle-demande')}
                className="bg-[#F6852A] hover:bg-[#E5761A] text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle demande
              </Button>
            )}
          </div>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex h-auto flex-wrap gap-1 bg-slate-100 p-1">
            {isAdminUser ? (
              <>
                <TabsTrigger value="dashboard" className="data-[state=active]:bg-[#134885] data-[state=active]:text-white">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Tableau de bord
                </TabsTrigger>
                <TabsTrigger value="demandes" className="data-[state=active]:bg-[#134885] data-[state=active]:text-white">
                  <Clock className="mr-2 h-4 w-4" />
                  Demandes
                </TabsTrigger>
                <TabsTrigger value="soldes" className="data-[state=active]:bg-[#134885] data-[state=active]:text-white">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Soldes
                </TabsTrigger>
                <TabsTrigger value="mouvements" className="data-[state=active]:bg-[#134885] data-[state=active]:text-white">
                  <TrendingDown className="mr-2 h-4 w-4" />
                  Mouvements
                </TabsTrigger>
                <TabsTrigger value="calendrier" className="data-[state=active]:bg-[#134885] data-[state=active]:text-white">
                  <Calendar className="mr-2 h-4 w-4" />
                  Calendrier
                </TabsTrigger>
              </>
            ) : (
              <>
                <TabsTrigger value="dashboard" className="data-[state=active]:bg-[#134885] data-[state=active]:text-white">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Tableau de bord
                </TabsTrigger>
                <TabsTrigger value="mes-demandes" className="data-[state=active]:bg-[#134885] data-[state=active]:text-white">
                  <Clock className="mr-2 h-4 w-4" />
                  Mes demandes
                </TabsTrigger>
                <TabsTrigger value="nouvelle-demande" className="data-[state=active]:bg-[#134885] data-[state=active]:text-white">
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvelle demande
                </TabsTrigger>
                <TabsTrigger value="calendrier" className="data-[state=active]:bg-[#134885] data-[state=active]:text-white">
                  <Calendar className="mr-2 h-4 w-4" />
                  Calendrier
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* ═══════════════════════════════════════════════════════════
              ADMIN DASHBOARD
          ═══════════════════════════════════════════════════════════ */}
          {isAdminUser && activeTab === 'dashboard' && (
            <TabsContent value="dashboard">
              <div className="space-y-6">
                {/* Stats cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-500">Demandes en attente</p>
                          <p className="mt-2 text-3xl font-bold text-slate-900">{pendingCount}</p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                          <AlertCircle className="h-6 w-6 text-amber-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-green-500">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-500">Approuvées ce mois</p>
                          <p className="mt-2 text-3xl font-bold text-slate-900">{approvedThisMonth}</p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-[#134885]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-500">Employés actifs</p>
                          <p className="mt-2 text-3xl font-bold text-slate-900">{balances.length}</p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#134885]/10">
                          <Users className="h-6 w-6 text-[#134885]" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Pending requests */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-lg font-semibold text-[#134885]">
                      Demandes en attente
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#F6852A]"
                      onClick={() => setActiveTab('demandes')}
                    >
                      Voir tout
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {requests.filter((r) => r.status === 'pending').length === 0 ? (
                      <p className="py-8 text-center text-sm text-slate-400">
                        Aucune demande en attente
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {requests
                          .filter((r) => r.status === 'pending')
                          .slice(0, 5)
                          .map((req) => {
                            const TypeIcon = getTypeIcon(req.type)
                            return (
                              <div
                                key={req.id}
                                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-slate-50"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#134885]/10">
                                    <TypeIcon className="h-5 w-5 text-[#134885]" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-900">
                                      {req.employee?.nom || 'Employé'}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {typeLabels[req.type]} · {formatDate(req.startDate)} → {formatDate(req.endDate)} · {req.daysCount}j
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white h-8"
                                    onClick={() => {
                                      setSelectedRequest(req)
                                      setShowApproveDialog(true)
                                    }}
                                  >
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    Approuver
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-8"
                                    onClick={() => {
                                      setSelectedRequest(req)
                                      setShowRejectDialog(true)
                                    }}
                                  >
                                    <XCircle className="mr-1 h-3 w-3" />
                                    Refuser
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* ═══════════════════════════════════════════════════════════
              EMPLOYEE DASHBOARD
          ═══════════════════════════════════════════════════════════ */}
          {!isAdminUser && activeTab === 'dashboard' && (
            <TabsContent value="dashboard">
              <div className="space-y-6">
                {/* Balance cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card className="border-l-4 border-l-[#134885]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-500">Solde actuel</p>
                          <p className="mt-2 text-3xl font-bold text-[#134885]">
                            {myBalance?.solde ?? 0}j
                          </p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#134885]/10">
                          <CalendarDays className="h-6 w-6 text-[#134885]" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-green-500">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-500">Crédit annuel</p>
                          <p className="mt-2 text-3xl font-bold text-green-600">
                            {myBalance?.breakdown?.annualCredit ?? 0}j
                          </p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                          <TrendingUp className="h-6 w-6 text-green-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-red-500">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-500">Congés pris</p>
                          <p className="mt-2 text-3xl font-bold text-red-600">
                            {myBalance?.breakdown?.leaveTaken ?? 0}j
                          </p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                          <Plane className="h-6 w-6 text-red-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-[#F6852A]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-500">Récupérations</p>
                          <p className="mt-2 text-3xl font-bold text-[#F6852A]">
                            {myBalance?.breakdown?.recoveryEarned ?? 0}j
                          </p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F6852A]/10">
                          <Briefcase className="h-6 w-6 text-[#F6852A]" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent requests */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-lg font-semibold text-[#134885]">
                      Demandes récentes
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#F6852A]"
                      onClick={() => setActiveTab('mes-demandes')}
                    >
                      Voir tout
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {requests.length === 0 ? (
                      <p className="py-8 text-center text-sm text-slate-400">
                        Aucune demande pour le moment
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {requests.slice(0, 5).map((req) => {
                          const TypeIcon = getTypeIcon(req.type)
                          return (
                            <div
                              key={req.id}
                              className="flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors hover:bg-slate-50"
                              onClick={() => {
                                setSelectedRequest(req)
                                setShowDetailDialog(true)
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#134885]/10">
                                  <TypeIcon className="h-5 w-5 text-[#134885]" />
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900">
                                    {typeLabels[req.type]}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {formatDate(req.startDate)} → {formatDate(req.endDate)} · {req.daysCount}j
                                  </p>
                                </div>
                              </div>
                              <Badge className={statusBadgeClass[req.status]}>
                                {statusLabels[req.status]}
                              </Badge>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* ═══════════════════════════════════════════════════════════
              ADMIN DEMANDES
          ═══════════════════════════════════════════════════════════ */}
          {isAdminUser && activeTab === 'demandes' && (
            <TabsContent value="demandes">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-lg font-semibold text-[#134885]">
                      Toutes les demandes
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Filter className="h-4 w-4 text-slate-400" />
                      <Select
                        value={requestFilter.status || '__all'}
                        onValueChange={(v) =>
                          setRequestFilter((prev) => ({ ...prev, status: v === '__all' ? '' : v }))
                        }
                      >
                        <SelectTrigger className="h-8 w-[130px]">
                          <SelectValue placeholder="Statut" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all">Tous</SelectItem>
                          <SelectItem value="pending">En attente</SelectItem>
                          <SelectItem value="approved">Approuvée</SelectItem>
                          <SelectItem value="rejected">Refusée</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={requestFilter.type || '__all'}
                        onValueChange={(v) =>
                          setRequestFilter((prev) => ({ ...prev, type: v === '__all' ? '' : v }))
                        }
                      >
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all">Tous</SelectItem>
                          <SelectItem value="leave">Congé</SelectItem>
                          <SelectItem value="absence">Absence</SelectItem>
                          <SelectItem value="recovery_work">Récupération</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[#134885]" />
                    </div>
                  ) : requests.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-400">
                      Aucune demande trouvée
                    </p>
                  ) : (
                    <>
                      <ScrollArea className="max-h-[600px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Employé</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Début</TableHead>
                              <TableHead>Fin</TableHead>
                              <TableHead>Jours</TableHead>
                              <TableHead>Raison</TableHead>
                              <TableHead>Statut</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {requests.map((req) => {
                              const TypeIcon = getTypeIcon(req.type)
                              return (
                                <TableRow key={req.id} className="cursor-pointer hover:bg-slate-50"
                                  onClick={() => {
                                    setSelectedRequest(req)
                                    setShowDetailDialog(true)
                                  }}
                                >
                                  <TableCell className="font-medium">
                                    {req.employee?.nom || '—'}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1.5">
                                      <TypeIcon className="h-4 w-4 text-slate-500" />
                                      {typeLabels[req.type]}
                                    </div>
                                  </TableCell>
                                  <TableCell>{formatDate(req.startDate)}</TableCell>
                                  <TableCell>{formatDate(req.endDate)}</TableCell>
                                  <TableCell>{req.daysCount}</TableCell>
                                  <TableCell className="max-w-[150px] truncate">
                                    {req.reason || '—'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={statusBadgeClass[req.status]}>
                                      {statusLabels[req.status]}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {req.status === 'pending' && (
                                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                          size="sm"
                                          className="bg-green-600 hover:bg-green-700 text-white h-7 px-2"
                                          onClick={() => {
                                            setSelectedRequest(req)
                                            setShowApproveDialog(true)
                                          }}
                                        >
                                          <CheckCircle className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          className="h-7 px-2"
                                          onClick={() => {
                                            setSelectedRequest(req)
                                            setShowRejectDialog(true)
                                          }}
                                        >
                                          <XCircle className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                    {req.status !== 'pending' && (
                                      <span className="text-xs text-slate-400">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                      {/* Pagination */}
                      {requestTotal > 20 && (
                        <div className="flex items-center justify-between pt-4">
                          <p className="text-sm text-slate-500">
                            {requestTotal} résultat(s) · Page {requestPage}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={requestPage <= 1}
                              onClick={() => setRequestPage((p) => Math.max(1, p - 1))}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={requestPage * 20 >= requestTotal}
                              onClick={() => setRequestPage((p) => p + 1)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ═══════════════════════════════════════════════════════════
              EMPLOYEE MES DEMANDES
          ═══════════════════════════════════════════════════════════ */}
          {!isAdminUser && activeTab === 'mes-demandes' && (
            <TabsContent value="mes-demandes">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-lg font-semibold text-[#134885]">
                      Mes demandes
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Select
                        value={requestFilter.status || '__all'}
                        onValueChange={(v) =>
                          setRequestFilter((prev) => ({ ...prev, status: v === '__all' ? '' : v }))
                        }
                      >
                        <SelectTrigger className="h-8 w-[130px]">
                          <SelectValue placeholder="Statut" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all">Tous</SelectItem>
                          <SelectItem value="pending">En attente</SelectItem>
                          <SelectItem value="approved">Approuvée</SelectItem>
                          <SelectItem value="rejected">Refusée</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        className="bg-[#F6852A] hover:bg-[#E5761A] text-white"
                        size="sm"
                        onClick={() => setActiveTab('nouvelle-demande')}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Nouvelle
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[#134885]" />
                    </div>
                  ) : requests.length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-slate-400">
                      <Calendar className="mb-3 h-12 w-12 opacity-30" />
                      <p>Aucune demande trouvée</p>
                      <Button
                        className="mt-4 bg-[#F6852A] hover:bg-[#E5761A] text-white"
                        size="sm"
                        onClick={() => setActiveTab('nouvelle-demande')}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Créer une demande
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[600px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Début</TableHead>
                            <TableHead>Fin</TableHead>
                            <TableHead>Jours</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead>Commentaire</TableHead>
                            <TableHead>Détail</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {requests.map((req) => {
                            const TypeIcon = getTypeIcon(req.type)
                            return (
                              <TableRow key={req.id}>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <TypeIcon className="h-4 w-4 text-slate-500" />
                                    {typeLabels[req.type]}
                                  </div>
                                </TableCell>
                                <TableCell>{formatDate(req.startDate)}</TableCell>
                                <TableCell>{formatDate(req.endDate)}</TableCell>
                                <TableCell>{req.daysCount}</TableCell>
                                <TableCell>
                                  <Badge className={statusBadgeClass[req.status]}>
                                    {statusLabels[req.status]}
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate">
                                  {req.adminComment || '—'}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-[#134885]"
                                    onClick={() => {
                                      setSelectedRequest(req)
                                      setShowDetailDialog(true)
                                    }}
                                  >
                                    Voir
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ═══════════════════════════════════════════════════════════
              NOUVELLE DEMANDE (EMPLOYEE)
          ═══════════════════════════════════════════════════════════ */}
          {!isAdminUser && activeTab === 'nouvelle-demande' && (
            <TabsContent value="nouvelle-demande">
              <Card className="max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-[#134885]">
                    Nouvelle demande
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Type de demande</Label>
                    <Select
                      value={newRequest.type}
                      onValueChange={(v) =>
                        setNewRequest((prev) => ({ ...prev, type: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="leave">
                          <div className="flex items-center gap-2">
                            <Plane className="h-4 w-4" />
                            Congé
                          </div>
                        </SelectItem>
                        <SelectItem value="absence">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Absence
                          </div>
                        </SelectItem>
                        <SelectItem value="recovery_work">
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4" />
                            Travail jour de récupération
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Date début</Label>
                      <Input
                        type="date"
                        value={newRequest.startDate}
                        onChange={(e) => {
                          const start = e.target.value
                          const days = calculateDaysCount(start, newRequest.endDate)
                          setNewRequest((prev) => ({ ...prev, startDate: start, daysCount: days }))
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date fin</Label>
                      <Input
                        type="date"
                        value={newRequest.endDate}
                        onChange={(e) => {
                          const end = e.target.value
                          const days = calculateDaysCount(newRequest.startDate, end)
                          setNewRequest((prev) => ({ ...prev, endDate: end, daysCount: days }))
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Nombre de jours (auto-calculé)
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={newRequest.daysCount}
                      readOnly
                      className="bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200"
                    />
                    <p className="text-xs text-slate-400">
                      Calculé automatiquement à partir de la plage de dates sélectionnée
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Motif (optionnel)</Label>
                    <Textarea
                      value={newRequest.reason}
                      onChange={(e) =>
                        setNewRequest((prev) => ({ ...prev, reason: e.target.value }))
                      }
                      placeholder="Décrivez la raison de votre demande..."
                      rows={3}
                    />
                  </div>

                  {newRequest.type === 'recovery_work' && (
                    <div className="rounded-lg border border-[#F6852A]/30 bg-[#F6852A]/5 p-3">
                      <p className="text-sm text-[#F6852A]">
                        <strong>Note :</strong> Au moins un jour dans la plage sélectionnée doit être un
                        week-end (vendredi-samedi) ou un jour férié pour une récupération.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setNewRequest({ type: 'leave', startDate: '', endDate: '', daysCount: 1, reason: '' })
                      }
                    >
                      Réinitialiser
                    </Button>
                    <Button
                      className="bg-[#F6852A] hover:bg-[#E5761A] text-white"
                      onClick={handleCreateRequest}
                      disabled={actionLoading || !newRequest.startDate || !newRequest.endDate}
                    >
                      {actionLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Soumettre
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ═══════════════════════════════════════════════════════════
              ADMIN SOLDES
          ═══════════════════════════════════════════════════════════ */}
          {isAdminUser && activeTab === 'soldes' && (
            <TabsContent value="soldes">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-lg font-semibold text-[#134885]">
                      Soldes des employés
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Rechercher un employé..."
                        value={balanceSearch}
                        onChange={(e) => setBalanceSearch(e.target.value)}
                        className="h-8 w-[200px]"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[#134885]" />
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[600px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employé</TableHead>
                            <TableHead className="text-right">Solde</TableHead>
                            <TableHead className="text-right">Crédit annuel</TableHead>
                            <TableHead className="text-right">Congés pris</TableHead>
                            <TableHead className="text-right">Absences</TableHead>
                            <TableHead className="text-right">Récupérations</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredBalances.map((bal) => (
                            <TableRow key={bal.employeeId}>
                              <TableCell className="font-medium">{bal.employeeNom}</TableCell>
                              <TableCell className="text-right">
                                <span
                                  className={`font-bold ${
                                    bal.solde >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}
                                >
                                  {bal.solde}j
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-green-600">
                                +{bal.breakdown.annualCredit}j
                              </TableCell>
                              <TableCell className="text-right text-red-600">
                                -{bal.breakdown.leaveTaken}j
                              </TableCell>
                              <TableCell className="text-right text-red-600">
                                -{bal.breakdown.absenceTaken}j
                              </TableCell>
                              <TableCell className="text-right text-[#F6852A]">
                                +{bal.breakdown.recoveryEarned}j
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ═══════════════════════════════════════════════════════════
              ADMIN MOUVEMENTS
          ═══════════════════════════════════════════════════════════ */}
          {isAdminUser && activeTab === 'mouvements' && (
            <TabsContent value="mouvements">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-lg font-semibold text-[#134885]">
                      Historique des mouvements
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={movementFilter.type || '__all'}
                        onValueChange={(v) =>
                          setMovementFilter((prev) => ({ ...prev, type: v === '__all' ? '' : v }))
                        }
                      >
                        <SelectTrigger className="h-8 w-[150px]">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all">Tous</SelectItem>
                          <SelectItem value="annual_credit">Crédit annuel</SelectItem>
                          <SelectItem value="leave">Congé pris</SelectItem>
                          <SelectItem value="absence">Absence</SelectItem>
                          <SelectItem value="recovery">Récupération</SelectItem>
                          <SelectItem value="adjustment">Ajustement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[#134885]" />
                    </div>
                  ) : movements.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-400">
                      Aucun mouvement trouvé
                    </p>
                  ) : (
                    <>
                      <ScrollArea className="max-h-[600px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Employé</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">Valeur</TableHead>
                              <TableHead>Source</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {movements.map((mov) => (
                              <TableRow key={mov.id}>
                                <TableCell>{formatDate(mov.date)}</TableCell>
                                <TableCell className="font-medium">
                                  {mov.employee?.nom || '—'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {movementTypeLabels[mov.type] || mov.type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <span
                                    className={`font-bold ${
                                      mov.value > 0 ? 'text-green-600' : 'text-red-600'
                                    }`}
                                  >
                                    {mov.value > 0 ? '+' : ''}
                                    {mov.value}j
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm text-slate-500">
                                  {mov.source
                                    ? `${typeLabels[mov.source.type] || mov.source.type} (${statusLabels[mov.source.status] || mov.source.status})`
                                    : '—'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                      {movementTotal > 20 && (
                        <div className="flex items-center justify-between pt-4">
                          <p className="text-sm text-slate-500">
                            {movementTotal} résultat(s) · Page {movementPage}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={movementPage <= 1}
                              onClick={() => setMovementPage((p) => Math.max(1, p - 1))}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={movementPage * 20 >= movementTotal}
                              onClick={() => setMovementPage((p) => p + 1)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ═══════════════════════════════════════════════════════════
              CALENDRIER (EMPLOYEE + ADMIN)
          ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'calendrier' && (
            <TabsContent value="calendrier">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <CardTitle className="text-lg font-semibold text-[#134885]">
                        Calendrier
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {isAdminUser && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-[#134885] text-[#134885]"
                              onClick={handleGenerateCalendar}
                              disabled={actionLoading}
                            >
                              {actionLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <CalendarDays className="mr-2 h-4 w-4" />
                              )}
                              Générer {calendarYear}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-[#F6852A] text-[#F6852A]"
                              onClick={() => setShowAddHoliday(true)}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Jour férié
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Calendar navigation */}
                    <div className="mb-6 flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (calendarMonth === 0) {
                            setCalendarMonth(11)
                            setCalendarYear((y) => y - 1)
                          } else {
                            setCalendarMonth((m) => m - 1)
                          }
                        }}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <h3 className="text-lg font-semibold text-[#134885]">
                        {monthNames[calendarMonth]} {calendarYear}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (calendarMonth === 11) {
                            setCalendarMonth(0)
                            setCalendarYear((y) => y + 1)
                          } else {
                            setCalendarMonth((m) => m + 1)
                          }
                        }}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>

                    {/* Legend */}
                    <div className="mb-4 flex flex-wrap items-center gap-4">
                      {Object.entries(dayTypeLabels).map(([type, label]) => {
                        const Icon = dayTypeIcons[type]
                        return (
                          <div key={type} className="flex items-center gap-1.5">
                            <div className={`flex h-5 w-5 items-center justify-center rounded text-[10px] ${dayTypeColors[type]}`}>
                              <Icon className="h-3 w-3" />
                            </div>
                            <span className="text-xs text-slate-600">{label}</span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                        <div
                          key={day}
                          className="flex h-8 items-center justify-center text-xs font-medium text-slate-500"
                        >
                          {day}
                        </div>
                      ))}
                      {Array.from({ length: getDaysInMonth(calendarYear, calendarMonth) }).map(
                        (_, i) => {
                          const day = i + 1
                          const dayType = getCalendarDayType(day)
                          const dayLabel = getCalendarDayLabel(day)
                          const firstDay = getFirstDayOfMonth(calendarYear, calendarMonth)
                          // Adjust for Monday start (0=Mon, 6=Sun)
                          const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1
                          const offset = day === 1 ? adjustedFirstDay : 0

                          return day === 1 ? (
                            <div key={`offset-${day}`} style={{ gridColumnStart: offset + 1 }}>
                              <div
                                className={`flex h-10 items-center justify-center rounded-md border text-sm ${
                                  dayType
                                    ? dayTypeColors[dayType]
                                    : 'border-slate-200 text-slate-700'
                                } ${dayLabel ? 'cursor-default' : ''}`}
                                title={dayLabel || undefined}
                              >
                                {day}
                              </div>
                            </div>
                          ) : (
                            <div
                              key={day}
                              className={`flex h-10 items-center justify-center rounded-md border text-sm ${
                                dayType
                                  ? dayTypeColors[dayType]
                                  : 'border-slate-200 text-slate-700'
                              } ${dayLabel ? 'cursor-default' : ''}`}
                              title={dayLabel || undefined}
                            >
                              {day}
                            </div>
                          )
                        }
                      )}
                    </div>

                    {/* Holidays list for this month */}
                    {calendarDays.filter((d) => d.type === 'holiday').length > 0 && (
                      <div className="mt-6">
                        <h4 className="mb-3 text-sm font-medium text-slate-700">
                          Jours fériés ce mois
                        </h4>
                        <div className="space-y-2">
                          {calendarDays
                            .filter((d) => d.type === 'holiday')
                            .map((d) => (
                              <div
                                key={d.id}
                                className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3"
                              >
                                <PartyPopper className="h-5 w-5 text-red-600" />
                                <div>
                                  <p className="font-medium text-red-800">
                                    {d.label || 'Jour férié'}
                                  </p>
                                  <p className="text-xs text-red-600">
                                    {formatDate(d.date)}
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          DIALOGS
      ═══════════════════════════════════════════════════════════════ */}

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#134885]">Détail de la demande</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500">Employé</Label>
                  <p className="font-medium">{selectedRequest.employee?.nom || '—'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Type</Label>
                  <p className="font-medium">{typeLabels[selectedRequest.type]}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Date début</Label>
                  <p className="font-medium">{formatDate(selectedRequest.startDate)}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Date fin</Label>
                  <p className="font-medium">{formatDate(selectedRequest.endDate)}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Nombre de jours</Label>
                  <p className="font-medium">{selectedRequest.daysCount} jour(s)</p>
                </div>
                <div>
                  <Label className="text-slate-500">Statut</Label>
                  <Badge className={statusBadgeClass[selectedRequest.status]}>
                    {statusLabels[selectedRequest.status]}
                  </Badge>
                </div>
              </div>
              {selectedRequest.reason && (
                <div>
                  <Label className="text-slate-500">Motif</Label>
                  <p className="mt-1 rounded-lg bg-slate-50 p-3 text-sm">
                    {selectedRequest.reason}
                  </p>
                </div>
              )}
              {selectedRequest.adminComment && (
                <div>
                  <Label className="text-slate-500">Commentaire admin</Label>
                  <p className="mt-1 rounded-lg bg-slate-50 p-3 text-sm">
                    {selectedRequest.adminComment}
                  </p>
                </div>
              )}
              {selectedRequest.approver && (
                <div>
                  <Label className="text-slate-500">Traité par</Label>
                  <p className="font-medium">{selectedRequest.approver.nom}</p>
                </div>
              )}
              {selectedRequest.approvedAt && (
                <div>
                  <Label className="text-slate-500">Date de traitement</Label>
                  <p className="font-medium">{formatDate(selectedRequest.approvedAt)}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-700">Approuver la demande</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 p-3">
                <p className="font-medium text-green-800">
                  {selectedRequest.employee?.nom} — {typeLabels[selectedRequest.type]}
                </p>
                <p className="text-sm text-green-600">
                  {formatDate(selectedRequest.startDate)} → {formatDate(selectedRequest.endDate)} ·{' '}
                  {selectedRequest.daysCount}j
                </p>
              </div>
              <div className="space-y-2">
                <Label>Commentaire (optionnel)</Label>
                <Textarea
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  placeholder="Ajouter un commentaire..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowApproveDialog(false)
                setAdminComment('')
              }}
            >
              Annuler
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleApprove}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700">Refuser la demande</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 p-3">
                <p className="font-medium text-red-800">
                  {selectedRequest.employee?.nom} — {typeLabels[selectedRequest.type]}
                </p>
                <p className="text-sm text-red-600">
                  {formatDate(selectedRequest.startDate)} → {formatDate(selectedRequest.endDate)} ·{' '}
                  {selectedRequest.daysCount}j
                </p>
              </div>
              <div className="space-y-2">
                <Label>
                  Motif du refus <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  placeholder="Expliquez pourquoi cette demande est refusée..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false)
                setAdminComment('')
              }}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading || !adminComment.trim()}
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Refuser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Holiday Dialog */}
      <Dialog open={showAddHoliday} onOpenChange={setShowAddHoliday}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#134885]">Ajouter un jour férié</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={holidayForm.date}
                onChange={(e) => setHolidayForm((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Libellé</Label>
              <Input
                value={holidayForm.label}
                onChange={(e) => setHolidayForm((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="Ex: Jour de l'an, Fête de l'indépendance..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddHoliday(false)}
            >
              Annuler
            </Button>
            <Button
              className="bg-[#F6852A] hover:bg-[#E5761A] text-white"
              onClick={handleAddHoliday}
              disabled={actionLoading || !holidayForm.date}
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
