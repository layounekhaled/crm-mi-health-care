'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Package,
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Filter,
  X,
  TrendingUp,
  Clock,
  CheckCircle2,
  BarChart3,
  CalendarDays,
  DollarSign,
  User,
  Briefcase,
  Tag,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

import { Card, CardContent } from '@/components/ui/card'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { useIsMobile } from '@/hooks/use-mobile'

// ─── Types ───────────────────────────────────────────────────────

interface Operation {
  id: string
  opportunityId: string
  produit: string
  marque: string
  prixEstime: number | null
  marge: number | null
  statut: string
  datePrevue: string | null
  priorite: string
  createdAt: string
  updatedAt: string
  opportunity: {
    id: string
    nomProjet: string
    client?: { id: string; nom: string } | null
  }
  responsable?: { id: string; nom: string; role: string } | null
}

interface Opportunity {
  id: string
  nomProjet: string
  statut: string
  client?: { id: string; nom: string } | null
}

interface Employee {
  id: string
  nom: string
  role: string
  actif: boolean
}

// ─── Constants ───────────────────────────────────────────────────

const MARQUES = [
  { value: 'MIR', label: 'MIR', color: 'blue' },
  { value: 'BOS', label: 'BOS', color: 'blue' },
  { value: 'Löwenstein', label: 'Löwenstein', color: 'purple' },
  { value: 'Yuwell', label: 'Yuwell', color: 'amber' },
  { value: 'Gelenke', label: 'Gelenke', color: 'rose' },
] as const

const STATUTS = [
  { value: 'en_attente', label: 'En attente', color: 'amber' },
  { value: 'en_cours', label: 'En cours', color: 'blue' },
  { value: 'termine', label: 'Terminé', color: 'green' },
] as const

const PRIORITES = [
  { value: 'basse', label: 'Basse', color: 'gray' },
  { value: 'moyenne', label: 'Moyenne', color: 'amber' },
  { value: 'haute', label: 'Haute', color: 'red' },
] as const

// ─── Brand Color Mapping ─────────────────────────────────────────

const BRAND_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  MIR: {
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  BOS: {
    bg: 'bg-[#003366]/10 dark:bg-[#003366]/20',
    text: 'text-[#003366] dark:text-[#FF9900]',
    border: 'border-[#003366]/20 dark:border-[#003366]/30',
    dot: 'bg-[#003366]',
  },
  Löwenstein: {
    bg: 'bg-purple-100 dark:bg-purple-900/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    dot: 'bg-purple-500',
  },
  Yuwell: {
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  Gelenke: {
    bg: 'bg-rose-100 dark:bg-rose-900/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
}

const STATUT_COLORS: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  en_attente: {
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    icon: <Clock className="size-3" />,
  },
  en_cours: {
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    icon: <TrendingUp className="size-3" />,
  },
  termine: {
    bg: 'bg-green-100 dark:bg-green-900/40',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
    icon: <CheckCircle2 className="size-3" />,
  },
}

// ─── Valid Status Transitions ────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  en_attente: ['en_cours'],
  en_cours: ['termine'],
  termine: [], // No backward transition
}

