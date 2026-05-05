'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Users,
  MapPin,
  Clock,
  Search,
  X,
  UserPlus,
  ChevronRight,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'

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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsMobile } from '@/hooks/use-mobile'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EventItem {
  id: string
  nom: string
  ville: string | null
  date: string
  type: string
  marques: string | null
  equipe: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    prospects: number
    tasks: number
  }
}

interface EventProspectLink {
  id: string
  eventId: string
  prospectId: string
  createdAt: string
  prospect: Prospect
}

interface Prospect {
  id: string
  nom: string
  specialite: string | null
  wilaya: string | null
  telephone: string | null
  whatsapp: string | null
  etablissement: string | null
  source: string | null
  isClient: boolean
  notes: string | null
}

// ─── Constants ──────────────────────────────────────────────────────────────

const VILLES_ALGERIE = [
  'Adrar', 'Alger', 'Annaba', 'Batna', 'Béjaïa', 'Blida', 'Biskra',
  'Boumerdès', 'Constantine', 'Djelfa', 'Ghardaïa', 'Jijel', 'Médéa',
  'Mostaganem', "M'Sila", 'Oran', 'Ouargla', 'Sétif', 'Sidi Bel Abbès',
  'Skikda', 'Tamanrasset', 'Tlemcen', 'Tizi Ouzou', 'Tiaret', 'Tébessa',
  'Tipaza', 'Saïda', 'Naâma', 'Aïn Defla', 'El Oued', 'Guelma',
  'Khenchela', 'Souk Ahras', 'Mascara', 'Bordj Bou Arréridj', 'Illizi',
  'Bouira', 'El Bayadh', 'Laghouat', 'Tindouf', 'Tissemsilt', 'Relizane',
  'Chlef', 'Miliana', 'Oum El Bouaghi', 'Aïn Témouchent',
]

