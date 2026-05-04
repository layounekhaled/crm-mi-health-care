'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Wrench,
  Plus,
  Edit3,
  Trash2,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Package,
  Settings,
  GraduationCap,
  ShieldCheck,
  Smile,
  Truck,
  Calendar,
  User,
  StickyNote,
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
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'

// ─── Types ───────────────────────────────────────────────────────

interface Prospect {
  id: string
  nom: string
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

interface AfterSale {
  id: string
  clientId: string
  type: string
  statut: string
  notes?: string | null
  date?: string | null
  employeId?: string | null
  createdAt: string
  updatedAt: string
  client: { id: string; nom: string; wilaya?: string | null; telephone?: string | null }
  employe?: { id: string; nom: string; role: string } | null
}

// ─── Constants ───────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: 'livraison', label: 'Livraison', icon: Truck, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  { value: 'installation', label: 'Installation', icon: Settings, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' },
  { value: 'formation', label: 'Formation', icon: GraduationCap, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  { value: 'sav', label: 'SAV', icon: ShieldCheck, color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
  { value: 'maintenance', label: 'Maintenance', icon: Package, color: 'bg-[#003366]/10 text-[#003366] dark:bg-[#003366]/20 dark:text-[#FF9900]' },
  { value: 'satisfaction', label: 'Satisfaction', icon: Smile, color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
] as const

const STATUT_OPTIONS = [
  { value: 'en_attente', label: 'En attente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', icon: Clock },
  { value: 'en_cours', label: 'En cours', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', icon: AlertCircle },
  { value: 'termine', label: 'Terminé', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300', icon: CheckCircle2 },
] as const

// ─── Helpers ─────────────────────────────────────────────────────

function getTypeConfig(type: string) {
  return TYPE_OPTIONS.find(t => t.value === type) || TYPE_OPTIONS[0]
}

function getStatutConfig(statut: string) {
  return STATUT_OPTIONS.find(s => s.value === statut) || STATUT_OPTIONS[0]
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Loading Skeleton ────────────────────────────────────────────

function AfterSalesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4">
              <Skeleton className="mb-2 h-3 w-20" />
              <Skeleton className="h-6 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
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
        <Wrench className="size-8 text-[#003366]/60" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
        {hasFilters ? 'Aucune intervention trouvée' : 'Aucune intervention'}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        {hasFilters
          ? 'Essayez de modifier vos filtres pour trouver des interventions.'
          : 'Commencez par créer votre première intervention après-vente.'}
      </p>
    </motion.div>
  )
}

// ─── Main Component ──────────────────────────────────────────────

export default function AfterSalesModule() {
  const { toast } = useToast()

  // Data
  const [afterSales, setAfterSales] = useState<AfterSale[]>([])
  const [clients, setClients] = useState<Prospect[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatut, setFilterStatut] = useState<string>('all')

  // Dialog
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form
  const [formData, setFormData] = useState({
    clientId: '',
    type: 'livraison',
    statut: 'en_attente',
    date: '',
    employeId: '',
    notes: '',
  })

  // ─── Data Fetching ─────────────────────────────────────────────

  const fetchAfterSales = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterType !== 'all') params.set('type', filterType)
      if (filterStatut !== 'all') params.set('statut', filterStatut)
      const res = await fetch(`/api/after-sales?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setAfterSales(data)
      }
    } catch (err) {
      console.error('Failed to fetch after-sales:', err)
    }
  }, [filterType, filterStatut])

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/prospects?isClient=true&limit=200')
      if (res.ok) {
        const data = await res.json()
        setClients(data.data || data)
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err)
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
      await Promise.all([fetchAfterSales(), fetchClients(), fetchEmployees()])
      setLoading(false)
    }
    load()
  }, [fetchAfterSales, fetchClients, fetchEmployees])

  // ─── Form Handlers ─────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingId(null)
    setFormData({
      clientId: '',
      type: 'livraison',
      statut: 'en_attente',
      date: '',
      employeId: '',
      notes: '',
    })
    setShowFormDialog(true)
  }

  const openEditDialog = (item: AfterSale) => {
    setEditingId(item.id)
    setFormData({
      clientId: item.clientId,
      type: item.type,
      statut: item.statut,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
      employeId: item.employeId || '',
      notes: item.notes || '',
    })
    setShowFormDialog(true)
  }

  const handleSave = async () => {
    if (!formData.clientId) {
      toast({ title: 'Erreur', description: 'Veuillez sélectionner un client.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        clientId: formData.clientId,
        type: formData.type,
        statut: formData.statut,
        date: formData.date || null,
        employeId: (formData.employeId && formData.employeId !== 'none') ? formData.employeId : null,
        notes: formData.notes || null,
      }

      if (editingId) {
        const res = await fetch(`/api/after-sales/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Update failed')
        toast({ title: 'Intervention modifiée', description: 'L\'intervention a été mise à jour avec succès.' })
      } else {
        const res = await fetch('/api/after-sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Create failed')
        toast({ title: 'Intervention créée', description: 'La nouvelle intervention a été ajoutée.' })
      }

      setShowFormDialog(false)
      await fetchAfterSales()
    } catch (err) {
      console.error('Save failed:', err)
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder l\'intervention.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      const res = await fetch(`/api/after-sales/${deletingId}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Intervention supprimée', description: 'L\'intervention a été supprimée.' })
        setShowDeleteDialog(false)
        setDeletingId(null)
        await fetchAfterSales()
      }
    } catch (err) {
      console.error('Delete failed:', err)
      toast({ title: 'Erreur', description: 'Impossible de supprimer l\'intervention.', variant: 'destructive' })
    }
  }

  // ─── Computed ──────────────────────────────────────────────────

  const totalInterventions = afterSales.length
  const enAttente = afterSales.filter(a => a.statut === 'en_attente').length
  const enCours = afterSales.filter(a => a.statut === 'en_cours').length
  const terminees = afterSales.filter(a => a.statut === 'termine').length
  const savEnCours = afterSales.filter(a => a.type === 'sav' && a.statut === 'en_cours').length

  const hasFilters = filterType !== 'all' || filterStatut !== 'all'

  // Techniciens for the employe select
  const techniciens = employees.filter(e => e.role === 'technicien')
  const allEmployes = employees

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/20">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/80 backdrop-blur-md dark:border-blue-900/50 dark:bg-slate-950/80">
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#003366] to-[#004080] text-white shadow-lg shadow-[#003366]/25">
                <Wrench className="size-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Après-vente
                </h1>
                <p className="text-xs text-muted-foreground">
                  CRM MI HEALTH CARE — Interventions après-vente
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9 w-[160px] text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {TYPE_OPTIONS.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatut} onValueChange={setFilterStatut}>
                <SelectTrigger className="h-9 w-[150px] text-xs">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {STATUT_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={openCreateDialog}
                className="gap-1.5 bg-gradient-to-r from-[#003366] to-[#004080] text-white shadow-lg shadow-[#003366]/25 hover:from-[#002244] hover:to-[#003366]"
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">Nouvelle Intervention</span>
                <span className="sm:hidden">Nouvelle</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
        {loading ? (
          <AfterSalesSkeleton />
        ) : (
          <>
            {/* Summary Cards */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Wrench className="size-3.5 text-[#003366]" />
                    Total
                  </div>
                  <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                    {totalInterventions}
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
                    <AlertCircle className="size-3.5 text-blue-500" />
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
                  <p className="mt-1 text-xl font-bold text-[#003366] dark:text-[#FF9900]">
                    {terminees}
                  </p>
                </CardContent>
              </Card>
              <Card className="col-span-2 border-0 bg-white/70 shadow-sm sm:col-span-1 dark:bg-slate-900/70">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-red-500" />
                    SAV en cours
                  </div>
                  <p className="mt-1 text-xl font-bold text-red-600 dark:text-red-400">
                    {savEnCours}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* After-Sales List */}
            {afterSales.length === 0 ? (
              <EmptyState hasFilters={hasFilters} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {afterSales.map((item) => {
                    const typeConfig = getTypeConfig(item.type)
                    const statutConfig = getStatutConfig(item.statut)
                    const TypeIcon = typeConfig.icon
                    const StatutIcon = statutConfig.icon

                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card className="group border-0 bg-white/70 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900/70">
                          <CardContent className="p-4">
                            {/* Top row: type badge + statut */}
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className={`gap-1.5 text-xs font-medium ${typeConfig.color}`}>
                                <TypeIcon className="size-3" />
                                {typeConfig.label}
                              </Badge>
                              <Badge variant="outline" className={`gap-1 text-[10px] font-medium ${statutConfig.color}`}>
                                <StatutIcon className="size-3" />
                                {statutConfig.label}
                              </Badge>
                            </div>

                            <Separator className="my-3" />

                            {/* Client */}
                            <div className="mb-2 flex items-center gap-2">
                              <User className="size-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {item.client.nom}
                              </span>
                            </div>

                            {/* Date */}
                            <div className="mb-2 flex items-center gap-2">
                              <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground">
                                {formatDate(item.date)}
                              </span>
                            </div>

                            {/* Employé */}
                            <div className="mb-2 flex items-center gap-2">
                              <Package className="size-3.5 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground truncate">
                                {item.employe?.nom || 'Non assigné'}
                              </span>
                            </div>

                            {/* Notes preview */}
                            {item.notes && (
                              <div className="mb-3 flex items-start gap-2">
                                <StickyNote className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                <span className="line-clamp-2 text-xs text-muted-foreground">
                                  {item.notes}
                                </span>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 px-2 text-xs text-slate-600 hover:text-[#003366] dark:text-slate-400 dark:hover:text-[#FF9900]"
                                onClick={() => openEditDialog(item)}
                              >
                                <Edit3 className="size-3" />
                                Modifier
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 px-2 text-xs text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                                onClick={() => {
                                  setDeletingId(item.id)
                                  setShowDeleteDialog(true)
                                }}
                              >
                                <Trash2 className="size-3" />
                                Supprimer
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
          </>
        )}
      </main>

      {/* ─── Add/Edit Dialog ────────────────────────────────────── */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#003366]/10 dark:bg-[#003366]/20">
                <Wrench className="size-4 text-[#003366] dark:text-[#FF9900]" />
              </div>
              {editingId ? 'Modifier l\'intervention' : 'Nouvelle intervention'}
            </DialogTitle>
            <DialogDescription>
              {editingId ? 'Modifiez les informations de l\'intervention.' : 'Créez une nouvelle intervention après-vente.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Client */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Client <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.clientId}
                onValueChange={v => setFormData(f => ({ ...f, clientId: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 ? (
                    <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                      Aucun client trouvé
                    </div>
                  ) : (
                    clients.map(c => (
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

            {/* Type */}
            <div className="space-y-1.5">
              <Label className="text-sm">Type d&apos;intervention</Label>
              <Select
                value={formData.type}
                onValueChange={v => setFormData(f => ({ ...f, type: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(t => {
                    const Icon = t.icon
                    return (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">
                          <Icon className="size-3.5" />
                          {t.label}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
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
                  {STATUT_OPTIONS.map(s => {
                    const Icon = s.icon
                    return (
                      <SelectItem key={s.value} value={s.value}>
                        <span className="flex items-center gap-2">
                          <Icon className="size-3.5" />
                          {s.label}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-sm">Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={e => setFormData(f => ({ ...f, date: e.target.value }))}
              />
            </div>

            {/* Employé */}
            <div className="space-y-1.5">
              <Label className="text-sm">Employé assigné</Label>
              <Select
                value={formData.employeId}
                onValueChange={v => setFormData(f => ({ ...f, employeId: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un employé" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigné</SelectItem>
                  {techniciens.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Techniciens
                      </div>
                      {techniciens.map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nom}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {allEmployes.filter(e => e.role !== 'technicien').length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Autres employés
                      </div>
                      {allEmployes
                        .filter(e => e.role !== 'technicien')
                        .map(e => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.nom} ({e.role})
                          </SelectItem>
                        ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-sm">Notes</Label>
              <Textarea
                placeholder="Notes sur l'intervention..."
                value={formData.notes}
                onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)} disabled={saving}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.clientId}
              className="gap-1.5 bg-gradient-to-r from-[#003366] to-[#004080] text-white hover:from-[#002244] hover:to-[#003366]"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  {editingId ? 'Modifier' : 'Créer'}
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
              Êtes-vous sûr de vouloir supprimer cette intervention ? Cette action est irréversible.
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
    </div>
  )
}
