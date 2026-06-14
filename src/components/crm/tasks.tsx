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
  Image,
  ChevronDown,
  ChevronUp,
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

interface InteractionPhoto {
  id: string
  url: string
  fileName: string
  fileSize: number
}

interface Interaction {
  id: string
  type: string
  notes?: string | null
  date: string
  employeId?: string | null
  taskId?: string | null
  photos: InteractionPhoto[]
  employe?: { id: string; nom: string; role?: string } | null
}

interface TaskAssignee {
  id: string
  employeeId: string
  employee: { id: string; nom: string; role?: string }
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
  creeParId?: string | null
  createdAt: string
  updatedAt: string
  assigneA?: { id: string; nom: string; role?: string } | null
  assignees?: TaskAssignee[]
  prospect?: { id: string; nom: string } | null
  opportunity?: { id: string; nomProjet: string } | null
  operation?: { id: string; produit: string; marque: string } | null
  event?: { id: string; nom: string; date?: string } | null
  interactions?: Interaction[]
  creePar?: { id: string; nom: string } | null
  modifiePar?: { id: string; nom: string } | null
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

const INTERACTION_TYPE_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  appel: { label: 'Appel', color: 'text-blue-600', dotColor: 'bg-blue-500' },
  whatsapp: { label: 'WhatsApp', color: 'text-green-600', dotColor: 'bg-green-500' },
  email: { label: 'Email', color: 'text-purple-600', dotColor: 'bg-purple-500' },
  visite: { label: 'Visite', color: 'text-amber-600', dotColor: 'bg-amber-500' },
  autre: { label: 'Autre', color: 'text-slate-600', dotColor: 'bg-slate-500' },
}

