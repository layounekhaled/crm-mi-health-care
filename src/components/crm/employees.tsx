'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  Loader2,
  Target,
  Mail,
  Phone,
  ShieldCheck,
  Briefcase,
  Wrench,
  CheckCircle2,
  BarChart3,
  Power,
  Calendar,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  MODULE_LABELS,
  ACTION_LABELS,
  ROLE_DEFAULTS,
  createPermissionsFromRole,
  type Permissions,
  type ModulePermissions,
  type PermissionModule,
  type PermissionAction,
} from '@/lib/permissions'

// ─── Types ───────────────────────────────────────────────────────

interface Employee {
  id: string
  nom: string
  email?: string | null
  telephone?: string | null
  role: string
  permissions: Record<string, unknown> | null
  actif: boolean
  createdAt: string
  updatedAt: string
  _count: {
    opportunities: number
    operations: number
    tasksAssigned: number
    interactions: number
    afterSales: number
    objectives: number
  }
  caGenere: number
  tachesRealisees: number
  nbOpportunites: number
  nbOperations: number
}

interface Objective {
  id: string
  employeId: string
  mois: string
  caObjectif: number
  nbVentesObjectif: number
  tachesObjectif: number
  createdAt: string
  updatedAt: string
  employe: { id: string; nom: string; role: string }
}

