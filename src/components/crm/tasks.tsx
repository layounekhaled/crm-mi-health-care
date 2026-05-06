'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckSquare,
  Plus,
  Phone,
  Wrench,
  Calendar,
  Settings,
  Loader2,
  Edit3,
  Trash2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ListChecks,
  User,
  Search,
  X,
  MessageSquare,
} from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { AddInteractionDialog, INTERACTION_TYPES } from '@/components/crm/add-interaction-dialog'

// ─── Types ───────────────────────────────────────────────────────

interface Employee {
  id: string
  nom: string
  email?: string | null
  role: string
  actif: boolean
}

interface Prospect {
  id: string
  nom: string
  wilaya?: string | null
}

interface Opportunity {
  id: string
  nomProjet: string
  statut: string
}

interface Operation {
  id: string
  produit: string
  marque: string
}

interface CRMEvent {
  id: string
  nom: string
  date: string
}

interface Task {
  id: string
  titre: string
  type: string
  assigneAId?: string | null
  prospectId?: string | null
  opportunityId?: string | null
  operationId?: string | null
  eventId?: string | null
  description?: string | null
  dateEcheance?: string | null
  priorite: string
  statut: string
  createdAt: string
  updatedAt: string
  assigneA?: { id: string; nom: string; role?: string } | null
  prospect?: { id: string; nom: string } | null
  opportunity?: { id: string; nomProjet: string } | null
  operation?: { id: string; produit: string; marque: string } | null
  event?: { id: string; nom: string; date?: string } | null
}

// ─── Constants ───────────────────────────────────────────────────

