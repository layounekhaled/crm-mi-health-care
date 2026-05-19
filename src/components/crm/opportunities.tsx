'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Search,
  GripVertical,
  TrendingUp,
  TrendingDown,
  Eye,
  MoreHorizontal,
  ChevronDown,
  LayoutGrid,
  List,
  Briefcase,
  User,
  DollarSign,
  Calendar,
  ArrowUpDown,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Trash2,
  Edit3,
  ArrowRight,
  MessageSquare,
  ListChecks,
  Wrench,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { AddInteractionDialog, INTERACTION_TYPES } from '@/components/crm/add-interaction-dialog'
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, useDroppable, type DragStartEvent, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────

interface Prospect {
  id: string
  nom: string
  specialite?: string | null
  wilaya?: string | null
  telephone?: string | null
  isClient: boolean
}

interface Employee {
  id: string
  nom: string
  role: string
  actif: boolean
}

interface Operation {
  id: string
  produit: string
  marque: string
  prixEstime?: number | null
  marge?: number | null
  statut: string
  priorite: string
  datePrevue?: string | null
  responsable?: { id: string; nom: string } | null
}

interface Task {
  id: string
  titre: string
  statut: string
  priorite: string
  dateEcheance?: string | null
  description?: string | null
  assigneA?: { id: string; nom: string } | null
}

interface Interaction {
  id: string
  type: string
  notes?: string | null
  date: string
  employe?: { id: string; nom: string } | null
  task?: { id: string; titre: string } | null
  afterSale?: { id: string; titre: string } | null
}

interface Opportunity {
  id: string
  clientId?: string | null
  nomProjet: string
  statut: string
  montantEstime?: number | null
  commercialId?: string | null
  motifPerte?: string | null
  createdAt: string
  updatedAt: string
  client?: Prospect | null
  commercial?: Employee | null
  operations?: Operation[]
  tasks?: Task[]
  interactions?: Interaction[]
}

// ─── Constants ───────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { value: 'Nouveau', label: 'Nouveau', color: 'bg-slate-500', headerBg: 'bg-slate-100 dark:bg-slate-900/40', badgeVariant: 'secondary' as const, textColor: 'text-slate-700 dark:text-slate-300' },
  { value: 'Contacté', label: 'Contacté', color: 'bg-blue-500', headerBg: 'bg-blue-50 dark:bg-blue-900/30', badgeVariant: 'default' as const, textColor: 'text-blue-700 dark:text-blue-300' },
  { value: 'Intéressé', label: 'Intéressé', color: 'bg-amber-500', headerBg: 'bg-amber-50 dark:bg-amber-900/30', badgeVariant: 'outline' as const, textColor: 'text-amber-700 dark:text-amber-300' },
  { value: 'Devis', label: 'Devis', color: 'bg-purple-500', headerBg: 'bg-purple-50 dark:bg-purple-900/30', badgeVariant: 'outline' as const, textColor: 'text-purple-700 dark:text-purple-300' },
  { value: 'Négociation', label: 'Négociation', color: 'bg-orange-500', headerBg: 'bg-orange-50 dark:bg-orange-900/30', badgeVariant: 'outline' as const, textColor: 'text-orange-700 dark:text-orange-300' },
  { value: 'Gagné', label: 'Gagné', color: 'bg-emerald-500', headerBg: 'bg-emerald-50 dark:bg-emerald-900/30', badgeVariant: 'default' as const, textColor: 'text-emerald-700 dark:text-emerald-300' },
  { value: 'Perdu', label: 'Perdu', color: 'bg-red-500', headerBg: 'bg-red-50 dark:bg-red-900/30', badgeVariant: 'destructive' as const, textColor: 'text-red-700 dark:text-red-300' },
]

const MOTIFS_PERTE = [
  'Prix trop élevé',
  'Concurrent choisi',
  'Mauvais timing',
  'Budget insuffisant',
  'Autre',
]

