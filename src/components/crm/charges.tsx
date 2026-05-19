'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus,
  Search,
  Receipt,
  TrendingUp,
  Users,
  Briefcase,
  Hotel,
  UtensilsCrossed,
  Car,
  Package,
  MoreHorizontal,
  Edit3,
  Trash2,
  Loader2,
  DollarSign,
  Calendar,
  ArrowUpDown,
  Filter,
  Upload,
  X,
  Eye,
  ImageIcon,
  FileText,
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
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'

// ─── Types ───────────────────────────────────────────────────────

interface Employee {
  id: string
  nom: string
  role: string
  actif: boolean
}

interface Charge {
  id: string
  type: string
  montant: number
  description?: string | null
  date: string
  employeId: string
  opportunityId?: string | null
  createdBy?: string | null
  justificatifUrl?: string | null
  createdAt: string
  updatedAt: string
  employe: { id: string; nom: string; role: string }
  opportunity?: { id: string; nomProjet: string; montantEstime: number | null } | null
  creator?: { id: string; nom: string } | null
}

interface ChargeStats {
  totalCharges: number
  byType: { type: string; total: number; count: number }[]
  byEmployee: {
    employeId: string
    nom: string
    total: number
    count: number
    byType: { type: string; total: number }[]
  }[]
  byOpportunity: {
    opportunityId: string
    nomProjet: string
    montantEstime: number | null
    total: number
    count: number
    byType: { type: string; total: number }[]
  }[]
}

// ─── Constants ───────────────────────────────────────────────────

