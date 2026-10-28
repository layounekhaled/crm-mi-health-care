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
  AlertTriangle,
  Package,
  Settings,
  GraduationCap,
  ShieldCheck,
  Smile,
  Truck,
  Calendar,
  CalendarClock,
  User,
  StickyNote,
  MessageSquare,
  Search,
  X,
  Hash,
  Cpu,
  FileText,
  Copy,
  Printer,
  Phone,
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
import { AddInteractionDialog, INTERACTION_TYPES } from '@/components/crm/add-interaction-dialog'

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
  marque?: string | null
  nomMachine?: string | null
  numeroSerie?: string | null
  dateAchat?: string | null
  notes?: string | null
  date?: string | null
  employeId?: string | null
  createdAt: string
  updatedAt: string
  client: { id: string; nom: string; wilaya?: string | null; telephone?: string | null }
  employe?: { id: string; nom: string; role: string } | null
  creePar?: { id: string; nom: string } | null
  modifiePar?: { id: string; nom: string } | null
}

// ─── Constants ───────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: 'livraison', label: 'Livraison', icon: Truck, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  { value: 'installation', label: 'Installation', icon: Settings, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' },
  { value: 'formation', label: 'Formation', icon: GraduationCap, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  { value: 'sav', label: 'SAV', icon: ShieldCheck, color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
  { value: 'maintenance', label: 'Maintenance', icon: Package, color: 'bg-[#134885]/10 text-[#134885] dark:bg-[#134885]/20 dark:text-[#F6852A]' },
  { value: 'satisfaction', label: 'Satisfaction', icon: Smile, color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
] as const

const STATUT_OPTIONS = [
  { value: 'en_attente', label: 'En attente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', icon: Clock },
  { value: 'en_cours', label: 'En cours', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', icon: AlertCircle },
  { value: 'termine', label: 'Terminé', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300', icon: CheckCircle2 },
] as const

// Familles de produits (marques) — cohérent avec le catalogue produits
const MARQUES = [
  { value: 'MIR', label: 'MIR', color: '#2563EB', bg: '#EFF6FF' },
  { value: 'BOSO BOSCH', label: 'BOSO BOSCH', color: '#DC2626', bg: '#FEF2F2' },
  { value: 'Löwenstein', label: 'Löwenstein', color: '#059669', bg: '#ECFDF5' },
  { value: 'Yuwell', label: 'Yuwell', color: '#7C3AED', bg: '#F5F3FF' },
  { value: 'Gelenke', label: 'Gelenke', color: '#D97706', bg: '#FFFBEB' },
  { value: 'DRIVE DEVILBISS', label: 'DRIVE DEVILBISS', color: '#0D9488', bg: '#F0FDFA' },
  { value: 'INOGEN', label: 'INOGEN', color: '#7C3AED', bg: '#F5F3FF' },
  { value: 'Autres', label: 'Autres', color: '#6B7280', bg: '#F9FAFB' },
]

function getMarqueConfig(marque: string | null | undefined) {
  if (!marque) return null
  return MARQUES.find(m => m.value === marque) || { value: marque, label: marque, color: '#6B7280', bg: '#F9FAFB' }
}

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

function formatFullDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// ─── Rapport fournisseur ───────────────────────────────────────

function buildReportText(items: AfterSale[]): string {
  const first = items[0]
  const machineItem = items.find(i => i.nomMachine || i.marque || i.dateAchat) || first
  const client = first?.client
  const lines: string[] = []

  lines.push('==============================================')
  lines.push('        RAPPORT D\'INTERVENTION')
  lines.push('     À L\'ATTENTION DU FOURNISSEUR')
  lines.push('           MI HEALTH CARE')
  lines.push('==============================================')
  lines.push('')
  lines.push(`Date du rapport : ${formatFullDate(new Date().toISOString())}`)
  lines.push('')

  lines.push('--- CLIENT ------------------------------------')
  if (client) {
    lines.push(`Nom / Établissement : ${client.nom}`)
    if (client.wilaya) lines.push(`Wilaya : ${client.wilaya}`)
    if (client.telephone) lines.push(`Téléphone : ${client.telephone}`)
  }
  lines.push('')

  lines.push('--- MACHINE -----------------------------------')
  if (machineItem?.marque) lines.push(`Famille (Marque) : ${machineItem.marque}`)
  if (machineItem?.nomMachine) lines.push(`Nom de la machine : ${machineItem.nomMachine}`)
  if (machineItem?.numeroSerie) lines.push(`Numéro de série : ${machineItem.numeroSerie}`)
  if (machineItem?.dateAchat) lines.push(`Date d\'achat (approximative) : ${formatFullDate(machineItem.dateAchat)}`)
  lines.push('')

  lines.push(`--- HISTORIQUE DES INTERVENTIONS (${items.length}) -------`)
  items.forEach((item, idx) => {
    const typeLabel = TYPE_OPTIONS.find(t => t.value === item.type)?.label || item.type
    const statutLabel = STATUT_OPTIONS.find(s => s.value === item.statut)?.label || item.statut
    lines.push(``) 
    lines.push(`${idx + 1}. ${formatFullDate(item.date)} — ${typeLabel} (${statutLabel})`)
    if (item.marque && !machineItem?.marque) lines.push(`   Marque : ${item.marque}`)
    if (item.nomMachine && item.nomMachine !== machineItem?.nomMachine) lines.push(`   Machine : ${item.nomMachine}`)
    if (item.numeroSerie && item.numeroSerie !== machineItem?.numeroSerie) lines.push(`   N° série : ${item.numeroSerie}`)
    if (item.employe?.nom) lines.push(`   Technicien : ${item.employe.nom}`)
    if (item.notes) lines.push(`   Notes : ${item.notes}`)
  })
  lines.push('')
  lines.push('==============================================')

  return lines.join('\n')
}

function buildReportHtml(items: AfterSale[]): string {
  const first = items[0]
  const machineItem = items.find(i => i.nomMachine || i.marque || i.dateAchat) || first
  const client = first?.client
  const logoUrl = typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : '/logo.png'

  const rows = items.map((item, idx) => {
    const typeLabel = TYPE_OPTIONS.find(t => t.value === item.type)?.label || item.type
    const statutLabel = STATUT_OPTIONS.find(s => s.value === item.statut)?.label || item.statut
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;">${idx + 1}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;white-space:nowrap;">${formatFullDate(item.date)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
          <strong>${typeLabel}</strong><br/>
          <span style="color:#64748b;font-size:12px;">${statutLabel}${item.employe?.nom ? ' · ' + item.employe.nom : ''}</span>
          ${item.notes ? `<br/><span style="color:#475569;font-size:12px;">${item.notes}</span>` : ''}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
          ${item.marque ? `<span style="font-size:12px;">${item.marque}</span><br/>` : ''}
          ${item.nomMachine ? `<span style="font-size:12px;">${item.nomMachine}</span><br/>` : ''}
          ${item.numeroSerie ? `<span style="font-size:12px;font-family:monospace;">N° ${item.numeroSerie}</span>` : ''}
        </td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<title>Rapport intervention — Fournisseur</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; padding: 32px; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #134885; padding-bottom: 16px; margin-bottom: 24px; }
  .header img { height: 56px; object-fit: contain; }
  .header .title { text-align: right; }
  .header h1 { font-size: 18px; color: #134885; margin: 0 0 4px; }
  .header p { margin: 0; font-size: 12px; color: #64748b; }
  h2 { font-size: 13px; color: #134885; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; background: #f1f5f9; padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; }
  td { font-size: 13px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; }
  .info-grid div span.k { color: #64748b; display: inline-block; min-width: 170px; }
  .badge-count { display: inline-block; background: #134885; color: #fff; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: bold; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="header">
    <img src="${logoUrl}" alt="MI HEALTH CARE"/>
    <div class="title">
      <h1>RAPPORT D'INTERVENTION</h1>
      <p>À l'attention du fournisseur — ${formatFullDate(new Date().toISOString())}</p>
    </div>
  </div>

  <h2>Client</h2>
  <div class="info-grid">
    <div><span class="k">Nom / Établissement :</span> <strong>${client?.nom || '—'}</strong></div>
    <div><span class="k">Wilaya :</span> ${client?.wilaya || '—'}</div>
    <div><span class="k">Téléphone :</span> ${client?.telephone || '—'}</div>
  </div>

  <h2>Machine</h2>
  <div class="info-grid">
    <div><span class="k">Famille (Marque) :</span> <strong>${machineItem?.marque || '—'}</strong></div>
    <div><span class="k">Nom de la machine :</span> <strong>${machineItem?.nomMachine || '—'}</strong></div>
    <div><span class="k">Numéro de série :</span> <strong style="font-family:monospace;">${machineItem?.numeroSerie || '—'}</strong></div>
    <div><span class="k">Date d'achat (approx.) :</span> ${machineItem?.dateAchat ? formatFullDate(machineItem.dateAchat) : '—'}</div>
  </div>

  <h2>Historique des interventions <span class="badge-count">${items.length}</span></h2>
  <table>
    <thead>
      <tr><th style="width:32px;">#</th><th style="width:150px;">Date</th><th>Intervention</th><th style="width:220px;">Machine</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    <span>MI HEALTH CARE — Service Après-Vente</span>
    <span>Document généré le ${new Date().toLocaleString('fr-FR')}</span>
  </div>
</body>
</html>`
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
        <Wrench className="size-8 text-[#134885]/60" />
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

  // Add interaction dialog
  const [showAddInteractionDialog, setShowAddInteractionDialog] = useState(false)
  const [selectedAfterSaleForInteraction, setSelectedAfterSaleForInteraction] = useState<any>(null)

  // Recherche par numéro de série
  const [serialSearch, setSerialSearch] = useState('')
  const [serialSearching, setSerialSearching] = useState(false)
  const [serialResults, setSerialResults] = useState<AfterSale[]>([])
  const [serialSearched, setSerialSearched] = useState('')

  // Rapport fournisseur
  const [reportItems, setReportItems] = useState<AfterSale[] | null>(null)
  const [copied, setCopied] = useState(false)

  // Vérif d'historique pendant la saisie du n° de série dans le formulaire
  const [serialCheck, setSerialCheck] = useState<AfterSale[] | null>(null)

  // Form
  const [formData, setFormData] = useState({
    clientId: '',
    type: 'livraison',
    statut: 'en_attente',
    marque: 'none',
    nomMachine: '',
    numeroSerie: '',
    dateAchat: '',
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

  // ─── Recherche par n° de série (debounce) ───────────────────

  useEffect(() => {
    const q = serialSearch.trim()
    if (q.length < 2) {
      setSerialResults([])
      setSerialSearched('')
      setSerialSearching(false)
      return
    }
    setSerialSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/after-sales?numeroSerie=${encodeURIComponent(q)}`, { cache: 'no-store' })
        if (res.ok) {
          const data: AfterSale[] = await res.json()
          setSerialResults(data)
          setSerialSearched(q)
        }
      } catch (err) {
        console.error('Serial search failed:', err)
      } finally {
        setSerialSearching(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [serialSearch])

  // ─── Alerte historique machine dans le formulaire (debounce) ─

  useEffect(() => {
    const q = formData.numeroSerie.trim()
    if (q.length < 2) {
      setSerialCheck(null)
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/after-sales?numeroSerie=${encodeURIComponent(q)}`, { cache: 'no-store' })
        if (res.ok) {
          const data: AfterSale[] = await res.json()
          const others = editingId ? data.filter(d => d.id !== editingId) : data
          setSerialCheck(others.length > 0 ? others : null)
        }
      } catch (err) {
        console.error('Serial check failed:', err)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [formData.numeroSerie, editingId])

  // ─── Form Handlers ─────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingId(null)
    setFormData({
      clientId: '',
      type: 'livraison',
      statut: 'en_attente',
      marque: 'none',
      nomMachine: '',
      numeroSerie: '',
      dateAchat: '',
      date: '',
      employeId: '',
      notes: '',
    })
    setSerialCheck(null)
    setShowFormDialog(true)
  }

  const openEditDialog = (item: AfterSale) => {
    setEditingId(item.id)
    setFormData({
      clientId: item.clientId,
      type: item.type,
      statut: item.statut,
      marque: item.marque || 'none',
      nomMachine: item.nomMachine || '',
      numeroSerie: item.numeroSerie || '',
      dateAchat: item.dateAchat ? new Date(item.dateAchat).toISOString().split('T')[0] : '',
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
      employeId: item.employeId || '',
      notes: item.notes || '',
    })
    setSerialCheck(null)
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
        marque: (formData.marque && formData.marque !== 'none') ? formData.marque : null,
        nomMachine: formData.nomMachine.trim() || null,
        numeroSerie: formData.numeroSerie.trim() || null,
        dateAchat: formData.dateAchat || null,
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

  // ─── Rapport fournisseur ──────────────────────────────────────

  const copyReport = async () => {
    if (!reportItems) return
    try {
      await navigator.clipboard.writeText(buildReportText(reportItems))
      setCopied(true)
      toast({ title: 'Rapport copié', description: 'Le rapport a été copié dans le presse-papiers. Vous pouvez le coller dans un email ou un message.' })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
      toast({ title: 'Erreur', description: 'Impossible de copier le rapport.', variant: 'destructive' })
    }
  }

  const printReport = () => {
    if (!reportItems) return
    const w = window.open('', '_blank', 'width=820,height=940')
    if (!w) {
      toast({ title: 'Popup bloquée', description: 'Autorisez les popups pour imprimer le rapport, ou utilisez « Copier le rapport ».', variant: 'destructive' })
      return
    }
    w.document.open()
    w.document.write(buildReportHtml(reportItems))
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 350)
  }

  // ─── Computed ──────────────────────────────────────────────────

  const totalInterventions = afterSales.length
  const enAttente = afterSales.filter(a => a.statut === 'en_attente').length
  const enCours = afterSales.filter(a => a.statut === 'en_cours').length
  const terminees = afterSales.filter(a => a.statut === 'termine').length
  const savEnCours = afterSales.filter(a => a.type === 'sav' && a.statut === 'en_cours').length

  // Statistiques par marque (famille de produits)
  const interventionsParMarque = MARQUES
    .map(m => {
      const items = afterSales.filter(a => a.marque === m.value)
      return {
        ...m,
        total: items.length,
        terminees: items.filter(a => a.statut === 'termine').length,
        enCours: items.filter(a => a.statut === 'en_cours').length,
        enAttente: items.filter(a => a.statut === 'en_attente').length,
      }
    })
    .filter(m => m.total > 0)
    .sort((a, b) => b.total - a.total)
  const sansMarque = afterSales.filter(a => !a.marque).length
  const maxMarqueCount = Math.max(...interventionsParMarque.map(m => m.total), 1)

  const hasFilters = filterType !== 'all' || filterStatut !== 'all'

  // Recherche n° de série : résultats triés (plus récent en premier) + fiche machine
  const sortedSerialResults = [...serialResults].sort(
    (a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
  )
  const machineSummary = serialResults.length > 0
    ? (serialResults.find(i => i.nomMachine || i.marque || i.dateAchat) || serialResults[0])
    : null

  // Current after-sale being edited (for detail fields like creePar/modifiePar)
  const currentAfterSale = editingId ? afterSales.find(a => a.id === editingId) : null

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
              <img src="/logo.png" alt="MI HEALTH CARE" className="h-9 w-auto shrink-0 object-contain" />
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#134885] dark:text-white">
                  Après-vente
                </h1>
                <p className="text-xs text-muted-foreground">
                  Interventions après-vente
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Recherche par numéro de série */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={serialSearch}
                  onChange={e => setSerialSearch(e.target.value)}
                  placeholder="N° de série machine…"
                  className="h-9 w-[190px] pl-8 pr-8 text-xs"
                />
                {serialSearch && (
                  <button
                    onClick={() => setSerialSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                    title="Effacer la recherche"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
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
                className="gap-1.5 bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white shadow-lg shadow-[#134885]/25 hover:from-[#0D3A6E] hover:to-[#134885]"
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
        ) : serialSearched ? (
          /* ─── Panneau historique par n° de série ─── */
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-[#134885]/10 dark:bg-[#134885]/20">
                    {serialSearching ? (
                      <Loader2 className="size-4 animate-spin text-[#134885]" />
                    ) : (
                      <Hash className="size-4 text-[#134885] dark:text-[#F6852A]" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Historique machine — « {serialSearched} »
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {serialSearching
                        ? 'Recherche en cours…'
                        : serialResults.length > 0
                          ? `${serialResults.length} intervention${serialResults.length > 1 ? 's' : ''} enregistrée${serialResults.length > 1 ? 's' : ''} pour ce numéro de série`
                          : 'Aucune intervention trouvée pour ce numéro de série'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {serialResults.length > 0 && (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white hover:from-[#0D3A6E] hover:to-[#134885]"
                      onClick={() => setReportItems(serialResults)}
                    >
                      <FileText className="size-3.5" />
                      Rapport fournisseur
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setSerialSearch('')}>
                    <X className="size-3.5" />
                    Fermer
                  </Button>
                </div>
              </div>

              {!serialSearching && serialResults.length === 0 ? (
                <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
                  <CheckCircle2 className="size-8 text-emerald-500" />
                  <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                    Machine jamais prise en charge par le SAV
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Aucune intervention n&apos;a été enregistrée avec le numéro de série « {serialSearched} ».
                  </p>
                </div>
              ) : (
                <>
                  {/* Fiche machine (info la plus complète) */}
                  {machineSummary && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <User className="size-3" /> Client
                        </p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {machineSummary.client.nom}
                        </p>
                        {machineSummary.client.wilaya && (
                          <p className="text-xs text-muted-foreground">{machineSummary.client.wilaya}</p>
                        )}
                        {machineSummary.client.telephone && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="size-3" /> {machineSummary.client.telephone}
                          </p>
                        )}
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Cpu className="size-3" /> Machine
                        </p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {machineSummary.nomMachine || '—'}
                        </p>
                        {machineSummary.marque && (
                          <p className="text-xs text-muted-foreground">{machineSummary.marque}</p>
                        )}
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Hash className="size-3" /> Numéro de série
                        </p>
                        <p className="mt-0.5 truncate font-mono text-sm font-semibold text-slate-900 dark:text-white">
                          {machineSummary.numeroSerie || serialSearched}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <CalendarClock className="size-3" /> Achat (approx.)
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                          {machineSummary.dateAchat ? formatDate(machineSummary.dateAchat) : '—'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Historique chronologique */}
                  <div className="mt-5 space-y-2">
                    {sortedSerialResults.map((item) => {
                      const typeConfig = getTypeConfig(item.type)
                      const statutConfig = getStatutConfig(item.statut)
                      const marqueConfig = getMarqueConfig(item.marque)
                      const TypeIcon = typeConfig.icon
                      const StatutIcon = statutConfig.icon
                      return (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-slate-100 p-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                        >
                          <div className="w-24 shrink-0">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white">
                              {formatDate(item.date)}
                            </span>
                          </div>
                          <Badge variant="outline" className={`gap-1 text-xs font-medium ${typeConfig.color}`}>
                            <TypeIcon className="size-3" />
                            {typeConfig.label}
                          </Badge>
                          <Badge variant="outline" className={`gap-1 shrink-0 text-[10px] font-medium ${statutConfig.color}`}>
                            <StatutIcon className="size-3" />
                            {statutConfig.label}
                          </Badge>
                          {marqueConfig && (
                            <Badge
                              variant="outline"
                              className="shrink-0 text-[10px] font-semibold"
                              style={{
                                color: marqueConfig.color,
                                backgroundColor: marqueConfig.bg,
                                borderColor: `${marqueConfig.color}44`,
                              }}
                            >
                              {marqueConfig.label}
                            </Badge>
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-xs text-muted-foreground">
                              {item.client.nom}
                              {item.employe?.nom ? ` · ${item.employe.nom}` : ''}
                            </span>
                            {(item.nomMachine || item.numeroSerie) && (
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {item.nomMachine}
                                {item.nomMachine && item.numeroSerie ? ' · ' : ''}
                                {item.numeroSerie && <span className="font-mono">N° {item.numeroSerie}</span>}
                              </span>
                            )}
                            {item.notes && (
                              <span className="line-clamp-1 block text-[11px] text-muted-foreground">{item.notes}</span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 shrink-0 p-0 text-[#134885]"
                            title="Rapport fournisseur de cette intervention"
                            onClick={() => setReportItems([item])}
                          >
                            <FileText className="size-3.5" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Wrench className="size-3.5 text-[#134885]" />
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
                  <p className="mt-1 text-xl font-bold text-[#134885] dark:text-[#F6852A]">
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

            {/* Statistiques par marque (famille de produits) */}
            {interventionsParMarque.length > 0 && (
              <Card className="mb-6 border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Package className="size-4 text-[#134885] dark:text-[#F6852A]" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Interventions par marque
                    </h3>
                    {sansMarque > 0 && (
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {sansMarque} intervention{sansMarque > 1 ? 's' : ''} sans marque
                      </span>
                    )}
                  </div>
                  <div className="space-y-2.5">
                    {interventionsParMarque.map((m) => (
                      <div key={m.value} className="flex items-center gap-3">
                        <span
                          className="w-28 shrink-0 truncate text-xs font-medium"
                          style={{ color: m.color }}
                          title={m.label}
                        >
                          {m.label}
                        </span>
                        <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                          <div
                            className="flex h-full items-center justify-end rounded-md pr-2 transition-all"
                            style={{
                              width: `${Math.max((m.total / maxMarqueCount) * 100, 8)}%`,
                              backgroundColor: `${m.color}22`,
                              borderRight: `3px solid ${m.color}`,
                            }}
                          >
                            <span
                              className="text-[11px] font-bold"
                              style={{ color: m.color }}
                            >
                              {m.total}
                            </span>
                          </div>
                        </div>
                        <span className="w-40 shrink-0 text-[10px] text-muted-foreground">
                          {m.terminees} terminée{m.terminees > 1 ? 's' : ''} · {m.enCours} en cours · {m.enAttente} en attente
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* After-Sales List */}
            {afterSales.length === 0 ? (
              <EmptyState hasFilters={hasFilters} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {afterSales.map((item) => {
                    const typeConfig = getTypeConfig(item.type)
                    const statutConfig = getStatutConfig(item.statut)
                    const marqueConfig = getMarqueConfig(item.marque)
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
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                <Badge variant="outline" className={`gap-1.5 text-xs font-medium ${typeConfig.color}`}>
                                  <TypeIcon className="size-3" />
                                  {typeConfig.label}
                                </Badge>
                                {marqueConfig && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-semibold border"
                                    style={{
                                      color: marqueConfig.color,
                                      backgroundColor: marqueConfig.bg,
                                      borderColor: `${marqueConfig.color}44`,
                                    }}
                                  >
                                    {marqueConfig.label}
                                  </Badge>
                                )}
                              </div>
                              <Badge variant="outline" className={`gap-1 shrink-0 text-[10px] font-medium ${statutConfig.color}`}>
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

                            {/* Machine */}
                            {item.nomMachine && (
                              <div className="mb-2 flex items-center gap-2">
                                <Cpu className="size-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate text-xs text-muted-foreground">
                                  {item.nomMachine}
                                </span>
                              </div>
                            )}
                            {item.numeroSerie && (
                              <div className="mb-2 flex items-center gap-2">
                                <Hash className="size-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate font-mono text-xs text-muted-foreground">
                                  N° {item.numeroSerie}
                                </span>
                              </div>
                            )}
                            {item.dateAchat && (
                              <div className="mb-2 flex items-center gap-2">
                                <CalendarClock className="size-3.5 text-muted-foreground shrink-0" />
                                <span className="text-xs text-muted-foreground">
                                  Achat (approx.) : {formatDate(item.dateAchat)}
                                </span>
                              </div>
                            )}

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
                                className="h-7 gap-1.5 px-2 text-xs text-slate-600 hover:text-[#134885] dark:text-slate-400 dark:hover:text-[#F6852A]"
                                onClick={() => openEditDialog(item)}
                              >
                                <Edit3 className="size-3" />
                                Modifier
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-[#134885]"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedAfterSaleForInteraction(item)
                                  setShowAddInteractionDialog(true)
                                }}
                                title="Ajouter une interaction"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
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
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#134885]/10 dark:bg-[#134885]/20">
                <Wrench className="size-4 text-[#134885] dark:text-[#F6852A]" />
              </div>
              {editingId ? 'Modifier l\'intervention' : 'Nouvelle intervention'}
            </DialogTitle>
            <DialogDescription>
              {editingId ? 'Modifiez les informations de l\'intervention.' : 'Créez une nouvelle intervention après-vente.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Section: Intervention */}
            <div className="flex items-center gap-2 pt-2">
              <div className="h-5 w-1 rounded-full bg-[#134885]" />
              <h3 className="text-sm font-semibold text-slate-700">Intervention</h3>
            </div>

            {/* Client */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Client <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Select
                value={formData.clientId}
                onValueChange={v => setFormData(f => ({ ...f, clientId: v }))}
              >
                <SelectTrigger className="w-full bg-white">
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
                <SelectTrigger className="w-full bg-white">
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
                <SelectTrigger className="w-full bg-white">
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

            {/* Marque (famille de produits) */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Famille (Marque)
              </Label>
              <Select
                value={formData.marque}
                onValueChange={v => setFormData(f => ({ ...f, marque: v }))}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Sélectionner une marque" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">Non renseignée</span>
                  </SelectItem>
                  {MARQUES.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{ backgroundColor: m.color }}
                        />
                        {m.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section: Machine concernée */}
            <div className="flex items-center gap-2 pt-2">
              <div className="h-5 w-1 rounded-full bg-[#134885]" />
              <h3 className="text-sm font-semibold text-slate-700">Machine concernée</h3>
            </div>

            {/* Nom de la machine */}
            <div className="space-y-1.5">
              <Label className="text-sm">Nom de la machine</Label>
              <Input
                placeholder="Ex : Nebuliseur MIR NX-2000…"
                className="bg-white"
                value={formData.nomMachine}
                onChange={e => setFormData(f => ({ ...f, nomMachine: e.target.value }))}
              />
            </div>

            {/* Numéro de série + alerte historique */}
            <div className="space-y-1.5">
              <Label className="text-sm">Numéro de série</Label>
              <Input
                placeholder="Ex : SN-2024-ABC123…"
                className="bg-white font-mono"
                value={formData.numeroSerie}
                onChange={e => setFormData(f => ({ ...f, numeroSerie: e.target.value }))}
              />
              {serialCheck && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs dark:border-amber-900/50 dark:bg-amber-950/30">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="min-w-0">
                    <p className="font-medium text-amber-800 dark:text-amber-300">
                      Cette machine a déjà subi {serialCheck.length} intervention{serialCheck.length > 1 ? 's' : ''}
                    </p>
                    <p className="mt-0.5 text-amber-700/80 dark:text-amber-400/80">
                      {serialCheck
                        .slice(0, 3)
                        .map(i => `${formatDate(i.date)} (${getTypeConfig(i.type).label})`)
                        .join(' · ')}
                      {serialCheck.length > 3 ? ` … +${serialCheck.length - 3}` : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Date d'achat approximative */}
            <div className="space-y-1.5">
              <Label className="text-sm">Date d&apos;achat (approximative)</Label>
              <Input
                type="date"
                className="bg-white"
                value={formData.dateAchat}
                onChange={e => setFormData(f => ({ ...f, dateAchat: e.target.value }))}
              />
            </div>

            {/* Section: Planification */}
            <div className="flex items-center gap-2 pt-2">
              <div className="h-5 w-1 rounded-full bg-[#134885]" />
              <h3 className="text-sm font-semibold text-slate-700">Planification</h3>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-sm">Date</Label>
              <Input
                type="date"
                className="bg-white"
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
                <SelectTrigger className="w-full bg-white">
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

            {/* Section: Notes */}
            <div className="flex items-center gap-2 pt-2">
              <div className="h-5 w-1 rounded-full bg-[#134885]" />
              <h3 className="text-sm font-semibold text-slate-700">Notes</h3>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-sm">Notes</Label>
              <Textarea
                placeholder="Notes sur l'intervention..."
                className="bg-white"
                value={formData.notes}
                onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Section: Suivi (only when editing) */}
            {currentAfterSale && (
              <>
                <div className="flex items-center gap-2 pt-2">
                  <div className="h-5 w-1 rounded-full bg-[#134885]" />
                  <h3 className="text-sm font-semibold text-slate-700">Suivi</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                    <p className="text-xs text-muted-foreground">Créé par</p>
                    <p className="text-sm font-medium">{currentAfterSale.creePar?.nom || '—'}</p>
                  </div>
                  {currentAfterSale.modifiePar && (
                    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                      <p className="text-xs text-muted-foreground">Modifié par</p>
                      <p className="text-sm font-medium">{currentAfterSale.modifiePar.nom}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)} disabled={saving}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.clientId}
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

      {/* ─── Rapport fournisseur ────────────────────────────────── */}
      <Dialog open={!!reportItems} onOpenChange={(open) => { if (!open) setReportItems(null) }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#134885]/10 dark:bg-[#134885]/20">
                <FileText className="size-4 text-[#134885] dark:text-[#F6852A]" />
              </div>
              Rapport fournisseur
            </DialogTitle>
            <DialogDescription>
              Aperçu du rapport à envoyer au fournisseur
              {reportItems ? ` (${reportItems.length} intervention${reportItems.length > 1 ? 's' : ''})` : ''}.
            </DialogDescription>
          </DialogHeader>

          {reportItems && (
            <pre className="max-h-[50dvh] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 font-mono text-[11px] leading-relaxed text-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {buildReportText(reportItems)}
            </pre>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReportItems(null)}>
              Fermer
            </Button>
            <Button variant="outline" onClick={copyReport} className="gap-1.5">
              {copied ? (
                <CheckCircle2 className="size-4 text-emerald-500" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? 'Copié !' : 'Copier le rapport'}
            </Button>
            <Button
              onClick={printReport}
              className="gap-1.5 bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white hover:from-[#0D3A6E] hover:to-[#134885]"
            >
              <Printer className="size-4" />
              Imprimer / PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Interaction Dialog */}
      <AddInteractionDialog
        open={showAddInteractionDialog}
        onOpenChange={setShowAddInteractionDialog}
        afterSaleId={selectedAfterSaleForInteraction?.id}
        prospectId={selectedAfterSaleForInteraction?.clientId}
        contextLabel={selectedAfterSaleForInteraction?.client?.nom || 'ce SAV'}
        onSuccess={() => {
          fetchAfterSales()
        }}
      />
    </div>
  )
}
