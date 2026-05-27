'use client'

import { useState, useEffect, useCallback } from 'react'
import { ModuleHeader } from '@/components/crm/module-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCRMStore } from '@/lib/store'
import {
  Plus,
  Search,
  Package,
  MoreHorizontal,
  Pencil,
  Trash2,
  BarChart3,
  ShoppingBag,
  TrendingUp,
  ArrowUpDown,
  Eye,
  ChevronDown,
  ChevronUp,
  DollarSign,
  User,
} from 'lucide-react'

// ── Types ──────────────────────────────────────
interface Product {
  id: string
  nom: string
  marque: string
  categorie: string | null
  reference: string | null
  description: string | null
  prixReference: number | null
  actif: boolean
  createdAt: string
  updatedAt: string
}

interface ProductStats {
  produit: string
  marque: string
  totalVentes: number
  totalCA: number
  totalMarge: number
  ventesParCommercial: {
    commercialId: string
    commercialNom: string
    nbVentes: number
    ca: number
  }[]
}

// ── Constants ──────────────────────────────────
const MARQUES = [
  { value: 'MIR', label: 'MIR', color: '#2563EB', bg: '#EFF6FF' },
  { value: 'BOS', label: 'BOS', color: '#DC2626', bg: '#FEF2F2' },
  { value: 'Löwenstein', label: 'Löwenstein', color: '#059669', bg: '#ECFDF5' },
  { value: 'Yuwell', label: 'Yuwell', color: '#7C3AED', bg: '#F5F3FF' },
  { value: 'Gelenke', label: 'Gelenke', color: '#D97706', bg: '#FFFBEB' },
  { value: 'Autres', label: 'Autres', color: '#6B7280', bg: '#F9FAFB' },
]

const CATEGORIES = [
  'Monitorage',
  'Ventilation',
  'Chirurgie',
  'Imagerie',
  'Réanimation',
  'Maternité',
  'Laboratoire',
  'Échographie',
  'Cardiologie',
  'Anesthésie',
  'Autre',
]

function getMarqueInfo(marque: string) {
  return MARQUES.find(m => m.value === marque) || MARQUES[MARQUES.length - 1]
}