const TASK_TYPES = [
  { value: 'commerciale', label: 'Commerciale', icon: Phone, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', dotColor: 'bg-blue-500' },
  { value: 'technique', label: 'Technique', icon: Wrench, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300', dotColor: 'bg-purple-500' },
  { value: 'evenement', label: 'Événement', icon: Calendar, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', dotColor: 'bg-amber-500' },
  { value: 'interne', label: 'Interne', icon: Settings, color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', dotColor: 'bg-slate-500' },
] as const

const PRIORITIES = [
  { value: 'basse', label: 'Basse', dotColor: 'bg-slate-400' },
  { value: 'moyenne', label: 'Moyenne', dotColor: 'bg-amber-500' },
  { value: 'haute', label: 'Haute', dotColor: 'bg-red-500' },
] as const

const STATUSES = [
  { value: 'en_attente', label: 'En attente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  { value: 'en_cours', label: 'En cours', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  { value: 'terminee', label: 'Terminée', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
] as const

// ─── Helpers ─────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function isOverdue(dateEcheance: string | null | undefined, statut: string): boolean {
  if (!dateEcheance || statut === 'terminee') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(dateEcheance)
  dueDate.setHours(0, 0, 0, 0)
  return dueDate < today
}

function getTypeConfig(type: string) {
  return TASK_TYPES.find(t => t.value === type) || TASK_TYPES[0]
}

function getPriorityConfig(priorite: string) {
  return PRIORITIES.find(p => p.value === priorite) || PRIORITIES[1]
}

function getStatusConfig(statut: string) {
  return STATUSES.find(s => s.value === statut) || STATUSES[0]
}

function getInitials(nom: string): string {
  return nom
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ─── Main Component ──────────────────────────────────────────────

export default function TasksModule() {
  const { toast } = useToast()

  // Data
  const [tasks, setTasks] = useState<Task[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [events, setEvents] = useState<CRMEvent[]>([])

  // Loading
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Filters
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [filterPriorite, setFilterPriorite] = useState<string>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [showMyTasks, setShowMyTasks] = useState(false)

  // Dialogs
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showAddInteractionDialog, setShowAddInteractionDialog] = useState(false)
  const [interactionTaskId, setInteractionTaskId] = useState<string | null>(null)
  const [interactionTaskName, setInteractionTaskName] = useState('')
  const [completeOnInteraction, setCompleteOnInteraction] = useState(false)
  const [interactionProspectId, setInteractionProspectId] = useState<string | null>(null)
  const [interactionOpportunityId, setInteractionOpportunityId] = useState<string | null>(null)

  // Form
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    titre: '',
    type: 'commerciale',
    assigneAId: 'none',
    prospectId: 'none',
    opportunityId: 'none',
    operationId: 'none',
    eventId: 'none',
    description: '',
    dateEcheance: '',
    priorite: 'moyenne',
    statut: 'en_attente',
  })

  // Search
  const [searchTerm, setSearchTerm] = useState('')
  const [prospectSearch, setProspectSearch] = useState('')
  const [opportunitySearch, setOpportunitySearch] = useState('')

  // ─── Data Fetching ─────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterType !== 'all') params.set('type', filterType)
      if (filterStatut !== 'all') params.set('statut', filterStatut)
      if (filterPriorite !== 'all') params.set('priorite', filterPriorite)
      if (filterAssignee !== 'all') params.set('assigneAId', filterAssignee)

      const res = await fetch(`/api/tasks?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    }
  }, [filterType, filterStatut, filterPriorite, filterAssignee])

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

  const fetchProspects = useCallback(async () => {
    try {
      const res = await fetch('/api/prospects?limit=200')
      if (res.ok) {
        const data = await res.json()
        setProspects(data.data || data)
      }
    } catch (err) {
      console.error('Failed to fetch prospects:', err)
    }
  }, [])

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

  const fetchOperations = useCallback(async () => {
    try {
      const res = await fetch('/api/operations')
      if (res.ok) {
        const data = await res.json()
        setOperations(data)
      }
    } catch (err) {
      console.error('Failed to fetch operations:', err)
    }
  }, [])

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events')
      if (res.ok) {
        const data = await res.json()
        setEvents(data)
      }
    } catch (err) {
      console.error('Failed to fetch events:', err)
    }
  }, [])

  // Initial load - fetch all reference data once
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([
        fetchTasks(),
        fetchEmployees(),
        fetchProspects(),
        fetchOpportunities(),
        fetchOperations(),
        fetchEvents(),
      ])
      setLoading(false)
      setInitialLoadDone(true)
    }
    load()
  }, [])

  // Re-fetch tasks when filters change (after initial load)
  useEffect(() => {
    if (initialLoadDone) {
      fetchTasks()
    }
  }, [filterType, filterStatut, filterPriorite, filterAssignee, fetchTasks, initialLoadDone])

  // ─── Computed Data ─────────────────────────────────────────────

  const filteredTasks = tasks.filter(task => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matchTitle = task.titre.toLowerCase().includes(search)
      const matchAssignee = task.assigneA?.nom?.toLowerCase().includes(search)
      const matchDescription = task.description?.toLowerCase().includes(search)
      if (!matchTitle && !matchAssignee && !matchDescription) return false
    }
    return true
  })

  // Sort: overdue first, then by priority (haute > moyenne > basse), then by date
  const priorityOrder: Record<string, number> = { haute: 0, moyenne: 1, basse: 2 }
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // Overdue tasks first
    const aOverdue = isOverdue(a.dateEcheance, a.statut)
    const bOverdue = isOverdue(b.dateEcheance, b.statut)
    if (aOverdue && !bOverdue) return -1
    if (!aOverdue && bOverdue) return 1

    // Then by status (en_attente > en_cours > terminee)
    const statusOrder: Record<string, number> = { en_attente: 0, en_cours: 1, terminee: 2 }
    const statusDiff = (statusOrder[a.statut] ?? 1) - (statusOrder[b.statut] ?? 1)
    if (statusDiff !== 0) return statusDiff

    // Then by priority
    const prioDiff = (priorityOrder[a.priorite] ?? 1) - (priorityOrder[b.priorite] ?? 1)
    if (prioDiff !== 0) return prioDiff

    // Then by due date (nulls last)
    if (a.dateEcheance && b.dateEcheance) {
      return new Date(a.dateEcheance).getTime() - new Date(b.dateEcheance).getTime()
    }
    if (a.dateEcheance) return -1
    if (b.dateEcheance) return 1

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const totalTasks = filteredTasks.length
  const enAttente = filteredTasks.filter(t => t.statut === 'en_attente').length
  const enCours = filteredTasks.filter(t => t.statut === 'en_cours').length
  const terminees = filteredTasks.filter(t => t.statut === 'terminee').length
  const enRetard = filteredTasks.filter(t => isOverdue(t.dateEcheance, t.statut)).length

  // Search-filtered selects
  const filteredProspects = prospects.filter(p => {
    if (!prospectSearch) return true
    return p.nom.toLowerCase().includes(prospectSearch.toLowerCase())
  })

  const filteredOpportunities = opportunities.filter(o => {
    if (!opportunitySearch) return true
    return o.nomProjet.toLowerCase().includes(opportunitySearch.toLowerCase())
  })

  // ─── Form Handlers ─────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingId(null)
    setFormData({
      titre: '',
      type: 'commerciale',
      assigneAId: 'none',
      prospectId: 'none',
      opportunityId: 'none',
      operationId: 'none',
      eventId: 'none',
      description: '',
      dateEcheance: '',
      priorite: 'moyenne',
      statut: 'en_attente',
    })
    setProspectSearch('')
    setOpportunitySearch('')
    setShowFormDialog(true)
  }

  const openEditDialog = (task: Task) => {
    setEditingId(task.id)
    setFormData({
      titre: task.titre,
      type: task.type,
      assigneAId: task.assigneAId || 'none',
      prospectId: task.prospectId || 'none',
      opportunityId: task.opportunityId || 'none',
      operationId: task.operationId || 'none',
      eventId: task.eventId || 'none',
      description: task.description || '',
      dateEcheance: task.dateEcheance ? new Date(task.dateEcheance).toISOString().split('T')[0] : '',
      priorite: task.priorite,
      statut: task.statut,
    })
    setProspectSearch(task.prospect?.nom || '')
    setOpportunitySearch(task.opportunity?.nomProjet || '')
    setShowFormDialog(true)
  }

  const handleSave = async () => {
    if (!formData.titre.trim()) return
    setSaving(true)
    try {
      // Convert "none" values to null for optional foreign keys
      const cleanId = (val: string) => (val && val !== 'none' ? val : null)

      const payload: Record<string, unknown> = {
        titre: formData.titre.trim(),
        type: formData.type,
        assigneAId: cleanId(formData.assigneAId),
        prospectId: cleanId(formData.prospectId),
        opportunityId: cleanId(formData.opportunityId),
        operationId: cleanId(formData.operationId),
        eventId: cleanId(formData.eventId),
        description: formData.description || null,
        dateEcheance: formData.dateEcheance || null,
        priorite: formData.priorite,
        statut: formData.statut,
      }

      if (editingId) {
        const res = await fetch(`/api/tasks/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Update failed')
        toast({ title: 'Tâche modifiée', description: 'La tâche a été mise à jour avec succès.' })
      } else {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Create failed')
        toast({ title: 'Tâche créée', description: 'La nouvelle tâche a été créée avec succès.' })
      }

      setShowFormDialog(false)
      await fetchTasks()
    } catch (err) {
      console.error('Save failed:', err)
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder la tâche.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleQuickComplete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'terminee' }),
      })
      if (res.ok) {
        toast({ title: 'Tâche terminée !', description: 'La tâche a été marquée comme terminée.' })
        await fetchTasks()
      }
    } catch (err) {
      console.error('Quick complete failed:', err)
      toast({ title: 'Erreur', description: 'Impossible de terminer la tâche.', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      const res = await fetch(`/api/tasks/${deletingId}`, { method: 'DELETE' })
      if (res.ok) {
        setShowDeleteDialog(false)
        setDeletingId(null)
        toast({ title: 'Tâche supprimée', description: 'La tâche a été supprimée avec succès.' })
        await fetchTasks()
      }
    } catch (err) {
      console.error('Delete failed:', err)
      toast({ title: 'Erreur', description: 'Impossible de supprimer la tâche.', variant: 'destructive' })
    }
  }

  const confirmDelete = (taskId: string) => {
    setDeletingId(taskId)
    setShowDeleteDialog(true)
  }

  const openInteractionDialog = (task: Task, shouldComplete: boolean = false) => {
    setInteractionTaskId(task.id)
    setInteractionTaskName(task.titre)
    setCompleteOnInteraction(shouldComplete)
    setInteractionProspectId(task.prospectId || null)
    setInteractionOpportunityId(task.opportunityId || null)
    setShowAddInteractionDialog(true)
  }

  // ─── Linked entity label ───────────────────────────────────────

  function getLinkedEntity(task: Task): { label: string; type: string } | null {
    if (task.prospect) return { label: task.prospect.nom, type: 'Prospect' }
    if (task.opportunity) return { label: task.opportunity.nomProjet, type: 'Opportunité' }
    if (task.operation) return { label: `${task.operation.produit} - ${task.operation.marque}`, type: 'Opération' }
    if (task.event) return { label: task.event.nom, type: 'Événement' }
    return null
  }

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/20">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/80 backdrop-blur-md dark:border-blue-900/50 dark:bg-slate-950/80">
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3">
            {/* Top row: title + actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="MI HEALTH CARE" className="h-9 w-auto shrink-0 object-contain" />
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-[#134885] dark:text-white">
                    Tâches
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Gestion des tâches
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="h-9 w-full pl-8 sm:w-48"
                  />
                </div>
                {/* My Tasks Toggle */}
                <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 dark:bg-slate-900">
                  <Label htmlFor="my-tasks-toggle" className="cursor-pointer text-xs font-medium whitespace-nowrap">
                    {showMyTasks ? 'Mes tâches' : 'Toutes'}
                  </Label>
                  <Checkbox
                    id="my-tasks-toggle"
                    checked={showMyTasks}
                    onCheckedChange={(checked) => {
                      setShowMyTasks(!!checked)
                      if (checked && employees.length > 0) {
                        setFilterAssignee(employees[0].id)
                      } else {
                        setFilterAssignee('all')
                      }
                    }}
                    className="border-[#F6852A] data-[state=checked]:bg-[#134885] data-[state=checked]:border-[#134885]"
                  />
                </div>
                {/* New Task Button */}
                <Button
                  onClick={openCreateDialog}
                  className="gap-1.5 bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white shadow-lg shadow-[#134885]/25 hover:from-[#0D3A6E] hover:to-[#134885]"
                >
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">Nouvelle Tâche</span>
                  <span className="sm:hidden">Nouvelle</span>
                </Button>
              </div>
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {TASK_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        <t.icon className="size-3.5" />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatut} onValueChange={setFilterStatut}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterPriorite} onValueChange={setFilterPriorite}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="Priorité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes priorités</SelectItem>
                  {PRIORITIES.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        <span className={`inline-block size-2 rounded-full ${p.dotColor}`} />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue placeholder="Assigné à" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les assignés</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(filterType !== 'all' || filterStatut !== 'all' || filterPriorite !== 'all' || filterAssignee !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setFilterType('all')
                    setFilterStatut('all')
                    setFilterPriorite('all')
                    setFilterAssignee('all')
                    setShowMyTasks(false)
                  }}
                >
                  <X className="size-3" />
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ListChecks className="size-3.5 text-[#134885]" />
                Total tâches
              </div>
              <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                {totalTasks}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="size-3.5 text-amber-500" />
                En attente
              </div>
              <p className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400">
                {enAttente}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 text-blue-500" />
                En cours
              </div>
              <p className="mt-1 text-xl font-bold text-blue-600 dark:text-blue-400">
                {enCours}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                Terminées
              </div>
              <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {terminees}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70 col-span-2 sm:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="size-3.5 text-red-500" />
                En retard
              </div>
              <p className="mt-1 text-xl font-bold text-red-600 dark:text-red-400">
                {enRetard}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Task List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-[#134885]" />
            <span className="mt-3 text-sm text-muted-foreground">Chargement des tâches...</span>
          </div>
        ) : sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-20 dark:border-slate-800">
            <CheckSquare className="mb-3 size-12 text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-medium text-slate-500">Aucune tâche trouvée</p>
            <p className="mt-1 text-xs text-slate-400">
              Créez une nouvelle tâche ou modifiez vos filtres
            </p>
            <Button
              onClick={openCreateDialog}
              className="mt-4 gap-1.5 bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white shadow-lg shadow-[#134885]/25 hover:from-[#0D3A6E] hover:to-[#134885]"
            >
              <Plus className="size-4" />
              Nouvelle Tâche
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {sortedTasks.map(task => {
                const typeConfig = getTypeConfig(task.type)
                const priorityConfig = getPriorityConfig(task.priorite)
                const statusConfig = getStatusConfig(task.statut)
                const overdue = isOverdue(task.dateEcheance, task.statut)
                const linkedEntity = getLinkedEntity(task)
                const isDone = task.statut === 'terminee'
                const TypeIcon = typeConfig.icon

                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      className={`group relative overflow-hidden border-0 bg-white/90 shadow-sm transition-all duration-200 hover:shadow-md dark:bg-slate-900/90 ${
                        overdue ? 'border-l-4 border-l-red-500' : ''
                      } ${isDone ? 'opacity-70' : ''}`}
                    >
                      {/* Overdue red left border accent */}
                      {overdue && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
                      )}

                      <CardContent className="p-4">
                        {/* Top: Checkbox + Title + Actions */}
                        <div className="flex items-start gap-3">
                          <div className="flex items-center gap-1">
                            <Checkbox
                              checked={isDone}
                              onCheckedChange={() => {
                                if (!isDone) {
                                  handleQuickComplete(task.id)
                                }
                              }}
                              className="mt-0.5 shrink-0 border-[#F6852A] data-[state=checked]:bg-[#134885] data-[state=checked]:border-[#134885]"
                              disabled={isDone}
                            />
                            {task.statut !== 'terminee' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openInteractionDialog(task, true)
                                }}
                                className="text-[10px] text-[#F6852A] hover:underline ml-2"
                              >
                                Terminer + Interaction
                              </button>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3
                                className={`text-sm font-semibold leading-snug ${
                                  isDone
                                    ? 'text-slate-400 line-through dark:text-slate-600'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {task.titre}
                              </h3>
                              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-7 p-0 text-slate-400 hover:text-[#134885]"
                                  onClick={() => openEditDialog(task)}
                                >
                                  <Edit3 className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-[#134885]"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openInteractionDialog(task, task.statut !== 'terminee')
                                  }}
                                  title="Ajouter une interaction"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-7 p-0 text-slate-400 hover:text-red-600"
                                  onClick={() => confirmDelete(task.id)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Description preview */}
                            {task.description && (
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Badges row */}
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {/* Type badge */}
                          <Badge variant="outline" className={`gap-1 text-[10px] font-medium ${typeConfig.color}`}>
                            <TypeIcon className="size-3" />
                            {typeConfig.label}
                          </Badge>

                          {/* Status badge */}
                          <Badge variant="outline" className={`text-[10px] font-medium ${statusConfig.color}`}>
                            {statusConfig.label}
                          </Badge>

                          {/* Overdue badge */}
                          {overdue && (
                            <Badge variant="destructive" className="gap-1 text-[10px] font-bold">
                              <AlertTriangle className="size-3" />
                              EN RETARD
                            </Badge>
                          )}

                          {/* Priority dot */}
                          <div className="flex items-center gap-1">
                            <span className={`inline-block size-2 rounded-full ${priorityConfig.dotColor}`} />
                            <span className="text-[10px] text-muted-foreground capitalize">
                              {priorityConfig.label}
                            </span>
                          </div>
                        </div>

                        {/* Linked entity */}
                        {linkedEntity && (
                          <div className="mt-2">
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              <span className="mr-1 text-muted-foreground">{linkedEntity.type}:</span>
                              {linkedEntity.label}
                            </Badge>
                          </div>
                        )}

                        <Separator className="my-3 bg-slate-100 dark:bg-slate-800" />

                        {/* Bottom: Assignee + Due date */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {task.assigneA ? (
                              <div className="flex items-center gap-2">
                                <div className="flex size-6 items-center justify-center rounded-full bg-[#134885]/10 text-[10px] font-bold text-[#134885] dark:bg-[#134885]/20 dark:text-[#F6852A]">
                                  {getInitials(task.assigneA.nom)}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {task.assigneA.nom}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-xs text-slate-400">
                                <User className="size-3.5" />
                                Non assigné
                              </div>
                            )}
                          </div>
                          {task.dateEcheance && (
                            <div
                              className={`flex items-center gap-1 text-xs ${
                                overdue
                                  ? 'font-semibold text-red-600 dark:text-red-400'
                                  : isDone
                                    ? 'text-slate-400'
                                    : 'text-muted-foreground'
                              }`}
                            >
                              <Calendar className="size-3" />
                              {formatDate(task.dateEcheance)}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* ─── Add/Edit Dialog ────────────────────────────────────── */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#134885]/10 dark:bg-[#134885]/20">
                <CheckSquare className="size-4 text-[#134885] dark:text-[#F6852A]" />
              </div>
              {editingId ? 'Modifier la tâche' : 'Nouvelle tâche'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Modifiez les informations de la tâche.'
                : 'Créez une nouvelle tâche et assignez-la à un membre de l\'équipe.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Titre */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Titre <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Ex: Relancer le client pour devis"
                value={formData.titre}
                onChange={e => setFormData(f => ({ ...f, titre: e.target.value }))}
              />
            </div>

            {/* Type + Priorité */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={v => setFormData(f => ({ ...f, type: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">
                          <t.icon className="size-3.5" />
                          {t.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Priorité</Label>
                <Select
                  value={formData.priorite}
                  onValueChange={v => setFormData(f => ({ ...f, priorite: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className="flex items-center gap-2">
                          <span className={`inline-block size-2 rounded-full ${p.dotColor}`} />
                          {p.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Assigné à */}
            <div className="space-y-1.5">
              <Label className="text-sm">Assigné à</Label>
              <Select
                value={formData.assigneAId}
                onValueChange={v => setFormData(f => ({ ...f, assigneAId: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un employé" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigné</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      <span className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-full bg-[#134885]/10 text-[9px] font-bold text-[#134885]">
                          {getInitials(emp.nom)}
                        </span>
                        {emp.nom}
                        <span className="text-xs text-muted-foreground">({emp.role})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Statut + Date d'échéance */}
            <div className="grid grid-cols-2 gap-3">
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
                    {STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Date d&apos;échéance</Label>
                <Input
                  type="date"
                  value={formData.dateEcheance}
                  onChange={e => setFormData(f => ({ ...f, dateEcheance: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>

            {/* Lié à section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Separator className="flex-1" />
                <span className="text-xs font-medium text-muted-foreground">Lié à (optionnel)</span>
                <Separator className="flex-1" />
              </div>

              {/* Prospect */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Prospect</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un prospect..."
                    value={prospectSearch}
                    onChange={e => setProspectSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <Select
                  value={formData.prospectId}
                  onValueChange={v => {
                    setFormData(f => ({ ...f, prospectId: v }))
                    const p = prospects.find(pr => pr.id === v)
                    if (p) setProspectSearch(p.nom)
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sélectionner un prospect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {filteredProspects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nom} {p.wilaya ? `(${p.wilaya})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Opportunité */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Opportunité</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher une opportunité..."
                    value={opportunitySearch}
                    onChange={e => setOpportunitySearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <Select
                  value={formData.opportunityId}
                  onValueChange={v => {
                    setFormData(f => ({ ...f, opportunityId: v }))
                    const o = opportunities.find(op => op.id === v)
                    if (o) setOpportunitySearch(o.nomProjet)
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sélectionner une opportunité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {filteredOpportunities.map(o => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.nomProjet}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Opération */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Opération</Label>
                <Select
                  value={formData.operationId}
                  onValueChange={v => setFormData(f => ({ ...f, operationId: v }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sélectionner une opération" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {operations.map(o => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.produit} — {o.marque}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Événement */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Événement</Label>
                <Select
                  value={formData.eventId}
                  onValueChange={v => setFormData(f => ({ ...f, eventId: v }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sélectionner un événement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {events.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nom} — {formatDate(e.date)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-sm">Description</Label>
              <Textarea
                placeholder="Détails de la tâche..."
                value={formData.description}
                onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFormDialog(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.titre.trim()}
              className="gap-1.5 bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white hover:from-[#0D3A6E] hover:to-[#134885]"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editingId ? 'Enregistrer' : 'Créer la tâche'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─────────────────────────── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/50">
                <Trash2 className="size-4 text-red-600 dark:text-red-400" />
              </div>
              Supprimer la tâche
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cette tâche ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false)
                setDeletingId(null)
              }}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="gap-1.5"
            >
              <Trash2 className="size-4" />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Interaction Dialog ──────────────────────────────── */}
      <AddInteractionDialog
        open={showAddInteractionDialog}
        onOpenChange={setShowAddInteractionDialog}
        taskId={interactionTaskId || undefined}
        prospectId={interactionProspectId || undefined}
        opportunityId={interactionOpportunityId || undefined}
        contextLabel={interactionTaskName || 'cette tâche'}
        onCompleteTask={completeOnInteraction ? interactionTaskId || undefined : undefined}
        onSuccess={() => {
          fetchTasks()
        }}
      />
    </div>
  )
}
