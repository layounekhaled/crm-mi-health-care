'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Building2,
  Stethoscope,
  UserPlus,
  AlertTriangle,
  Filter,
  X,
  ChevronRight,
  PhoneCall,
  CalendarDays,
} from 'lucide-react'
import { toast } from 'sonner'

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useIsMobile } from '@/hooks/use-mobile'

// ─── Types ──────────────────────────────────────────────────────────────────

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
  createdAt: string
  updatedAt: string
  _count?: {
    interactions: number
    opportunities: number
    afterSales: number
  }
}

interface ProspectDetail extends Prospect {
  interactions: Interaction[]
  opportunities: Opportunity[]
  afterSales: AfterSale[]
}

interface Interaction {
  id: string
  type: string
  notes: string | null
  date: string
  employe?: { id: string; nom: string } | null
}

interface Opportunity {
  id: string
  nomProjet: string
  statut: string
  montantEstime: number | null
  commercial?: { id: string; nom: string } | null
}

interface AfterSale {
  id: string
  type: string
  statut: string
  notes: string | null
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SPECIALITES = [
  'Cardiologie',
  'Orthopédie',
  'Radiologie',
  'Chirurgie',
  'Anesthésie',
  'Médecine générale',
  'Autre',
]

const WILAYAS = [
  'Adrar',
  'Aïn Defla',
  'Alger',
  'Annaba',
  'Batna',
  'Béjaïa',
  'Blida',
  'Biskra',
  'Boumerdès',
  'Constantine',
  'Djelfa',
  'Ghardaïa',
  'Jijel',
  'Médéa',
  'Mostaganem',
  'M\'Sila',
  'Naâma',
  'Oran',
  'Ouargla',
  'Saïda',
  'Sétif',
  'Sidi Bel Abbès',
  'Skikda',
  'Tamanrasset',
  'Tiaret',
  'Tébessa',
  'Tipaza',
  'Tizi Ouzou',
  'Tlemcen',
]

const SOURCES = [
  { value: 'événement', label: 'Événement' },
  { value: 'prospection', label: 'Prospection' },
  { value: 'recommandation', label: 'Recommandation' },
]

const INTERACTION_TYPES = [
  { value: 'appel', label: 'Appel téléphonique' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'visite', label: 'Visite' },
  { value: 'autre', label: 'Autre' },
]

// ─── Helper: Source badge color ─────────────────────────────────────────────

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return <Badge variant="outline">—</Badge>

  const config: Record<string, string> = {
    'événement': 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
    'prospection': 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100',
    'recommandation': 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  }

  const labels: Record<string, string> = {
    'événement': 'Événement',
    'prospection': 'Prospection',
    'recommandation': 'Recommandation',
    'propection': 'Prospection',
  }

  return (
    <Badge variant="outline" className={config[source] || ''}>
      {labels[source] || source}
    </Badge>
  )
}

// ─── Helper: Status badge ───────────────────────────────────────────────────

function StatusBadge({ isClient }: { isClient: boolean }) {
  if (isClient) {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 border">
        Client
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100">
      Prospect
    </Badge>
  )
}

// ─── Helper: Interaction type icon ──────────────────────────────────────────

function InteractionIcon({ type }: { type: string }) {
  switch (type) {
    case 'appel':
      return <PhoneCall className="size-4 text-blue-500" />
    case 'whatsapp':
      return <MessageCircle className="size-4 text-green-500" />
    case 'email':
      return <Mail className="size-4 text-purple-500" />
    case 'visite':
      return <CalendarDays className="size-4 text-amber-500" />
    default:
      return <Phone className="size-4 text-slate-400" />
  }
}