// ── Main Component ─────────────────────────────
export default function CatalogModule() {
  const { currentUser } = useCRMStore()
  const isAdmin = currentUser?.role === 'admin'
  const isCommercial = currentUser?.role === 'commercial'

  // State
  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState<ProductStats[]>([])
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMarque, setFilterMarque] = useState<string>('all')
  const [filterCategorie, setFilterCategorie] = useState<string>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [activeTab, setActiveTab] = useState<'catalog' | 'stats'>('catalog')

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [expandedStats, setExpandedStats] = useState<Set<string>>(new Set())

  // Form state
  const [formData, setFormData] = useState({
    nom: '',
    marque: 'MIR',
    categorie: '',
    reference: '',
    description: '',
    prixReference: '',
    actif: true,
  })

  // ── Fetch ──
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterMarque !== 'all') params.set('marque', filterMarque)
      if (filterCategorie !== 'all') params.set('categorie', filterCategorie)
      if (!showInactive) params.set('actif', 'true')
      const res = await fetch(`/api/products?${params}`)
      if (res.ok) setProducts(await res.json())
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [filterMarque, filterCategorie, showInactive])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const params = new URLSearchParams({ stats: 'true' })
      if (filterMarque !== 'all') params.set('marque', filterMarque)
      const res = await fetch(`/api/products?${params}`)
      if (res.ok) setStats(await res.json())
    } catch (e) { console.error(e) }
    setStatsLoading(false)
  }, [filterMarque])

  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { if (activeTab === 'stats') fetchStats() }, [activeTab, fetchStats])

  // ── CRUD ──
  const handleCreate = async () => {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          prixReference: formData.prixReference ? parseFloat(formData.prixReference) : null,
        }),
      })
      if (res.ok) {
        setShowCreateDialog(false)
        resetForm()
        fetchProducts()
      }
    } catch (e) { console.error(e) }
  }

  const handleEdit = async () => {
    if (!selectedProduct) return
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          prixReference: formData.prixReference ? parseFloat(formData.prixReference) : null,
        }),
      })
      if (res.ok) {
        setShowEditDialog(false)
        setSelectedProduct(null)
        resetForm()
        fetchProducts()
      }
    } catch (e) { console.error(e) }
  }

  const handleDelete = async () => {
    if (!selectedProduct) return
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}`, { method: 'DELETE' })
      if (res.ok) {
        setShowDeleteDialog(false)
        setSelectedProduct(null)
        fetchProducts()
      }
    } catch (e) { console.error(e) }
  }

  const resetForm = () => {
    setFormData({
      nom: '', marque: 'MIR', categorie: '', reference: '',
      description: '', prixReference: '', actif: true,
    })
  }

  const openEdit = (p: Product) => {
    setSelectedProduct(p)
    setFormData({
      nom: p.nom, marque: p.marque, categorie: p.categorie || '',
      reference: p.reference || '', description: p.description || '',
      prixReference: p.prixReference?.toString() || '', actif: p.actif,
    })
    setShowEditDialog(true)
  }

  // ── Filtering ──
  const filtered = products.filter(p =>
    p.nom.toLowerCase().includes(search.toLowerCase()) ||
    (p.reference || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.categorie || '').toLowerCase().includes(search.toLowerCase())
  )

  // ── Summary ──
  const totalProducts = products.length
  const totalActive = products.filter(p => p.actif).length
  const marquesCount = new Set(products.map(p => p.marque)).size

  // ── Render ──
  return (
    <div className="min-h-screen bg-slate-50">
      <ModuleHeader
        title="Catalogue Produits"
        subtitle={`${totalActive} produits actifs · ${marquesCount} marques`}
        actions={
          (isAdmin || isCommercial) ? (
            <Button
              onClick={() => { resetForm(); setShowCreateDialog(true) }}
              className="bg-[#134885] hover:bg-[#0D3A6E] text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              Nouveau produit
            </Button>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-0">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'catalog'
                ? 'border-[#134885] text-[#134885]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Package className="h-4 w-4" />
            Catalogue
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'stats'
                ? 'border-[#134885] text-[#134885]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Statistiques de vente
          </button>
        </div>

        {activeTab === 'catalog' ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2.5">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{totalProducts}</p>
                    <p className="text-xs text-slate-500">Total produits</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-50 p-2.5">
                    <ShoppingBag className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{totalActive}</p>
                    <p className="text-xs text-slate-500">Produits actifs</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-amber-50 p-2.5">
                    <TrendingUp className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{marquesCount}</p>
                    <p className="text-xs text-slate-500">Marques</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative flex-1 w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Rechercher un produit..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterMarque} onValueChange={setFilterMarque}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Marque" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les marques</SelectItem>
                  {MARQUES.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCategorie} onValueChange={setFilterCategorie}>
                <SelectTrigger className="w-full sm:w-[170px]">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Afficher inactifs
              </label>
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#134885]" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-lg font-medium">Aucun produit trouvé</p>
                <p className="text-sm">Commencez par ajouter des produits au catalogue</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead>Produit</TableHead>
                      <TableHead>Marque</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead className="text-right">Prix réf.</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((product) => {
                      const mInfo = getMarqueInfo(product.marque)
                      return (
                        <TableRow
                          key={product.id}
                          className="cursor-pointer hover:bg-slate-50/80"
                          onClick={() => { setSelectedProduct(product); setShowDetailDialog(true) }}
                        >
                          <TableCell>
                            <div className="font-medium text-slate-900">{product.nom}</div>
                            {product.description && (
                              <div className="text-xs text-slate-400 truncate max-w-[200px]">{product.description}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              style={{ backgroundColor: mInfo.bg, color: mInfo.color, borderColor: mInfo.color + '30' }}
                              variant="outline"
                              className="font-semibold text-xs"
                            >
                              {product.marque}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600 text-sm">
                            {product.categorie || '—'}
                          </TableCell>
                          <TableCell className="text-slate-500 text-sm font-mono">
                            {product.reference || '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-700">
                            {product.prixReference
                              ? `${product.prixReference.toLocaleString('fr-DZ')} DA`
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={product.actif
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-red-50 text-red-600 border-red-200'
                              }
                            >
                              {product.actif ? 'Actif' : 'Inactif'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedProduct(product); setShowDetailDialog(true) }}>
                                  <Eye className="mr-2 h-4 w-4" /> Voir détails
                                </DropdownMenuItem>
                                {(isAdmin || isCommercial) && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(product) }}>
                                    <Pencil className="mr-2 h-4 w-4" /> Modifier
                                  </DropdownMenuItem>
                                )}
                                {isAdmin && (
                                  <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); setSelectedProduct(product); setShowDeleteDialog(true) }}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Désactiver
                                  </DropdownMenuItem>
                                )}
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
          </>
        ) : (
          /* ── Stats Tab ── */
          <>
            {/* Stats Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <Select value={filterMarque} onValueChange={setFilterMarque}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filtrer par marque" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les marques</SelectItem>
                  {MARQUES.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {statsLoading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#134885]" />
              </div>
            ) : stats.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-lg font-medium">Aucune donnée de vente</p>
                <p className="text-sm">Les statistiques apparaîtront lorsque des opportunités seront gagnées</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Stats summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-blue-50 p-2.5">
                        <ShoppingBag className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900">
                          {stats.reduce((s, p) => s + p.totalVentes, 0)}
                        </p>
                        <p className="text-xs text-slate-500">Total ventes</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-green-50 p-2.5">
                        <DollarSign className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900">
                          {Math.round(stats.reduce((s, p) => s + p.totalCA, 0)).toLocaleString('fr-DZ')}
                        </p>
                        <p className="text-xs text-slate-500">CA total (DA)</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-amber-50 p-2.5">
                        <TrendingUp className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900">
                          {Math.round(stats.reduce((s, p) => s + p.totalMarge, 0)).toLocaleString('fr-DZ')}
                        </p>
                        <p className="text-xs text-slate-500">Marge totale (DA)</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Product stats table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50">
                        <TableHead>Produit</TableHead>
                        <TableHead>Marque</TableHead>
                        <TableHead className="text-center">Qté vendue</TableHead>
                        <TableHead className="text-right">CA total</TableHead>
                        <TableHead className="text-right">Marge</TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.map((stat, idx) => {
                        const key = `${stat.produit}||${stat.marque}||${idx}`
                        const mInfo = getMarqueInfo(stat.marque)
                        const isExpanded = expandedStats.has(key)
                        return (
                          <>
                            <TableRow
                              key={key}
                              className="cursor-pointer hover:bg-slate-50/80"
                              onClick={() => {
                                setExpandedStats(prev => {
                                  const next = new Set(prev)
                                  if (next.has(key)) next.delete(key)
                                  else next.add(key)
                                  return next
                                })
                              }}
                            >
                              <TableCell className="font-medium text-slate-900">
                                {stat.produit}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  style={{ backgroundColor: mInfo.bg, color: mInfo.color, borderColor: mInfo.color + '30' }}
                                  variant="outline"
                                  className="font-semibold text-xs"
                                >
                                  {stat.marque}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm w-8 h-8">
                                  {stat.totalVentes}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-medium text-slate-700">
                                {Math.round(stat.totalCA).toLocaleString('fr-DZ')} DA
                              </TableCell>
                              <TableCell className="text-right font-medium text-green-600">
                                {Math.round(stat.totalMarge).toLocaleString('fr-DZ')} DA
                              </TableCell>
                              <TableCell>
                                {isExpanded
                                  ? <ChevronUp className="h-4 w-4 text-slate-400" />
                                  : <ChevronDown className="h-4 w-4 text-slate-400" />
                                }
                              </TableCell>
                            </TableRow>
                            {/* Expanded: per-commercial breakdown */}
                            {isExpanded && (
                              <TableRow key={`${key}-detail`} className="bg-slate-50/50">
                                <TableCell colSpan={6} className="p-0">
                                  <div className="px-8 py-3">
                                    <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                                      <User className="h-3 w-3" /> Ventes par commercial
                                    </p>
                                    <div className="space-y-1">
                                      {stat.ventesParCommercial
                                        .sort((a, b) => b.nbVentes - a.nbVentes)
                                        .map((vc) => (
                                          <div
                                            key={vc.commercialId}
                                            className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-white border border-slate-100"
                                          >
                                            <div className="flex items-center gap-2">
                                              <div className="h-6 w-6 rounded-full bg-[#134885] flex items-center justify-center text-white text-[10px] font-bold">
                                                {vc.commercialNom.slice(0, 2).toUpperCase()}
                                              </div>
                                              <span className="font-medium text-slate-700">{vc.commercialNom}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                              <span className="text-slate-500">
                                                <span className="font-bold text-slate-700">{vc.nbVentes}</span> vente{vc.nbVentes > 1 ? 's' : ''}
                                              </span>
                                              <span className="font-semibold text-green-600">
                                                {Math.round(vc.ca).toLocaleString('fr-DZ')} DA
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Create Dialog ── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-[#134885]">Nouveau produit</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nom du produit *</Label>
              <Input
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                placeholder="Ex: Moniteur patient MIR 12 pouces"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Marque *</Label>
                <Select value={formData.marque} onValueChange={(v) => setFormData({ ...formData, marque: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MARQUES.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Catégorie</Label>
                <Select value={formData.categorie} onValueChange={(v) => setFormData({ ...formData, categorie: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Référence</Label>
                <Input
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  placeholder="Ex: MIR-M12-2024"
                />
              </div>
              <div className="grid gap-2">
                <Label>Prix de référence (DA)</Label>
                <Input
                  type="number"
                  value={formData.prixReference}
                  onChange={(e) => setFormData({ ...formData, prixReference: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description du produit..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!formData.nom} className="bg-[#134885] hover:bg-[#0D3A6E] text-white">
              Créer le produit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-[#134885]">Modifier le produit</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nom du produit *</Label>
              <Input
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Marque *</Label>
                <Select value={formData.marque} onValueChange={(v) => setFormData({ ...formData, marque: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MARQUES.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Catégorie</Label>
                <Select value={formData.categorie || '_none'} onValueChange={(v) => setFormData({ ...formData, categorie: v === '_none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Aucune</SelectItem>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Référence</Label>
                <Input
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Prix de référence (DA)</Label>
                <Input
                  type="number"
                  value={formData.prixReference}
                  onChange={(e) => setFormData({ ...formData, prixReference: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.actif}
                onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                className="rounded border-slate-300"
              />
              Produit actif
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Annuler</Button>
            <Button onClick={handleEdit} className="bg-[#134885] hover:bg-[#0D3A6E] text-white">
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ── */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-[#134885]">{selectedProduct?.nom}</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <Badge
                  style={{
                    backgroundColor: getMarqueInfo(selectedProduct.marque).bg,
                    color: getMarqueInfo(selectedProduct.marque).color,
                  }}
                  className="font-semibold"
                >
                  {selectedProduct.marque}
                </Badge>
                <Badge variant="outline" className={selectedProduct.actif ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}>
                  {selectedProduct.actif ? 'Actif' : 'Inactif'}
                </Badge>
                {selectedProduct.categorie && (
                  <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                    {selectedProduct.categorie}
                  </Badge>
                )}
              </div>
              {selectedProduct.reference && (
                <div>
                  <p className="text-xs text-slate-500">Référence</p>
                  <p className="font-mono text-sm text-slate-700">{selectedProduct.reference}</p>
                </div>
              )}
              {selectedProduct.prixReference && (
                <div>
                  <p className="text-xs text-slate-500">Prix de référence</p>
                  <p className="text-lg font-bold text-slate-900">{selectedProduct.prixReference.toLocaleString('fr-DZ')} DA</p>
                </div>
              )}
              {selectedProduct.description && (
                <div>
                  <p className="text-xs text-slate-500">Description</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedProduct.description}</p>
                </div>
              )}
              <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
                Créé le {new Date(selectedProduct.createdAt).toLocaleDateString('fr-FR')}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Fermer</Button>
            {(isAdmin || isCommercial) && selectedProduct && (
              <Button
                onClick={() => {
                  setShowDetailDialog(false)
                  openEdit(selectedProduct)
                }}
                className="bg-[#134885] hover:bg-[#0D3A6E] text-white gap-2"
              >
                <Pencil className="h-4 w-4" /> Modifier
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Désactiver le produit</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Voulez-vous désactiver <strong>{selectedProduct?.nom}</strong> ? Le produit ne sera plus visible dans les sélections mais restera dans l&apos;historique.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete}>Désactiver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
