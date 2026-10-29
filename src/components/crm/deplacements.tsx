'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus,
  Search,
  Car,
  Route,
  MapPin,
  Users,
  Calendar,
  Edit3,
  Trash2,
  Loader2,
  X,
  Stethoscope,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
  Navigation,
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
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'
import { WILAYAS } from '@/lib/wilayas'

// ─── Types ───────────────────────────────────────────────────────

interface Employee {
  id: string
  nom: string
  role: string
  actif?: boolean
}

interface ProspectLite {
  id: string
  nom: string
  specialite?: string | null
  etablissement?: string | null
  wilaya?: string | null
}

interface Deplacement {
  id: string
  employeId: string
  prospectId?: string | null
  motif: string
  statut: string
  moyenTransport: string
  villeDepart?: string | null
  villeArrivee?: string | null
  date: string
  heureDepart?: string | null
  heureRetour?: string | null
  distanceKm?: number | null
  montant: number
  notes?: string | null
  createdAt: string
  updatedAt: string
  employe: { id: string; nom: string; role: string }
  prospect?: ProspectLite | null
  creePar?: { id: string; nom: string } | null
  modifiePar?: { id: string; nom: string } | null
}

interface DeplacementStats {
  total: number
  totalKm: number
  totalMontant: number
  totalVisites: number
  byMotif: { motif: string; total: number; count: number; km: number }[]
  byEmployee: { employeId: string; nom: string; count: number; km: number; total: number; visites: number }[]
  topProspects: { prospectId: string; nom: string; count: number }[]
  byStatut: { statut: string; count: number }[]
}

// ─── Constants ───────────────────────────────────────────────────