const STATUT_BADGE_MAP: Record<string, { className: string; icon: React.ReactNode }> = {
  'Nouveau': { className: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300', icon: <Clock className="size-3" /> },
  'Contacté': { className: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300', icon: <MessageSquare className="size-3" /> },
  'Intéressé': { className: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300', icon: <TrendingUp className="size-3" /> },
  'Devis': { className: 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-300', icon: <FileText className="size-3" /> },
  'Négociation': { className: 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/50 dark:text-orange-300', icon: <DollarSign className="size-3" /> },
  'Gagné': { className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300', icon: <CheckCircle2 className="size-3" /> },
  'Perdu': { className: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300', icon: <XCircle className="size-3" /> },
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

function getStageConfig(statut: string) {
  return PIPELINE_STAGES.find(s => s.value === statut) || PIPELINE_STAGES[0]
}

// ─── Statut Badge Component ──────────────────────────────────────

function StatutBadge({ statut }: { statut: string }) {
  const config = STATUT_BADGE_MAP[statut] || STATUT_BADGE_MAP['Nouveau']
  return (
    <Badge variant="outline" className={`gap-1 font-medium ${config.className}`}>
      {config.icon}
      {statut}
    </Badge>
  )
}

// ─── Priority Badge ──────────────────────────────────────────────

function PriorityBadge({ priorite }: { priorite: string }) {
  const map: Record<string, string> = {
    haute: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    moyenne: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    basse: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  }
  const labels: Record<string, string> = { haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse' }
  return (
    <Badge variant="outline" className={map[priorite] || map.moyenne}>
      {labels[priorite] || priorite}
    </Badge>
  )
}

// ─── Main Component ──────────────────────────────────────────────

export default function OpportunitiesModule() {
  // State
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [clients, setClients] = useState<Prospect[]>([])
  const [commercials, setCommercials] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'kanban' | 'liste'>('kanban')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [sortField, setSortField] = useState<string>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Dialogs
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showAddOperationDialog, setShowAddOperationDialog] = useState(false)
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false)
  const [showAddInteractionDialog, setShowAddInteractionDialog] = useState(false)

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    clientId: '',
    nomProjet: '',
    statut: 'Nouveau',
    montantEstime: '',
    commercialId: '',
    motifPerte: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  // Detail state
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Operation form
  const [operationForm, setOperationForm] = useState({
    produit: '',
    marque: '',
    prixEstime: '',
    marge: '',
    priorite: 'moyenne',
    statut: 'en_attente',
  })

  // Task form
  const [taskForm, setTaskForm] = useState({
    titre: '',
    description: '',
    priorite: 'moyenne',
    dateEcheance: '',
  })

  // Client search
  const [clientSearch, setClientSearch] = useState('')

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [motifPerteDialogOpen, setMotifPerteDialogOpen] = useState(false)
  const [motifPerteOppId, setMotifPerteOppId] = useState<string | null>(null)
  const [motifPerteValue, setMotifPerteValue] = useState('')

  // ─── Data Fetching ─────────────────────────────────────────────

  const fetchOpportunities = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatut !== 'all') params.set('statut', filterStatut)
      const res = await fetch(`/api/opportunities?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setOpportunities(data)
      }
    } catch (err) {
      toast.error('Erreur lors du chargement des opportunités')
    }
  }, [filterStatut])

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/prospects?isClient=true&limit=100')
      if (res.ok) {
        const data = await res.json()
        setClients(data.data || data)
      }
    } catch (err) {
      toast.error('Erreur lors du chargement des clients')
    }
  }, [])

  const fetchCommercials = useCallback(async () => {
    try {
      const res = await fetch('/api/employees?role=commercial&actif=true')
      if (res.ok) {
        const data = await res.json()
        setCommercials(data)
      }
    } catch (err) {
      toast.error('Erreur lors du chargement des commerciaux')
    }
  }, [])

  const fetchOpportunityDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/opportunities/${id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedOpportunity(data)
      }
    } catch (err) {
      toast.error('Erreur lors du chargement du détail')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchOpportunities(), fetchClients(), fetchCommercials()])
      setLoading(false)
    }
    load()
  }, [fetchOpportunities, fetchClients, fetchCommercials])

  // ─── Form Handlers ─────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingId(null)
    setFormData({
      clientId: '',
      nomProjet: '',
      statut: 'Nouveau',
      montantEstime: '',
      commercialId: '',
      motifPerte: '',
      notes: '',
    })
    setClientSearch('')
    setShowFormDialog(true)
  }

  const openEditDialog = (opp: Opportunity) => {
    setEditingId(opp.id)
    setFormData({
      clientId: opp.clientId || '',
      nomProjet: opp.nomProjet,
      statut: opp.statut,
      montantEstime: opp.montantEstime?.toString() || '',
      commercialId: opp.commercialId || '',
      motifPerte: opp.motifPerte || '',
      notes: '',
    })
    setClientSearch(opp.client?.nom || '')
    setShowFormDialog(true)
  }

  const handleSave = async () => {
    if (!formData.nomProjet.trim()) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        clientId: formData.clientId || null,
        nomProjet: formData.nomProjet.trim(),
        statut: formData.statut,
        montantEstime: formData.montantEstime ? parseFloat(formData.montantEstime) : null,
        commercialId: formData.commercialId || null,
        motifPerte: formData.statut === 'Perdu' ? formData.motifPerte : null,
      }

      if (editingId) {
        const res = await fetch(`/api/opportunities/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Update failed')
      } else {
        const res = await fetch('/api/opportunities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Create failed')
      }

      setShowFormDialog(false)
      await fetchOpportunities()
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      const res = await fetch(`/api/opportunities/${deletingId}`, { method: 'DELETE' })
      if (res.ok) {
        setShowDeleteDialog(false)
        setDeletingId(null)
        setShowDetailDialog(false)
        setSelectedOpportunity(null)
        await fetchOpportunities()
      }
    } catch (err) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const moveOpportunity = async (oppId: string, newStatut: string) => {
    try {
      const payload: Record<string, unknown> = { statut: newStatut }
      if (newStatut === 'Perdu' && !formData.motifPerte) {
        // If moving to Perdu without motif, we need to prompt
        // For quick-move, we'll just set a default
      }
      const res = await fetch(`/api/opportunities/${oppId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        await fetchOpportunities()
      }
    } catch (err) {
      toast.error('Erreur lors du déplacement')
    }
  }

  const handleAddOperation = async () => {
    if (!selectedOpportunity || !operationForm.produit || !operationForm.marque) return
    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: selectedOpportunity.id,
          produit: operationForm.produit,
          marque: operationForm.marque,
          prixEstime: operationForm.prixEstime ? parseFloat(operationForm.prixEstime) : null,
          marge: operationForm.marge ? parseFloat(operationForm.marge) : null,
          priorite: operationForm.priorite,
          statut: operationForm.statut,
        }),
      })
      if (res.ok) {
        setShowAddOperationDialog(false)
        setOperationForm({ produit: '', marque: '', prixEstime: '', marge: '', priorite: 'moyenne', statut: 'en_attente' })
        await fetchOpportunityDetail(selectedOpportunity.id)
        await fetchOpportunities()
      }
    } catch (err) {
      toast.error("Erreur lors de l'ajout de l'opération")
    }
  }

  const handleAddTask = async () => {
    if (!selectedOpportunity || !taskForm.titre) return
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre: taskForm.titre,
          type: 'commerciale',
          opportunityId: selectedOpportunity.id,
          description: taskForm.description || null,
          priorite: taskForm.priorite,
          dateEcheance: taskForm.dateEcheance || null,
          statut: 'en_attente',
        }),
      })
      if (res.ok) {
        setShowAddTaskDialog(false)
        setTaskForm({ titre: '', description: '', priorite: 'moyenne', dateEcheance: '' })
        await fetchOpportunityDetail(selectedOpportunity.id)
      }
    } catch (err) {
      toast.error("Erreur lors de l'ajout de la tâche")
    }
  }

  // ─── Computed Data ─────────────────────────────────────────────

  const filteredOpportunities = opportunities.filter(opp => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matchName = opp.nomProjet.toLowerCase().includes(search)
      const matchClient = opp.client?.nom?.toLowerCase().includes(search)
      const matchCommercial = opp.commercial?.nom?.toLowerCase().includes(search)
      if (!matchName && !matchClient && !matchCommercial) return false
    }
    return true
  })

  const sortedOpportunities = [...filteredOpportunities].sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case 'nomProjet':
        cmp = a.nomProjet.localeCompare(b.nomProjet)
        break
      case 'montantEstime':
        cmp = (a.montantEstime || 0) - (b.montantEstime || 0)
        break
      case 'createdAt':
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        break
      case 'client':
        cmp = (a.client?.nom || '').localeCompare(b.client?.nom || '')
        break
      default:
        cmp = 0
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const kanbanData = PIPELINE_STAGES.map(stage => ({
    ...stage,
    opportunities: filteredOpportunities.filter(o => o.statut === stage.value),
  }))

  const totalPipeline = filteredOpportunities
    .filter(o => !['Gagné', 'Perdu'].includes(o.statut))
    .reduce((sum, o) => sum + (o.montantEstime || 0), 0)

  const totalGagne = filteredOpportunities
    .filter(o => o.statut === 'Gagné')
    .reduce((sum, o) => sum + (o.montantEstime || 0), 0)

  const totalPerdu = filteredOpportunities
    .filter(o => o.statut === 'Perdu')
    .reduce((sum, o) => sum + (o.montantEstime || 0), 0)

  const filteredClients = clients.filter(c => {
    if (!clientSearch) return true
    return c.nom.toLowerCase().includes(clientSearch.toLowerCase())
  })

  // ─── Sort Toggle ───────────────────────────────────────────────

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // ─── DnD Handlers ────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  // Track which column is being hovered during drag
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null)

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    // Find the column the dragged item is over
    const overId = over.id as string
    let targetColumn: string | null = null

    // Check if over a column directly
    if (PIPELINE_STAGES.some(s => s.value === overId)) {
      targetColumn = overId
    } else {
      // Check if over a card - find which column that card belongs to
      const overOpp = opportunities.find(o => o.id === overId)
      if (overOpp) {
        targetColumn = overOpp.statut
      }
    }

    setHoveredColumn(targetColumn)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setHoveredColumn(null)

    if (!over) return

    const activeOpp = opportunities.find(o => o.id === active.id)
    if (!activeOpp) return

    // Find which column the item was dropped on
    let newStatut: string | null = null

    // Check if dropped on a column directly
    const overStage = PIPELINE_STAGES.find(s => s.value === over.id)
    if (overStage) {
      newStatut = overStage.value
    } else {
      // Dropped on another card - find that card's column
      const overOpp = opportunities.find(o => o.id === over.id)
      if (overOpp) {
        newStatut = overOpp.statut
      }
    }

    if (!newStatut || activeOpp.statut === newStatut) return // No change

    // If moving to "Perdu", show motif dialog
    if (newStatut === 'Perdu') {
      setMotifPerteOppId(activeOpp.id)
      setMotifPerteValue('')
      setMotifPerteDialogOpen(true)
      return
    }

    // Optimistic update
    setOpportunities(prev => prev.map(o => o.id === active.id ? { ...o, statut: newStatut! } : o))

    try {
      const res = await fetch(`/api/opportunities/${active.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: newStatut }),
      })
      if (!res.ok) throw new Error('Move failed')
      const targetLabel = PIPELINE_STAGES.find(s => s.value === newStatut)?.label || newStatut
      toast.success(`Opportunité déplacée vers "${targetLabel}"`)
      await fetchOpportunities()
    } catch {
      toast.error('Erreur lors du déplacement')
      await fetchOpportunities() // Revert
    }
  }

  const handleConfirmMotifPerte = async () => {
    if (!motifPerteOppId) return
    const opp = opportunities.find(o => o.id === motifPerteOppId)
    if (!opp) return

    // Optimistic update
    setOpportunities(prev => prev.map(o => o.id === motifPerteOppId ? { ...o, statut: 'Perdu', motifPerte: motifPerteValue || 'Autre' } : o))
    setMotifPerteDialogOpen(false)

    try {
      const res = await fetch(`/api/opportunities/${motifPerteOppId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'Perdu', motifPerte: motifPerteValue || 'Autre' }),
      })
      if (!res.ok) throw new Error('Move failed')
      toast.success('Opportunité déplacée vers "Perdu"')
      setMotifPerteOppId(null)
      await fetchOpportunities()
    } catch {
      toast.error('Erreur lors du déplacement')
      await fetchOpportunities() // Revert
    }
  }

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/20">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/80 backdrop-blur-md dark:border-blue-900/50 dark:bg-slate-950/80">
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="MI HEALTH CARE" className="h-9 w-auto shrink-0 object-contain" />
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#134885] dark:text-white">
                  Opportunités
                </h1>
                <p className="text-xs text-muted-foreground">
                  Pipeline commercial
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
              </div>
              <div className="flex items-center rounded-lg border bg-muted p-0.5">
                <Button
                  size="sm"
                  variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                  className="h-7 gap-1.5 px-2.5 text-xs"
                  onClick={() => setViewMode('kanban')}
                >
                  <LayoutGrid className="size-3.5" />
                  Kanban
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'liste' ? 'default' : 'ghost'}
                  className="h-7 gap-1.5 px-2.5 text-xs"
                  onClick={() => setViewMode('liste')}
                >
                  <List className="size-3.5" />
                  Liste
                </Button>
              </div>
              <Button
                onClick={openCreateDialog}
                className="gap-1.5 bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white shadow-lg shadow-[#134885]/25 hover:from-[#0D3A6E] hover:to-[#134885]"
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">Nouvelle Opportunité</span>
                <span className="sm:hidden">Nouvelle</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="size-3.5 text-[#134885]" />
                Pipeline
              </div>
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                {formatDZD(totalPipeline)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                Gagné
              </div>
              <p className="mt-1 text-base font-bold text-[#134885] dark:text-[#F6852A] sm:text-lg">
                {formatDZD(totalGagne)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <XCircle className="size-3.5 text-red-500" />
                Perdu
              </div>
              <p className="mt-1 text-base font-bold text-red-600 dark:text-red-400 sm:text-lg">
                {formatDZD(totalPerdu)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Briefcase className="size-3.5 text-[#F6852A]" />
                Total
              </div>
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                {filteredOpportunities.length} opportunité{filteredOpportunities.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-[#134885]" />
            <span className="ml-3 text-muted-foreground">Chargement des opportunités...</span>
          </div>
        ) : (
          <>
            {/* ─── Kanban View ──────────────────────────────────── */}
            {viewMode === 'kanban' && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <div className="overflow-x-auto pb-4">
                  <div className="flex gap-4" style={{ minWidth: `${PIPELINE_STAGES.length * 296}px` }}>
                    {kanbanData.map(stage => (
                      <DroppableColumn
                        key={stage.value}
                        id={stage.value}
                        isHovered={hoveredColumn === stage.value}
                        isDragging={!!activeId}
                      >
                        {/* Column Header */}
                        <div className={`rounded-t-xl px-3 py-2.5 ${stage.headerBg}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`size-2.5 rounded-full ${stage.color}`} />
                              <span className={`text-sm font-semibold ${stage.textColor}`}>
                                {stage.label}
                              </span>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {stage.opportunities.length}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDZD(stage.opportunities.reduce((s, o) => s + (o.montantEstime || 0), 0))}
                          </p>
                        </div>

                        {/* Cards */}
                        <ScrollArea className="flex-1" style={{ maxHeight: 'calc(100vh - 340px)' }}>
                          <div className="space-y-2 p-2">
                            <SortableContext items={stage.opportunities.map(o => o.id)} strategy={verticalListSortingStrategy}>
                              <AnimatePresence mode="popLayout">
                                {stage.opportunities.map(opp => (
                                  <SortableKanbanCard
                                    key={opp.id}
                                    opportunity={opp}
                                    onMove={moveOpportunity}
                                    onClick={() => {
                                      fetchOpportunityDetail(opp.id)
                                      setShowDetailDialog(true)
                                    }}
                                    onEdit={() => openEditDialog(opp)}
                                    onDelete={() => {
                                      setDeletingId(opp.id)
                                      setShowDeleteDialog(true)
                                    }}
                                  />
                                ))}
                              </AnimatePresence>
                            </SortableContext>
                            {stage.opportunities.length === 0 && (
                              <div className="flex flex-col items-center justify-center py-8 text-xs text-muted-foreground">
                                <Briefcase className="mb-2 size-8 opacity-20" />
                                Aucune opportunité
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </DroppableColumn>
                    ))}
                  </div>
                </div>
                <DragOverlay>
                  {activeId ? (
                    <div className="w-[260px] rotate-3 opacity-90">
                      <KanbanCard
                        opportunity={opportunities.find(o => o.id === activeId)!}
                        onMove={async () => {}}
                        onClick={() => {}}
                        onEdit={() => {}}
                        onDelete={() => {}}
                      />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}

            {/* ─── List View ────────────────────────────────────── */}
            {viewMode === 'liste' && (
              <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
                <CardContent className="p-0">
                  {/* Filters bar */}
                  <div className="flex flex-wrap items-center gap-2 border-b p-4">
                    <Label className="text-xs text-muted-foreground">Filtrer par statut:</Label>
                    <Select value={filterStatut} onValueChange={setFilterStatut}>
                      <SelectTrigger className="h-8 w-40 text-xs">
                        <SelectValue placeholder="Tous" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les statuts</SelectItem>
                        {PIPELINE_STAGES.map(s => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="cursor-pointer" onClick={() => toggleSort('nomProjet')}>
                            <span className="flex items-center gap-1">
                              Projet <ArrowUpDown className="size-3" />
                            </span>
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => toggleSort('client')}>
                            <span className="flex items-center gap-1">
                              Client <ArrowUpDown className="size-3" />
                            </span>
                          </TableHead>
                          <TableHead>Commercial</TableHead>
                          <TableHead className="cursor-pointer" onClick={() => toggleSort('montantEstime')}>
                            <span className="flex items-center gap-1">
                              Montant <ArrowUpDown className="size-3" />
                            </span>
                          </TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="cursor-pointer" onClick={() => toggleSort('createdAt')}>
                            <span className="flex items-center gap-1">
                              Date <ArrowUpDown className="size-3" />
                            </span>
                          </TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedOpportunities.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                              <div className="flex flex-col items-center">
                                <Briefcase className="mb-2 size-8 opacity-20" />
                                Aucune opportunité trouvée
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          sortedOpportunities.map(opp => (
                            <TableRow
                              key={opp.id}
                              className="cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                              onClick={() => {
                                fetchOpportunityDetail(opp.id)
                                setShowDetailDialog(true)
                              }}
                            >
                              <TableCell className="font-medium">{opp.nomProjet}</TableCell>
                              <TableCell>{opp.client?.nom || '—'}</TableCell>
                              <TableCell>{opp.commercial?.nom || '—'}</TableCell>
                              <TableCell className="font-mono text-sm">{formatDZD(opp.montantEstime)}</TableCell>
                              <TableCell><StatutBadge statut={opp.statut} /></TableCell>
                              <TableCell>{formatDate(opp.createdAt)}</TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                    <Button variant="ghost" size="sm" className="size-8 p-0">
                                      <MoreHorizontal className="size-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={e => { e.stopPropagation(); openEditDialog(opp) }}>
                                      <Edit3 className="mr-2 size-3.5" /> Modifier
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={e => { e.stopPropagation(); fetchOpportunityDetail(opp.id); setShowDetailDialog(true) }}>
                                      <Eye className="mr-2 size-3.5" /> Détails
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={e => { e.stopPropagation(); setDeletingId(opp.id); setShowDeleteDialog(true) }}
                                    >
                                      <Trash2 className="mr-2 size-3.5" /> Supprimer
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      {/* ─── Add/Edit Dialog ────────────────────────────────────── */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#134885]/10 dark:bg-[#134885]/20">
                <Briefcase className="size-4 text-[#134885] dark:text-[#F6852A]" />
              </div>
              {editingId ? 'Modifier l\'opportunité' : 'Nouvelle opportunité'}
            </DialogTitle>
            <DialogDescription>
              {editingId ? 'Modifiez les informations de l\'opportunité.' : 'Créez une nouvelle opportunité commerciale.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Client */}
            <div className="space-y-1.5">
              <Label className="text-sm">Client</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un client..."
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select
                value={formData.clientId}
                onValueChange={v => {
                  setFormData(f => ({ ...f, clientId: v }))
                  const client = clients.find(c => c.id === v)
                  if (client) setClientSearch(client.nom)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {filteredClients.length === 0 ? (
                    <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                      Aucun client trouvé
                    </div>
                  ) : (
                    filteredClients.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          {c.nom}
                          {c.wilaya && (
                            <span className="text-xs text-muted-foreground">({c.wilaya})</span>
                          )}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Nom du Projet */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Nom du Projet <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Ex: Équipement bloc opératoire"
                value={formData.nomProjet}
                onChange={e => setFormData(f => ({ ...f, nomProjet: e.target.value }))}
              />
            </div>

            {/* Statut */}
            <div className="space-y-1.5">
              <Label className="text-sm">Statut</Label>
              <Select
                value={formData.statut}
                onValueChange={v => setFormData(f => ({ ...f, statut: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="flex items-center gap-2">
                        <span className={`inline-block size-2 rounded-full ${s.color}`} />
                        {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Gagné animation */}
            <AnimatePresence>
              {formData.statut === 'Gagné' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/50">
                    <div className="flex items-center gap-3">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        <CheckCircle2 className="size-8 text-emerald-500" />
                      </motion.div>
                      <div>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                          Opportunité gagnée ! 🎉
                        </p>
                        <p className="text-xs text-[#134885] dark:text-[#F6852A]">
                          Le client sera automatiquement converti s&apos;il ne l&apos;est pas déjà.
                        </p>
                      </div>
                    </div>
                    <Badge className="mt-2 bg-emerald-600 text-white">
                      <CheckCircle2 className="mr-1 size-3" /> Gagné
                    </Badge>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Perdu fields */}
            <AnimatePresence>
              {formData.statut === 'Perdu' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/50">
                    <div className="flex items-center gap-2 mb-3">
                      <XCircle className="size-5 text-red-500" />
                      <p className="font-semibold text-red-700 dark:text-red-300">
                        Motif de perte <span className="text-red-500">*</span>
                      </p>
                    </div>
                    <Select
                      value={formData.motifPerte}
                      onValueChange={v => setFormData(f => ({ ...f, motifPerte: v }))}
                    >
                      <SelectTrigger className="w-full border-red-200 dark:border-red-800">
                        <SelectValue placeholder="Sélectionner un motif" />
                      </SelectTrigger>
                      <SelectContent>
                        {MOTIFS_PERTE.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge className="mt-2 bg-red-600 text-white">
                      <XCircle className="mr-1 size-3" /> Perdu
                    </Badge>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Montant */}
            <div className="space-y-1.5">
              <Label className="text-sm">Montant Estimé (DZD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="1 500 000"
                  value={formData.montantEstime}
                  onChange={e => setFormData(f => ({ ...f, montantEstime: e.target.value }))}
                  className="pl-8"
                />
              </div>
              {formData.montantEstime && (
                <p className="text-xs text-muted-foreground">
                  Aperçu: {formatDZD(parseFloat(formData.montantEstime) || 0)}
                </p>
              )}
            </div>

            {/* Commercial */}
            <div className="space-y-1.5">
              <Label className="text-sm">Commercial</Label>
              <Select
                value={formData.commercialId}
                onValueChange={v => setFormData(f => ({ ...f, commercialId: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un commercial" />
                </SelectTrigger>
                <SelectContent>
                  {commercials.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                  ))}
                  {commercials.length === 0 && (
                    <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                      Aucun commercial disponible
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-sm">Notes</Label>
              <Textarea
                placeholder="Notes additionnelles..."
                value={formData.notes}
                onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.nomProjet.trim() || (formData.statut === 'Perdu' && !formData.motifPerte)}
              className="gap-1.5 bg-[#134885] hover:bg-[#0D3A6E]"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {editingId ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Detail Dialog ──────────────────────────────────────── */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-[#134885]" />
              <span className="ml-3 text-muted-foreground">Chargement...</span>
            </div>
          ) : selectedOpportunity ? (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#134885] to-[#1A5A9E] text-white">
                      <Briefcase className="size-5" />
                    </div>
                    <div>
                      <DialogTitle>{selectedOpportunity.nomProjet}</DialogTitle>
                      <DialogDescription>
                        Créée le {formatDate(selectedOpportunity.createdAt)}
                      </DialogDescription>
                    </div>
                  </div>
                  <StatutBadge statut={selectedOpportunity.statut} />
                </div>
              </DialogHeader>

              {/* Key Info */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="text-sm font-medium">{selectedOpportunity.client?.nom || '—'}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                  <p className="text-xs text-muted-foreground">Commercial</p>
                  <p className="text-sm font-medium">{selectedOpportunity.commercial?.nom || '—'}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                  <p className="text-xs text-muted-foreground">Montant</p>
                  <p className="text-sm font-semibold text-[#134885] dark:text-[#F6852A]">
                    {formatDZD(selectedOpportunity.montantEstime)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                  <p className="text-xs text-muted-foreground">Opérations</p>
                  <p className="text-sm font-medium">
                    {selectedOpportunity.operations?.length || 0}
                  </p>
                </div>
              </div>

              {/* Perdu motif */}
              {selectedOpportunity.statut === 'Perdu' && selectedOpportunity.motifPerte && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/50">
                  <XCircle className="size-4 text-red-500" />
                  <span className="text-sm text-red-700 dark:text-red-300">
                    Motif de perte: <strong>{selectedOpportunity.motifPerte}</strong>
                  </span>
                </div>
              )}

              {/* Gagné banner */}
              {selectedOpportunity.statut === 'Gagné' && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/50">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span className="text-sm text-emerald-700 dark:text-emerald-300">
                    Opportunité gagnée — Félicitations ! 🎉
                  </span>
                </div>
              )}

              <Separator />

              {/* Move opportunity */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <ArrowRight className="size-3.5" />
                  Déplacer dans le pipeline
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {PIPELINE_STAGES.map(s => (
                    <Button
                      key={s.value}
                      size="sm"
                      variant={selectedOpportunity.statut === s.value ? 'default' : 'outline'}
                      className={`h-7 gap-1 text-xs ${
                        selectedOpportunity.statut === s.value
                          ? 'bg-[#134885] hover:bg-[#0D3A6E]'
                          : ''
                      }`}
                      onClick={async () => {
                        await moveOpportunity(selectedOpportunity.id, s.value)
                        await fetchOpportunityDetail(selectedOpportunity.id)
                      }}
                    >
                      <span className={`size-1.5 rounded-full ${s.color}`} />
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Operations */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Wrench className="size-3.5" />
                    Opérations ({selectedOpportunity.operations?.length || 0})
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setShowAddOperationDialog(true)}
                  >
                    <Plus className="size-3" /> Ajouter
                  </Button>
                </div>
                {selectedOpportunity.operations && selectedOpportunity.operations.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedOpportunity.operations.map(op => (
                      <div
                        key={op.id}
                        className="flex items-center justify-between rounded-lg border bg-white p-3 dark:bg-slate-800/50"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {op.produit} — {op.marque}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {op.responsable?.nom || 'Non assigné'} · {formatDZD(op.prixEstime)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <PriorityBadge priorite={op.priorite} />
                          <Badge
                            variant="outline"
                            className={
                              op.statut === 'en_attente'
                                ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                : op.statut === 'en_cours'
                                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300'
                                  : op.statut === 'terminee'
                                    ? 'bg-[#134885]/10 text-[#134885] dark:bg-[#134885]/20 dark:text-[#F6852A]'
                                    : ''
                            }
                          >
                            {op.statut === 'en_attente' ? 'En attente' : op.statut === 'en_cours' ? 'En cours' : op.statut === 'terminee' ? 'Terminée' : op.statut}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Aucune opération liée
                  </p>
                )}
              </div>

              <Separator />

              {/* Tasks */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <ListChecks className="size-3.5" />
                    Tâches ({selectedOpportunity.tasks?.length || 0})
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setShowAddTaskDialog(true)}
                  >
                    <Plus className="size-3" /> Ajouter
                  </Button>
                </div>
                {selectedOpportunity.tasks && selectedOpportunity.tasks.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedOpportunity.tasks.map(task => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between rounded-lg border bg-white p-3 dark:bg-slate-800/50"
                      >
                        <div>
                          <p className="text-sm font-medium">{task.titre}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.assigneA?.nom || 'Non assigné'}
                            {task.dateEcheance && ` · Échéance: ${formatDate(task.dateEcheance)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <PriorityBadge priorite={task.priorite} />
                          <Badge
                            variant="outline"
                            className={
                              task.statut === 'en_attente'
                                ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                : task.statut === 'en_cours'
                                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300'
                                  : task.statut === 'terminee'
                                    ? 'bg-[#134885]/10 text-[#134885] dark:bg-[#134885]/20 dark:text-[#F6852A]'
                                    : ''
                            }
                          >
                            {task.statut === 'en_attente' ? 'En attente' : task.statut === 'en_cours' ? 'En cours' : task.statut === 'terminee' ? 'Terminée' : task.statut}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Aucune tâche liée
                  </p>
                )}
              </div>

              <Separator />

              {/* Interactions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <MessageSquare className="size-3.5" />
                    Historique des interactions ({selectedOpportunity.interactions?.length || 0})
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-[#134885]/20 text-[#134885] hover:bg-[#134885]/5"
                    onClick={() => setShowAddInteractionDialog(true)}
                  >
                    <Plus className="size-3 mr-1" />
                    Ajouter
                  </Button>
                </div>
                {selectedOpportunity.interactions && selectedOpportunity.interactions.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedOpportunity.interactions.map(inter => {
                      const interactionType = INTERACTION_TYPES.find(t => t.value === inter.type)
                      const TypeIcon = interactionType?.icon || MessageSquare
                      return (
                        <div
                          key={inter.id}
                          className="flex items-start gap-3 rounded-lg border bg-white p-3 dark:bg-slate-800/50"
                        >
                          <div className="flex size-8 items-center justify-center rounded-full bg-[#134885]/10 dark:bg-[#134885]/20">
                            <TypeIcon className={`size-4 ${interactionType?.color || 'text-[#134885] dark:text-[#F6852A]'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{inter.notes || inter.type}</p>
                            <p className="text-xs text-muted-foreground">
                              {inter.employe?.nom || 'Système'} · {formatDateTime(inter.date)}
                            </p>
                            {inter.task && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <ListChecks className="size-3" />
                                Tâche: {inter.task.titre}
                              </p>
                            )}
                            {inter.afterSale && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Wrench className="size-3" />
                                SAV: {inter.afterSale.titre}
                              </p>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {interactionType?.label || inter.type}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Aucune interaction enregistrée
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    setShowDetailDialog(false)
                    openEditDialog(selectedOpportunity)
                  }}
                >
                  <Edit3 className="size-3.5" /> Modifier
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    setDeletingId(selectedOpportunity.id)
                    setShowDeleteDialog(true)
                  }}
                >
                  <Trash2 className="size-3.5" /> Supprimer
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ──────────────────────────── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="size-5" />
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription>
              Cette action est irréversible. L&apos;opportunité et toutes ses opérations associées seront supprimées.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} className="gap-1">
              <Trash2 className="size-4" /> Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Operation Dialog ───────────────────────────────── */}
      <Dialog open={showAddOperationDialog} onOpenChange={setShowAddOperationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="size-5 text-[#F6852A]" />
              Ajouter une opération
            </DialogTitle>
            <DialogDescription>
              Ajoutez une opération à cette opportunité.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Produit <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Nom du produit"
                value={operationForm.produit}
                onChange={e => setOperationForm(f => ({ ...f, produit: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Marque <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Nom de la marque"
                value={operationForm.marque}
                onChange={e => setOperationForm(f => ({ ...f, marque: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Prix estimé</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={operationForm.prixEstime}
                  onChange={e => setOperationForm(f => ({ ...f, prixEstime: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Marge</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={operationForm.marge}
                  onChange={e => setOperationForm(f => ({ ...f, marge: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Priorité</Label>
                <Select value={operationForm.priorite} onValueChange={v => setOperationForm(f => ({ ...f, priorite: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="haute">Haute</SelectItem>
                    <SelectItem value="moyenne">Moyenne</SelectItem>
                    <SelectItem value="basse">Basse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Statut</Label>
                <Select value={operationForm.statut} onValueChange={v => setOperationForm(f => ({ ...f, statut: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en_attente">En attente</SelectItem>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="terminee">Terminée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddOperationDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAddOperation}
              disabled={!operationForm.produit || !operationForm.marque}
              className="gap-1 bg-[#1A5A9E] hover:bg-[#134885]"
            >
              <Plus className="size-4" /> Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Task Dialog ────────────────────────────────────── */}
      <Dialog open={showAddTaskDialog} onOpenChange={setShowAddTaskDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="size-5 text-[#F6852A]" />
              Ajouter une tâche
            </DialogTitle>
            <DialogDescription>
              Ajoutez une tâche à cette opportunité.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Titre <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Titre de la tâche"
                value={taskForm.titre}
                onChange={e => setTaskForm(f => ({ ...f, titre: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Description</Label>
              <Textarea
                placeholder="Description de la tâche..."
                value={taskForm.description}
                onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Priorité</Label>
                <Select value={taskForm.priorite} onValueChange={v => setTaskForm(f => ({ ...f, priorite: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="haute">Haute</SelectItem>
                    <SelectItem value="moyenne">Moyenne</SelectItem>
                    <SelectItem value="basse">Basse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Échéance</Label>
                <Input
                  type="date"
                  value={taskForm.dateEcheance}
                  onChange={e => setTaskForm(f => ({ ...f, dateEcheance: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTaskDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAddTask}
              disabled={!taskForm.titre}
              className="gap-1 bg-[#1A5A9E] hover:bg-[#134885]"
            >
              <Plus className="size-4" /> Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Interaction Dialog */}
      <AddInteractionDialog
        open={showAddInteractionDialog}
        onOpenChange={setShowAddInteractionDialog}
        opportunityId={selectedOpportunity?.id}
        prospectId={selectedOpportunity?.clientId || undefined}
        contextLabel={selectedOpportunity?.nomProjet || 'cette opportunité'}
        onSuccess={() => {
          if (selectedOpportunity) fetchOpportunityDetail(selectedOpportunity.id)
        }}
      />

      {/* ─── Motif de Perte Dialog ──────────────────────────────── */}
      <Dialog open={motifPerteDialogOpen} onOpenChange={setMotifPerteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="size-5" />
              Motif de perte
            </DialogTitle>
            <DialogDescription>
              Pourquoi cette opportunité est-elle perdue ?
            </DialogDescription>
          </DialogHeader>
          <Select value={motifPerteValue} onValueChange={setMotifPerteValue}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un motif" />
            </SelectTrigger>
            <SelectContent>
              {MOTIFS_PERTE.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMotifPerteDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmMotifPerte}
              disabled={!motifPerteValue}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Droppable Column Component ──────────────────────────────────

function DroppableColumn({ id, isHovered, isDragging, children }: {
  id: string
  isHovered: boolean
  isDragging: boolean
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[280px] flex-shrink-0 flex-col rounded-xl border transition-all duration-200 ${
        isHovered || isOver
          ? 'border-[#F6852A]/60 bg-orange-50/50 shadow-md shadow-[#F6852A]/10 dark:border-[#F6852A]/40 dark:bg-orange-950/20'
          : 'border-slate-200/80 bg-white/50 dark:border-slate-800/80 dark:bg-slate-900/50'
      } ${isDragging ? '' : ''}`}
    >
      {children}
    </div>
  )
}

function KanbanCard({
  opportunity,
  onMove,
  onClick,
  onEdit,
  onDelete,
  dragHandleProps,
}: {
  opportunity: Opportunity
  onMove: (id: string, statut: string) => Promise<void>
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
  dragHandleProps?: Record<string, unknown>
}) {
  const stage = getStageConfig(opportunity.statut)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className="cursor-pointer border-0 bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-slate-800/80"
        onClick={onClick}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {opportunity.nomProjet}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                <User className="mr-1 inline size-3" />
                {opportunity.client?.nom || 'Client non assigné'}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="size-7 p-0 shrink-0">
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={e => { e.stopPropagation(); onEdit() }}>
                  <Edit3 className="mr-2 size-3.5" /> Modifier
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSeparator className="text-xs text-muted-foreground px-2 py-1">Déplacer vers</DropdownMenuSeparator>
                {PIPELINE_STAGES.filter(s => s.value !== opportunity.statut).map(s => (
                  <DropdownMenuItem
                    key={s.value}
                    onClick={e => { e.stopPropagation(); onMove(opportunity.id, s.value) }}
                  >
                    <span className={`mr-2 inline-block size-2 rounded-full ${s.color}`} />
                    {s.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={e => { e.stopPropagation(); onDelete() }}
                >
                  <Trash2 className="mr-2 size-3.5" /> Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            <DollarSign className="size-3 text-[#F6852A]" />
            <span className="text-xs font-semibold text-[#134885] dark:text-[#F6852A]">
              {formatDZD(opportunity.montantEstime)}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="flex size-5 items-center justify-center rounded-full bg-[#134885]/10 dark:bg-[#134885]/20">
                <User className="size-3 text-[#134885] dark:text-[#F6852A]" />
              </div>
              <span className="text-xs text-muted-foreground">
                {opportunity.commercial?.nom || '—'}
              </span>
            </div>
            {(opportunity.operations?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                <Wrench className="mr-0.5 size-2.5" />
                {opportunity.operations!.length}
              </Badge>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between border-t pt-2">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="size-3" />
              {formatDate(opportunity.createdAt)}
            </div>
            <button
              className="cursor-grab rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-[#F6852A] active:cursor-grabbing"
              {...(dragHandleProps || {})}
              onClick={e => e.stopPropagation()}
            >
              <GripVertical className="size-3.5" />
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Sortable Kanban Card Component ──────────────────────────────

function SortableKanbanCard({ opportunity, onMove, onClick, onEdit, onDelete }: {
  opportunity: Opportunity
  onMove: (id: string, statut: string) => Promise<void>
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: opportunity.id,
    data: { type: 'opportunity', statut: opportunity.statut },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <KanbanCard
        opportunity={opportunity}
        onMove={onMove}
        onClick={onClick}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}