const PRIORITE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  basse: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-700',
  },
  moyenne: {
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  haute: {
    bg: 'bg-red-100 dark:bg-red-900/40',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
  },
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatDZD(amount: number | null | undefined): string {
  if (amount == null) return '— DZD'
  return new Intl.NumberFormat('fr-DZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' DZD'
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getBrandColor(marque: string) {
  return BRAND_COLORS[marque] || BRAND_COLORS['MIR']
}

function getStatutLabel(statut: string): string {
  return STATUTS.find(s => s.value === statut)?.label || statut
}

function getPrioriteLabel(priorite: string): string {
  return PRIORITES.find(p => p.value === priorite)?.label || priorite
}

// ─── Badge Components ────────────────────────────────────────────

function MarqueBadge({ marque }: { marque: string }) {
  const colors = getBrandColor(marque)
  return (
    <Badge variant="outline" className={`gap-1 font-medium ${colors.bg} ${colors.text} ${colors.border} hover:${colors.bg}`}>
      <span className={`inline-block size-1.5 rounded-full ${colors.dot}`} />
      {marque}
    </Badge>
  )
}

function StatutBadge({ statut }: { statut: string }) {
  const colors = STATUT_COLORS[statut] || STATUT_COLORS.en_attente
  return (
    <Badge variant="outline" className={`gap-1 font-medium ${colors.bg} ${colors.text} ${colors.border} hover:${colors.bg}`}>
      {colors.icon}
      {getStatutLabel(statut)}
    </Badge>
  )
}

function PrioriteBadge({ priorite }: { priorite: string }) {
  const colors = PRIORITE_COLORS[priorite] || PRIORITE_COLORS.moyenne
  return (
    <Badge variant="outline" className={`font-medium ${colors.bg} ${colors.text} ${colors.border} hover:${colors.bg}`}>
      {getPrioriteLabel(priorite)}
    </Badge>
  )
}

// ─── Quick Status Buttons ─────────────────────────────────────────

function QuickStatusButtons({ statut, operationId, onChange }: { statut: string; operationId: string; onChange: (id: string, newStatut: string) => void }) {
  const transitions = VALID_TRANSITIONS[statut] || []
  if (transitions.length === 0) return null

  return (
    <div className="flex items-center gap-1 ml-1">
      {transitions.map(nextStatut => {
        const nextConfig = STATUT_COLORS[nextStatut]
        if (!nextConfig) return null
        return (
          <button
            key={nextStatut}
            onClick={(e) => {
              e.stopPropagation()
              onChange(operationId, nextStatut)
            }}
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:opacity-80 ${nextConfig.bg} ${nextConfig.text} border ${nextConfig.border}`}
            title={`Passer à "${getStatutLabel(nextStatut)}"`}
          >
            {nextConfig.icon}
            {getStatutLabel(nextStatut)}
          </button>
        )
      })}
    </div>
  )
}

// ─── Loading Skeletons ───────────────────────────────────────────

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
          <CardContent className="p-4">
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-6 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-6 w-16" />
            </div>
            <Skeleton className="h-4 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Form Data Type ──────────────────────────────────────────────

interface OperationFormData {
  opportunityId: string
  produit: string
  marque: string
  responsableId: string
  prixEstime: string
  marge: string
  statut: string
  datePrevue: string
  priorite: string
}

const emptyForm: OperationFormData = {
  opportunityId: '',
  produit: '',
  marque: '',
  responsableId: '',
  prixEstime: '',
  marge: '',
  statut: 'en_attente',
  datePrevue: '',
  priorite: 'moyenne',
}

// ─── Main Component ──────────────────────────────────────────────

export default function OperationsModule() {
  const isMobile = useIsMobile()

  // Data state
  const [operations, setOperations] = useState<Operation[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [filterMarque, setFilterMarque] = useState<string>('tous')
  const [filterStatut, setFilterStatut] = useState<string>('tous')
  const [filterPriorite, setFilterPriorite] = useState<string>('tous')
  const [searchTerm, setSearchTerm] = useState('')

  // Dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formData, setFormData] = useState<OperationFormData>({ ...emptyForm })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Expanded row state
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Track current status for transition guards in edit form
  const [currentStatut, setCurrentStatut] = useState<string>('')

  // Opportunity auto-complete dialog state
  const [opportunityCompleteDialog, setOpportunityCompleteDialog] = useState<{ open: boolean; opportunityId: string; opportunityName: string }>({
    open: false,
    opportunityId: '',
    opportunityName: '',
  })

  // ─── Data Fetching ─────────────────────────────────────────────

  const fetchOperations = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterMarque && filterMarque !== 'tous') params.set('marque', filterMarque)
      if (filterStatut && filterStatut !== 'tous') params.set('statut', filterStatut)

      const res = await fetch(`/api/operations?${params.toString()}`)
      if (!res.ok) throw new Error('Erreur lors du chargement')
      const data = await res.json()
      setOperations(data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch operations:', err)
      setError('Erreur lors du chargement des opérations')
    }
  }, [filterMarque, filterStatut])

  const fetchOpportunities = useCallback(async () => {
    try {
      const res = await fetch('/api/opportunities')
      if (res.ok) {
        const data = await res.json()
        setOpportunities(data)
      }
    } catch (err) {
      console.error('Failed to fetch opportunities:', err)
    }
  }, [])

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees?actif=true')
      if (res.ok) {
        const data = await res.json()
        setEmployees(data)
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchOperations(), fetchOpportunities(), fetchEmployees()])
      setLoading(false)
    }
    load()
  }, [fetchOperations, fetchOpportunities, fetchEmployees])

  // ─── Computed Data ─────────────────────────────────────────────

  const filteredOperations = operations.filter(op => {
    // Priorité filter (client-side since API doesn't support it)
    if (filterPriorite && filterPriorite !== 'tous' && op.priorite !== filterPriorite) {
      return false
    }
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matchProduit = op.produit.toLowerCase().includes(search)
      const matchMarque = op.marque.toLowerCase().includes(search)
      const matchOpportunity = op.opportunity?.nomProjet?.toLowerCase().includes(search)
      const matchClient = op.opportunity?.client?.nom?.toLowerCase().includes(search)
      const matchResponsable = op.responsable?.nom?.toLowerCase().includes(search)
      if (!matchProduit && !matchMarque && !matchOpportunity && !matchClient && !matchResponsable) {
        return false
      }
    }
    return true
  })

  const totalOperations = filteredOperations.length
  const enAttente = filteredOperations.filter(o => o.statut === 'en_attente').length
  const enCours = filteredOperations.filter(o => o.statut === 'en_cours').length
  const terminees = filteredOperations.filter(o => o.statut === 'termine').length

  const marges = filteredOperations.filter(o => o.marge != null).map(o => o.marge!)
  const margeMoyenne = marges.length > 0 ? marges.reduce((sum, m) => sum + m, 0) / marges.length : 0

  const completionRate = totalOperations > 0 ? Math.round((terminees / totalOperations) * 100) : 0

  // ─── Form Handlers ─────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingId(null)
    setFormData({ ...emptyForm })
    setFormErrors({})
    setFormOpen(true)
  }

  const openEditDialog = (op: Operation) => {
    setEditingId(op.id)
    setCurrentStatut(op.statut)  // Track current status for transition guards
    setFormData({
      opportunityId: op.opportunityId,
      produit: op.produit,
      marque: op.marque,
      responsableId: op.responsable?.id || '',
      prixEstime: op.prixEstime?.toString() || '',
      marge: op.marge?.toString() || '',
      statut: op.statut,
      datePrevue: op.datePrevue ? new Date(op.datePrevue).toISOString().split('T')[0] : '',
      priorite: op.priorite,
    })
    setFormErrors({})
    setFormOpen(true)
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.opportunityId) errors.opportunityId = "L'opportunité est requise"
    if (!formData.produit.trim()) errors.produit = 'Le produit est requis'
    if (!formData.marque) errors.marque = 'La marque est requise'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const payload = {
        opportunityId: formData.opportunityId,
        produit: formData.produit.trim(),
        marque: formData.marque,
        responsableId: formData.responsableId || null,
        prixEstime: formData.prixEstime ? parseFloat(formData.prixEstime) : null,
        marge: formData.marge ? parseFloat(formData.marge) : null,
        statut: formData.statut,
        datePrevue: formData.datePrevue || null,
        priorite: formData.priorite,
      }

      if (editingId) {
        const res = await fetch(`/api/operations/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Échec de la mise à jour')
        const data = await res.json()
        toast.success('Opération mise à jour avec succès')

        // Check if all operations are complete
        if (data.allOperationsComplete && data.opportunity) {
          setOpportunityCompleteDialog({
            open: true,
            opportunityId: data.opportunity.id || data.opportunityId,
            opportunityName: data.opportunity.nomProjet || 'Opportunité',
          })
        }
      } else {
        const res = await fetch('/api/operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Échec de la création')
        toast.success('Opération créée avec succès')
      }

      setFormOpen(false)
      await fetchOperations()
    } catch (err) {
      console.error('Save failed:', err)
      toast.error("Erreur lors de l'enregistrement")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/operations/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Échec de la suppression')
      toast.success('Opération supprimée avec succès')
      await fetchOperations()
    } catch (err) {
      console.error('Delete failed:', err)
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeleteOpen(false)
      setDeleteId(null)
    }
  }

  const handleQuickStatusChange = async (opId: string, newStatut: string) => {
    try {
      const res = await fetch(`/api/operations/${opId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: newStatut }),
      })
      if (!res.ok) throw new Error('Échec de la mise à jour')
      const data = await res.json()
      toast.success(`Statut changé en "${getStatutLabel(newStatut)}"`)
      await fetchOperations()

      // Check if all operations of the parent opportunity are complete
      if (data.allOperationsComplete && data.opportunity) {
        setOpportunityCompleteDialog({
          open: true,
          opportunityId: data.opportunity.id || data.opportunityId,
          opportunityName: data.opportunity.nomProjet || 'Opportunité',
        })
      }
    } catch (err) {
      console.error('Status change failed:', err)
      toast.error('Erreur lors du changement de statut')
    }
  }

  const clearFilters = () => {
    setFilterMarque('tous')
    setFilterStatut('tous')
    setFilterPriorite('tous')
    setSearchTerm('')
  }

  const hasActiveFilters = filterMarque !== 'tous' || filterStatut !== 'tous' || filterPriorite !== 'tous' || searchTerm !== ''

  // ─── Mobile Card Component ─────────────────────────────────────

  const MobileOperationCard = ({ op }: { op: Operation }) => {
    const isExpanded = expandedId === op.id
    const brandColor = getBrandColor(op.marque)

    return (
      <Card
        className={`border-0 bg-white/80 shadow-sm dark:bg-slate-900/70 overflow-hidden transition-all cursor-pointer border-l-4 ${brandColor.border}`}
        onClick={() => setExpandedId(isExpanded ? null : op.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{op.produit}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Briefcase className="size-3" />
                {op.opportunity?.nomProjet || '—'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <MarqueBadge marque={op.marque} />
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="size-4 text-muted-foreground" />
              </motion.div>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <StatutBadge statut={op.statut} />
            <QuickStatusButtons statut={op.statut} operationId={op.id} onChange={handleQuickStatusChange} />
            <PrioriteBadge priorite={op.priorite} />
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-[#003366] dark:text-[#FF9900]">
              {formatDZD(op.prixEstime)}
            </span>
            {op.marge != null && (
              <span className="text-xs text-muted-foreground">
                Marge: {formatDZD(op.marge)}
              </span>
            )}
          </div>

          {/* Expanded Details */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  {op.opportunity?.client && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="size-3" />
                      <span>Client: {op.opportunity.client.nom}</span>
                    </div>
                  )}
                  {op.responsable && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="size-3" />
                      <span>Responsable: {op.responsable.nom}</span>
                    </div>
                  )}
                  {op.datePrevue && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarDays className="size-3" />
                      <span>Date prévue: {formatDate(op.datePrevue)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Tag className="size-3" />
                    <span>Créé le: {formatDate(op.createdAt)}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditDialog(op)
                      }}
                    >
                      <Pencil className="size-3" />
                      Modifier
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteId(op.id)
                        setDeleteOpen(true)
                      }}
                    >
                      <Trash2 className="size-3" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    )
  }

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/20">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/80 backdrop-blur-md dark:border-blue-900/50 dark:bg-slate-950/80">
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#003366] to-[#004080] text-white shadow-lg shadow-[#003366]/25">
                <Package className="size-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Opérations
                </h1>
                <p className="text-xs text-muted-foreground">
                  CRM MI HEALTH CARE — Gestion par produit/marque
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="h-9 w-full pl-8 sm:w-56"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <Button
                onClick={openCreateDialog}
                className="gap-1.5 bg-gradient-to-r from-[#003366] to-[#004080] text-white shadow-lg shadow-[#003366]/25 hover:from-[#002244] hover:to-[#003366]"
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">Nouvelle Opération</span>
                <span className="sm:hidden">Nouvelle</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 space-y-4">
        {/* ─── Filters ──────────────────────────────────────────── */}
        <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="size-4" />
                <span className="font-medium">Filtres :</span>
              </div>
              <div className="flex flex-wrap gap-2 flex-1">
                <Select value={filterMarque} onValueChange={setFilterMarque}>
                  <SelectTrigger className="h-8 w-[150px] text-xs">
                    <SelectValue placeholder="Marque" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Toutes les marques</SelectItem>
                    {MARQUES.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        <span className="flex items-center gap-2">
                          <span className={`inline-block size-2 rounded-full ${BRAND_COLORS[m.value]?.dot || 'bg-gray-400'}`} />
                          {m.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatut} onValueChange={setFilterStatut}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Tous les statuts</SelectItem>
                    {STATUTS.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterPriorite} onValueChange={setFilterPriorite}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue placeholder="Priorité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Toutes les priorités</SelectItem>
                    {PRIORITES.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground" onClick={clearFilters}>
                  <X className="size-3" />
                  Effacer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── Summary Cards ────────────────────────────────────── */}
        {loading ? (
          <SummarySkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Package className="size-3.5 text-[#FF9900]" />
                  Total
                </div>
                <p className="mt-1 text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                  {totalOperations}
                </p>
                <p className="text-xs text-muted-foreground">opération{totalOperations !== 1 ? 's' : ''}</p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="size-3.5 text-amber-500" />
                  En attente
                </div>
                <p className="mt-1 text-base font-bold text-amber-600 dark:text-amber-400 sm:text-lg">
                  {enAttente}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp className="size-3.5 text-blue-500" />
                  En cours
                </div>
                <p className="mt-1 text-base font-bold text-blue-600 dark:text-blue-400 sm:text-lg">
                  {enCours}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3.5 text-green-500" />
                  Terminées
                </div>
                <p className="mt-1 text-base font-bold text-green-600 dark:text-green-400 sm:text-lg">
                  {terminees}
                </p>
                {totalOperations > 0 && (
                  <Progress value={completionRate} className="mt-1.5 h-1.5" />
                )}
              </CardContent>
            </Card>
            <Card className="col-span-2 sm:col-span-1 border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <BarChart3 className="size-3.5 text-[#003366]" />
                  Marge moyenne
                </div>
                <p className="mt-1 text-base font-bold text-[#003366] dark:text-[#FF9900] sm:text-lg">
                  {formatDZD(margeMoyenne)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── Error State ──────────────────────────────────────── */}
        {error && !loading && (
          <Card className="border-0 bg-red-50 dark:bg-red-950/30">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                <X className="size-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-medium text-red-700 dark:text-red-300">{error}</p>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-red-600 dark:text-red-400"
                  onClick={fetchOperations}
                >
                  Réessayer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Desktop Table ────────────────────────────────────── */}
        {!isMobile && !error && (
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-0">
              {loading ? (
                <TableSkeleton />
              ) : filteredOperations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-blue-50 p-4 mb-4 dark:bg-blue-950/30">
                    <Package className="size-8 text-[#003366]/60" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Aucune opération trouvée</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    {hasActiveFilters
                      ? 'Modifiez vos filtres pour voir plus de résultats.'
                      : 'Commencez par ajouter votre première opération.'}
                  </p>
                  {hasActiveFilters ? (
                    <Button
                      variant="outline"
                      className="mt-4 gap-1.5"
                      onClick={clearFilters}
                    >
                      <X className="size-4" />
                      Effacer les filtres
                    </Button>
                  ) : (
                    <Button
                      onClick={openCreateDialog}
                      className="mt-4 gap-1.5 bg-[#003366] hover:bg-[#002244] text-white"
                      size="sm"
                    >
                      <Plus className="size-4" />
                      Nouvelle Opération
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                        <TableHead className="font-semibold">Produit</TableHead>
                        <TableHead className="font-semibold">Marque</TableHead>
                        <TableHead className="font-semibold">Opportunité</TableHead>
                        <TableHead className="font-semibold">Responsable</TableHead>
                        <TableHead className="font-semibold">Prix Estimé</TableHead>
                        <TableHead className="font-semibold">Marge</TableHead>
                        <TableHead className="font-semibold">Statut</TableHead>
                        <TableHead className="font-semibold">Priorité</TableHead>
                        <TableHead className="font-semibold">Date Prévue</TableHead>
                        <TableHead className="font-semibold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOperations.map(op => {
                        const isExpanded = expandedId === op.id
                        return (
                          <>
                            <TableRow
                              key={op.id}
                              className={`cursor-pointer transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-950/20 ${isExpanded ? "bg-blue-50/30 dark:bg-blue-950/10" : ''}`}
                              onClick={() => setExpandedId(isExpanded ? null : op.id)}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <motion.div
                                    animate={{ rotate: isExpanded ? 90 : 0 }}
                                    transition={{ duration: 0.15 }}
                                  >
                                    <ChevronDown className="size-3.5 text-muted-foreground" />
                                  </motion.div>
                                  {op.produit}
                                </div>
                              </TableCell>
                              <TableCell><MarqueBadge marque={op.marque} /></TableCell>
                              <TableCell>
                                <div className="max-w-[160px]">
                                  <p className="truncate text-sm font-medium">{op.opportunity?.nomProjet || '—'}</p>
                                  {op.opportunity?.client && (
                                    <p className="truncate text-xs text-muted-foreground">{op.opportunity.client.nom}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{op.responsable?.nom || '—'}</TableCell>
                              <TableCell className="font-mono text-sm">{formatDZD(op.prixEstime)}</TableCell>
                              <TableCell className="font-mono text-sm">
                                {op.marge != null ? formatDZD(op.marge) : '—'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 flex-wrap">
                                  <StatutBadge statut={op.statut} />
                                  <QuickStatusButtons statut={op.statut} operationId={op.id} onChange={handleQuickStatusChange} />
                                </div>
                              </TableCell>
                              <TableCell><PrioriteBadge priorite={op.priorite} /></TableCell>
                              <TableCell className="text-sm">{formatDate(op.datePrevue)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="size-8 p-0 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openEditDialog(op)
                                    }}
                                  >
                                    <Pencil className="size-3.5 text-[#003366] dark:text-[#FF9900]" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="size-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setDeleteId(op.id)
                                      setDeleteOpen(true)
                                    }}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {/* Expanded Detail Row */}
                            <AnimatePresence key={`${op.id}-detail`}>
                              {isExpanded && (
                                <motion.tr
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <TableCell colSpan={10} className="bg-slate-50/50 dark:bg-slate-800/30 p-0">
                                    <motion.div
                                      initial={{ height: 0 }}
                                      animate={{ height: 'auto' }}
                                      exit={{ height: 0 }}
                                      className="px-6 py-4"
                                    >
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">Client</p>
                                          <p className="text-sm font-medium">{op.opportunity?.client?.nom || '—'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">Responsable</p>
                                          <p className="text-sm font-medium">{op.responsable?.nom || '—'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">Prix estimé</p>
                                          <p className="text-sm font-medium">{formatDZD(op.prixEstime)}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">Marge</p>
                                          <p className="text-sm font-medium">{op.marge != null ? formatDZD(op.marge) : '—'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">Date prévue</p>
                                          <p className="text-sm font-medium">{formatDate(op.datePrevue)}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">Créé le</p>
                                          <p className="text-sm font-medium">{formatDate(op.createdAt)}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">Statut</p>
                                          <StatutBadge statut={op.statut} />
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">Priorité</p>
                                          <PrioriteBadge priorite={op.priorite} />
                                        </div>
                                      </div>
                                    </motion.div>
                                  </TableCell>
                                </motion.tr>
                              )}
                            </AnimatePresence>
                          </>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── Mobile Cards ─────────────────────────────────────── */}
        {isMobile && !error && (
          <div className="space-y-3">
            {loading ? (
              <CardSkeleton />
            ) : filteredOperations.length === 0 ? (
              <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-blue-50 p-4 mb-4 dark:bg-blue-950/30">
                    <Package className="size-8 text-[#003366]/60" />
                  </div>
                  <h3 className="text-lg font-semibold">Aucune opération trouvée</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    {hasActiveFilters
                      ? 'Modifiez vos filtres pour voir plus de résultats.'
                      : 'Commencez par ajouter votre première opération.'}
                  </p>
                  {hasActiveFilters ? (
                    <Button
                      variant="outline"
                      className="mt-4 gap-1.5"
                      onClick={clearFilters}
                    >
                      <X className="size-4" />
                      Effacer les filtres
                    </Button>
                  ) : (
                    <Button
                      onClick={openCreateDialog}
                      className="mt-4 gap-1.5 bg-[#003366] hover:bg-[#002244] text-white"
                      size="sm"
                    >
                      <Plus className="size-4" />
                      Nouvelle Opération
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredOperations.map(op => (
                <MobileOperationCard key={op.id} op={op} />
              ))
            )}
          </div>
        )}
      </main>

      {/* ─── Add/Edit Dialog ────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#003366]/10 dark:bg-[#003366]/20">
                <Package className="size-4 text-[#003366] dark:text-[#FF9900]" />
              </div>
              {editingId ? "Modifier l'opération" : 'Nouvelle opération'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Modifiez les informations de l'opération ci-dessous."
                : 'Créez une nouvelle opération pour une opportunité.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Opportunité */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Opportunité <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.opportunityId}
                onValueChange={v => setFormData(f => ({ ...f, opportunityId: v }))}
              >
                <SelectTrigger className={formErrors.opportunityId ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Sélectionner une opportunité" />
                </SelectTrigger>
                <SelectContent>
                  {opportunities.length === 0 ? (
                    <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                      Aucune opportunité disponible
                    </div>
                  ) : (
                    opportunities.map(opp => (
                      <SelectItem key={opp.id} value={opp.id}>
                        <span className="flex items-center gap-2">
                          {opp.nomProjet}
                          {opp.client && (
                            <span className="text-xs text-muted-foreground">
                              — {opp.client.nom}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {formErrors.opportunityId && (
                <p className="text-xs text-red-500">{formErrors.opportunityId}</p>
              )}
            </div>

            {/* Produit */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Produit <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Ex: Respirateur, Moniteur, Table opératoire..."
                value={formData.produit}
                onChange={e => setFormData(f => ({ ...f, produit: e.target.value }))}
                className={formErrors.produit ? 'border-red-500' : ''}
              />
              {formErrors.produit && (
                <p className="text-xs text-red-500">{formErrors.produit}</p>
              )}
            </div>

            {/* Marque */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Marque <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.marque}
                onValueChange={v => setFormData(f => ({ ...f, marque: v }))}
              >
                <SelectTrigger className={formErrors.marque ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Sélectionner une marque" />
                </SelectTrigger>
                <SelectContent>
                  {MARQUES.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      <span className="flex items-center gap-2">
                        <span className={`inline-block size-2.5 rounded-full ${BRAND_COLORS[m.value]?.dot || 'bg-gray-400'}`} />
                        {m.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.marque && (
                <p className="text-xs text-red-500">{formErrors.marque}</p>
              )}
            </div>

            {/* Responsable */}
            <div className="space-y-1.5">
              <Label className="text-sm">Responsable</Label>
              <Select
                value={formData.responsableId}
                onValueChange={v => setFormData(f => ({ ...f, responsableId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un responsable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      <span className="flex items-center gap-2">
                        {emp.nom}
                        <span className="text-xs text-muted-foreground">({emp.role})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prix Estimé & Marge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1">
                  <DollarSign className="size-3.5" />
                  Prix Estimé (DZD)
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.prixEstime}
                  onChange={e => setFormData(f => ({ ...f, prixEstime: e.target.value }))}
                  min={0}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1">
                  <BarChart3 className="size-3.5" />
                  Marge (DZD)
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.marge}
                  onChange={e => setFormData(f => ({ ...f, marge: e.target.value }))}
                  min={0}
                />
              </div>
            </div>

            {/* Statut & Priorité */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Statut</Label>
                <Select
                  value={formData.statut}
                  onValueChange={v => {
                    if (editingId) {
                      const allowed = VALID_TRANSITIONS[currentStatut] || []
                      // Allow staying on same status or transitioning forward
                      if (v !== currentStatut && !allowed.includes(v)) {
                        toast.error('Transition non autorisée : vous ne pouvez pas revenir en arrière')
                        return
                      }
                    }
                    setFormData(f => ({ ...f, statut: v }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUTS.map(s => {
                      // In edit mode, show all statuses but disable invalid ones
                      const isDisabled = editingId ? (s.value !== currentStatut && !(VALID_TRANSITIONS[currentStatut] || []).includes(s.value)) : false
                      return (
                        <SelectItem key={s.value} value={s.value} disabled={isDisabled}>
                          <span className="flex items-center gap-2">
                            {STATUT_COLORS[s.value]?.icon}
                            {s.label}
                            {isDisabled && <span className="text-xs text-muted-foreground">(non autorisé)</span>}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Priorité</Label>
                <Select
                  value={formData.priorite}
                  onValueChange={v => setFormData(f => ({ ...f, priorite: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITES.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className="flex items-center gap-2">
                          <span className={`inline-block size-2 rounded-full ${PRIORITE_COLORS[p.value]?.bg}`} />
                          {p.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date Prévue */}
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                Date Prévue
              </Label>
              <Input
                type="date"
                value={formData.datePrevue}
                onChange={e => setFormData(f => ({ ...f, datePrevue: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="gap-1.5 bg-gradient-to-r from-[#003366] to-[#004080] text-white hover:from-[#002244] hover:to-[#003366]"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  {editingId ? 'Mettre à jour' : 'Créer l\'opération'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ────────────────────────────────── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette opération ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteOpen(false); setDeleteId(null) }}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Opportunity Auto-Complete Dialog */}
      <AlertDialog open={opportunityCompleteDialog.open} onOpenChange={(open) => setOpportunityCompleteDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#FF9900]" />
              Toutes les opérations sont terminées !
            </AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les opérations de l&apos;opportunité <strong>&quot;{opportunityCompleteDialog.opportunityName}&quot;</strong> sont terminées.
              Voulez-vous passer cette opportunité en statut <strong>Gagné</strong> ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOpportunityCompleteDialog({ open: false, opportunityId: '', opportunityName: '' })}>
              Plus tard
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  const res = await fetch(`/api/opportunities/${opportunityCompleteDialog.opportunityId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ statut: 'Gagné' }),
                  })
                  if (!res.ok) throw new Error('Échec')
                  toast.success('Opportunité passée en "Gagné" !')
                } catch {
                  toast.error('Erreur lors de la mise à jour de l\'opportunité')
                } finally {
                  setOpportunityCompleteDialog({ open: false, opportunityId: '', opportunityName: '' })
                }
              }}
              className="bg-[#003366] hover:bg-[#002244] text-white"
            >
              Oui, passer en Gagné
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