// ─── Constants ───────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrateur', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', icon: ShieldCheck },
  { value: 'commercial', label: 'Commercial', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', icon: Briefcase },
  { value: 'technicien', label: 'Technicien', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300', icon: Wrench },
] as const

const ROLE_FILTER = [
  { value: 'all', label: 'Tous les rôles' },
  { value: 'admin', label: 'Administrateurs' },
  { value: 'commercial', label: 'Commerciaux' },
  { value: 'technicien', label: 'Techniciens' },
]

// ─── Helpers ─────────────────────────────────────────────────────

function getRoleConfig(role: string) {
  return ROLE_OPTIONS.find(r => r.value === role) || ROLE_OPTIONS[1]
}

function formatDZD(amount: number): string {
  return new Intl.NumberFormat('fr-DZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' DZD'
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMonth(mois: string): string {
  const [year, month] = mois.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function getProgressColor(pct: number): string {
  if (pct >= 80) return 'bg-[#134885]'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

function getProgressTrackColor(pct: number): string {
  if (pct >= 80) return 'text-[#134885] dark:text-[#F6852A]'
  if (pct >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

// ─── Loading Skeleton ────────────────────────────────────────────

function EmployeesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-28" />
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/50">
        <Users className="size-8 text-[#134885]/60" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
        {hasFilters ? 'Aucun employé trouvé' : 'Aucun employé'}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        {hasFilters
          ? 'Essayez de modifier vos filtres.'
          : 'Commencez par ajouter votre premier employé.'}
      </p>
    </motion.div>
  )
}

// ─── Progress Bar Component ──────────────────────────────────────

function ObjectiveProgress({
  label,
  realised,
  objectif,
  formatValue,
}: {
  label: string
  realised: number
  objectif: number
  formatValue?: (v: number) => string
}) {
  const pct = objectif > 0 ? Math.min((realised / objectif) * 100, 100) : 0
  const displayFmt = formatValue || ((v: number) => v.toString())

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={getProgressTrackColor(pct)}>
          {displayFmt(realised)} / {displayFmt(objectif)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${getProgressColor(pct)}`}
        />
      </div>
    </div>
  )
}

// ─── Permissions Editor Component ──────────────────────────────

function PermissionsEditor({
  permissions,
  onChange,
  role,
}: {
  permissions: Permissions
  onChange: (permissions: Permissions) => void
  role: string
}) {
  const isAdmin = role === 'admin'
  const modules = Object.keys(MODULE_LABELS) as PermissionModule[]
  const actions: PermissionAction[] = ['view', 'create', 'edit', 'delete']

  const togglePermission = (module: PermissionModule, action: PermissionAction) => {
    const newPerms = { ...permissions }
    newPerms[module] = { ...newPerms[module], [action]: !newPerms[module][action] }
    // If view is turned off, turn off all other actions
    if (action === 'view' && !newPerms[module].view) {
      newPerms[module].create = false
      newPerms[module].edit = false
      newPerms[module].delete = false
    }
    // If an action is turned on but view is off, turn view on
    if (action !== 'view' && newPerms[module][action] && !newPerms[module].view) {
      newPerms[module].view = true
    }
    onChange(newPerms)
  }

  const toggleAllForModule = (module: PermissionModule, value: boolean) => {
    const newPerms = { ...permissions }
    newPerms[module] = { view: value, create: value, edit: value, delete: value }
    onChange(newPerms)
  }

  const setAllPermissions = (value: boolean) => {
    const newPerms = { ...permissions }
    for (const mod of modules) {
      newPerms[mod] = { view: value, create: value, edit: value, delete: value }
    }
    onChange(newPerms)
  }

  const resetToRoleDefaults = () => {
    onChange(createPermissionsFromRole(role))
  }

  if (isAdmin) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <ShieldCheck className="size-4" />
          <span className="text-sm font-medium">Accès complet</span>
        </div>
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
          Les administrateurs ont accès à tous les modules par défaut. Aucune permission à configurer.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setAllPermissions(true)}
        >
          <CheckCircle2 className="mr-1 size-3" />
          Tout autoriser
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setAllPermissions(false)}
        >
          <EyeOff className="mr-1 size-3" />
          Tout interdire
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={resetToRoleDefaults}
        >
          <Lock className="mr-1 size-3" />
          Défaut du rôle
        </Button>
      </div>

      {/* Permissions grid */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Module</th>
              {actions.map(action => (
                <th key={action} className="px-2 py-2 text-center font-medium text-muted-foreground">
                  {ACTION_LABELS[action]}
                </th>
              ))}
              <th className="px-2 py-2 text-center font-medium text-muted-foreground">Tout</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((module, idx) => {
              const modPerms = permissions[module]
              const allChecked = modPerms.view && modPerms.create && modPerms.edit && modPerms.delete
              const noneChecked = !modPerms.view && !modPerms.create && !modPerms.edit && !modPerms.delete

              return (
                <tr
                  key={module}
                  className={`border-b last:border-b-0 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30'}`}
                >
                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">
                    {MODULE_LABELS[module].label}
                  </td>
                  {actions.map(action => {
                    const isViewDependent = action !== 'view' && !modPerms.view
                    return (
                      <td key={action} className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => togglePermission(module, action)}
                          disabled={isViewDependent}
                          className={`inline-flex size-6 items-center justify-center rounded transition-all ${
                            modPerms[action]
                              ? 'bg-[#134885] text-white shadow-sm'
                              : isViewDependent
                                ? 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-700'
                          }`}
                        >
                          {modPerms[action] ? (
                            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                      </td>
                    )
                  })}
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => toggleAllForModule(module, !allChecked)}
                      className={`inline-flex size-6 items-center justify-center rounded transition-all ${
                        allChecked
                          ? 'bg-[#F6852A] text-white shadow-sm'
                          : noneChecked
                            ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                            : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}
                    >
                      {allChecked ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        <EyeOff className="size-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────

export default function EmployeesModule() {
  const { toast } = useToast()

  // Data
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterRole, setFilterRole] = useState<string>('all')

  // Employee form dialog
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Objectives dialog
  const [showObjectivesDialog, setShowObjectivesDialog] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [objectivesLoading, setObjectivesLoading] = useState(false)
  const [savingObjective, setSavingObjective] = useState(false)

  // Objective form
  const [objectiveForm, setObjectiveForm] = useState({
    mois: getCurrentMonth(),
    caObjectif: '',
    nbVentesObjectif: '',
    tachesObjectif: '',
  })
  const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null)

  // Employee form (with permissions)
  const [formData, setFormData] = useState({
    nom: '',
    email: '',
    telephone: '',
    role: 'commercial',
    actif: true,
    permissions: createPermissionsFromRole('commercial'),
  })

  // ─── Data Fetching ─────────────────────────────────────────────

  const fetchEmployees = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterRole !== 'all') params.set('role', filterRole)
      const res = await fetch(`/api/employees?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setEmployees(data)
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    }
  }, [filterRole])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchEmployees()
      setLoading(false)
    }
    load()
  }, [fetchEmployees])

  const fetchObjectives = useCallback(async (employeId: string) => {
    setObjectivesLoading(true)
    try {
      const res = await fetch(`/api/objectives?employeId=${employeId}`)
      if (res.ok) {
        const data = await res.json()
        setObjectives(data)
      }
    } catch (err) {
      console.error('Failed to fetch objectives:', err)
    } finally {
      setObjectivesLoading(false)
    }
  }, [])

  // ─── Employee Form Handlers ────────────────────────────────────

  const openCreateDialog = () => {
    setEditingId(null)
    setFormData({
      nom: '',
      email: '',
      telephone: '',
      role: 'commercial',
      actif: true,
      permissions: createPermissionsFromRole('commercial'),
    })
    setShowFormDialog(true)
  }

  const openEditDialog = (emp: Employee) => {
    setEditingId(emp.id)
    const roleDefaults = createPermissionsFromRole(emp.role)
    // Merge existing permissions with role defaults (fill missing modules)
    const mergedPerms = { ...roleDefaults }
    if (emp.permissions && typeof emp.permissions === 'object') {
      for (const [mod, actions] of Object.entries(emp.permissions)) {
        if (mod in mergedPerms && typeof actions === 'object' && actions !== null) {
          mergedPerms[mod as PermissionModule] = {
            ...mergedPerms[mod as PermissionModule],
            ...(actions as Partial<ModulePermissions>),
          }
        }
      }
    }
    setFormData({
      nom: emp.nom,
      email: emp.email || '',
      telephone: emp.telephone || '',
      role: emp.role,
      actif: emp.actif,
      permissions: mergedPerms,
    })
    setShowFormDialog(true)
  }

  const handleRoleChange = (newRole: string) => {
    const newPerms = createPermissionsFromRole(newRole)
    setFormData(f => ({ ...f, role: newRole, permissions: newPerms }))
  }

  const handleSave = async () => {
    if (!formData.nom.trim()) {
      toast({ title: 'Erreur', description: 'Le nom est requis.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      // For admin, send null permissions (they get full access anyway)
      const permsToSend = formData.role === 'admin' ? null : formData.permissions

      const payload = {
        nom: formData.nom.trim(),
        email: formData.email.trim() || null,
        telephone: formData.telephone.trim() || null,
        role: formData.role,
        permissions: permsToSend,
        actif: formData.actif,
      }

      if (editingId) {
        const res = await fetch(`/api/employees/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || 'Update failed')
        }
        toast({ title: 'Employé modifié', description: 'Les informations et permissions ont été mises à jour.' })
      } else {
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || 'Create failed')
        }
        toast({ title: 'Employé ajouté', description: 'Le nouvel employé a été créé avec ses permissions.' })
      }

      setShowFormDialog(false)
      await fetchEmployees()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      toast({ title: 'Erreur', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      const res = await fetch(`/api/employees/${deletingId}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Employé supprimé', description: 'L\'employé a été supprimé.' })
        setShowDeleteDialog(false)
        setDeletingId(null)
        await fetchEmployees()
      }
    } catch (err) {
      console.error('Delete failed:', err)
      toast({ title: 'Erreur', description: 'Impossible de supprimer l\'employé.', variant: 'destructive' })
    }
  }

  const toggleActif = async (emp: Employee) => {
    try {
      const res = await fetch(`/api/employees/${emp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: !emp.actif }),
      })
      if (res.ok) {
        toast({
          title: emp.actif ? 'Employé désactivé' : 'Employé activé',
          description: `${emp.nom} est maintenant ${emp.actif ? 'inactif' : 'actif'}.`,
        })
        await fetchEmployees()
      }
    } catch (err) {
      console.error('Toggle failed:', err)
    }
  }

  // ─── Objective Handlers ────────────────────────────────────────

  const openObjectivesDialog = (emp: Employee) => {
    setSelectedEmployee(emp)
    setObjectiveForm({
      mois: getCurrentMonth(),
      caObjectif: '',
      nbVentesObjectif: '',
      tachesObjectif: '',
    })
    setEditingObjectiveId(null)
    setShowObjectivesDialog(true)
    fetchObjectives(emp.id)
  }

  const selectObjectiveForEdit = (obj: Objective) => {
    setEditingObjectiveId(obj.id)
    setObjectiveForm({
      mois: obj.mois,
      caObjectif: obj.caObjectif?.toString() || '',
      nbVentesObjectif: obj.nbVentesObjectif?.toString() || '',
      tachesObjectif: obj.tachesObjectif?.toString() || '',
    })
  }

  const handleSaveObjective = async () => {
    if (!selectedEmployee || !objectiveForm.mois) return
    setSavingObjective(true)
    try {
      if (editingObjectiveId) {
        const res = await fetch(`/api/objectives/${editingObjectiveId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caObjectif: objectiveForm.caObjectif ? parseFloat(objectiveForm.caObjectif) : 0,
            nbVentesObjectif: objectiveForm.nbVentesObjectif ? parseInt(objectiveForm.nbVentesObjectif) : 0,
            tachesObjectif: objectiveForm.tachesObjectif ? parseInt(objectiveForm.tachesObjectif) : 0,
          }),
        })
        if (!res.ok) throw new Error('Update failed')
        toast({ title: 'Objectif modifié', description: 'L\'objectif a été mis à jour.' })
      } else {
        const res = await fetch('/api/objectives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeId: selectedEmployee.id,
            mois: objectiveForm.mois,
            caObjectif: objectiveForm.caObjectif ? parseFloat(objectiveForm.caObjectif) : 0,
            nbVentesObjectif: objectiveForm.nbVentesObjectif ? parseInt(objectiveForm.nbVentesObjectif) : 0,
            tachesObjectif: objectiveForm.tachesObjectif ? parseInt(objectiveForm.tachesObjectif) : 0,
          }),
        })
        if (!res.ok) throw new Error('Create failed')
        toast({ title: 'Objectif défini', description: 'Le nouvel objectif a été enregistré.' })
      }

      setEditingObjectiveId(null)
      setObjectiveForm({
        mois: getCurrentMonth(),
        caObjectif: '',
        nbVentesObjectif: '',
        tachesObjectif: '',
      })
      await fetchObjectives(selectedEmployee.id)
    } catch (err) {
      console.error('Save objective failed:', err)
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder l\'objectif.', variant: 'destructive' })
    } finally {
      setSavingObjective(false)
    }
  }

  const handleDeleteObjective = async (objId: string) => {
    if (!selectedEmployee) return
    try {
      const res = await fetch(`/api/objectives/${objId}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Objectif supprimé' })
        await fetchObjectives(selectedEmployee.id)
      }
    } catch (err) {
      console.error('Delete objective failed:', err)
    }
  }

  // ─── Computed ──────────────────────────────────────────────────

  const hasFilters = filterRole !== 'all'

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
                  Employés & Objectifs
                </h1>
                <p className="text-xs text-muted-foreground">
                  Gestion du personnel et permissions
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="h-9 w-[160px] text-xs">
                  <SelectValue placeholder="Rôle" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_FILTER.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={openCreateDialog}
                className="gap-1.5 bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white shadow-lg shadow-[#134885]/25 hover:from-[#0D3A6E] hover:to-[#134885]"
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">Nouvel Employé</span>
                <span className="sm:hidden">Nouveau</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
        {loading ? (
          <EmployeesSkeleton />
        ) : employees.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {employees.map((emp) => {
                const roleConfig = getRoleConfig(emp.role)
                const RoleIcon = roleConfig.icon

                return (
                  <motion.div
                    key={emp.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className={`group border-0 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900/70 ${emp.actif ? 'bg-white/70' : 'bg-slate-50/70 opacity-70'}`}>
                      <CardContent className="p-4">
                        {/* Header: Name + Role Badge */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${emp.actif ? 'bg-[#134885]/10 dark:bg-[#134885]/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                              <span className={`text-sm font-bold ${emp.actif ? 'text-[#134885] dark:text-[#F6852A]' : 'text-slate-400'}`}>
                                {emp.nom.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                                {emp.nom}
                              </h3>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge variant="outline" className={`gap-1 text-[10px] font-medium ${roleConfig.color}`}>
                                  <RoleIcon className="size-2.5" />
                                  {roleConfig.label}
                                </Badge>
                                {emp.role !== 'admin' && emp.permissions && typeof emp.permissions === 'object' && Object.keys(emp.permissions).length > 0 && (
                                  <Badge variant="outline" className="gap-1 text-[10px] font-medium bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                                    <Lock className="size-2.5" />
                                    Custom
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          {!emp.actif && (
                            <Badge variant="secondary" className="text-[10px] bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              Inactif
                            </Badge>
                          )}
                        </div>

                        {/* Contact info */}
                        <div className="space-y-1 mb-3">
                          {emp.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="size-3.5 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground truncate">{emp.email}</span>
                            </div>
                          )}
                          {emp.telephone && (
                            <div className="flex items-center gap-2">
                              <Phone className="size-3.5 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground">{emp.telephone}</span>
                            </div>
                          )}
                        </div>

                        <Separator className="my-3" />

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2 text-center">
                            <p className="text-base font-bold text-slate-900 dark:text-white">{emp.nbOpportunites}</p>
                            <p className="text-[10px] text-muted-foreground">Opportunités</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2 text-center">
                            <p className="text-base font-bold text-slate-900 dark:text-white">{emp.nbOperations}</p>
                            <p className="text-[10px] text-muted-foreground">Opérations</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2 text-center">
                            <p className="text-base font-bold text-[#134885] dark:text-[#F6852A]">{emp.tachesRealisees}</p>
                            <p className="text-[10px] text-muted-foreground">Tâches réalisées</p>
                          </div>
                          <div className="rounded-lg bg-[#134885]/5 dark:bg-[#134885]/10 p-2 text-center">
                            <p className="text-sm font-bold text-[#134885] dark:text-[#F6852A]">{formatDZD(emp.caGenere)}</p>
                            <p className="text-[10px] text-muted-foreground">CA généré</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs text-[#134885] hover:text-[#0D3A6E] hover:bg-[#134885]/5 dark:text-[#F6852A] dark:hover:bg-[#134885]/10"
                            onClick={() => openObjectivesDialog(emp)}
                          >
                            <Target className="size-3" />
                            Objectifs
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs text-slate-600 hover:text-[#134885] dark:text-slate-400 dark:hover:text-[#F6852A]"
                            onClick={() => openEditDialog(emp)}
                          >
                            <Edit3 className="size-3" />
                            Modifier
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                            onClick={() => {
                              setDeletingId(emp.id)
                              setShowDeleteDialog(true)
                            }}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-7 gap-1 px-2 text-xs ${emp.actif ? 'text-amber-600 hover:text-amber-700' : 'text-[#134885] hover:text-[#0D3A6E]'}`}
                            onClick={() => toggleActif(emp)}
                            title={emp.actif ? 'Désactiver' : 'Activer'}
                          >
                            <Power className="size-3" />
                          </Button>
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

      {/* ─── Add/Edit Employee Dialog ───────────────────────────── */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#134885]/10 dark:bg-[#134885]/20">
                <Users className="size-4 text-[#134885] dark:text-[#F6852A]" />
              </div>
              {editingId ? 'Modifier l\'employé' : 'Nouvel employé'}
            </DialogTitle>
            <DialogDescription>
              {editingId ? 'Modifiez les informations et permissions de l\'employé.' : 'Ajoutez un nouvel employé à l\'équipe et définissez ses permissions.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Section: Informations */}
            <div className="flex items-center gap-2 pt-2">
              <div className="h-5 w-1 rounded-full bg-[#134885]" />
              <h3 className="text-sm font-semibold text-slate-700">Informations</h3>
            </div>

            {/* Nom */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Nom <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                placeholder="Nom complet"
                value={formData.nom}
                onChange={e => setFormData(f => ({ ...f, nom: e.target.value }))}
                className="bg-white"
              />
            </div>

            {/* Email + Téléphone */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm">Email</Label>
                <Input
                  type="email"
                  placeholder="email@exemple.com"
                  value={formData.email}
                  onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                  className="bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Téléphone</Label>
                <Input
                  placeholder="0X XX XX XX XX"
                  value={formData.telephone}
                  onChange={e => setFormData(f => ({ ...f, telephone: e.target.value }))}
                  className="bg-white"
                />
              </div>
            </div>

            {/* Section: Rôle & Permissions */}
            <div className="flex items-center gap-2 pt-2">
              <div className="h-5 w-1 rounded-full bg-[#134885]" />
              <h3 className="text-sm font-semibold text-slate-700">Rôle & Permissions</h3>
            </div>

            {/* Rôle */}
            <div className="space-y-1.5">
              <Label className="text-sm">Rôle</Label>
              <Select
                value={formData.role}
                onValueChange={handleRoleChange}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => {
                    const Icon = r.icon
                    return (
                      <SelectItem key={r.value} value={r.value}>
                        <span className="flex items-center gap-2">
                          <Icon className="size-3.5" />
                          {r.label}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Permissions */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-[#134885] dark:text-[#F6852A]" />
                <Label className="text-sm font-semibold">Permissions</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Définissez les modules et actions accessibles par cet employé. Changer le rôle réinitialise les permissions aux valeurs par défaut.
              </p>
              <PermissionsEditor
                permissions={formData.permissions}
                onChange={(perms) => setFormData(f => ({ ...f, permissions: perms }))}
                role={formData.role}
              />
            </div>

            {/* Actif toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Actif</Label>
                <p className="text-xs text-muted-foreground">
                  L&apos;employé est-il actuellement actif ?
                </p>
              </div>
              <Switch
                checked={formData.actif}
                onCheckedChange={v => setFormData(f => ({ ...f, actif: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)} disabled={saving}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.nom.trim()}
              className="gap-1.5 bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white hover:from-[#0D3A6E] hover:to-[#134885]"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  {editingId ? 'Modifier' : 'Ajouter'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ────────────────────────────────── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet employé ? Toutes ses données associées seront perdues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Objectives Dialog ──────────────────────────────────── */}
      <Dialog open={showObjectivesDialog} onOpenChange={setShowObjectivesDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#F6852A]/10 dark:bg-[#F6852A]/20">
                <Target className="size-4 text-[#F6852A] dark:text-[#F6852A]" />
              </div>
              Objectifs — {selectedEmployee?.nom}
            </DialogTitle>
            <DialogDescription>
              Définissez et suivez les objectifs mensuels de cet employé.
            </DialogDescription>
          </DialogHeader>

          {/* Objective Form */}
          <div className="rounded-lg border border-[#134885]/20 dark:border-[#134885]/30 bg-[#134885]/5 dark:bg-[#134885]/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#134885] dark:text-[#F6852A]">
              <BarChart3 className="size-4" />
              {editingObjectiveId ? 'Modifier l\'objectif' : 'Nouvel objectif'}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Mois</Label>
                <Input
                  type="month"
                  value={objectiveForm.mois}
                  onChange={e => setObjectiveForm(f => ({ ...f, mois: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">CA Objectif (DZD)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={objectiveForm.caObjectif}
                  onChange={e => setObjectiveForm(f => ({ ...f, caObjectif: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Nombre de Ventes Objectif</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={objectiveForm.nbVentesObjectif}
                  onChange={e => setObjectiveForm(f => ({ ...f, nbVentesObjectif: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Tâches Objectif</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={objectiveForm.tachesObjectif}
                  onChange={e => setObjectiveForm(f => ({ ...f, tachesObjectif: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleSaveObjective}
                disabled={savingObjective || !objectiveForm.mois}
                className="gap-1 bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white hover:from-[#0D3A6E] hover:to-[#134885]"
              >
                {savingObjective ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                {editingObjectiveId ? 'Modifier' : 'Définir'}
              </Button>
              {editingObjectiveId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingObjectiveId(null)
                    setObjectiveForm({
                      mois: getCurrentMonth(),
                      caObjectif: '',
                      nbVentesObjectif: '',
                      tachesObjectif: '',
                    })
                  }}
                >
                  Annuler
                </Button>
              )}
            </div>
          </div>

          {/* Objectives List with Progress */}
          {objectivesLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : objectives.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Target className="mb-2 size-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Aucun objectif défini</p>
              <p className="text-xs text-muted-foreground">Définissez le premier objectif ci-dessus.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {objectives.map((obj) => {
                const caPct = obj.caObjectif > 0
                  ? Math.min((selectedEmployee?.caGenere || 0) / obj.caObjectif * 100, 100)
                  : 0
                const ventesRealisees = selectedEmployee?.nbOpportunites || 0
                const ventesPct = obj.nbVentesObjectif > 0
                  ? Math.min(ventesRealisees / obj.nbVentesObjectif * 100, 100)
                  : 0
                const tachesRealisees = selectedEmployee?.tachesRealisees || 0
                const tachesPct = obj.tachesObjectif > 0
                  ? Math.min(tachesRealisees / obj.tachesObjectif * 100, 100)
                  : 0

                return (
                  <motion.div
                    key={obj.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="size-4 text-[#F6852A]" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                          {formatMonth(obj.mois)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-slate-400 hover:text-[#134885]"
                          onClick={() => selectObjectiveForEdit(obj)}
                        >
                          <Edit3 className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-slate-400 hover:text-red-600"
                          onClick={() => handleDeleteObjective(obj.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <ObjectiveProgress
                        label="CA Réalisé"
                        realised={selectedEmployee?.caGenere || 0}
                        objectif={obj.caObjectif}
                        formatValue={formatDZD}
                      />
                      <ObjectiveProgress
                        label="Ventes Réalisées"
                        realised={ventesRealisees}
                        objectif={obj.nbVentesObjectif}
                      />
                      <ObjectiveProgress
                        label="Tâches Complétées"
                        realised={tachesRealisees}
                        objectif={obj.tachesObjectif}
                      />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