const CHARGE_TYPES = [
  { value: 'hotel', label: 'Hôtel', icon: Hotel, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', dotColor: 'bg-blue-500' },
  { value: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300', dotColor: 'bg-orange-500' },
  { value: 'transport', label: 'Transport', icon: Car, color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300', dotColor: 'bg-green-500' },
  { value: 'divers', label: 'Divers', icon: Package, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300', dotColor: 'bg-purple-500' },
]

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

function getTypeConfig(type: string) {
  return CHARGE_TYPES.find(t => t.value === type) || CHARGE_TYPES[3]
}

function getTypeLabel(type: string): string {
  return getTypeConfig(type).label
}

function isImageFile(url: string | null | undefined): boolean {
  if (!url) return false
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(url)
}

// ─── Type Badge Component ────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const config = getTypeConfig(type)
  const Icon = config.icon
  return (
    <Badge variant="outline" className={`gap-1 font-medium ${config.color}`}>
      <Icon className="size-3" />
      {config.label}
    </Badge>
  )
}

// ─── Justificatif Preview Component ──────────────────────────────

function JustificatifThumbnail({ url }: { url: string }) {
  const [showPreview, setShowPreview] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowPreview(true)}
        className="group relative flex size-9 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 transition-all hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-600 dark:hover:bg-blue-950/30"
      >
        {isImageFile(url) ? (
          <img src={url} alt="Justificatif" className="size-full object-cover" />
        ) : (
          <FileText className="size-4 text-slate-400" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
          <Eye className="size-4 text-white" />
        </div>
      </button>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Justificatif</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center overflow-auto rounded-lg bg-slate-100 p-4 dark:bg-slate-800">
            {isImageFile(url) ? (
              <img src={url} alt="Justificatif" className="max-h-[70vh] rounded-md object-contain" />
            ) : (
              <iframe src={url} className="h-[70vh] w-full rounded-md" title="Justificatif PDF" />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Fermer
            </Button>
            <Button asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                Ouvrir dans un nouvel onglet
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Main Component ──────────────────────────────────────────────

export default function ChargesModule() {
  const { user } = useAuth()
  const isAdminUser = user?.role === 'admin'

  // State
  const [charges, setCharges] = useState<Charge[]>([])
  const [stats, setStats] = useState<ChargeStats | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [opportunities, setOpportunities] = useState<{ id: string; nomProjet: string; montantEstime: number | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterEmploye, setFilterEmploye] = useState<string>('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [sortField, setSortField] = useState<string>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Dialogs
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    type: 'hotel',
    montant: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    employeId: '',
    opportunityId: '',
  })
  const [justificatifFile, setJustificatifFile] = useState<File | null>(null)
  const [justificatifPreview, setJustificatifPreview] = useState<string | null>(null)
  const [existingJustificatifUrl, setExistingJustificatifUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Data Fetching ─────────────────────────────────────────────

  const fetchCharges = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterType !== 'all') params.set('type', filterType)
      if (isAdminUser && filterEmploye !== 'all') params.set('employeId', filterEmploye)
      if (filterDateFrom) params.set('dateFrom', filterDateFrom)
      if (filterDateTo) params.set('dateTo', filterDateTo)

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/charges?${params.toString()}`),
        fetch(`/api/charges?stats=true&${params.toString()}`),
      ])

      if (listRes.ok) {
        const listData = await listRes.json()
        setCharges(listData)
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }
    } catch (err) {
      toast.error('Erreur lors du chargement des charges')
    }
  }, [filterType, filterEmploye, filterDateFrom, filterDateTo, isAdminUser])

  const fetchEmployees = useCallback(async () => {
    if (!isAdminUser) return // non-admin don't need employee list
    try {
      const res = await fetch('/api/employees?actif=true')
      if (res.ok) {
        const data = await res.json()
        setEmployees(data)
      }
    } catch (err) {
      toast.error('Erreur lors du chargement des employés')
    }
  }, [isAdminUser])

  const fetchOpportunities = useCallback(async () => {
    try {
      const res = await fetch('/api/opportunities')
      if (res.ok) {
        const data = await res.json()
        setOpportunities(data.map((o: { id: string; nomProjet: string; montantEstime: number | null }) => ({
          id: o.id,
          nomProjet: o.nomProjet,
          montantEstime: o.montantEstime,
        })))
      }
    } catch (err) {
      toast.error('Erreur lors du chargement des opportunités')
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchCharges(), fetchEmployees(), fetchOpportunities()])
      setLoading(false)
    }
    load()
  }, [fetchCharges, fetchEmployees, fetchOpportunities])

  // ─── File Upload Handler ────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Type de fichier non autorisé (images et PDF uniquement)')
      return
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10 Mo)')
      return
    }

    setJustificatifFile(file)

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (ev) => setJustificatifPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setJustificatifPreview(null)
    }
  }

  const removeJustificatif = () => {
    setJustificatifFile(null)
    setJustificatifPreview(null)
    setExistingJustificatifUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Form Handlers ─────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingId(null)
    setFormData({
      type: 'hotel',
      montant: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      employeId: isAdminUser ? (employees[0]?.id || '') : (user?.employeId || ''),
      opportunityId: '',
    })
    setJustificatifFile(null)
    setJustificatifPreview(null)
    setExistingJustificatifUrl(null)
    setShowFormDialog(true)
  }

  const openEditDialog = (charge: Charge) => {
    setEditingId(charge.id)
    setFormData({
      type: charge.type,
      montant: charge.montant.toString(),
      description: charge.description || '',
      date: new Date(charge.date).toISOString().split('T')[0],
      employeId: charge.employeId,
      opportunityId: charge.opportunityId || '',
    })
    setJustificatifFile(null)
    setJustificatifPreview(charge.justificatifUrl && isImageFile(charge.justificatifUrl) ? charge.justificatifUrl : null)
    setExistingJustificatifUrl(charge.justificatifUrl || null)
    setShowFormDialog(true)
  }

  const handleSave = async () => {
    if (!formData.type || !formData.montant) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    if (isAdminUser && !formData.employeId) {
      toast.error('Veuillez sélectionner un employé')
      return
    }
    setSaving(true)
    setUploading(true)
    try {
      // Upload justificatif first if a new file was selected
      let justificatifUrl: string | null = existingJustificatifUrl

      if (justificatifFile) {
        const uploadFormData = new FormData()
        uploadFormData.append('file', justificatifFile)
        const uploadRes = await fetch('/api/charges/upload', {
          method: 'POST',
          body: uploadFormData,
        })
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          justificatifUrl = uploadData.url
        } else {
          toast.error("Erreur lors de l'upload du justificatif")
          setUploading(false)
          setSaving(false)
          return
        }
      }

      setUploading(false)

      const payload = {
        type: formData.type,
        montant: formData.montant,
        description: formData.description || null,
        date: formData.date || new Date().toISOString().split('T')[0],
        employeId: isAdminUser ? formData.employeId : (user?.employeId || ''),
        opportunityId: formData.opportunityId || null,
        justificatifUrl,
      }

      if (editingId) {
        const res = await fetch(`/api/charges/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Update failed')
        toast.success('Charge mise à jour avec succès')
      } else {
        const res = await fetch('/api/charges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Create failed')
        toast.success('Charge créée avec succès')
      }

      setShowFormDialog(false)
      await fetchCharges()
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement")
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      const res = await fetch(`/api/charges/${deletingId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Charge supprimée avec succès')
        setShowDeleteDialog(false)
        setDeletingId(null)
        await fetchCharges()
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch (err) {
      toast.error('Erreur lors de la suppression')
    }
  }

  // ─── Computed Data ─────────────────────────────────────────────

  const filteredCharges = charges.filter(charge => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matchDesc = charge.description?.toLowerCase().includes(search)
      const matchEmployee = charge.employe.nom.toLowerCase().includes(search)
      const matchOpp = charge.opportunity?.nomProjet?.toLowerCase().includes(search)
      if (!matchDesc && !matchEmployee && !matchOpp) return false
    }
    return true
  })

  const sortedCharges = [...filteredCharges].sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case 'date':
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime()
        break
      case 'montant':
        cmp = a.montant - b.montant
        break
      case 'employe':
        cmp = a.employe.nom.localeCompare(b.employe.nom)
        break
      case 'type':
        cmp = a.type.localeCompare(b.type)
        break
      default:
        cmp = 0
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  // Current month charges
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const chargesThisMonth = charges.filter(c => {
    const d = new Date(c.date)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })
  const totalThisMonth = chargesThisMonth.reduce((sum, c) => sum + c.montant, 0)
  const totalAll = charges.reduce((sum, c) => sum + c.montant, 0)

  // ─── Sort Toggle ───────────────────────────────────────────────

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // ─── Subtitle based on role ────────────────────────────────────
  const subtitle = isAdminUser ? 'Suivi des dépenses' : 'Mes dépenses'

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
                  Charges
                </h1>
                <p className="text-xs text-muted-foreground">
                  {subtitle}
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
              <Button
                onClick={openCreateDialog}
                className="gap-1.5 bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white shadow-lg shadow-[#134885]/25 hover:from-[#0D3A6E] hover:to-[#134885]"
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">Nouvelle Charge</span>
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
                <DollarSign className="size-3.5 text-[#134885]" />
                Total Charges
              </div>
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                {formatDZD(totalAll)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="size-3.5 text-[#F6852A]" />
                Charges ce mois
              </div>
              <p className="mt-1 text-base font-bold text-[#134885] dark:text-[#F6852A] sm:text-lg">
                {formatDZD(totalThisMonth)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Receipt className="size-3.5 text-emerald-500" />
                Nombre de charges
              </div>
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                {charges.length} charge{charges.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ImageIcon className="size-3.5 text-purple-500" />
                Justificatifs
              </div>
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                {charges.filter(c => c.justificatifUrl).length} avec justificatif
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-[#134885]" />
            <span className="ml-3 text-muted-foreground">Chargement des charges...</span>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-white/70 shadow-sm dark:bg-slate-900/70">
              <TabsTrigger value="overview" className="gap-1.5">
                <TrendingUp className="size-3.5" />
                Vue Globale
              </TabsTrigger>
              {isAdminUser && (
                <TabsTrigger value="byEmployee" className="gap-1.5">
                  <Users className="size-3.5" />
                  Par Employé
                </TabsTrigger>
              )}
              <TabsTrigger value="byOpportunity" className="gap-1.5">
                <Briefcase className="size-3.5" />
                Par Opportunité
              </TabsTrigger>
            </TabsList>

            {/* ─── Vue Globale Tab ─────────────────────────────── */}
            <TabsContent value="overview">
              <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
                <CardContent className="p-0">
                  {/* Filters bar */}
                  <div className="flex flex-wrap items-center gap-2 border-b p-4">
                    <Filter className="size-4 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground">Filtres:</Label>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les types</SelectItem>
                        {CHARGE_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isAdminUser && (
                      <Select value={filterEmploye} onValueChange={setFilterEmploye}>
                        <SelectTrigger className="h-8 w-44 text-xs">
                          <SelectValue placeholder="Employé" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tous les employés</SelectItem>
                          {employees.map(e => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.nom}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <div className="flex items-center gap-1">
                      <Input
                        type="date"
                        value={filterDateFrom}
                        onChange={e => setFilterDateFrom(e.target.value)}
                        className="h-8 w-32 text-xs"
                        placeholder="Du"
                      />
                      <span className="text-xs text-muted-foreground">→</span>
                      <Input
                        type="date"
                        value={filterDateTo}
                        onChange={e => setFilterDateTo(e.target.value)}
                        className="h-8 w-32 text-xs"
                        placeholder="Au"
                      />
                    </div>
                    {(filterType !== 'all' || (isAdminUser && filterEmploye !== 'all') || filterDateFrom || filterDateTo) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          setFilterType('all')
                          setFilterEmploye('all')
                          setFilterDateFrom('')
                          setFilterDateTo('')
                        }}
                      >
                        Réinitialiser
                      </Button>
                    )}
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="cursor-pointer" onClick={() => toggleSort('date')}>
                            <span className="flex items-center gap-1">
                              Date <ArrowUpDown className="size-3" />
                            </span>
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => toggleSort('type')}>
                            <span className="flex items-center gap-1">
                              Type <ArrowUpDown className="size-3" />
                            </span>
                          </TableHead>
                          <TableHead>Description</TableHead>
                          {isAdminUser && (
                            <TableHead className="cursor-pointer" onClick={() => toggleSort('employe')}>
                              <span className="flex items-center gap-1">
                                Employé <ArrowUpDown className="size-3" />
                              </span>
                            </TableHead>
                          )}
                          <TableHead>Opportunité</TableHead>
                          <TableHead>Justificatif</TableHead>
                          <TableHead className="cursor-pointer" onClick={() => toggleSort('montant')}>
                            <span className="flex items-center gap-1">
                              Montant <ArrowUpDown className="size-3" />
                            </span>
                          </TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedCharges.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isAdminUser ? 8 : 7} className="h-32 text-center text-muted-foreground">
                              <div className="flex flex-col items-center">
                                <Receipt className="mb-2 size-8 opacity-20" />
                                Aucune charge trouvée
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          sortedCharges.map(charge => (
                            <TableRow
                              key={charge.id}
                              className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                            >
                              <TableCell className="text-sm">{formatDate(charge.date)}</TableCell>
                              <TableCell><TypeBadge type={charge.type} /></TableCell>
                              <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                                {charge.description || '—'}
                              </TableCell>
                              {isAdminUser && (
                                <TableCell className="text-sm font-medium">{charge.employe.nom}</TableCell>
                              )}
                              <TableCell className="text-sm text-muted-foreground">
                                {charge.opportunity?.nomProjet || '—'}
                              </TableCell>
                              <TableCell>
                                {charge.justificatifUrl ? (
                                  <JustificatifThumbnail url={charge.justificatifUrl} />
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-sm font-semibold">
                                {formatDZD(charge.montant)}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="size-8 p-0">
                                      <MoreHorizontal className="size-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditDialog(charge)}>
                                      <Edit3 className="mr-2 size-3.5" /> Modifier
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={() => {
                                        setDeletingId(charge.id)
                                        setShowDeleteDialog(true)
                                      }}
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
            </TabsContent>

            {/* ─── Par Employé Tab (Admin only) ────────────────── */}
            {isAdminUser && (
              <TabsContent value="byEmployee">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <AnimatePresence mode="popLayout">
                    {(stats?.byEmployee || []).map((emp, index) => (
                      <motion.div
                        key={emp.employeId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="flex size-9 items-center justify-center rounded-full bg-[#134885]/10 dark:bg-[#134885]/20">
                                  <Users className="size-4 text-[#134885] dark:text-[#F6852A]" />
                                </div>
                                <div>
                                  <CardTitle className="text-sm font-semibold">{emp.nom}</CardTitle>
                                  <p className="text-xs text-muted-foreground">{emp.count} charge{emp.count !== 1 ? 's' : ''}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-[#134885] dark:text-[#F6852A]">
                                  {formatDZD(emp.total)}
                                </p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {/* Breakdown by type */}
                            <div className="space-y-2">
                              {CHARGE_TYPES.map(typeConfig => {
                                const typeData = emp.byType.find(bt => bt.type === typeConfig.value)
                                const total = typeData?.total || 0
                                const percentage = emp.total > 0 ? (total / emp.total) * 100 : 0
                                return (
                                  <div key={typeConfig.value} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-1.5">
                                        <div className={`size-2 rounded-full ${typeConfig.dotColor}`} />
                                        <span className="text-muted-foreground">{typeConfig.label}</span>
                                      </div>
                                      <span className="font-medium">{formatDZD(total)}</span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        transition={{ duration: 0.5, delay: index * 0.05 }}
                                        className={`h-full rounded-full ${typeConfig.dotColor}`}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            <Separator className="my-3" />

                            {/* Recent charges for this employee */}
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-muted-foreground">Charges récentes</p>
                              {sortedCharges
                                .filter(c => c.employeId === emp.employeId)
                                .slice(0, 3)
                                .map(c => (
                                  <div key={c.id} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5">
                                      <TypeBadge type={c.type} />
                                      <span className="text-muted-foreground">{formatDate(c.date)}</span>
                                      {c.justificatifUrl && (
                                        <ImageIcon className="size-3 text-emerald-500" />
                                      )}
                                    </div>
                                    <span className="font-medium">{formatDZD(c.montant)}</span>
                                  </div>
                                ))
                              }
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {(!stats?.byEmployee || stats.byEmployee.length === 0) && (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Receipt className="mb-3 size-12 opacity-20" />
                      <p>Aucune charge par employé</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            {/* ─── Par Opportunité Tab ──────────────────────────── */}
            <TabsContent value="byOpportunity">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {(stats?.byOpportunity || []).map((opp, index) => {
                    const profitPotential = (opp.montantEstime || 0) - opp.total
                    return (
                      <motion.div
                        key={opp.opportunityId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="flex size-9 items-center justify-center rounded-full bg-[#F6852A]/10 dark:bg-[#F6852A]/20">
                                  <Briefcase className="size-4 text-[#F6852A]" />
                                </div>
                                <div>
                                  <CardTitle className="text-sm font-semibold">{opp.nomProjet}</CardTitle>
                                  <p className="text-xs text-muted-foreground">{opp.count} charge{opp.count !== 1 ? 's' : ''}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-red-600 dark:text-red-400">
                                  {formatDZD(opp.total)}
                                </p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {/* Breakdown by type */}
                            <div className="space-y-2">
                              {CHARGE_TYPES.map(typeConfig => {
                                const typeData = opp.byType.find(bt => bt.type === typeConfig.value)
                                const total = typeData?.total || 0
                                const percentage = opp.total > 0 ? (total / opp.total) * 100 : 0
                                return (
                                  <div key={typeConfig.value} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-1.5">
                                        <div className={`size-2 rounded-full ${typeConfig.dotColor}`} />
                                        <span className="text-muted-foreground">{typeConfig.label}</span>
                                      </div>
                                      <span className="font-medium">{formatDZD(total)}</span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        transition={{ duration: 0.5, delay: index * 0.05 }}
                                        className={`h-full rounded-full ${typeConfig.dotColor}`}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            <Separator className="my-3" />

                            {/* Net calculation */}
                            {opp.montantEstime != null && (
                              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Montant estimé</span>
                                  <span className="font-medium">{formatDZD(opp.montantEstime)}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Total charges</span>
                                  <span className="font-medium text-red-600">-{formatDZD(opp.total)}</span>
                                </div>
                                <Separator className="my-1.5" />
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold">Bénéfice potentiel</span>
                                  <span className={`font-bold ${profitPotential >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatDZD(profitPotential)}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Recent charges for this opportunity */}
                            <div className="mt-3 space-y-1.5">
                              <p className="text-xs font-medium text-muted-foreground">Charges récentes</p>
                              {sortedCharges
                                .filter(c => c.opportunityId === opp.opportunityId)
                                .slice(0, 3)
                                .map(c => (
                                  <div key={c.id} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5">
                                      <TypeBadge type={c.type} />
                                      {isAdminUser && (
                                        <span className="text-muted-foreground">{c.employe.nom}</span>
                                      )}
                                      {c.justificatifUrl && (
                                        <ImageIcon className="size-3 text-emerald-500" />
                                      )}
                                    </div>
                                    <span className="font-medium">{formatDZD(c.montant)}</span>
                                  </div>
                                ))
                              }
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
                {(!stats?.byOpportunity || stats.byOpportunity.length === 0) && (
                  <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Briefcase className="mb-3 size-12 opacity-20" />
                    <p>Aucune charge liée à une opportunité</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* ─── Stats breakdown row (under tabs) ──────────────────── */}
        {!loading && stats && stats.byType.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.byType.map((typeStat) => {
              const config = getTypeConfig(typeStat.type)
              const Icon = config.icon
              return (
                <Card key={typeStat.type} className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon className={`size-3.5 ${config.dotColor.replace('bg-', 'text-')}`} />
                      {config.label}
                    </div>
                    <p className="mt-1 text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                      {formatDZD(typeStat.total)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {typeStat.count} charge{typeStat.count !== 1 ? 's' : ''}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>

      {/* ─── Add/Edit Dialog ────────────────────────────────────── */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#134885]/10 dark:bg-[#134885]/20">
                <Receipt className="size-4 text-[#134885] dark:text-[#F6852A]" />
              </div>
              {editingId ? 'Modifier la charge' : 'Nouvelle charge'}
            </DialogTitle>
            <DialogDescription>
              {editingId ? 'Modifiez les informations de la charge.' : 'Enregistrez une nouvelle dépense.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Type *</Label>
              <Select value={formData.type} onValueChange={v => setFormData(prev => ({ ...prev, type: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent>
                  {CHARGE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        <t.icon className="size-4" />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Montant */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Montant (DZD) *</Label>
              <Input
                type="number"
                placeholder="0"
                value={formData.montant}
                onChange={e => setFormData(prev => ({ ...prev, montant: e.target.value }))}
                min="0"
                step="100"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Description</Label>
              <Textarea
                placeholder="Description de la dépense..."
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

            {/* Employé (admin only) */}
            {isAdminUser && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Employé *</Label>
                <Select value={formData.employeId} onValueChange={v => setFormData(prev => ({ ...prev, employeId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner l'employé" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Opportunité */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Opportunité (optionnel)</Label>
              <Select value={formData.opportunityId} onValueChange={v => setFormData(prev => ({ ...prev, opportunityId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Aucune opportunité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune opportunité</SelectItem>
                  {opportunities.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nomProjet}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Justificatif Upload */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Justificatif (bon, ticket, reçu)</Label>
              <div className="space-y-2">
                {(justificatifPreview || existingJustificatifUrl) ? (
                  <div className="relative flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                    {(justificatifPreview || (existingJustificatifUrl && isImageFile(existingJustificatifUrl))) ? (
                      <img
                        src={justificatifPreview || existingJustificatifUrl || ''}
                        alt="Aperçu"
                        className="size-16 rounded-md object-cover"
                      />
                    ) : existingJustificatifUrl ? (
                      <div className="flex size-16 items-center justify-center rounded-md bg-slate-200 dark:bg-slate-700">
                        <FileText className="size-8 text-slate-400" />
                      </div>
                    ) : null}
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {justificatifFile ? justificatifFile.name : 'Justificatif existant'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {justificatifFile
                          ? `${(justificatifFile.size / 1024).toFixed(1)} Ko`
                          : 'Cliquez sur X pour supprimer'
                        }
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0 text-red-500 hover:text-red-700"
                      onClick={removeJustificatif}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-8 text-slate-400" />
                    <p className="text-sm text-muted-foreground">
                      Cliquez pour ajouter un justificatif
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Image ou PDF (max 10 Mo)
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {!justificatifPreview && !existingJustificatifUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-4" />
                    Ajouter un justificatif
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.type || !formData.montant || (isAdminUser && !formData.employeId)}
              className="gap-1.5 bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white shadow-lg shadow-[#134885]/25 hover:from-[#0D3A6E] hover:to-[#134885]"
            >
              {saving && (
                <>
                  {uploading ? (
                    <><Loader2 className="size-4 animate-spin" /> Upload...</>
                  ) : (
                    <><Loader2 className="size-4 animate-spin" /></>
                  )}
                </>
              )}
              {editingId ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─────────────────────────── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="size-5" />
              Supprimer la charge
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cette charge ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
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
    </div>
  )
}