// ─── Loading Skeleton ───────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ProspectsModule() {
  const isMobile = useIsMobile()

  // Data state
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  // Filter state
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string>('tous')
  const [wilayaFilter, setWilayaFilter] = useState<string>('tous')
  const [tabFilter, setTabFilter] = useState<string>('tous')

  // Dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [addInteractionOpen, setAddInteractionOpen] = useState(false)

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    nom: '',
    specialite: '',
    wilaya: '',
    telephone: '',
    whatsapp: '',
    etablissement: '',
    source: 'prospection',
    notes: '',
    isClient: false,
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Detail state
  const [selectedProspect, setSelectedProspect] = useState<ProspectDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [duplicateExistingId, setDuplicateExistingId] = useState<string | null>(null)

  // Interaction form state
  const [interactionForm, setInteractionForm] = useState({
    type: 'appel',
    notes: '',
  })
  const [interactionSubmitting, setInteractionSubmitting] = useState(false)

  // ─── Fetch prospects ────────────────────────────────────────────────────

  const fetchProspects = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (sourceFilter && sourceFilter !== 'tous') params.set('source', sourceFilter)
      if (wilayaFilter && wilayaFilter !== 'tous') params.set('wilaya', wilayaFilter)
      if (tabFilter === 'prospects') params.set('isClient', 'false')
      if (tabFilter === 'clients') params.set('isClient', 'true')

      const res = await fetch(`/api/prospects?${params.toString()}`)
      if (!res.ok) throw new Error('Erreur lors du chargement')
      const json = await res.json()
      setProspects(json.data || [])
      setTotal(json.pagination?.total || 0)
    } catch {
      toast.error('Erreur lors du chargement des prospects')
    } finally {
      setLoading(false)
    }
  }, [search, sourceFilter, wilayaFilter, tabFilter])

  useEffect(() => {
    fetchProspects()
  }, [fetchProspects])

  // ─── Fetch prospect detail ──────────────────────────────────────────────

  const fetchDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/prospects/${id}`)
      if (!res.ok) throw new Error('Erreur')
      const data = await res.json()
      setSelectedProspect(data)
    } catch {
      toast.error('Erreur lors du chargement des détails')
    } finally {
      setDetailLoading(false)
    }
  }

  // ─── Form handlers ──────────────────────────────────────────────────────

  const openAddForm = () => {
    setEditingId(null)
    setFormData({
      nom: '',
      specialite: '',
      wilaya: '',
      telephone: '',
      whatsapp: '',
      etablissement: '',
      source: 'prospection',
      notes: '',
      isClient: false,
    })
    setFormErrors({})
    setFormOpen(true)
  }

  const openEditForm = (prospect: Prospect) => {
    setEditingId(prospect.id)
    setFormData({
      nom: prospect.nom,
      specialite: prospect.specialite || '',
      wilaya: prospect.wilaya || '',
      telephone: prospect.telephone || '',
      whatsapp: prospect.whatsapp || '',
      etablissement: prospect.etablissement || '',
      source: prospect.source || 'prospection',
      notes: prospect.notes || '',
      isClient: prospect.isClient,
    })
    setFormErrors({})
    setFormOpen(true)
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (!formData.nom.trim()) errors.nom = 'Le nom est requis'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setSubmitting(true)
    try {
      if (editingId) {
        // Update
        const res = await fetch(`/api/prospects/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (!res.ok) {
          const data = await res.json()
          if (res.status === 409) {
            toast.error('Un prospect avec ce numéro de téléphone existe déjà')
            setSubmitting(false)
            return
          }
          throw new Error(data.error || 'Erreur')
        }
        toast.success('Prospect mis à jour avec succès')
      } else {
        // Create
        const res = await fetch('/api/prospects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (res.status === 409) {
          const data = await res.json()
          setDuplicateExistingId(data.existingId || null)
          setDuplicateOpen(true)
          setSubmitting(false)
          return
        }
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Erreur')
        }
        toast.success('Prospect créé avec succès')
      }

      setFormOpen(false)
      fetchProspects()
    } catch {
      toast.error("Erreur lors de l'enregistrement")
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Delete handler ─────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/prospects/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur')
      toast.success('Prospect supprimé avec succès')
      fetchProspects()
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeleteOpen(false)
      setDeleteId(null)
    }
  }

  // ─── Convert to client ─────────────────────────────────────────────────

  const convertToClient = async (id: string) => {
    try {
      const res = await fetch(`/api/prospects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isClient: true }),
      })
      if (!res.ok) throw new Error('Erreur')
      toast.success('Prospect converti en client avec succès')
      fetchProspects()
      if (selectedProspect?.id === id) {
        fetchDetail(id)
      }
    } catch {
      toast.error('Erreur lors de la conversion')
    }
  }

  // ─── Add interaction ────────────────────────────────────────────────────

  const handleAddInteraction = async () => {
    if (!selectedProspect || !interactionForm.notes.trim()) {
      toast.error('Veuillez saisir des notes')
      return
    }

    setInteractionSubmitting(true)
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: interactionForm.type,
          prospectId: selectedProspect.id,
          notes: interactionForm.notes,
        }),
      })
      if (!res.ok) throw new Error('Erreur')
      toast.success('Interaction ajoutée avec succès')
      setAddInteractionOpen(false)
      setInteractionForm({ type: 'appel', notes: '' })
      fetchDetail(selectedProspect.id)
    } catch {
      toast.error("Erreur lors de l'ajout de l'interaction")
    } finally {
      setInteractionSubmitting(false)
    }
  }

  // ─── View existing duplicate ────────────────────────────────────────────

  const viewExistingDuplicate = () => {
    if (duplicateExistingId) {
      setFormOpen(false)
      setDuplicateOpen(false)
      fetchDetail(duplicateExistingId)
      setDetailOpen(true)
    }
  }

  // ─── Mobile Card Row ────────────────────────────────────────────────────

  const MobileCard = ({ prospect }: { prospect: Prospect }) => (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-[#FF9900]"
      onClick={() => {
        fetchDetail(prospect.id)
        setDetailOpen(true)
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{prospect.nom}</h3>
            {prospect.specialite && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Stethoscope className="size-3" />
                {prospect.specialite}
              </p>
            )}
          </div>
          <StatusBadge isClient={prospect.isClient} />
        </div>

        <div className="mt-2 space-y-1">
          {prospect.wilaya && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="size-3" />
              {prospect.wilaya}
            </p>
          )}
          {prospect.etablissement && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="size-3" />
              <span className="truncate">{prospect.etablissement}</span>
            </p>
          )}
          {prospect.telephone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="size-3" />
              {prospect.telephone}
            </p>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <SourceBadge source={prospect.source} />
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation()
                openEditForm(prospect)
              }}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteId(prospect.id)
                setDeleteOpen(true)
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-[#003366] to-[#004080] bg-clip-text text-transparent">
                Prospects & Clients
              </span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gérez vos médecins et cliniques ({total} enregistrement{total !== 1 ? 's' : ''})
            </p>
          </div>
          <Button
            onClick={openAddForm}
            className="bg-[#003366] hover:bg-[#002244] text-white shadow-md shadow-[#003366]/20 self-start sm:self-auto"
          >
            <Plus className="size-4 mr-2" />
            Nouveau Prospect
          </Button>
        </div>

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              {/* Search bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, téléphone, établissement..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-full"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              {/* Filter row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Filter className="size-4" />
                  <span className="font-medium">Filtres :</span>
                </div>

                <div className="flex flex-wrap gap-2 flex-1">
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="w-[160px]" size="sm">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tous">Toutes les sources</SelectItem>
                      <SelectItem value="événement">Événement</SelectItem>
                      <SelectItem value="prospection">Prospection</SelectItem>
                      <SelectItem value="recommandation">Recommandation</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={wilayaFilter} onValueChange={setWilayaFilter}>
                    <SelectTrigger className="w-[160px]" size="sm">
                      <SelectValue placeholder="Wilaya" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tous">Toutes les wilayas</SelectItem>
                      {WILAYAS.map((w) => (
                        <SelectItem key={w} value={w}>
                          {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tabs for Tous / Prospects / Clients */}
                <Tabs value={tabFilter} onValueChange={setTabFilter}>
                  <TabsList className="h-8">
                    <TabsTrigger value="tous" className="text-xs px-3 h-6">
                      Tous
                    </TabsTrigger>
                    <TabsTrigger value="prospects" className="text-xs px-3 h-6">
                      Prospects
                    </TabsTrigger>
                    <TabsTrigger value="clients" className="text-xs px-3 h-6">
                      Clients
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Data Table (Desktop) ────────────────────────────────────────── */}
        {!isMobile && (
          <Card className="shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6">
                  <TableSkeleton />
                </div>
              ) : prospects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-blue-50 p-4 mb-4">
                    <UserPlus className="size-8 text-[#003366]/60" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Aucun prospect trouvé</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Commencez par ajouter votre premier prospect ou modifiez vos filtres de recherche.
                  </p>
                  <Button
                    onClick={openAddForm}
                    className="mt-4 bg-[#003366] hover:bg-[#002244] text-white"
                    size="sm"
                  >
                    <Plus className="size-4 mr-2" />
                    Nouveau Prospect
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="font-semibold">Nom</TableHead>
                      <TableHead className="font-semibold">Spécialité</TableHead>
                      <TableHead className="font-semibold">Wilaya</TableHead>
                      <TableHead className="font-semibold">Téléphone</TableHead>
                      <TableHead className="font-semibold">Établissement</TableHead>
                      <TableHead className="font-semibold">Source</TableHead>
                      <TableHead className="font-semibold">Statut</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prospects.map((prospect) => (
                      <TableRow
                        key={prospect.id}
                        className="cursor-pointer hover:bg-blue-50/40 transition-colors"
                        onClick={() => {
                          fetchDetail(prospect.id)
                          setDetailOpen(true)
                        }}
                      >
                        <TableCell className="font-medium">{prospect.nom}</TableCell>
                        <TableCell>
                          {prospect.specialite ? (
                            <span className="flex items-center gap-1.5">
                              <Stethoscope className="size-3.5 text-[#003366]" />
                              {prospect.specialite}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {prospect.wilaya ? (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="size-3.5 text-[#FF9900]" />
                              {prospect.wilaya}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {prospect.telephone ? (
                            <span className="flex items-center gap-1.5 font-mono text-xs">
                              <Phone className="size-3.5 text-slate-400" />
                              {prospect.telephone}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {prospect.etablissement ? (
                            <span className="flex items-center gap-1.5 truncate max-w-[180px]">
                              <Building2 className="size-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{prospect.etablissement}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <SourceBadge source={prospect.source} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge isClient={prospect.isClient} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-blue-50"
                              onClick={(e) => {
                                e.stopPropagation()
                                fetchDetail(prospect.id)
                                setDetailOpen(true)
                              }}
                            >
                              <Eye className="size-4 text-[#003366]" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditForm(prospect)
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteId(prospect.id)
                                setDeleteOpen(true)
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Mobile Cards ────────────────────────────────────────────────── */}
        {isMobile && (
          <div className="space-y-3">
            {loading ? (
              <CardSkeleton />
            ) : prospects.length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-blue-50 p-4 mb-4">
                    <UserPlus className="size-8 text-[#003366]/60" />
                  </div>
                  <h3 className="text-lg font-semibold">Aucun prospect trouvé</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ajoutez votre premier prospect ou modifiez vos filtres.
                  </p>
                  <Button
                    onClick={openAddForm}
                    className="mt-4 bg-[#003366] hover:bg-[#002244] text-white"
                    size="sm"
                  >
                    <Plus className="size-4 mr-2" />
                    Nouveau Prospect
                  </Button>
                </CardContent>
              </Card>
            ) : (
              prospects.map((prospect) => (
                <MobileCard key={prospect.id} prospect={prospect} />
              ))
            )}
          </div>
        )}

        {/* ── Add/Edit Dialog ─────────────────────────────────────────────── */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editingId ? (
                  <>
                    <Pencil className="size-5 text-[#003366]" />
                    Modifier le prospect
                  </>
                ) : (
                  <>
                    <UserPlus className="size-5 text-[#003366]" />
                    Nouveau prospect
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {editingId
                  ? 'Modifiez les informations du prospect ci-dessous.'
                  : 'Remplissez les informations pour créer un nouveau prospect.'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Nom */}
              <div className="grid gap-2">
                <Label htmlFor="nom" className="flex items-center gap-1">
                  Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nom"
                  placeholder="Nom du médecin ou de la clinique"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className={formErrors.nom ? 'border-destructive' : ''}
                />
                {formErrors.nom && (
                  <p className="text-xs text-destructive">{formErrors.nom}</p>
                )}
              </div>

              {/* Spécialité + Wilaya */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="specialite">Spécialité</Label>
                  <Select
                    value={formData.specialite}
                    onValueChange={(v) => setFormData({ ...formData, specialite: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECIALITES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="wilaya">Wilaya</Label>
                  <Select
                    value={formData.wilaya}
                    onValueChange={(v) => setFormData({ ...formData, wilaya: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {WILAYAS.map((w) => (
                        <SelectItem key={w} value={w}>
                          {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Téléphone + WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="telephone" className="flex items-center gap-1">
                    <Phone className="size-3.5" />
                    Téléphone
                  </Label>
                  <Input
                    id="telephone"
                    placeholder="0X XX XX XX XX"
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="whatsapp" className="flex items-center gap-1">
                    <MessageCircle className="size-3.5 text-green-500" />
                    WhatsApp
                  </Label>
                  <Input
                    id="whatsapp"
                    placeholder="Numéro WhatsApp"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  />
                </div>
              </div>

              {/* Établissement */}
              <div className="grid gap-2">
                <Label htmlFor="etablissement" className="flex items-center gap-1">
                  <Building2 className="size-3.5" />
                  Établissement
                </Label>
                <Input
                  id="etablissement"
                  placeholder="Nom de l'établissement"
                  value={formData.etablissement}
                  onChange={(e) => setFormData({ ...formData, etablissement: e.target.value })}
                />
              </div>

              {/* Source */}
              <div className="grid gap-2">
                <Label>Source</Label>
                <Select
                  value={formData.source}
                  onValueChange={(v) => setFormData({ ...formData, source: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner la source" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Notes additionnelles..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Convert to client checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isClient"
                  checked={formData.isClient}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isClient: checked === true })
                  }
                />
                <Label htmlFor="isClient" className="cursor-pointer">
                  Convertir en client
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-[#003366] hover:bg-[#002244] text-white"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enregistrement...
                  </span>
                ) : editingId ? (
                  'Mettre à jour'
                ) : (
                  'Créer le prospect'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Detail Dialog ───────────────────────────────────────────────── */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            {detailLoading ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ) : selectedProspect ? (
              <>
                <DialogHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <DialogTitle className="text-xl flex items-center gap-2">
                        {selectedProspect.nom}
                        <StatusBadge isClient={selectedProspect.isClient} />
                      </DialogTitle>
                      <DialogDescription className="mt-1">
                        Détails du {selectedProspect.isClient ? 'client' : 'prospect'}
                      </DialogDescription>
                    </div>
                    {!selectedProspect.isClient && (
                      <Button
                        size="sm"
                        className="bg-[#003366] hover:bg-[#002244] text-white"
                        onClick={() => convertToClient(selectedProspect.id)}
                      >
                        <UserPlus className="size-4 mr-1" />
                        Convertir en client
                      </Button>
                    )}
                  </div>
                </DialogHeader>

                {/* Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
                  {selectedProspect.specialite && (
                    <div className="flex items-center gap-2 text-sm">
                      <Stethoscope className="size-4 text-[#003366] shrink-0" />
                      <span className="text-muted-foreground">Spécialité:</span>
                      <span className="font-medium">{selectedProspect.specialite}</span>
                    </div>
                  )}
                  {selectedProspect.wilaya && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="size-4 text-[#FF9900] shrink-0" />
                      <span className="text-muted-foreground">Wilaya:</span>
                      <span className="font-medium">{selectedProspect.wilaya}</span>
                    </div>
                  )}
                  {selectedProspect.telephone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="size-4 text-blue-500 shrink-0" />
                      <span className="text-muted-foreground">Tél:</span>
                      <span className="font-mono">{selectedProspect.telephone}</span>
                    </div>
                  )}
                  {selectedProspect.whatsapp && (
                    <div className="flex items-center gap-2 text-sm">
                      <MessageCircle className="size-4 text-green-500 shrink-0" />
                      <span className="text-muted-foreground">WhatsApp:</span>
                      <span className="font-mono">{selectedProspect.whatsapp}</span>
                    </div>
                  )}
                  {selectedProspect.etablissement && (
                    <div className="flex items-center gap-2 text-sm sm:col-span-2">
                      <Building2 className="size-4 text-slate-500 shrink-0" />
                      <span className="text-muted-foreground">Établissement:</span>
                      <span className="font-medium">{selectedProspect.etablissement}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Source:</span>
                    <SourceBadge source={selectedProspect.source} />
                  </div>
                </div>

                {selectedProspect.notes && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold mb-1">Notes</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedProspect.notes}
                      </p>
                    </div>
                  </>
                )}

                {/* Interactions */}
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Phone className="size-4 text-[#003366]" />
                      Historique des interactions
                      {selectedProspect.interactions?.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {selectedProspect.interactions.length}
                        </Badge>
                      )}
                    </h4>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-[#003366]/20 text-[#003366] hover:bg-[#003366]/5"
                      onClick={() => setAddInteractionOpen(true)}
                    >
                      <Plus className="size-3 mr-1" />
                      Ajouter
                    </Button>
                  </div>

                  {selectedProspect.interactions?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucune interaction enregistrée
                    </p>
                  ) : (
                    <ScrollArea className="max-h-48">
                      <div className="space-y-2">
                        {selectedProspect.interactions?.map((interaction) => (
                          <div
                            key={interaction.id}
                            className="flex items-start gap-3 p-2.5 rounded-md bg-slate-50 hover:bg-slate-100 transition-colors"
                          >
                            <InteractionIcon type={interaction.type} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium capitalize">
                                  {INTERACTION_TYPES.find((t) => t.value === interaction.type)?.label || interaction.type}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(interaction.date).toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                                {interaction.employe && (
                                  <span className="text-xs text-muted-foreground">
                                    par {interaction.employe.nom}
                                  </span>
                                )}
                              </div>
                              {interaction.notes && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {interaction.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {/* Opportunities */}
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <ChevronRight className="size-4 text-[#003366]" />
                    Opportunités liées
                    {selectedProspect.opportunities?.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedProspect.opportunities.length}
                      </Badge>
                    )}
                  </h4>

                  {selectedProspect.opportunities?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucune opportunité liée
                    </p>
                  ) : (
                    <ScrollArea className="max-h-48">
                      <div className="space-y-2">
                        {selectedProspect.opportunities?.map((opp) => (
                          <div
                            key={opp.id}
                            className="flex items-center justify-between p-2.5 rounded-md bg-slate-50 hover:bg-slate-100 transition-colors"
                          >
                            <div>
                              <p className="text-sm font-medium">{opp.nomProjet}</p>
                              <p className="text-xs text-muted-foreground">
                                {opp.commercial ? `Commercial: ${opp.commercial.nom}` : 'Non assigné'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {opp.montantEstime && (
                                <span className="text-xs font-medium text-[#003366]">
                                  {opp.montantEstime.toLocaleString('fr-FR')} DA
                                </span>
                              )}
                              <Badge
                                variant="outline"
                                className={
                                  opp.statut === 'Gagné'
                                    ? 'bg-[#003366]/5 text-[#003366] border-[#003366]/20'
                                    : opp.statut === 'Perdu'
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                                }
                              >
                                {opp.statut}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {/* Footer actions */}
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDetailOpen(false)
                      if (selectedProspect) openEditForm(selectedProspect)
                    }}
                  >
                    <Pencil className="size-4 mr-1" />
                    Modifier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50 hover:bg-red-50"
                    onClick={() => {
                      setDetailOpen(false)
                      setDeleteId(selectedProspect.id)
                      setDeleteOpen(true)
                    }}
                  >
                    <Trash2 className="size-4 mr-1" />
                    Supprimer
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Add Interaction Dialog ──────────────────────────────────────── */}
        <Dialog open={addInteractionOpen} onOpenChange={setAddInteractionOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="size-5 text-[#003366]" />
                Ajouter une interaction
              </DialogTitle>
              <DialogDescription>
                Enregistrez une nouvelle interaction avec{' '}
                {selectedProspect?.nom}.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Type d&apos;interaction</Label>
                <Select
                  value={interactionForm.type}
                  onValueChange={(v) => setInteractionForm({ ...interactionForm, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERACTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">
                          <InteractionIcon type={t.value} />
                          {t.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="interaction-notes">Notes</Label>
                <Textarea
                  id="interaction-notes"
                  placeholder="Détails de l'interaction..."
                  value={interactionForm.notes}
                  onChange={(e) =>
                    setInteractionForm({ ...interactionForm, notes: e.target.value })
                  }
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAddInteractionOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleAddInteraction}
                disabled={interactionSubmitting}
                className="bg-[#003366] hover:bg-[#002244] text-white"
              >
                {interactionSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enregistrement...
                  </span>
                ) : (
                  'Enregistrer'
                )}
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
                Confirmer la suppression
              </AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer ce prospect ? Cette action est
                irréversible et toutes les données associées seront perdues.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Duplicate Warning Dialog ────────────────────────────────────── */}
        <AlertDialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-500" />
                Doublon détecté
              </AlertDialogTitle>
              <AlertDialogDescription>
                Un prospect avec ce numéro de téléphone existe déjà. Souhaitez-vous
                consulter l&apos;enregistrement existant ou annuler ?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setDuplicateOpen(false)
                  setDuplicateExistingId(null)
                }}
              >
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={viewExistingDuplicate}
                className="bg-[#003366] hover:bg-[#002244] text-white"
              >
                Voir l&apos;existant
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
