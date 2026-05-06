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
  UserCheck,
  AlertTriangle,
  Filter,
  X,
  ChevronRight,
  PhoneCall,
  CalendarDays,
  Download,
  Briefcase,
  Wrench,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Users,
  CircleDot,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useIsMobile } from '@/hooks/use-mobile'
import { AddInteractionDialog, INTERACTION_TYPES } from '@/components/crm/add-interaction-dialog'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Client {
  id: string
  nom: string
  specialite: string | null
  wilaya: string | null
  telephone: string | null
  whatsapp: string | null
  etablissement: string | null
  source: string | null
  isClient: true
  notes: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    interactions: number
    opportunities: number
    afterSales: number
  }
}

interface Interaction {
  id: string
  type: string
  notes: string | null
  date: string
  employe?: { id: string; nom: string } | null
  task?: { id: string; titre: string; statut: string } | null
  afterSale?: { id: string; type: string; statut: string } | null
}

interface Operation {
  id: string
  produit: string
  marque: string
  prixEstime: number | null
  statut: string
}

interface Opportunity {
  id: string
  nomProjet: string
  statut: string
  montantEstime: number | null
  commercial?: { id: string; nom: string } | null
  operations?: Operation[]
}

interface AfterSale {
  id: string
  type: string
  statut: string
  notes: string | null
}