const EVENT_TYPES = [
  { value: 'congres', label: 'Congrès', color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { value: 'expo', label: 'Expo', color: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100' },
  { value: 'formation', label: 'Formation', color: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100' },
]

const MARQUES = ['MIR', 'BOS', 'Löwenstein', 'Yuwell', 'Gelenke']

const MARQUE_COLORS: Record<string, string> = {
  MIR: 'bg-[#134885]/10 text-[#134885] border-[#134885]/20 hover:bg-[#134885]/10',
  BOS: 'bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100',
  Löwenstein: 'bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-100',
  Yuwell: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100',
  Gelenke: 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-100',
}

const TYPE_FILTER_OPTIONS = [
  { value: 'tous', label: 'Tous' },
  { value: 'congres', label: 'Congrès' },
  { value: 'expo', label: 'Expo' },
  { value: 'formation', label: 'Formation' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getTypeConfig(type: string) {
  return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[0]
}

function getMarqueColor(marque: string): string {
  return MARQUE_COLORS[marque] || 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100'
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const config = getTypeConfig(type)
  return (
    <Badge variant="outline" className={`text-xs font-medium ${config.color}`}>
      {config.label}
    </Badge>
  )
}

function MarqueBadge({ marque }: { marque: string }) {
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getMarqueColor(marque)}`}>
      {marque}
    </Badge>
  )
}

// ─── Loading Skeletons ──────────────────────────────────────────────────────

function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-4 w-28" />
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-12" />
            </div>
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-4 w-20" />
              <div className="flex gap-1">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function EventsModule() {
  const isMobile = useIsMobile()

  // ── Data state ──────────────────────────────────────────────────────────
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Filter state ────────────────────────────────────────────────────────
  const [typeFilter, setTypeFilter] = useState<string>('tous')

  // ── Form dialog state ───────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    nom: '',
    type: 'congres',
    ville: '',
    date: '',
    marques: [] as string[],
    equipe: '',
    notes: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // ── Delete dialog state ─────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Manage Prospects dialog state ───────────────────────────────────────
  const [prospectsOpen, setProspectsOpen] = useState(false)
  const [prospectsEventId, setProspectsEventId] = useState<string | null>(null)
  const [eventProspects, setEventProspects] = useState<EventProspectLink[]>([])
  const [prospectsLoading, setProspectsLoading] = useState(false)
  const [prospectSearch, setProspectSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Prospect[]>([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  // ── Quick add prospect dialog ───────────────────────────────────────────
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddForm, setQuickAddForm] = useState({
    nom: '',
    specialite: '',
    wilaya: '',
    telephone: '',
    etablissement: '',
  })
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false)

  // ── Fetch events ────────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (typeFilter && typeFilter !== 'tous') params.set('type', typeFilter)

      const res = await fetch(`/api/events?${params.toString()}`)
      if (!res.ok) throw new Error('Erreur lors du chargement')
      const data = await res.json()
      setEvents(data)
    } catch {
      setError('Impossible de charger les événements')
      toast.error('Erreur lors du chargement des événements')
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // ── Fetch event prospects ───────────────────────────────────────────────

  const fetchEventProspects = useCallback(async (eventId: string) => {
    setProspectsLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/prospects`)
      if (!res.ok) throw new Error('Erreur')
      const data = await res.json()
      setEventProspects(data)
    } catch {
      toast.error('Erreur lors du chargement des prospects')
    } finally {
      setProspectsLoading(false)
    }
  }, [])

  // ── Search prospects ────────────────────────────────────────────────────

  const searchProspects = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/prospects?search=${encodeURIComponent(query)}&limit=10`)
      if (!res.ok) throw new Error('Erreur')
      const json = await res.json()
      setSearchResults(json.data || json)
    } catch {
      toast.error('Erreur lors de la recherche')
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (prospectSearch) {
        searchProspects(prospectSearch)
      } else {
        setSearchResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [prospectSearch, searchProspects])

  // ── Form handlers ───────────────────────────────────────────────────────

  const openAddForm = () => {
    setEditingId(null)
    setFormData({
      nom: '',
      type: 'congres',
      ville: '',
      date: '',
      marques: [],
      equipe: '',
      notes: '',
    })
    setFormErrors({})
    setFormOpen(true)
  }

  const openEditForm = (event: EventItem) => {
    setEditingId(event.id)
    setFormData({
      nom: event.nom,
      type: event.type,
      ville: event.ville || '',
      date: event.date ? new Date(event.date).toISOString().split('T')[0] : '',
      marques: event.marques ? event.marques.split(',').map(m => m.trim()) : [],
      equipe: event.equipe || '',
      notes: event.notes || '',
    })
    setFormErrors({})
    setFormOpen(true)
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (!formData.nom.trim()) errors.nom = "Le nom de l'événement est requis"
    if (!formData.date) errors.date = 'La date est requise'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const payload = {
        nom: formData.nom.trim(),
        type: formData.type,
        ville: formData.ville || null,
        date: formData.date,
        marques: formData.marques.length > 0 ? formData.marques.join(',') : null,
        equipe: formData.equipe.trim() || null,
        notes: formData.notes.trim() || null,
      }

      if (editingId) {
        const res = await fetch(`/api/events/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Erreur')
        toast.success('Événement mis à jour avec succès')
      } else {
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Erreur')
        toast.success('Événement créé avec succès')
      }

      setFormOpen(false)
      fetchEvents()
    } catch {
      toast.error("Erreur lors de l'enregistrement")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete handler ──────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/events/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur')
      toast.success('Événement supprimé avec succès')
      fetchEvents()
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
      setDeleteId(null)
    }
  }

  // ── Prospects management ────────────────────────────────────────────────

  const openProspectsDialog = (eventId: string) => {
    setProspectsEventId(eventId)
    setProspectSearch('')
    setSearchResults([])
    setShowSearch(false)
    fetchEventProspects(eventId)
    setProspectsOpen(true)
  }

  const addProspectToEvent = async (prospectId: string) => {
    if (!prospectsEventId) return
    try {
      const res = await fetch(`/api/events/${prospectsEventId}/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectIds: [prospectId] }),
      })
      if (!res.ok) throw new Error('Erreur')
      toast.success('Prospect ajouté avec succès')
      fetchEventProspects(prospectsEventId)
      fetchEvents()
      setProspectSearch('')
      setSearchResults([])
    } catch {
      toast.error("Erreur lors de l'ajout du prospect")
    }
  }

  const removeProspectFromEvent = async (prospectId: string) => {
    if (!prospectsEventId) return
    try {
      const res = await fetch(
        `/api/events/${prospectsEventId}/prospects?prospectIds=${prospectId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('Erreur')
      toast.success('Prospect retiré avec succès')
      fetchEventProspects(prospectsEventId)
      fetchEvents()
    } catch {
      toast.error('Erreur lors du retrait du prospect')
    }
  }

  // ── Quick add prospect ──────────────────────────────────────────────────

  const handleQuickAddProspect = async () => {
    if (!quickAddForm.nom.trim()) {
      toast.error('Le nom est requis')
      return
    }
    setQuickAddSubmitting(true)
    try {
      const res = await fetch('/api/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: quickAddForm.nom.trim(),
          specialite: quickAddForm.specialite || null,
          wilaya: quickAddForm.wilaya || null,
          telephone: quickAddForm.telephone || null,
          etablissement: quickAddForm.etablissement || null,
          source: 'événement',
        }),
      })
      if (!res.ok) throw new Error('Erreur')
      const newProspect = await res.json()

      // Auto-add to event
      if (prospectsEventId) {
        await addProspectToEvent(newProspect.id)
      }

      toast.success('Prospect créé et ajouté avec succès')
      setQuickAddOpen(false)
      setQuickAddForm({ nom: '', specialite: '', wilaya: '', telephone: '', etablissement: '' })
    } catch {
      toast.error('Erreur lors de la création du prospect')
    } finally {
      setQuickAddSubmitting(false)
    }
  }

  // ── Toggle marque selection ─────────────────────────────────────────────

  const toggleMarque = (marque: string) => {
    setFormData(prev => ({
      ...prev,
      marques: prev.marques.includes(marque)
        ? prev.marques.filter(m => m !== marque)
        : [...prev.marques, marque],
    }))
  }

  // ── Check if prospect is already linked ─────────────────────────────────

  const isProspectLinked = (prospectId: string) => {
    return eventProspects.some(ep => ep.prospectId === prospectId)
  }

  // ── Compute stats ───────────────────────────────────────────────────────

  const totalProspects = events.reduce((sum, e) => sum + (e._count?.prospects || 0), 0)
  const upcomingEvents = events.filter(e => new Date(e.date) >= new Date()).length
  const pastEvents = events.filter(e => new Date(e.date) < new Date()).length

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="MI HEALTH CARE" className="h-9 w-auto shrink-0 object-contain" />
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#134885]">
                  Événements
                </h1>
                <p className="text-xs text-muted-foreground">
                  Congrès, Expos & Formations
                </p>
              </div>
            </div>
            <Button
              onClick={openAddForm}
              className="gap-1.5 bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white shadow-lg shadow-[#134885]/25 hover:from-[#0D3A6E] hover:to-[#134885] self-start sm:self-auto"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nouvel Événement</span>
              <span className="sm:hidden">Nouveau</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 space-y-6">
        {/* ── Summary Cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border-0 bg-white/70 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="size-3.5 text-[#134885]" />
                Total
              </div>
              <p className="mt-1 text-base font-bold text-slate-900 sm:text-lg">
                {events.length} événement{events.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="size-3.5 text-[#F6852A]" />
                À venir
              </div>
              <p className="mt-1 text-base font-bold text-[#1A5A9E] sm:text-lg">
                {upcomingEvents}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-slate-400" />
                Passés
              </div>
              <p className="mt-1 text-base font-bold text-slate-500 sm:text-lg">
                {pastEvents}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="size-3.5 text-violet-500" />
                Prospects liés
              </div>
              <p className="mt-1 text-base font-bold text-violet-600 sm:text-lg">
                {totalProspects}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Filter Bar ───────────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="size-4" />
                <span className="font-medium">Filtrer par type :</span>
              </div>
              <Tabs value={typeFilter} onValueChange={setTypeFilter}>
                <TabsList className="h-9">
                  {TYPE_FILTER_OPTIONS.map(opt => (
                    <TabsTrigger key={opt.value} value={opt.value} className="text-xs px-3">
                      {opt.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* ── Loading State ────────────────────────────────────────────── */}
        {loading && <CardGridSkeleton />}

        {/* ── Error State ──────────────────────────────────────────────── */}
        {error && !loading && (
          <Card className="shadow-sm border-red-200">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-red-50 p-4 mb-4">
                <AlertTriangle className="size-8 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-red-700">Erreur de chargement</h3>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <Button
                onClick={fetchEvents}
                variant="outline"
                className="mt-4"
                size="sm"
              >
                Réessayer
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Empty State ──────────────────────────────────────────────── */}
        {!loading && !error && events.length === 0 && (
          <Card className="shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-blue-50 p-4 mb-4">
                <Calendar className="size-8 text-[#134885]/60" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Aucun événement trouvé</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Commencez par créer votre premier événement — congrès, expo ou formation.
              </p>
              <Button
                onClick={openAddForm}
                className="mt-4 bg-[#134885] hover:bg-[#0D3A6E] text-white"
                size="sm"
              >
                <Plus className="size-4 mr-2" />
                Nouvel Événement
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Event Cards Grid ─────────────────────────────────────────── */}
        {!loading && !error && events.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(event => {
              const marquesList = event.marques
                ? event.marques.split(',').map(m => m.trim()).filter(Boolean)
                : []
              const isUpcoming = new Date(event.date) >= new Date()

              return (
                <Card
                  key={event.id}
                  className={`shadow-sm hover:shadow-md transition-all duration-200 border-l-4 ${
                    isUpcoming
                      ? 'border-l-[#F6852A] hover:border-l-[#F6852A]'
                      : 'border-l-slate-300 hover:border-l-slate-400'
                  }`}
                >
                  <CardContent className="p-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-sm leading-tight flex-1 min-w-0">
                        <span className="truncate block">{event.nom}</span>
                      </h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <TypeBadge type={event.type} />
                        {isUpcoming && (
                          <span className="inline-block size-2 rounded-full bg-[#F6852A] animate-pulse" />
                        )}
                      </div>
                    </div>

                    {/* City + Date */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      {event.ville && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" />
                          {event.ville}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDate(event.date)}
                      </span>
                    </div>

                    {/* Marques badges */}
                    {marquesList.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {marquesList.map(marque => (
                          <MarqueBadge key={marque} marque={marque} />
                        ))}
                      </div>
                    )}

                    {/* Prospects count + Team */}
                    <div className="flex items-center justify-between mb-3 text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users className="size-3" />
                        {event._count?.prospects || 0} prospect{(event._count?.prospects || 0) !== 1 ? 's' : ''}
                      </span>
                      {event.equipe && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {event.equipe}
                        </Badge>
                      )}
                    </div>

                    <Separator className="mb-3" />

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-xs hover:bg-[#134885]/5 hover:text-[#134885]"
                        onClick={() => openProspectsDialog(event.id)}
                      >
                        <Users className="size-3.5" />
                        {!isMobile && 'Prospects'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEditForm(event)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeleteId(event.id)
                          setDeleteOpen(true)
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>

      {/* ── Add/Edit Event Dialog ───────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#134885]/10">
                <Calendar className="size-4 text-[#134885]" />
              </div>
              {editingId ? "Modifier l'événement" : 'Nouvel événement'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Modifiez les informations de l'événement ci-dessous."
                : 'Remplissez les informations pour créer un nouvel événement.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Nom de l'événement */}
            <div className="grid gap-2">
              <Label htmlFor="event-nom" className="flex items-center gap-1">
                Nom de l&apos;événement <span className="text-destructive">*</span>
              </Label>
              <Input
                id="event-nom"
                placeholder="Ex: Congrès National de Cardiologie 2025"
                value={formData.nom}
                onChange={e => setFormData({ ...formData, nom: e.target.value })}
                className={formErrors.nom ? 'border-destructive' : ''}
              />
              {formErrors.nom && (
                <p className="text-xs text-destructive">{formErrors.nom}</p>
              )}
            </div>

            {/* Type + Ville */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={v => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">
                          <span className={`inline-block size-2 rounded-full ${
                            t.value === 'congres' ? 'bg-blue-500' :
                            t.value === 'expo' ? 'bg-purple-500' : 'bg-amber-500'
                          }`} />
                          {t.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Ville</Label>
                <Select
                  value={formData.ville}
                  onValueChange={v => setFormData({ ...formData, ville: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {VILLES_ALGERIE.sort().map(v => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date */}
            <div className="grid gap-2">
              <Label htmlFor="event-date" className="flex items-center gap-1">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="event-date"
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className={formErrors.date ? 'border-destructive' : ''}
              />
              {formErrors.date && (
                <p className="text-xs text-destructive">{formErrors.date}</p>
              )}
            </div>

            {/* Marques présentes */}
            <div className="grid gap-2">
              <Label>Marques présentes</Label>
              <div className="flex flex-wrap gap-2">
                {MARQUES.map(marque => (
                  <button
                    key={marque}
                    type="button"
                    onClick={() => toggleMarque(marque)}
                    className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      formData.marques.includes(marque)
                        ? getMarqueColor(marque)
                        : 'bg-white text-muted-foreground border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {marque}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Cliquez sur les marques pour les sélectionner
              </p>
            </div>

            {/* Équipe assignée */}
            <div className="grid gap-2">
              <Label htmlFor="event-equipe" className="flex items-center gap-1">
                <Users className="size-3.5" />
                Équipe assignée
              </Label>
              <Input
                id="event-equipe"
                placeholder="Ex: Équipe Nord, Commercial Alger..."
                value={formData.equipe}
                onChange={e => setFormData({ ...formData, equipe: e.target.value })}
              />
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="event-notes">Notes</Label>
              <Textarea
                id="event-notes"
                placeholder="Notes additionnelles sur l'événement..."
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-[#134885] hover:bg-[#0D3A6E] text-white"
            >
              {submitting && <Loader2 className="size-4 mr-2 animate-spin" />}
              {editingId ? 'Mettre à jour' : 'Créer l\'événement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ──────────────────────────────────── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Supprimer l&apos;événement
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet événement ? Cette action est
              irréversible. Tous les prospects liés seront détachés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="size-4 mr-2 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Manage Prospects Dialog ─────────────────────────────────────── */}
      <Dialog open={prospectsOpen} onOpenChange={setProspectsOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-violet-100">
                <Users className="size-4 text-violet-600" />
              </div>
              Gérer les prospects
            </DialogTitle>
            <DialogDescription>
              Ajoutez ou retirez des prospects liés à cet événement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Linked prospects list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Prospects liés ({eventProspects.length})
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    setQuickAddForm({ nom: '', specialite: '', wilaya: '', telephone: '', etablissement: '' })
                    setQuickAddOpen(true)
                  }}
                >
                  <UserPlus className="size-3" />
                  Créer un prospect
                </Button>
              </div>

              {prospectsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : eventProspects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center rounded-lg border border-dashed">
                  <Users className="size-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Aucun prospect lié</p>
                  <p className="text-xs text-muted-foreground">
                    Utilisez la recherche ci-dessous pour en ajouter.
                  </p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                  {eventProspects.map(ep => (
                    <div
                      key={ep.id}
                      className="flex items-center gap-3 rounded-lg border p-2.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex size-8 items-center justify-center rounded-full bg-[#134885]/10 text-[#134885] shrink-0">
                        <span className="text-xs font-bold">
                          {ep.prospect.nom.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ep.prospect.nom}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {ep.prospect.specialite && <span>{ep.prospect.specialite}</span>}
                          {ep.prospect.wilaya && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="size-2.5" />
                              {ep.prospect.wilaya}
                            </span>
                          )}
                          {ep.prospect.etablissement && (
                            <span className="truncate">{ep.prospect.etablissement}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
                        onClick={() => removeProspectFromEvent(ep.prospectId)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Search and add prospects */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Ajouter des prospects</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, spécialité, établissement..."
                  value={prospectSearch}
                  onChange={e => {
                    setProspectSearch(e.target.value)
                    setShowSearch(true)
                  }}
                  onFocus={() => setShowSearch(true)}
                  className="pl-9 pr-9"
                />
                {prospectSearch && (
                  <button
                    onClick={() => {
                      setProspectSearch('')
                      setSearchResults([])
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              {/* Search results */}
              {showSearch && prospectSearch && (
                <div className="rounded-lg border bg-white shadow-lg max-h-48 overflow-y-auto">
                  {searching ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="size-5 animate-spin text-[#134885]" />
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Search className="size-5 text-muted-foreground/30 mb-1" />
                      <p className="text-xs text-muted-foreground">Aucun prospect trouvé</p>
                    </div>
                  ) : (
                    searchResults.map(prospect => {
                      const alreadyLinked = isProspectLinked(prospect.id)
                      return (
                        <div
                          key={prospect.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 transition-colors border-b last:border-b-0"
                        >
                          <div className="flex size-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 shrink-0">
                            <span className="text-[10px] font-bold">
                              {prospect.nom.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{prospect.nom}</p>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              {prospect.specialite && <span>{prospect.specialite}</span>}
                              {prospect.wilaya && <span>· {prospect.wilaya}</span>}
                            </div>
                          </div>
                          {alreadyLinked ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                              <CheckCircle2 className="size-2.5 mr-0.5" />
                              Ajouté
                            </Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] px-2 shrink-0 hover:bg-[#134885]/5 hover:text-[#134885] hover:border-[#134885]/20"
                              onClick={() => addProspectToEvent(prospect.id)}
                            >
                              <Plus className="size-2.5 mr-0.5" />
                              Ajouter
                            </Button>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProspectsOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Quick Add Prospect Dialog ───────────────────────────────────── */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#134885]/10">
                <UserPlus className="size-4 text-[#134885]" />
              </div>
              Nouveau prospect
            </DialogTitle>
            <DialogDescription>
              Créez un prospect et ajoutez-le automatiquement à cet événement.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="quick-nom" className="flex items-center gap-1">
                Nom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quick-nom"
                placeholder="Nom du médecin ou de la clinique"
                value={quickAddForm.nom}
                onChange={e => setQuickAddForm({ ...quickAddForm, nom: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Spécialité</Label>
                <Input
                  placeholder="Cardiologie, Orthopédie..."
                  value={quickAddForm.specialite}
                  onChange={e => setQuickAddForm({ ...quickAddForm, specialite: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Wilaya</Label>
                <Select
                  value={quickAddForm.wilaya}
                  onValueChange={v => setQuickAddForm({ ...quickAddForm, wilaya: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {VILLES_ALGERIE.sort().map(v => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Téléphone</Label>
                <Input
                  placeholder="0X XX XX XX XX"
                  value={quickAddForm.telephone}
                  onChange={e => setQuickAddForm({ ...quickAddForm, telephone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Établissement</Label>
                <Input
                  placeholder="Nom de l'établissement"
                  value={quickAddForm.etablissement}
                  onChange={e => setQuickAddForm({ ...quickAddForm, etablissement: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAddOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleQuickAddProspect}
              disabled={quickAddSubmitting}
              className="bg-[#134885] hover:bg-[#0D3A6E] text-white"
            >
              {quickAddSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
              Créer et ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="mt-auto border-t bg-white/60">
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
          <p className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} MI HEALTH CARE &mdash; Tous droits réservés
          </p>
        </div>
      </footer>
    </div>
  )
}