// ─── Helpers ─────────────────────────────────────────────────────

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
  const [interactionProspectId, setInteractionProspectId] = useState<string | null>(null)
  const [interactionOpportunityId, setInteractionOpportunityId] = useState<string | null>(null)

  // Task detail dialog
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [expandedPhotos, setExpandedPhotos] = useState<string | null>(null)

  // Form
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    titre: '',
    type: 'commerciale',
    prospectId: 'none',
    opportunityId: 'none',
    operationId: 'none',
    eventId: 'none',
    description: '',
    dateEcheance: '',
    priorite: 'moyenne',
    statut: 'en_attente',
  })
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([])

  // Search
  const [searchTerm, setSearchTerm] = useState('')
  const [prospectSearch, setProspectSearch] = useState('')
  const [opportunitySearch, setOpportunitySearch] = useState('')
  const [assigneeSearch, setAssigneeSearch] = useState('')

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
      const matchAssignee = task.assignees?.some(a => a.employee.nom.toLowerCase().includes(search))
        || task.assigneA?.nom?.toLowerCase().includes(search)
      const matchDescription = task.description?.toLowerCase().includes(search)
      if (!matchTitle && !matchAssignee && !matchDescription) return false
    }
    return true
  })

  // Sort: overdue first, then by priority (haute > moyenne > basse), then by date
  const priorityOrder: Record<string, number> = { haute: 0, moyenne: 1, basse: 2 }
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const aOverdue = isOverdue(a.dateEcheance, a.statut)
    const bOverdue = isOverdue(b.dateEcheance, b.statut)
    if (aOverdue && !bOverdue) return -1
    if (!aOverdue && bOverdue) return 1

    const statusOrder: Record<string, number> = { en_attente: 0, en_cours: 1, terminee: 2 }
    const statusDiff = (statusOrder[a.statut] ?? 1) - (statusOrder[b.statut] ?? 1)
    if (statusDiff !== 0) return statusDiff

    const prioDiff = (priorityOrder[a.priorite] ?? 1) - (priorityOrder[b.priorite] ?? 1)
    if (prioDiff !== 0) return prioDiff

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

  const filteredEmployees = employees.filter(emp => {
    if (!assigneeSearch) return true
    return emp.nom.toLowerCase().includes(assigneeSearch.toLowerCase())
  })

  // ─── Form Handlers ─────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingId(null)
    setFormData({
      titre: '',
      type: 'commerciale',
      prospectId: 'none',
      opportunityId: 'none',
      operationId: 'none',
      eventId: 'none',
      description: '',
      dateEcheance: '',
      priorite: 'moyenne',
      statut: 'en_attente',
    })
    setSelectedAssigneeIds([])
    setProspectSearch('')
    setOpportunitySearch('')
    setAssigneeSearch('')
    setShowFormDialog(true)
  }

  const openEditDialog = (task: Task) => {
    setEditingId(task.id)
    setFormData({
      titre: task.titre,
      type: task.type,
      prospectId: task.prospectId || 'none',
      opportunityId: task.opportunityId || 'none',
      operationId: task.operationId || 'none',
      eventId: task.eventId || 'none',
      description: task.description || '',
      dateEcheance: task.dateEcheance ? new Date(task.dateEcheance).toISOString().split('T')[0] : '',
      priorite: task.priorite,
      statut: task.statut,
    })
    // Set assignees from junction table
    setSelectedAssigneeIds(task.assignees?.map(a => a.employeeId) || (task.assigneAId ? [task.assigneAId] : []))
    setProspectSearch(task.prospect?.nom || '')
    setOpportunitySearch(task.opportunity?.nomProjet || '')
    setAssigneeSearch('')
    setShowFormDialog(true)
  }

  const handleSave = async () => {
    if (!formData.titre.trim()) return
    setSaving(true)
    try {
      const cleanId = (val: string) => (val && val !== 'none' ? val : null)

      const payload: Record<string, unknown> = {
        titre: formData.titre.trim(),
        type: formData.type,
        prospectId: cleanId(formData.prospectId),
        opportunityId: cleanId(formData.opportunityId),
        operationId: cleanId(formData.operationId),
        eventId: cleanId(formData.eventId),
        description: formData.description || null,
        dateEcheance: formData.dateEcheance || null,
        priorite: formData.priorite,
        statut: formData.statut,
        assigneAIds: selectedAssigneeIds,
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

  const openInteractionDialog = (task: Task) => {
    setInteractionTaskId(task.id)
    setInteractionTaskName(task.titre)
    setInteractionProspectId(task.prospectId || null)
    setInteractionOpportunityId(task.opportunityId || null)
    setShowAddInteractionDialog(true)
  }

  const openTaskDetail = (task: Task) => {
    setDetailTask(task)
    setShowDetailDialog(true)
  }

  // ─── Linked entity label ───────────────────────────────────────

  function getLinkedEntity(task: Task): { label: string; type: string } | null {
    if (task.prospect) return { label: task.prospect.nom, type: 'Prospect' }
    if (task.opportunity) return { label: task.opportunity.nomProjet, type: 'Opportunité' }
    if (task.operation) return { label: `${task.operation.produit} - ${task.operation.marque}`, type: 'Opération' }
    if (task.event) return { label: task.event.nom, type: 'Événement' }
    return null
  }

  // Get all assignees for display
  function getAssignees(task: Task): { id: string; nom: string }[] {
    if (task.assignees && task.assignees.length > 0) {
      return task.assignees.map(a => ({ id: a.employee.id, nom: a.employee.nom }))
    }
    if (task.assigneA) {
      return [{ id: task.assigneA.id, nom: task.assigneA.nom }]
    }
    return []
  }

  // Toggle assignee in form
  const toggleAssignee = (empId: string) => {
    setSelectedAssigneeIds(prev =>
      prev.includes(empId)
        ? prev.filter(id => id !== empId)
        : [...prev, empId]
    )
  }

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/20">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/80 backdrop-blur-md dark:border-blue-900/50 dark:bg-slate-950/80">
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3">
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
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="h-9 w-full pl-8 sm:w-48"
                  />
                </div>
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
              <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{totalTasks}</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="size-3.5 text-amber-500" />
                En attente
              </div>
              <p className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400">{enAttente}</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 text-blue-500" />
                En cours
              </div>
              <p className="mt-1 text-xl font-bold text-blue-600 dark:text-blue-400">{enCours}</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                Terminées
              </div>
              <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">{terminees}</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70 col-span-2 sm:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="size-3.5 text-red-500" />
                En retard
              </div>
              <p className="mt-1 text-xl font-bold text-red-600 dark:text-red-400">{enRetard}</p>
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
            <p className="mt-1 text-xs text-slate-400">Créez une nouvelle tâche ou modifiez vos filtres</p>
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
                const assignees = getAssignees(task)
                const interactionCount = task.interactions?.length || 0

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
                      className={`group relative overflow-hidden border-0 bg-white/90 shadow-sm transition-all duration-200 hover:shadow-md dark:bg-slate-900/90 cursor-pointer ${
                        overdue ? 'border-l-4 border-l-red-500' : ''
                      } ${isDone ? 'opacity-70' : ''}`}
                      onClick={() => openTaskDetail(task)}
                    >
                      {overdue && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
                      )}

                      <CardContent className="p-4">
                        {/* Top: Checkbox + Title + Actions */}
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isDone}
                            onCheckedChange={(e) => {
                              e.stopPropagation()
                              if (!isDone) handleQuickComplete(task.id)
                            }}
                            className="mt-0.5 shrink-0 border-[#F6852A] data-[state=checked]:bg-[#134885] data-[state=checked]:border-[#134885]"
                            disabled={isDone}
                          />
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
                                  onClick={(e) => { e.stopPropagation(); openEditDialog(task) }}
                                >
                                  <Edit3 className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-[#134885]"
                                  onClick={(e) => { e.stopPropagation(); openInteractionDialog(task) }}
                                  title="Ajouter une interaction"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-7 p-0 text-slate-400 hover:text-red-600"
                                  onClick={(e) => { e.stopPropagation(); confirmDelete(task.id) }}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>

                            {task.description && (
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Badges row */}
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={`gap-1 text-[10px] font-medium ${typeConfig.color}`}>
                            <TypeIcon className="size-3" />
                            {typeConfig.label}
                          </Badge>

                          <Badge variant="outline" className={`text-[10px] font-medium ${statusConfig.color}`}>
                            {statusConfig.label}
                          </Badge>

                          {overdue && (
                            <Badge variant="destructive" className="gap-1 text-[10px] font-bold">
                              <AlertTriangle className="size-3" />
                              EN RETARD
                            </Badge>
                          )}

                          <div className="flex items-center gap-1">
                            <span className={`inline-block size-2 rounded-full ${priorityConfig.dotColor}`} />
                            <span className="text-[10px] text-muted-foreground capitalize">{priorityConfig.label}</span>
                          </div>

                          {interactionCount > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-[#134885]">
                              <MessageSquare className="size-3" />
                              {interactionCount}
                            </div>
                          )}
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

                        {/* Bottom: Assignees + Due date */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {assignees.length > 0 ? (
                              <div className="flex items-center">
                                {assignees.slice(0, 3).map((a, i) => (
                                  <div
                                    key={a.id}
                                    className="flex size-6 items-center justify-center rounded-full bg-[#134885]/10 text-[10px] font-bold text-[#134885] dark:bg-[#134885]/20 dark:text-[#F6852A] border-2 border-white dark:border-slate-900"
                                    style={{ marginLeft: i > 0 ? -6 : 0, zIndex: 3 - i }}
                                    title={a.nom}
                                  >
                                    {getInitials(a.nom)}
                                  </div>
                                ))}
                                {assignees.length > 3 && (
                                  <span className="ml-1 text-[10px] text-muted-foreground">
                                    +{assignees.length - 3}
                                  </span>
                                )}
                                <span className="ml-1.5 text-xs text-muted-foreground truncate max-w-[100px]">
                                  {assignees.length === 1 ? assignees[0].nom : `${assignees.length} assignés`}
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

      {/* ─── Task Detail Dialog ─────────────────────────────────── */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
          {detailTask && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-[#134885]/10 dark:bg-[#134885]/20">
                    <CheckSquare className="size-4 text-[#134885] dark:text-[#F6852A]" />
                  </div>
                  {detailTask.titre}
                </DialogTitle>
                <DialogDescription>
                  Détails de la tâche et historique des interactions
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Task info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Type</p>
                    <p className="text-sm font-semibold">{getTypeConfig(detailTask.type).label}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Statut</p>
                    <Badge variant="outline" className={`text-xs ${getStatusConfig(detailTask.statut).color}`}>
                      {getStatusConfig(detailTask.statut).label}
                    </Badge>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Priorité</p>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block size-2 rounded-full ${getPriorityConfig(detailTask.priorite).dotColor}`} />
                      <span className="text-sm">{getPriorityConfig(detailTask.priorite).label}</span>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Échéance</p>
                    <p className={`text-sm ${isOverdue(detailTask.dateEcheance, detailTask.statut) ? 'font-semibold text-red-600' : ''}`}>
                      {formatDate(detailTask.dateEcheance)}
                    </p>
                  </div>
                </div>

                {/* Assignees */}
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase mb-2">Assigné(s)</p>
                  {getAssignees(detailTask).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {getAssignees(detailTask).map(a => (
                        <div key={a.id} className="flex items-center gap-1.5 rounded-full bg-[#134885]/10 px-2.5 py-1">
                          <div className="flex size-5 items-center justify-center rounded-full bg-[#134885] text-[8px] font-bold text-white">
                            {getInitials(a.nom)}
                          </div>
                          <span className="text-xs font-medium text-[#134885]">{a.nom}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Non assigné</p>
                  )}
                </div>

                {/* Description */}
                {detailTask.description && (
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Description</p>
                    <p className="text-sm whitespace-pre-wrap">{detailTask.description}</p>
                  </div>
                )}

                {/* Linked entity */}
                {getLinkedEntity(detailTask) && (
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Lié à</p>
                    <Badge variant="secondary" className="text-xs">
                      <span className="mr-1 text-muted-foreground">{getLinkedEntity(detailTask)!.type}:</span>
                      {getLinkedEntity(detailTask)!.label}
                    </Badge>
                  </div>
                )}

                {/* Créé par / Modifié par */}
                {(detailTask.creePar || detailTask.modifiePar) && (
                  <div className="grid grid-cols-2 gap-3">
                    {detailTask.creePar && (
                      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                        <p className="text-xs text-muted-foreground">Créé par</p>
                        <p className="text-sm font-medium">{detailTask.creePar.nom}</p>
                      </div>
                    )}
                    {detailTask.modifiePar && (
                      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                        <p className="text-xs text-muted-foreground">Modifié par</p>
                        <p className="text-sm font-medium">{detailTask.modifiePar.nom}</p>
                      </div>
                    )}
                  </div>
                )}

                <Separator />

                {/* Interactions timeline */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <MessageSquare className="size-4 text-[#134885]" />
                      Interactions
                      {detailTask.interactions && detailTask.interactions.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">{detailTask.interactions.length}</Badge>
                      )}
                    </h3>
                    <Button
                      size="sm"
                      className="gap-1 text-xs bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white hover:from-[#0D3A6E] hover:to-[#134885]"
                      onClick={() => {
                        setShowDetailDialog(false)
                        openInteractionDialog(detailTask)
                      }}
                    >
                      <Plus className="size-3" />
                      Interaction
                    </Button>
                  </div>

                  {!detailTask.interactions || detailTask.interactions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
                      <MessageSquare className="mx-auto mb-2 size-8 text-slate-300" />
                      <p className="text-sm text-slate-500">Aucune interaction enregistrée</p>
                      <p className="text-xs text-slate-400">Ajoutez une interaction pour suivre l&apos;avancement</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {detailTask.interactions.map((interaction, idx) => {
                        const intConfig = INTERACTION_TYPE_CONFIG[interaction.type] || INTERACTION_TYPE_CONFIG.autre
                        return (
                          <div key={interaction.id} className="relative rounded-lg border bg-white p-3">
                            {/* Timeline connector */}
                            {idx < (detailTask.interactions?.length || 0) - 1 && (
                              <div className="absolute left-6 bottom-0 w-0.5 h-3 translate-y-full bg-slate-200" />
                            )}

                            <div className="flex items-start gap-3">
                              {/* Type indicator */}
                              <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${intConfig.dotColor} bg-opacity-10`}>
                                <div className={`size-2.5 rounded-full ${intConfig.dotColor}`} />
                              </div>

                              <div className="flex-1 min-w-0">
                                {/* Header */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-semibold ${intConfig.color}`}>
                                      {intConfig.label}
                                    </span>
                                    {interaction.employe && (
                                      <span className="text-[10px] text-muted-foreground">
                                        par {interaction.employe.nom}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatDateTime(interaction.date)}
                                  </span>
                                </div>

                                {/* Notes */}
                                {interaction.notes && (
                                  <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap">
                                    {interaction.notes}
                                  </p>
                                )}

                                {/* Photos */}
                                {interaction.photos && interaction.photos.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {interaction.photos.map(photo => (
                                      <div key={photo.id} className="relative group">
                                        <img
                                          src={photo.url}
                                          alt={photo.fileName}
                                          className="h-16 w-16 rounded-lg border border-slate-200 object-cover cursor-pointer transition-shadow hover:shadow-md"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setExpandedPhotos(expandedPhotos === photo.url ? null : photo.url)
                                          }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDetailDialog(false)
                    openEditDialog(detailTask)
                  }}
                  className="gap-1"
                >
                  <Edit3 className="size-3.5" />
                  Modifier
                </Button>
                {detailTask.statut !== 'terminee' && (
                  <Button
                    size="sm"
                    className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => {
                      setShowDetailDialog(false)
                      handleQuickComplete(detailTask.id)
                    }}
                  >
                    <CheckCircle2 className="size-3.5" />
                    Terminer
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Photo Expanded Dialog ──────────────────────────────── */}
      <Dialog open={!!expandedPhotos} onOpenChange={() => setExpandedPhotos(null)}>
        <DialogContent className="sm:max-w-[800px] p-2">
          {expandedPhotos && (
            <img
              src={expandedPhotos}
              alt="Photo agrandie"
              className="w-full rounded-lg object-contain max-h-[80vh]"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Add/Edit Dialog ────────────────────────────────────── */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="sm:max-w-[780px] p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#134885] to-[#1A5A9E] shadow-sm">
                <CheckSquare className="size-4 text-white" />
              </div>
              {editingId ? 'Modifier la tâche' : 'Nouvelle tâche'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingId ? 'Modifiez les informations de la tâche.' : 'Créez et assignez une nouvelle tâche.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-0">
            {/* Left column: Informations + Liens */}
            <div className="space-y-4 px-6 pb-4 border-r border-slate-100 dark:border-slate-800">
              {/* Section: Informations */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="flex size-5 items-center justify-center rounded-md bg-[#134885]/10">
                    <CheckSquare className="size-3 text-[#134885]" />
                  </div>
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Informations</h3>
                </div>

                <div className="space-y-2.5">
                  {/* Titre */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-600">
                      Titre <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="Ex: Relancer le client pour devis"
                      value={formData.titre}
                      onChange={e => setFormData(f => ({ ...f, titre: e.target.value }))}
                      className="h-8 bg-white text-sm"
                    />
                  </div>

                  {/* Type + Priorité */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Type</Label>
                      <Select
                        value={formData.type}
                        onValueChange={v => setFormData(f => ({ ...f, type: v }))}
                      >
                        <SelectTrigger className="h-8 bg-white text-sm">
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

                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Priorité</Label>
                      <Select
                        value={formData.priorite}
                        onValueChange={v => setFormData(f => ({ ...f, priorite: v }))}
                      >
                        <SelectTrigger className="h-8 bg-white text-sm">
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

                  {/* Échéance + Statut */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Échéance</Label>
                      <Input
                        type="date"
                        value={formData.dateEcheance}
                        onChange={e => setFormData(f => ({ ...f, dateEcheance: e.target.value }))}
                        className="h-8 bg-white text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Statut</Label>
                      <Select
                        value={formData.statut}
                        onValueChange={v => setFormData(f => ({ ...f, statut: v }))}
                      >
                        <SelectTrigger className="h-8 bg-white text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map(s => (
                            <SelectItem key={s.value} value={s.value}>
                              <span className="flex items-center gap-2">
                                <span className={`inline-block size-2 rounded-full ${s.value === 'en_attente' ? 'bg-amber-500' : s.value === 'en_cours' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                                {s.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-600">Description</Label>
                    <Textarea
                      placeholder="Détails de la tâche..."
                      value={formData.description}
                      onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                      rows={3}
                      className="bg-white text-sm resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section: Liens */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="flex size-5 items-center justify-center rounded-md bg-[#134885]/10">
                    <Phone className="size-3 text-[#134885]" />
                  </div>
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Liens</h3>
                </div>

                <div className="space-y-2.5">
                  {/* Prospect + Opportunité */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Prospect</Label>
                      <Select
                        value={formData.prospectId}
                        onValueChange={v => {
                          setFormData(f => ({ ...f, prospectId: v }))
                          const p = prospects.find(pr => pr.id === v)
                          if (p) setProspectSearch(p.nom)
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="px-2 py-1.5">
                            <input
                              placeholder="Rechercher..."
                              value={prospectSearch}
                              onChange={e => setProspectSearch(e.target.value)}
                              className="w-full rounded border px-2 py-1 text-xs"
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                          <SelectItem value="none">Aucun</SelectItem>
                          {filteredProspects.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nom} {p.wilaya ? `(${p.wilaya})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Opportunité</Label>
                      <Select
                        value={formData.opportunityId}
                        onValueChange={v => {
                          setFormData(f => ({ ...f, opportunityId: v }))
                          const o = opportunities.find(op => op.id === v)
                          if (o) setOpportunitySearch(o.nomProjet)
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="px-2 py-1.5">
                            <input
                              placeholder="Rechercher..."
                              value={opportunitySearch}
                              onChange={e => setOpportunitySearch(e.target.value)}
                              className="w-full rounded border px-2 py-1 text-xs"
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                          <SelectItem value="none">Aucune</SelectItem>
                          {filteredOpportunities.map(o => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.nomProjet}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Opération + Événement */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Opération</Label>
                      <Select
                        value={formData.operationId}
                        onValueChange={v => setFormData(f => ({ ...f, operationId: v }))}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue placeholder="Sélectionner" />
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

                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Événement</Label>
                      <Select
                        value={formData.eventId}
                        onValueChange={v => setFormData(f => ({ ...f, eventId: v }))}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue placeholder="Sélectionner" />
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
                </div>
              </div>
            </div>

            {/* Right column: Assignation */}
            <div className="px-4 py-4">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="flex size-5 items-center justify-center rounded-md bg-[#134885]/10">
                  <User className="size-3 text-[#134885]" />
                </div>
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Assignation</h3>
                {selectedAssigneeIds.length > 0 && (
                  <Badge className="ml-auto h-5 bg-[#134885]/10 text-[#134885] text-[10px] font-medium border-0">
                    {selectedAssigneeIds.length}
                  </Badge>
                )}
              </div>

              {/* Search */}
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={assigneeSearch}
                  onChange={e => setAssigneeSearch(e.target.value)}
                  className="h-8 pl-7 text-xs bg-white"
                />
              </div>

              {/* Employee list - simple scrollable div */}
              <div className="max-h-[260px] overflow-y-auto rounded-md border bg-white">
                {filteredEmployees.map(emp => (
                  <label
                    key={emp.id}
                    className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors border-b border-slate-50 last:border-0 ${
                      selectedAssigneeIds.includes(emp.id)
                        ? 'bg-[#134885]/5'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <Checkbox
                      checked={selectedAssigneeIds.includes(emp.id)}
                      onCheckedChange={() => toggleAssignee(emp.id)}
                      className="shrink-0 border-[#F6852A] data-[state=checked]:bg-[#134885] data-[state=checked]:border-[#134885]"
                    />
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#134885]/10 text-[9px] font-bold text-[#134885]">
                      {getInitials(emp.nom)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{emp.nom}</p>
                      <p className="text-[10px] text-muted-foreground">{emp.role}</p>
                    </div>
                    {selectedAssigneeIds.includes(emp.id) && (
                      <CheckCircle2 className="size-3.5 text-[#134885] shrink-0" />
                    )}
                  </label>
                ))}
                {filteredEmployees.length === 0 && (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Aucun employé trouvé
                  </div>
                )}
              </div>

              {/* Selected badges */}
              {selectedAssigneeIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2.5">
                  {selectedAssigneeIds.map(id => {
                    const emp = employees.find(e => e.id === id)
                    if (!emp) return null
                    return (
                      <Badge key={id} variant="secondary" className="gap-1 text-[11px] bg-[#134885]/5 text-[#134885] border-[#134885]/10 hover:bg-[#134885]/10 px-1.5 py-0">
                        {emp.nom}
                        <button
                          type="button"
                          onClick={() => toggleAssignee(id)}
                          className="ml-0.5 text-[#134885]/40 hover:text-red-500"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              onClick={() => setShowFormDialog(false)}
              disabled={saving}
              className="h-8 text-xs"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.titre.trim()}
              className="gap-1.5 h-8 text-xs bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white shadow-md shadow-[#134885]/20 hover:from-[#0D3A6E] hover:to-[#134885]"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
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
        onSuccess={() => {
          fetchTasks()
        }}
      />
    </div>
  )
}