const MOTIFS = [
  { value: 'visite', label: 'Visite médecin', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  { value: 'formation', label: 'Formation', color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  { value: 'livraison', label: 'Livraison', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  { value: 'evenement', label: 'Événement / Congrès', color: 'bg-pink-100 text-pink-700', dot: 'bg-pink-500' },
  { value: 'prospection', label: 'Prospection', color: 'bg-cyan-100 text-cyan-700', dot: 'bg-cyan-500' },
  { value: 'autre', label: 'Autre', color: 'bg-slate-100 text-slate-700', dot: 'bg-slate-500' },
]

const STATUTS = [
  { value: 'planifie', label: 'Planifié', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'en_cours', label: 'En cours', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'termine', label: 'Terminé', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'annule', label: 'Annulé', color: 'bg-red-100 text-red-700 border-red-200' },
]

const MOYENS_TRANSPORT = [
  { value: 'vehicule_personnel', label: 'Véhicule personnel' },
  { value: 'vehicule_societe', label: 'Véhicule de société' },
  { value: 'taxi', label: 'Taxi' },
  { value: 'train', label: 'Train' },
  { value: 'avion', label: 'Avion' },
  { value: 'autre', label: 'Autre' },
]

function motifInfo(value: string) {
  return MOTIFS.find((m) => m.value === value) || MOTIFS[MOTIFS.length - 1]
}

function statutInfo(value: string) {
  return STATUTS.find((s) => s.value === value) || STATUTS[0]
}

function transportLabel(value: string) {
  return MOYENS_TRANSPORT.find((t) => t.value === value)?.label || value
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatDZD(amount: number | null | undefined): string {
  if (amount == null) return '— DZD'
  return new Intl.NumberFormat('fr-DZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' DZD'
}

function formatKm(km: number | null | undefined): string {
  if (km == null) return '— km'
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(km)} km`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const emptyForm = {
  employeId: '',
  prospectId: '',
  motif: 'visite',
  statut: 'planifie',
  moyenTransport: 'vehicule_personnel',
  villeDepart: '',
  villeArrivee: '',
  date: '',
  heureDepart: '',
  heureRetour: '',
  distanceKm: '',
  montant: '',
  notes: '',
}

// ─── Component ───────────────────────────────────────────────────

export default function DeplacementsModule() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [deplacements, setDeplacements] = useState<Deplacement[]>([])
  const [stats, setStats] = useState<DeplacementStats | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [prospects, setProspects] = useState<ProspectLite[]>([])
  const [loading, setLoading] = useState(true)
  const [showStats, setShowStats] = useState(false)

  // Filtres
  const [search, setSearch] = useState('')
  const [filterEmploye, setFilterEmploye] = useState('all')
  const [filterMotif, setFilterMotif] = useState('all')
  const [filterStatut, setFilterStatut] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [prospectSearch, setProspectSearch] = useState('')
  const [formData, setFormData] = useState({ ...emptyForm })

  // ─── Chargement employés + médecins ───
  useEffect(() => {
    const loadData = async () => {
      try {
        if (isAdmin) {
          const res = await fetch('/api/employees/list')
          if (res.ok) {
            const data = await res.json()
            setEmployees(Array.isArray(data) ? data : data.employees || [])
          }
        }
        const resP = await fetch('/api/prospects?limit=500')
        if (resP.ok) {
          const dataP = await resP.json()
          const list: ProspectLite[] = Array.isArray(dataP) ? dataP : dataP.data || dataP.prospects || []
          setProspects(list)
        }
      } catch {
        // silencieux — les listes resteront vides
      }
    }
    loadData()
  }, [isAdmin])

  // ─── Chargement déplacements + stats ───
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (isAdmin && filterEmploye !== 'all') params.set('employeId', filterEmploye)
      if (filterMotif !== 'all') params.set('motif', filterMotif)
      if (filterStatut !== 'all') params.set('statut', filterStatut)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const [resList, resStats] = await Promise.all([
        fetch(`/api/deplacements?${params.toString()}`),
        fetch(`/api/deplacements?${params.toString()}&stats=true`),
      ])

      if (resList.ok) {
        const data = await resList.json()
        setDeplacements(Array.isArray(data) ? data : [])
      } else {
        const err = await resList.json().catch(() => ({}))
        toast.error(err.error || 'Erreur lors du chargement des déplacements')
      }

      if (resStats.ok) {
        setStats(await resStats.json())
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }, [search, isAdmin, filterEmploye, filterMotif, filterStatut, dateFrom, dateTo])

  // Debounce sur la recherche uniquement
  useEffect(() => {
    const t = setTimeout(() => {
      fetchData()
    }, 400)
    return () => clearTimeout(t)
  }, [fetchData])

  // ─── Filtrage local (recherche médecin / ville / notes) ───
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return deplacements
    return deplacements.filter((d) => {
      const prospect = d.prospect
      return (
        prospect?.nom?.toLowerCase().includes(q) ||
        prospect?.etablissement?.toLowerCase().includes(q) ||
        prospect?.specialite?.toLowerCase().includes(q) ||
        d.villeDepart?.toLowerCase().includes(q) ||
        d.villeArrivee?.toLowerCase().includes(q) ||
        d.notes?.toLowerCase().includes(q) ||
        d.employe?.nom?.toLowerCase().includes(q)
      )
    })
  }, [deplacements, search])

  // ─── Formulaire ───
  const openCreate = () => {
    setEditingId(null)
    setFormData({ ...emptyForm, employeId: isAdmin ? '' : (user?.employeId || '') })
    setProspectSearch('')
    setIsDialogOpen(true)
  }

  const openEdit = (d: Deplacement) => {
    setEditingId(d.id)
    setFormData({
      employeId: d.employeId,
      prospectId: d.prospectId || '',
      motif: d.motif,
      statut: d.statut,
      moyenTransport: d.moyenTransport,
      villeDepart: d.villeDepart || '',
      villeArrivee: d.villeArrivee || '',
      date: d.date ? new Date(d.date).toISOString().slice(0, 10) : '',
      heureDepart: d.heureDepart || '',
      heureRetour: d.heureRetour || '',
      distanceKm: d.distanceKm != null ? String(d.distanceKm) : '',
      montant: d.montant != null ? String(d.montant) : '',
      notes: d.notes || '',
    })
    setProspectSearch('')
    setIsDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.date) {
      toast.error('La date du déplacement est requise')
      return
    }
    if (!formData.employeId) {
      toast.error('Veuillez sélectionner un employé')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        ...formData,
        distanceKm: formData.distanceKm === '' ? null : formData.distanceKm,
        montant: formData.montant === '' ? 0 : formData.montant,
      }
      const res = await fetch(
        editingId ? `/api/deplacements/${editingId}` : '/api/deplacements',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur lors de l\'enregistrement')
      }
      toast.success(editingId ? 'Déplacement mis à jour' : 'Déplacement créé')
      setIsDialogOpen(false)
      await fetchData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/deplacements/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur lors de la suppression')
      }
      toast.success('Déplacement supprimé')
      setDeleteId(null)
      await fetchData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue'
      toast.error(msg)
    }
  }

  // ─── Liste des médecins filtrée dans le formulaire ───
  const prospectsFiltered = useMemo(() => {
    const q = prospectSearch.trim().toLowerCase()
    const sorted = [...prospects].sort((a, b) => a.nom.localeCompare(b.nom))
    if (!q) return sorted.slice(0, 100)
    return sorted
      .filter(
        (p) =>
          p.nom?.toLowerCase().includes(q) ||
          p.etablissement?.toLowerCase().includes(q) ||
          p.wilaya?.toLowerCase().includes(q)
      )
      .slice(0, 100)
  }, [prospects, prospectSearch])

  const selectedProspect = prospects.find((p) => p.id === formData.prospectId)

  const hasActiveFilters =
    search.trim() !== '' ||
    filterEmploye !== 'all' ||
    filterMotif !== 'all' ||
    filterStatut !== 'all' ||
    dateFrom !== '' ||
    dateTo !== ''

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ─── Header ─── */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#F6852A] to-[#e06b10] text-white shadow-lg">
                <Car className="h-5 w-5" />
              </div>
              Déplacements
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Gestion des déplacements chez les médecins et établissements de santé
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowStats((v) => !v)}
              className="border-slate-200"
            >
              {showStats ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
              Statistiques
            </Button>
            <Button
              onClick={openCreate}
              className="bg-gradient-to-r from-[#F6852A] to-[#e8751a] text-white shadow-lg shadow-[#F6852A]/20 hover:from-[#e8751a] hover:to-[#d96508]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouveau déplacement
            </Button>
          </div>
        </div>

        {/* ─── Statistiques ─── */}
        <AnimatePresence initial={false}>
          {showStats && stats && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-slate-200">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <Route className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Déplacements</p>
                      <p className="text-xl font-bold text-slate-900">{stats.total}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                      <Stethoscope className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Visites effectuées</p>
                      <p className="text-xl font-bold text-slate-900">{stats.totalVisites}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                      <Navigation className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Distance totale</p>
                      <p className="text-xl font-bold text-slate-900">{formatKm(stats.totalKm)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Frais totaux</p>
                      <p className="text-xl font-bold text-slate-900">{formatDZD(stats.totalMontant)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Par employé */}
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Users className="h-4 w-4 text-[#F6852A]" />
                      Par employé
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.byEmployee.length === 0 ? (
                      <p className="py-4 text-center text-sm text-slate-400">Aucune donnée</p>
                    ) : (
                      <div className="space-y-2">
                        {stats.byEmployee.map((e) => (
                          <div key={e.employeId} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                            <div>
                              <p className="text-sm font-medium text-slate-800">{e.nom}</p>
                              <p className="text-xs text-slate-500">
                                {e.count} déplacement{e.count > 1 ? 's' : ''} · {formatKm(e.km)} · {e.visites} visite{e.visites > 1 ? 's' : ''}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-[#F6852A]">{formatDZD(e.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Top médecins */}
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Stethoscope className="h-4 w-4 text-[#F6852A]" />
                      Médecins / établissements les plus visités
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.topProspects.length === 0 ? (
                      <p className="py-4 text-center text-sm text-slate-400">Aucune donnée</p>
                    ) : (
                      <div className="space-y-2">
                        {stats.topProspects.map((p, i) => (
                          <div key={p.prospectId} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F6852A]/10 text-xs font-bold text-[#F6852A]">
                                {i + 1}
                              </span>
                              <p className="text-sm font-medium text-slate-800">{p.nom}</p>
                            </div>
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                              {p.count} visite{p.count > 1 ? 's' : ''}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Filtres ─── */}
        <Card className="mb-6 border-slate-200">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Rechercher (médecin, établissement, ville, notes...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {isAdmin && (
                <Select value={filterEmploye} onValueChange={setFilterEmploye}>
                  <SelectTrigger className="w-full lg:w-[180px]">
                    <SelectValue placeholder="Employé" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les employés</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={filterMotif} onValueChange={setFilterMotif}>
                <SelectTrigger className="w-full lg:w-[170px]">
                  <SelectValue placeholder="Motif" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les motifs</SelectItem>
                  {MOTIFS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatut} onValueChange={setFilterStatut}>
                <SelectTrigger className="w-full lg:w-[150px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {STATUTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[140px]"
                  title="Date début"
                />
                <span className="text-slate-400">→</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[140px]"
                  title="Date fin"
                />
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSearch('')
                      setFilterEmploye('all')
                      setFilterMotif('all')
                      setFilterStatut('all')
                      setDateFrom('')
                      setDateTo('')
                    }}
                    title="Réinitialiser les filtres"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Liste ─── */}
        <Card className="border-slate-200">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-[#F6852A]" />
                <span className="ml-3 text-sm text-slate-500">Chargement des déplacements...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                  <Car className="h-7 w-7 text-slate-400" />
                </div>
                <p className="font-medium text-slate-700">Aucun déplacement trouvé</p>
                <p className="mt-1 text-sm text-slate-500">
                  {hasActiveFilters
                    ? 'Aucun résultat pour ces filtres. Essayez de les ajuster.'
                    : 'Créez votre premier déplacement pour commencer le suivi.'}
                </p>
                {!hasActiveFilters && (
                  <Button onClick={openCreate} className="mt-4 bg-[#F6852A] text-white hover:bg-[#e8751a]">
                    <Plus className="mr-2 h-4 w-4" />
                    Nouveau déplacement
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-xs font-semibold text-slate-600">Date</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600">Employé</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600">Médecin / Établissement</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600">Trajet</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600">Motif</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600">Transport</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-slate-600">Distance</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-slate-600">Frais</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600">Statut</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((d) => {
                      const motif = motifInfo(d.motif)
                      const statut = statutInfo(d.statut)
                      return (
                        <TableRow key={d.id} className="hover:bg-slate-50/60">
                          <TableCell>
                            <div className="text-sm font-medium text-slate-800">{formatDate(d.date)}</div>
                            {(d.heureDepart || d.heureRetour) && (
                              <div className="flex items-center gap-1 text-xs text-slate-400">
                                <Clock className="h-3 w-3" />
                                {d.heureDepart || '—'} → {d.heureRetour || '—'}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-700">{d.employe?.nom || '—'}</TableCell>
                          <TableCell>
                            {d.prospect ? (
                              <div>
                                <div className="text-sm font-medium text-slate-800">{d.prospect.nom}</div>
                                {(d.prospect.specialite || d.prospect.etablissement) && (
                                  <div className="text-xs text-slate-400">
                                    {[d.prospect.specialite, d.prospect.etablissement].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-slate-700">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              {d.villeDepart || '—'}
                              <span className="text-slate-300">→</span>
                              {d.villeArrivee || '—'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${motif.color} border-0 font-medium`}>
                              {motif.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">{transportLabel(d.moyenTransport)}</TableCell>
                          <TableCell className="text-right text-sm text-slate-700">{formatKm(d.distanceKm)}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-slate-800">
                            {formatDZD(d.montant)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${statut.color} font-medium`}>
                              {statut.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Filter className="h-4 w-4 text-slate-500" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(d)} className="cursor-pointer">
                                  <Edit3 className="mr-2 h-4 w-4" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteId(d.id)}
                                  className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Dialog création / édition ─── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-[#F6852A]" />
              {editingId ? 'Modifier le déplacement' : 'Nouveau déplacement'}
            </DialogTitle>
            <DialogDescription>
              Enregistrez un déplacement chez un médecin ou un établissement de santé.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Employé */}
            <div className="space-y-1.5">
              <Label htmlFor="dep-employe">Employé *</Label>
              {isAdmin ? (
                <Select
                  value={formData.employeId || undefined}
                  onValueChange={(v) => setFormData((f) => ({ ...f, employeId: v }))}
                >
                  <SelectTrigger id="dep-employe">
                    <SelectValue placeholder="Sélectionner un employé" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={user?.employeNom || ''} disabled />
              )}
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="dep-date">Date du déplacement *</Label>
              <Input
                id="dep-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))}
              />
            </div>

            {/* Médecin / établissement */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="dep-prospect-search">Médecin / établissement visité</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="dep-prospect-search"
                  placeholder="Filtrer la liste (nom, établissement, wilaya)..."
                  value={prospectSearch}
                  onChange={(e) => setProspectSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={formData.prospectId || undefined}
                onValueChange={(v) => setFormData((f) => ({ ...f, prospectId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucun (déplacement interne)" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {prospectsFiltered.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nom}
                      {p.wilaya ? ` — ${p.wilaya}` : ''}
                      {p.etablissement ? ` (${p.etablissement})` : ''}
                    </SelectItem>
                  ))}
                  {prospectsFiltered.length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-400">Aucun résultat</div>
                  )}
                </SelectContent>
              </Select>
              {selectedProspect && (
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Stethoscope className="h-3 w-3 text-[#F6852A]" />
                  {[selectedProspect.specialite, selectedProspect.etablissement, selectedProspect.wilaya]
                    .filter(Boolean)
                    .join(' · ') || 'Sélectionné'}
                </p>
              )}
            </div>

            {/* Trajet */}
            <div className="space-y-1.5">
              <Label htmlFor="dep-vdepart">Ville / lieu de départ</Label>
              <Input
                id="dep-vdepart"
                list="wilayas-list"
                placeholder="Ex : Alger"
                value={formData.villeDepart}
                onChange={(e) => setFormData((f) => ({ ...f, villeDepart: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dep-varrivee">Ville / lieu d&apos;arrivée</Label>
              <Input
                id="dep-varrivee"
                list="wilayas-list"
                placeholder="Ex : Oran"
                value={formData.villeArrivee}
                onChange={(e) => setFormData((f) => ({ ...f, villeArrivee: e.target.value }))}
              />
            </div>
            <datalist id="wilayas-list">
              {WILAYAS.map((w) => (
                <option key={w} value={w} />
              ))}
            </datalist>

            {/* Motif / Statut */}
            <div className="space-y-1.5">
              <Label>Motif</Label>
              <Select value={formData.motif} onValueChange={(v) => setFormData((f) => ({ ...f, motif: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOTIFS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select value={formData.statut} onValueChange={(v) => setFormData((f) => ({ ...f, statut: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Transport / KM */}
            <div className="space-y-1.5">
              <Label>Moyen de transport</Label>
              <Select
                value={formData.moyenTransport}
                onValueChange={(v) => setFormData((f) => ({ ...f, moyenTransport: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOYENS_TRANSPORT.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dep-km">Distance (km)</Label>
              <Input
                id="dep-km"
                type="number"
                min="0"
                step="0.1"
                placeholder="Ex : 120"
                value={formData.distanceKm}
                onChange={(e) => setFormData((f) => ({ ...f, distanceKm: e.target.value }))}
              />
            </div>

            {/* Heures */}
            <div className="space-y-1.5">
              <Label htmlFor="dep-hdepart">Heure de départ</Label>
              <Input
                id="dep-hdepart"
                type="time"
                value={formData.heureDepart}
                onChange={(e) => setFormData((f) => ({ ...f, heureDepart: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dep-hretour">Heure de retour</Label>
              <Input
                id="dep-hretour"
                type="time"
                value={formData.heureRetour}
                onChange={(e) => setFormData((f) => ({ ...f, heureRetour: e.target.value }))}
              />
            </div>

            {/* Frais */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="dep-montant">Frais du déplacement (DZD)</Label>
              <Input
                id="dep-montant"
                type="number"
                min="0"
                step="1"
                placeholder="Ex : 3500"
                value={formData.montant}
                onChange={(e) => setFormData((f) => ({ ...f, montant: e.target.value }))}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="dep-notes">Notes</Label>
              <Textarea
                id="dep-notes"
                placeholder="Observations, comptes-rendus de visite, détails du trajet..."
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-gradient-to-r from-[#F6852A] to-[#e8751a] text-white hover:from-[#e8751a] hover:to-[#d96508]"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : editingId ? (
                'Enregistrer les modifications'
              ) : (
                'Créer le déplacement'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog suppression ─── */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Supprimer le déplacement ?</DialogTitle>
            <DialogDescription>
              Cette action est définitive. Le déplacement sera supprimé du suivi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