interface ClientDetail extends Client {
  interactions: Interaction[]
  opportunities: Opportunity[]
  afterSales: AfterSale[]
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

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function getDaysSinceLastInteraction(interactions: Interaction[]): number | null {
  if (!interactions || interactions.length === 0) return null
  const sorted = [...interactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  const lastDate = new Date(sorted[0].date)
  const now = new Date()
  return Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
}

function getClientHealthColor(daysSinceLastInteraction: number | null): string {
  if (daysSinceLastInteraction === null) return 'bg-slate-300'
  if (daysSinceLastInteraction <= 30) return 'bg-emerald-400'
  if (daysSinceLastInteraction <= 60) return 'bg-amber-400'
  return 'bg-red-400'
}

function getClientHealthLabel(daysSinceLastInteraction: number | null): string {
  if (daysSinceLastInteraction === null) return 'Aucune interaction'
  if (daysSinceLastInteraction <= 30) return 'Récent'
  if (daysSinceLastInteraction <= 60) return 'À relancer'
  return 'Inactif'
}

function cleanPhoneNumber(phone: string): string {
  return phone.replace(/[\s\-\.]/g, '').replace(/^0/, '213')
}

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

// ─── Helper: Opportunity status badge ───────────────────────────────────────

function OpportunityStatusBadge({ statut }: { statut: string }) {
  const config: Record<string, string> = {
    'Nouveau': 'bg-slate-100 text-slate-700 border-slate-200',
    'Contacté': 'bg-blue-100 text-blue-700 border-blue-200',
    'Intéressé': 'bg-amber-100 text-amber-700 border-amber-200',
    'Devis': 'bg-purple-100 text-purple-700 border-purple-200',
    'Négociation': 'bg-orange-100 text-orange-700 border-orange-200',
    'Gagné': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Perdu': 'bg-red-100 text-red-700 border-red-200',
  }

  const icons: Record<string, React.ReactNode> = {
    'Nouveau': <Clock className="size-3" />,
    'Contacté': <Phone className="size-3" />,
    'Intéressé': <TrendingUp className="size-3" />,
    'Devis': <FileText className="size-3" />,
    'Négociation': <Briefcase className="size-3" />,
    'Gagné': <CheckCircle2 className="size-3" />,
    'Perdu': <XCircle className="size-3" />,
  }

  return (
    <Badge variant="outline" className={`gap-1 ${config[statut] || config['Nouveau']}`}>
      {icons[statut]}
      {statut}
    </Badge>
  )
}

// ─── Helper: SAV status badge ───────────────────────────────────────────────

function SAVStatusBadge({ statut }: { statut: string }) {
  const config: Record<string, string> = {
    'en_cours': 'bg-amber-100 text-amber-700 border-amber-200',
    'résolu': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'en_attente': 'bg-slate-100 text-slate-700 border-slate-200',
    'ouvert': 'bg-red-100 text-red-700 border-red-200',
  }

  const labels: Record<string, string> = {
    'en_cours': 'En cours',
    'résolu': 'Résolu',
    'en_attente': 'En attente',
    'ouvert': 'Ouvert',
  }

  return (
    <Badge variant="outline" className={config[statut] || config['en_attente']}>
      {labels[statut] || statut}
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

// ─── Helper: Health indicator dot ───────────────────────────────────────────

function HealthIndicator({ daysSinceLastInteraction }: { daysSinceLastInteraction: number | null }) {
  const color = getClientHealthColor(daysSinceLastInteraction)
  const label = getClientHealthLabel(daysSinceLastInteraction)

  return (
    <div className="flex items-center gap-1.5" title={label}>
      <div className={`size-2.5 rounded-full ${color} ${daysSinceLastInteraction !== null && daysSinceLastInteraction > 30 ? 'animate-pulse' : ''}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
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
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-24" />
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

export default function ClientsModule() {
  const isMobile = useIsMobile()

  // Data state
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  // Filter state
  const [search, setSearch] = useState('')
  const [wilayaFilter, setWilayaFilter] = useState<string>('tous')
  const [specialiteFilter, setSpecialiteFilter] = useState<string>('tous')

  // Dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
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
    isClient: true as true,
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Detail state
  const [selectedClient, setSelectedClient] = useState<ClientDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // ─── Computed stats ──────────────────────────────────────────────────────

  const stats = {
    total: total,
    withActiveOpps: clients.filter(
      (c) => (c._count?.opportunities || 0) > 0
    ).length,
    withActiveSAV: clients.filter(
      (c) => (c._count?.afterSales || 0) > 0
    ).length,
    caTotal: 0, // Will be computed from detail data when available
  }

  // We need to fetch opportunity details for CA total
  // For now, we compute from what we have client-side
  // The CA total needs won opportunity amounts which we don't have in list view
  // So we'll compute it client-side from the loaded data
  const [caTotal, setCaTotal] = useState(0)

  // ─── Fetch clients ──────────────────────────────────────────────────────

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('isClient', 'true')
      if (search) params.set('search', search)
      if (wilayaFilter && wilayaFilter !== 'tous') params.set('wilaya', wilayaFilter)
      if (specialiteFilter && specialiteFilter !== 'tous') params.set('specialite', specialiteFilter)

      const res = await fetch(`/api/prospects?${params.toString()}`)
      if (!res.ok) throw new Error('Erreur lors du chargement')
      const json = await res.json()
      setClients(json.data || [])
      setTotal(json.pagination?.total || 0)
    } catch {
      toast.error('Erreur lors du chargement des clients')
    } finally {
      setLoading(false)
    }
  }, [search, wilayaFilter, specialiteFilter])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  // ─── Fetch client detail ────────────────────────────────────────────────

  const fetchDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/prospects/${id}`)
      if (!res.ok) throw new Error('Erreur')
      const data = await res.json()
      setSelectedClient(data)

      // Compute CA total from won opportunities
      const wonAmount = (data.opportunities || [])
        .filter((o: Opportunity) => o.statut === 'Gagné')
        .reduce((sum: number, o: Opportunity) => sum + (o.montantEstime || 0), 0)
      setCaTotal(wonAmount)
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
      isClient: true,
    })
    setFormErrors({})
    setFormOpen(true)
  }

  const openEditForm = (client: Client) => {
    setEditingId(client.id)
    setFormData({
      nom: client.nom,
      specialite: client.specialite || '',
      wilaya: client.wilaya || '',
      telephone: client.telephone || '',
      whatsapp: client.whatsapp || '',
      etablissement: client.etablissement || '',
      source: client.source || 'prospection',
      notes: client.notes || '',
      isClient: true,
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
        const res = await fetch(`/api/prospects/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (!res.ok) {
          const data = await res.json()
          if (res.status === 409) {
            toast.error('Un client avec ce numéro de téléphone existe déjà')
            setSubmitting(false)
            return
          }
          throw new Error(data.error || 'Erreur')
        }
        toast.success('Client mis à jour avec succès')
      } else {
        const res = await fetch('/api/prospects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (res.status === 409) {
          toast.error('Un client avec ce numéro de téléphone existe déjà')
          setSubmitting(false)
          return
        }
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Erreur')
        }
        toast.success('Client créé avec succès')
      }

      setFormOpen(false)
      fetchClients()
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
      toast.success('Client supprimé avec succès')
      fetchClients()
      if (selectedClient?.id === deleteId) {
        setDetailOpen(false)
        setSelectedClient(null)
      }
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeleteOpen(false)
      setDeleteId(null)
    }
  }

  // ─── Mobile Card Row ────────────────────────────────────────────────────

  const MobileCard = ({ client }: { client: Client }) => {
    const daysSince = null // We don't have interaction data in list view for health
    const hasPendingSAV = (client._count?.afterSales || 0) > 0

    return (
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-[#134885]"
        onClick={() => {
          fetchDetail(client.id)
          setDetailOpen(true)
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{client.nom}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {client.specialite && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Stethoscope className="size-3" />
                    {client.specialite}
                  </p>
                )}
                {client.wilaya && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="size-3" />
                    {client.wilaya}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {client.telephone && (
                <a
                  href={`tel:${client.telephone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center size-7 rounded-md hover:bg-blue-50 text-blue-500 transition-colors"
                >
                  <Phone className="size-3.5" />
                </a>
              )}
              {client.whatsapp && (
                <a
                  href={`https://wa.me/${cleanPhoneNumber(client.whatsapp)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center size-7 rounded-md hover:bg-green-50 text-green-500 transition-colors"
                >
                  <MessageCircle className="size-3.5" />
                </a>
              )}
            </div>
          </div>

          {client.etablissement && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
              <Building2 className="size-3" />
              <span className="truncate">{client.etablissement}</span>
            </p>
          )}

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {(client._count?.opportunities || 0) > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">
                  <Briefcase className="size-2.5 mr-0.5" />
                  {client._count?.opportunities}
                </Badge>
              )}
              {(client._count?.afterSales || 0) > 0 && (
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${hasPendingSAV ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  <Wrench className="size-2.5 mr-0.5" />
                  {client._count?.afterSales} SAV
                </Badge>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  openEditForm(client)
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
                  setDeleteId(client.id)
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
  }

  // ─── Detail Dialog Tabs ─────────────────────────────────────────────────

  const DetailProfileTab = () => {
    if (!selectedClient) return null
    const daysSince = getDaysSinceLastInteraction(selectedClient.interactions)

    return (
      <div className="space-y-4">
        {/* Health indicator */}
        <div className="flex items-center justify-between">
          <HealthIndicator daysSinceLastInteraction={daysSince} />
          <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 border">
            Client
          </Badge>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {selectedClient.specialite && (
            <div className="flex items-center gap-2 text-sm">
              <Stethoscope className="size-4 text-[#134885] shrink-0" />
              <span className="text-muted-foreground">Spécialité:</span>
              <span className="font-medium">{selectedClient.specialite}</span>
            </div>
          )}
          {selectedClient.wilaya && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="size-4 text-[#F6852A] shrink-0" />
              <span className="text-muted-foreground">Wilaya:</span>
              <span className="font-medium">{selectedClient.wilaya}</span>
            </div>
          )}
          {selectedClient.telephone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="size-4 text-blue-500 shrink-0" />
              <span className="text-muted-foreground">Tél:</span>
              <span className="font-mono">{selectedClient.telephone}</span>
              <a
                href={`tel:${selectedClient.telephone}`}
                className="inline-flex items-center justify-center size-6 rounded-md hover:bg-blue-50 text-blue-500 transition-colors"
                title="Appeler"
              >
                <PhoneCall className="size-3.5" />
              </a>
            </div>
          )}
          {selectedClient.whatsapp && (
            <div className="flex items-center gap-2 text-sm">
              <MessageCircle className="size-4 text-green-500 shrink-0" />
              <span className="text-muted-foreground">WhatsApp:</span>
              <span className="font-mono">{selectedClient.whatsapp}</span>
              <a
                href={`https://wa.me/${cleanPhoneNumber(selectedClient.whatsapp)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center size-6 rounded-md hover:bg-green-50 text-green-500 transition-colors"
                title="WhatsApp"
              >
                <MessageCircle className="size-3.5" />
              </a>
            </div>
          )}
          {selectedClient.etablissement && (
            <div className="flex items-center gap-2 text-sm sm:col-span-2">
              <Building2 className="size-4 text-slate-500 shrink-0" />
              <span className="text-muted-foreground">Établissement:</span>
              <span className="font-medium">{selectedClient.etablissement}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Source:</span>
            <SourceBadge source={selectedClient.source} />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="size-4 text-slate-400 shrink-0" />
            <span className="text-muted-foreground">Client depuis:</span>
            <span className="font-medium">{formatDate(selectedClient.createdAt)}</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          {selectedClient.telephone && (
            <a href={`tel:${selectedClient.telephone}`}>
              <Button variant="outline" size="sm" className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50">
                <PhoneCall className="size-3.5 mr-1.5" />
                Appeler
              </Button>
            </a>
          )}
          {selectedClient.whatsapp && (
            <a href={`https://wa.me/${cleanPhoneNumber(selectedClient.whatsapp)}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="h-8 text-xs border-green-200 text-green-600 hover:bg-green-50">
                <MessageCircle className="size-3.5 mr-1.5" />
                WhatsApp
              </Button>
            </a>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-[#134885]/20 text-[#134885] hover:bg-[#134885]/5"
            onClick={() => setAddInteractionOpen(true)}
          >
            <Plus className="size-3.5 mr-1.5" />
            Ajouter interaction
          </Button>
        </div>

        {selectedClient.notes && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold mb-1">Notes</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {selectedClient.notes}
              </p>
            </div>
          </>
        )}

        {/* Summary counts */}
        <Separator />
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-blue-50/60">
            <p className="text-lg font-bold text-[#134885]">{selectedClient.opportunities?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Opportunités</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-50/60">
            <p className="text-lg font-bold text-amber-600">{selectedClient.interactions?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Interactions</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-50/60">
            <p className="text-lg font-bold text-red-600">{selectedClient.afterSales?.length || 0}</p>
            <p className="text-xs text-muted-foreground">SAV</p>
          </div>
        </div>
      </div>
    )
  }

  const DetailOpportunitiesTab = () => {
    if (!selectedClient) return null

    const opportunities = selectedClient.opportunities || []
    const totalMontant = opportunities.reduce((s, o) => s + (o.montantEstime || 0), 0)
    const wonMontant = opportunities.filter((o) => o.statut === 'Gagné').reduce((s, o) => s + (o.montantEstime || 0), 0)

    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-slate-50">
            <p className="text-xs text-muted-foreground">Montant total</p>
            <p className="text-sm font-bold">{formatDZD(totalMontant)}</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50">
            <p className="text-xs text-muted-foreground">CA gagné</p>
            <p className="text-sm font-bold text-emerald-700">{formatDZD(wonMontant)}</p>
          </div>
        </div>

        {opportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Briefcase className="size-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Aucune opportunité</p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {opportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{opp.nomProjet}</p>
                      {opp.commercial && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Commercial: {opp.commercial.nom}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {opp.montantEstime && (
                        <span className="text-xs font-semibold text-[#134885]">
                          {formatDZD(opp.montantEstime)}
                        </span>
                      )}
                      <OpportunityStatusBadge statut={opp.statut} />
                    </div>
                  </div>

                  {/* Operations */}
                  {opp.operations && opp.operations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Opérations
                      </p>
                      <div className="space-y-1">
                        {opp.operations.map((op) => (
                          <div
                            key={op.id}
                            className="flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1"
                          >
                            <div className="flex items-center gap-2">
                              <CircleDot className="size-2.5 text-[#F6852A]" />
                              <span className="font-medium">{op.produit}</span>
                              <span className="text-muted-foreground">({op.marque})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {op.prixEstime && (
                                <span className="text-muted-foreground">{formatDZD(op.prixEstime)}</span>
                              )}
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {op.statut}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    )
  }

  const DetailInteractionsTab = () => {
    if (!selectedClient) return null

    const interactions = selectedClient.interactions || []

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Phone className="size-4 text-[#134885]" />
            Historique des interactions
            {interactions.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {interactions.length}
              </Badge>
            )}
          </h4>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-[#134885]/20 text-[#134885] hover:bg-[#134885]/5"
            onClick={() => setAddInteractionOpen(true)}
          >
            <Plus className="size-3 mr-1" />
            Ajouter
          </Button>
        </div>

        {interactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Phone className="size-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Aucune interaction enregistrée</p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="relative pl-6 space-y-4">
              {/* Timeline line */}
              <div className="absolute left-2.5 top-1 bottom-1 w-px bg-slate-200" />

              {interactions.map((interaction) => (
                <div key={interaction.id} className="relative">
                  {/* Timeline dot */}
                  <div className="absolute -left-3.5 top-1 rounded-full bg-white p-0.5">
                    <InteractionIcon type={interaction.type} />
                  </div>

                  <div className="rounded-lg border bg-white p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium capitalize">
                        {INTERACTION_TYPES.find((t) => t.value === interaction.type)?.label || interaction.type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(interaction.date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {interaction.employe && (
                        <span className="text-xs text-muted-foreground">
                          par {interaction.employe.nom}
                        </span>
                      )}
                    </div>
                    {interaction.notes && (
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                        {interaction.notes}
                      </p>
                    )}
                    {(interaction.task || interaction.afterSale) && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {interaction.task && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-100">
                            📋 {interaction.task.titre}
                          </Badge>
                        )}
                        {interaction.afterSale && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                            🔧 SAV: {interaction.afterSale.type}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    )
  }

  const DetailSAVTab = () => {
    if (!selectedClient) return null

    const afterSales = selectedClient.afterSales || []
    const pendingCount = afterSales.filter(
      (s) => s.statut === 'en_cours' || s.statut === 'ouvert'
    ).length

    return (
      <div className="space-y-4">
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
            <AlertTriangle className="size-4 text-red-500 shrink-0" />
            <span className="text-sm text-red-700">
              {pendingCount} SAV en cours nécessitent votre attention
            </span>
          </div>
        )}

        {afterSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Wrench className="size-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Aucun service après-vente</p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {afterSales.map((sav) => (
                <div
                  key={sav.id}
                  className="p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Wrench className="size-4 text-amber-500 shrink-0" />
                      <span className="text-sm font-medium">{sav.type}</span>
                    </div>
                    <SAVStatusBadge statut={sav.statut} />
                  </div>
                  {sav.notes && (
                    <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap pl-6">
                      {sav.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    )
  }

  const DetailDocumentsTab = () => {
    if (!selectedClient) return null

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="size-4 text-[#134885]" />
            Documents
          </h4>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-[#134885]/20 text-[#134885] hover:bg-[#134885]/5"
            disabled
          >
            <Plus className="size-3 mr-1" />
            Ajouter
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-slate-100 p-4 mb-3">
            <FileText className="size-8 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Aucun document</p>
          <p className="text-xs text-muted-foreground mt-1">
            Les documents envoyés à ce client apparaîtront ici
          </p>
        </div>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="MI HEALTH CARE" className="h-9 w-auto shrink-0 object-contain" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#134885]">
                Clients
              </h1>
              <p className="text-xs text-muted-foreground">
                Gérez vos clients existants ({total} client{total !== 1 ? 's' : ''})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={() => toast.info('Fonctionnalité d\'export à venir')}
            >
              <Download className="size-4 mr-1.5" />
              Exporter
            </Button>
            <Button
              onClick={openAddForm}
              className="bg-[#134885] hover:bg-[#0D3A6E] text-white shadow-md shadow-[#134885]/20"
            >
              <Plus className="size-4 mr-2" />
              Nouveau Client
            </Button>
          </div>
        </div>

        {/* ── Stats Cards ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="shadow-sm border-0 bg-white/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="size-3.5 text-[#134885]" />
                Total clients
              </div>
              <p className="mt-1 text-base font-bold text-slate-900 sm:text-lg">
                {stats.total}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-0 bg-white/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Briefcase className="size-3.5 text-[#F6852A]" />
                Avec opportunités
              </div>
              <p className="mt-1 text-base font-bold text-[#134885] sm:text-lg">
                {stats.withActiveOpps}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-0 bg-white/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Wrench className="size-3.5 text-red-500" />
                SAV en cours
              </div>
              <p className="mt-1 text-base font-bold text-red-600 sm:text-lg">
                {stats.withActiveSAV}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-0 bg-white/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="size-3.5 text-emerald-500" />
                CA total (gagné)
              </div>
              <p className="mt-1 text-base font-bold text-emerald-700 sm:text-lg">
                {formatDZD(caTotal)}
              </p>
            </CardContent>
          </Card>
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

                  <Select value={specialiteFilter} onValueChange={setSpecialiteFilter}>
                    <SelectTrigger className="w-[180px]" size="sm">
                      <SelectValue placeholder="Spécialité" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tous">Toutes les spécialités</SelectItem>
                      {SPECIALITES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
              ) : clients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-blue-50 p-4 mb-4">
                    <UserCheck className="size-8 text-[#134885]/60" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Aucun client trouvé</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Commencez par ajouter votre premier client ou modifiez vos filtres de recherche.
                  </p>
                  <Button
                    onClick={openAddForm}
                    className="mt-4 bg-[#134885] hover:bg-[#0D3A6E] text-white"
                    size="sm"
                  >
                    <Plus className="size-4 mr-2" />
                    Nouveau Client
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="font-semibold">Nom</TableHead>
                      <TableHead className="font-semibold">Spécialité / Wilaya</TableHead>
                      <TableHead className="font-semibold">Établissement</TableHead>
                      <TableHead className="font-semibold">Contact</TableHead>
                      <TableHead className="font-semibold text-center">Opp.</TableHead>
                      <TableHead className="font-semibold text-center">SAV</TableHead>
                      <TableHead className="font-semibold">Source</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow
                        key={client.id}
                        className="cursor-pointer hover:bg-blue-50/40 transition-colors"
                        onClick={() => {
                          fetchDetail(client.id)
                          setDetailOpen(true)
                        }}
                      >
                        <TableCell className="font-medium">{client.nom}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {client.specialite ? (
                              <span className="flex items-center gap-1.5 text-sm">
                                <Stethoscope className="size-3.5 text-[#134885]" />
                                {client.specialite}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                            {client.wilaya ? (
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin className="size-3 text-[#F6852A]" />
                                {client.wilaya}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          {client.etablissement ? (
                            <span className="flex items-center gap-1.5 truncate max-w-[180px]">
                              <Building2 className="size-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{client.etablissement}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {client.telephone && (
                              <a
                                href={`tel:${client.telephone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-blue-600 transition-colors"
                                title="Appeler"
                              >
                                <Phone className="size-3.5 text-slate-400" />
                                {client.telephone}
                              </a>
                            )}
                            {client.whatsapp && (
                              <a
                                href={`https://wa.me/${cleanPhoneNumber(client.whatsapp)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center justify-center size-6 rounded hover:bg-green-50 text-green-500 transition-colors"
                                title="WhatsApp"
                              >
                                <MessageCircle className="size-3.5" />
                              </a>
                            )}
                            {!client.telephone && !client.whatsapp && (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {(client._count?.opportunities || 0) > 0 ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">
                              {client._count?.opportunities}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {(client._count?.afterSales || 0) > 0 ? (
                            <Badge
                              variant="outline"
                              className={
                                client._count?.afterSales > 0
                                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                              }
                            >
                              {client._count?.afterSales}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <SourceBadge source={client.source} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {client.telephone && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-blue-50 text-blue-500"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(`tel:${client.telephone}`, '_self')
                                }}
                                title="Appeler"
                              >
                                <PhoneCall className="size-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-blue-50"
                              onClick={(e) => {
                                e.stopPropagation()
                                fetchDetail(client.id)
                                setDetailOpen(true)
                              }}
                            >
                              <Eye className="size-4 text-[#134885]" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditForm(client)
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
                                setDeleteId(client.id)
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
            ) : clients.length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-blue-50 p-4 mb-4">
                    <UserCheck className="size-8 text-[#134885]/60" />
                  </div>
                  <h3 className="text-lg font-semibold">Aucun client trouvé</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ajoutez votre premier client ou modifiez vos filtres.
                  </p>
                  <Button
                    onClick={openAddForm}
                    className="mt-4 bg-[#134885] hover:bg-[#0D3A6E] text-white"
                    size="sm"
                  >
                    <Plus className="size-4 mr-2" />
                    Nouveau Client
                  </Button>
                </CardContent>
              </Card>
            ) : (
              clients.map((client) => (
                <MobileCard key={client.id} client={client} />
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
                    <Pencil className="size-5 text-[#134885]" />
                    Modifier le client
                  </>
                ) : (
                  <>
                    <UserCheck className="size-5 text-[#134885]" />
                    Nouveau client
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {editingId
                  ? 'Modifiez les informations du client ci-dessous.'
                  : 'Remplissez les informations pour créer un nouveau client.'}
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
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enregistrement...
                  </span>
                ) : editingId ? (
                  'Mettre à jour'
                ) : (
                  'Créer le client'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Detail Dialog ───────────────────────────────────────────────── */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-[750px] max-h-[90vh]">
            {detailLoading ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ) : selectedClient ? (
              <>
                <DialogHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <DialogTitle className="text-xl flex items-center gap-2">
                        {selectedClient.nom}
                        <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 border">
                          Client
                        </Badge>
                      </DialogTitle>
                      <DialogDescription className="mt-1">
                        Fiche client détaillée
                      </DialogDescription>
                    </div>
                    <div className="flex gap-2">
                      {selectedClient.telephone && (
                        <a href={`tel:${selectedClient.telephone}`}>
                          <Button variant="outline" size="sm" className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50">
                            <PhoneCall className="size-3.5 mr-1" />
                            Appeler
                          </Button>
                        </a>
                      )}
                      {selectedClient.whatsapp && (
                        <a href={`https://wa.me/${cleanPhoneNumber(selectedClient.whatsapp)}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="h-8 text-xs border-green-200 text-green-600 hover:bg-green-50">
                            <MessageCircle className="size-3.5 mr-1" />
                            WhatsApp
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </DialogHeader>

                <Tabs defaultValue="profile" className="mt-2">
                  <TabsList className="w-full grid grid-cols-5">
                    <TabsTrigger value="profile" className="text-xs">
                      <UserCheck className="size-3.5 mr-1 hidden sm:inline" />
                      Profil
                    </TabsTrigger>
                    <TabsTrigger value="opportunities" className="text-xs">
                      <Briefcase className="size-3.5 mr-1 hidden sm:inline" />
                      Opp.
                    </TabsTrigger>
                    <TabsTrigger value="interactions" className="text-xs">
                      <Phone className="size-3.5 mr-1 hidden sm:inline" />
                      Interactions
                    </TabsTrigger>
                    <TabsTrigger value="sav" className="text-xs">
                      <Wrench className="size-3.5 mr-1 hidden sm:inline" />
                      SAV
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="text-xs">
                      <FileText className="size-3.5 mr-1 hidden sm:inline" />
                      Docs
                    </TabsTrigger>
                  </TabsList>

                  <ScrollArea className="max-h-[55vh] mt-4 pr-1">
                    <TabsContent value="profile" className="mt-0">
                      <DetailProfileTab />
                    </TabsContent>
                    <TabsContent value="opportunities" className="mt-0">
                      <DetailOpportunitiesTab />
                    </TabsContent>
                    <TabsContent value="interactions" className="mt-0">
                      <DetailInteractionsTab />
                    </TabsContent>
                    <TabsContent value="sav" className="mt-0">
                      <DetailSAVTab />
                    </TabsContent>
                    <TabsContent value="documents" className="mt-0">
                      <DetailDocumentsTab />
                    </TabsContent>
                  </ScrollArea>
                </Tabs>

                <Separator />

                {/* Footer actions */}
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDetailOpen(false)
                      if (selectedClient) openEditForm(selectedClient)
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
                      setDeleteId(selectedClient.id)
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

        {/* ── Add Interaction Dialog (shared) ─────────────────────────────── */}
        <AddInteractionDialog
          open={addInteractionOpen}
          onOpenChange={setAddInteractionOpen}
          prospectId={selectedClient?.id}
          contextLabel={selectedClient?.nom || ''}
          onSuccess={() => {
            if (selectedClient) fetchDetail(selectedClient.id)
          }}
        />

        {/* ── Delete Confirmation Dialog ──────────────────────────────────── */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-destructive" />
                Confirmer la suppression
              </AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer ce client ? Cette action est
                irréversible et toutes les données associées (interactions, opportunités, SAV) seront perdues.
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
      </div>
    </div>
  )
}
