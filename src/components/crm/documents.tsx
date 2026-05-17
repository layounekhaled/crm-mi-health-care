'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { ModuleHeader } from '@/components/crm/module-header'
import { formatFileSize } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  FileText, Upload, Search, Filter, Send, Eye, Copy, Download,
  Trash2, Archive, Restore, Plus, X, Check, Loader2, FileUp,
  FolderOpen, Mail, History, ChevronDown, Lock, BookOpen
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { motion, AnimatePresence } from 'framer-motion'

// Types
interface DocumentRecord {
  id: string
  title: string
  description: string | null
  brand: string
  productName: string | null
  documentType: string
  fileUrl: string
  filePath: string
  fileName: string
  fileSize: number
  uploadedBy: string | null
  status: string
  createdAt: string
  updatedAt: string
  uploader: { id: string; nom: string } | null
}

interface DocumentSendRecord {
  id: string
  documentIds: string
  sentBy: string | null
  recipientType: string
  recipientId: string | null
  recipientEmail: string
  message: string | null
  sentAt: string
  status: string
  sender: { id: string; nom: string } | null
  prospect: { id: string; nom: string } | null
  documents: { id: string; title: string; brand: string }[]
}

interface ProspectOption {
  id: string
  nom: string
  email?: string | null
  telephone?: string | null
}

const BRANDS = ['MIR', 'BOS', 'Löwenstein', 'Yuwell', 'Gelenke', 'Autres']
const DOCUMENT_TYPES = [
  { value: 'catalogue', label: 'Catalogue' },
  { value: 'prospectus', label: 'Prospectus' },
  { value: 'fiche_technique', label: 'Fiche technique' },
  { value: 'formation', label: 'Formation' },
  { value: 'sav', label: 'SAV' },
  { value: 'autre', label: 'Autre' },
]

const BRAND_COLORS: Record<string, string> = {
  'MIR': 'bg-blue-100 text-blue-800',
  'BOS': 'bg-emerald-100 text-emerald-800',
  'Löwenstein': 'bg-violet-100 text-violet-800',
  'Yuwell': 'bg-amber-100 text-amber-800',
  'Gelenke': 'bg-rose-100 text-rose-800',
  'Autres': 'bg-slate-100 text-slate-800',
}

const TYPE_COLORS: Record<string, string> = {
  'catalogue': 'bg-indigo-100 text-indigo-800',
  'prospectus': 'bg-pink-100 text-pink-800',
  'fiche_technique': 'bg-cyan-100 text-cyan-800',
  'formation': 'bg-orange-100 text-orange-800',
  'sav': 'bg-red-100 text-red-800',
  'autre': 'bg-gray-100 text-gray-800',
}

export default function DocumentsModule() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  // State
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [sends, setSends] = useState<DocumentSendRecord[]>([])
  const [prospects, setProspects] = useState<ProspectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterBrand, setFilterBrand] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<string>('library')
  const [showArchived, setShowArchived] = useState(false)

  // Upload dialog
  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    title: '', description: '', brand: 'MIR', productName: '', documentType: 'catalogue'
  })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Edit dialog
  const [showEdit, setShowEdit] = useState(false)
  const [editingDoc, setEditingDoc] = useState<DocumentRecord | null>(null)
  const [editForm, setEditForm] = useState({
    title: '', description: '', brand: '', productName: '', documentType: '', status: ''
  })

  // Send dialog
  const [showSend, setShowSend] = useState(false)
  const [sendForm, setSendForm] = useState({
    recipientType: 'manual', recipientId: '', recipientEmail: '', message: ''
  })
  const [sending, setSending] = useState(false)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DocumentRecord | null>(null)

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterBrand !== 'all') params.set('brand', filterBrand)
      if (filterType !== 'all') params.set('documentType', filterType)
      if (searchQuery) params.set('search', searchQuery)
      if (showArchived) params.set('status', 'archived')
      params.set('limit', '100')

      const res = await fetch(`/api/documents?${params}`)
      const data = await res.json()
      if (data.data) setDocuments(data.data)
    } catch (error) {
      console.error('Fetch documents error:', error)
    }
  }, [filterBrand, filterType, searchQuery, showArchived])

  // Fetch sends history
  const fetchSends = useCallback(async () => {
    try {
      const res = await fetch('/api/documents/sends?limit=50')
      const data = await res.json()
      if (data.data) setSends(data.data)
    } catch (error) {
      console.error('Fetch sends error:', error)
    }
  }, [])

  // Fetch prospects for send dialog
  const fetchProspects = useCallback(async () => {
    try {
      const res = await fetch('/api/prospects?limit=500')
      const data = await res.json()
      if (data.prospects) {
        setProspects(data.prospects.map((p: any) => ({
          id: p.id, nom: p.nom, email: p.email, telephone: p.telephone
        })))
      }
    } catch {}
  }, [])

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchDocuments(), fetchSends(), fetchProspects()])
      setLoading(false)
    }
    load()
  }, [fetchDocuments, fetchSends, fetchProspects])

  // Refetch when filters change
  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Upload handler
  const handleUpload = async () => {
    if (!uploadFile || !uploadForm.title) {
      toast.error('Fichier et titre sont requis')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('title', uploadForm.title)
      formData.append('description', uploadForm.description)
      formData.append('brand', uploadForm.brand)
      formData.append('productName', uploadForm.productName)
      formData.append('documentType', uploadForm.documentType)

      const res = await fetch('/api/documents', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de l\'upload')
        return
      }

      toast.success('Document ajouté avec succès')
      setShowUpload(false)
      setUploadForm({ title: '', description: '', brand: 'MIR', productName: '', documentType: 'catalogue' })
      setUploadFile(null)
      fetchDocuments()
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error?.message || 'Erreur lors de l\'upload — vérifiez la connexion réseau')
    } finally {
      setUploading(false)
    }
  }

  // Edit handler
  const handleEdit = async () => {
    if (!editingDoc) return

    try {
      const res = await fetch(`/api/documents/${editingDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la modification')
        return
      }

      toast.success('Document modifié')
      setShowEdit(false)
      setEditingDoc(null)
      fetchDocuments()
    } catch {
      toast.error('Erreur lors de la modification')
    }
  }

  // Delete handler
  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      const res = await fetch(`/api/documents/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la suppression')
        return
      }

      toast.success('Document supprimé')
      setShowDeleteConfirm(false)
      setDeleteTarget(null)
      fetchDocuments()
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  // Archive/Restore handler
  const handleArchive = async (doc: DocumentRecord, newStatus: string) => {
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        toast.error('Erreur')
        return
      }

      toast.success(newStatus === 'archived' ? 'Document archivé' : 'Document restauré')
      fetchDocuments()
    } catch {
      toast.error('Erreur')
    }
  }

  // Send documents handler
  const handleSend = async () => {
    if (!sendForm.recipientEmail && sendForm.recipientType === 'manual') {
      toast.error('Email du destinataire requis')
      return
    }

    if (selectedIds.size === 0) {
      toast.error('Sélectionnez au moins un document')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/documents/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: Array.from(selectedIds),
          recipientType: sendForm.recipientType,
          recipientId: sendForm.recipientId || null,
          recipientEmail: sendForm.recipientEmail,
          message: sendForm.message || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de l\'envoi')
        return
      }

      toast.success(`${selectedIds.size} document(s) envoyé(s) avec succès`)
      setShowSend(false)
      setSendForm({ recipientType: 'manual', recipientId: '', recipientEmail: '', message: '' })
      setSelectedIds(new Set())
      fetchSends()
    } catch {
      toast.error('Erreur lors de l\'envoi')
    } finally {
      setSending(false)
    }
  }

  // Copy link
  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url)
    toast.success('Lien copié')
  }

  // Toggle selection
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  // Select all visible
  const selectAll = () => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(documents.map(d => d.id)))
    }
  }

  // Open edit dialog
  const openEdit = (doc: DocumentRecord) => {
    setEditingDoc(doc)
    setEditForm({
      title: doc.title,
      description: doc.description || '',
      brand: doc.brand,
      productName: doc.productName || '',
      documentType: doc.documentType,
      status: doc.status,
    })
    setShowEdit(true)
  }

  // Open send dialog
  const openSend = (docIds?: string[]) => {
    if (docIds && docIds.length > 0) {
      setSelectedIds(new Set(docIds))
    }
    if (selectedIds.size === 0 && !docIds) {
      toast.error('Sélectionnez au moins un document')
      return
    }
    setShowSend(true)
  }

  // Handle prospect selection for send
  const handleProspectSelect = (prospectId: string) => {
    const prospect = prospects.find(p => p.id === prospectId)
    setSendForm(prev => ({
      ...prev,
      recipientId: prospectId,
      recipientEmail: prospect?.email || prospect?.telephone || '',
    }))
  }

  const getTypeLabel = (type: string) => DOCUMENT_TYPES.find(t => t.value === type)?.label || type

  return (
    <div className="min-h-screen bg-slate-50">
      <ModuleHeader
        title="Documents"
        subtitle="Bibliothèque de documents PDF — MI HEALTH CARE"
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/documents/init-bucket', { method: 'POST' })
                    const data = await res.json()
                    if (res.ok) toast.success(data.message)
                    else toast.error(data.error)
                  } catch {
                    toast.error('Erreur initialisation bucket')
                  }
                }}
                variant="outline"
                size="sm"
                className="border-[#134885] text-[#134885] hover:bg-[#134885] hover:text-white"
              >
                <FolderOpen className="mr-1.5 h-4 w-4" />
                Init Stockage
              </Button>
            )}
            {isAdmin && (
              <Button
                onClick={() => setShowUpload(true)}
                className="bg-[#F6852A] hover:bg-[#e5761f] text-white"
                size="sm"
              >
                <Upload className="mr-1.5 h-4 w-4" />
                Ajouter
              </Button>
            )}
            {selectedIds.size > 0 && (
              <Button
                onClick={() => openSend()}
                className="bg-[#134885] hover:bg-[#0D3A6E] text-white"
                size="sm"
              >
                <Send className="mr-1.5 h-4 w-4" />
                Envoyer ({selectedIds.size})
              </Button>
            )}
          </div>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 bg-white shadow-sm">
            <TabsTrigger value="library" className="gap-1.5">
              <BookOpen className="h-4 w-4" />
              Bibliothèque
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-4 w-4" />
              Historique
            </TabsTrigger>
          </TabsList>

          {/* ====== LIBRARY TAB ====== */}
          <TabsContent value="library">
            {/* Filters bar */}
            <div className="mb-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Rechercher un document..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterBrand} onValueChange={setFilterBrand}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Marque" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les marques</SelectItem>
                  {BRANDS.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {DOCUMENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && (
                <Button
                  variant={showArchived ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowArchived(!showArchived)}
                  className={showArchived ? 'bg-slate-600' : ''}
                >
                  <Archive className="mr-1.5 h-4 w-4" />
                  {showArchived ? 'Voir actifs' : 'Archivés'}
                </Button>
              )}
            </div>

            {/* Selection bar */}
            {documents.length > 0 && (
              <div className="mb-3 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedIds.size === documents.length && documents.length > 0}
                    onCheckedChange={selectAll}
                  />
                  <span className="text-sm text-slate-500">
                    {selectedIds.size > 0 ? `${selectedIds.size} sélectionné(s)` : 'Tout sélectionner'}
                  </span>
                </div>
                {selectedIds.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-slate-500"
                  >
                    <X className="mr-1 h-3 w-3" />
                    Désélectionner
                  </Button>
                )}
              </div>
            )}

            {/* Documents grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-[#134885]" />
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <FileText className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-lg font-medium">Aucun document trouvé</p>
                <p className="text-sm mt-1">
                  {isAdmin ? 'Cliquez sur "Ajouter" pour uploader votre premier document' : 'Aucun document actif disponible'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <AnimatePresence>
                  {documents.map((doc) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`relative rounded-xl border bg-white p-4 shadow-sm transition-all hover:shadow-md ${
                        selectedIds.has(doc.id) ? 'border-[#F6852A] ring-2 ring-[#F6852A]/20' : 'border-slate-200'
                      } ${doc.status === 'archived' ? 'opacity-60' : ''}`}
                    >
                      {/* Selection checkbox */}
                      <div className="absolute top-3 left-3">
                        <Checkbox
                          checked={selectedIds.has(doc.id)}
                          onCheckedChange={() => toggleSelect(doc.id)}
                        />
                      </div>

                      {/* PDF icon */}
                      <div className="flex justify-center mt-2 mb-3">
                        <div className="flex h-16 w-14 items-center justify-center rounded-lg bg-red-50 border border-red-100">
                          <FileText className="h-8 w-8 text-red-500" />
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="text-sm font-semibold text-slate-800 text-center line-clamp-2 min-h-[2.5rem] mb-2">
                        {doc.title}
                      </h3>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1 justify-center mb-2">
                        <Badge variant="secondary" className={`text-[10px] ${BRAND_COLORS[doc.brand] || ''}`}>
                          {doc.brand}
                        </Badge>
                        <Badge variant="secondary" className={`text-[10px] ${TYPE_COLORS[doc.documentType] || ''}`}>
                          {getTypeLabel(doc.documentType)}
                        </Badge>
                      </div>

                      {/* Product name */}
                      {doc.productName && (
                        <p className="text-xs text-slate-500 text-center mb-2 truncate">
                          {doc.productName}
                        </p>
                      )}

                      {/* File info */}
                      <p className="text-[10px] text-slate-400 text-center mb-3">
                        {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => window.open(doc.fileUrl, '_blank')}
                          title="Voir"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => copyLink(doc.fileUrl)}
                          title="Copier le lien"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            const a = document.createElement('a')
                            a.href = doc.fileUrl
                            a.download = doc.fileName
                            a.click()
                          }}
                          title="Télécharger"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-[#134885]"
                          onClick={() => openSend([doc.id])}
                          title="Envoyer"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <ChevronDown className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(doc)}>
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleArchive(doc, doc.status === 'active' ? 'archived' : 'active')}>
                                {doc.status === 'active' ? 'Archiver' : 'Restaurer'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => { setDeleteTarget(doc); setShowDeleteConfirm(true) }}
                              >
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          {/* ====== HISTORY TAB ====== */}
          <TabsContent value="history">
            {sends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Mail className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-lg font-medium">Aucun envoi enregistré</p>
                <p className="text-sm mt-1">Les envois de documents apparaîtront ici</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sends.map((send) => (
                  <div key={send.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Send className="h-4 w-4 text-[#134885] shrink-0" />
                          <span className="text-sm font-medium text-slate-800 truncate">
                            {send.sender?.nom || 'Inconnu'}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="text-sm text-slate-600 truncate">
                            {send.prospect?.nom || send.recipientEmail}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-1">
                          {send.documents.map((doc) => (
                            <Badge key={doc.id} variant="secondary" className="text-[10px]">
                              {doc.title} ({doc.brand})
                            </Badge>
                          ))}
                        </div>
                        {send.message && (
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1">{send.message}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] text-slate-400">
                          {new Date(send.sentAt).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                        <Badge
                          variant={send.status === 'sent' ? 'default' : 'destructive'}
                          className="text-[10px] mt-1"
                        >
                          {send.status === 'sent' ? 'Envoyé' : 'Échoué'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ====== UPLOAD DIALOG ====== */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-[#F6852A]" />
              Ajouter un document
            </DialogTitle>
            <DialogDescription>
              Uploadez un fichier PDF vers la bibliothèque
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* File upload */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Fichier PDF *
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                {uploadFile && (
                  <span className="text-xs text-slate-500 shrink-0">
                    {formatFileSize(uploadFile.size)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">PDF uniquement, 20 MB max</p>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Titre *</label>
              <Input
                value={uploadForm.title}
                onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Catalogue MIR 2025"
              />
            </div>

            {/* Brand + Type row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Marque *</label>
                <Select value={uploadForm.brand} onValueChange={(v) => setUploadForm(prev => ({ ...prev, brand: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
                <Select value={uploadForm.documentType} onValueChange={(v) => setUploadForm(prev => ({ ...prev, documentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Product name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nom du produit</label>
              <Input
                value={uploadForm.productName}
                onChange={(e) => setUploadForm(prev => ({ ...prev, productName: e.target.value }))}
                placeholder="Optionnel"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <Textarea
                value={uploadForm.description}
                onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optionnel"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Annuler</Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !uploadFile || !uploadForm.title}
              className="bg-[#F6852A] hover:bg-[#e5761f] text-white"
            >
              {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              {uploading ? 'Upload en cours...' : 'Uploader'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== EDIT DIALOG ====== */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le document</DialogTitle>
            <DialogDescription>
              Modifiez les informations du document
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Titre</label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Marque</label>
                <Select value={editForm.brand} onValueChange={(v) => setEditForm(prev => ({ ...prev, brand: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <Select value={editForm.documentType} onValueChange={(v) => setEditForm(prev => ({ ...prev, documentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nom du produit</label>
              <Input
                value={editForm.productName}
                onChange={(e) => setEditForm(prev => ({ ...prev, productName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Statut</label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm(prev => ({ ...prev, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="archived">Archivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Annuler</Button>
            <Button onClick={handleEdit} className="bg-[#134885] hover:bg-[#0D3A6E] text-white">
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== SEND DIALOG ====== */}
      <Dialog open={showSend} onOpenChange={setShowSend}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-[#134885]" />
              Envoyer des documents
            </DialogTitle>
            <DialogDescription>
              {selectedIds.size} document(s) sélectionné(s) — les liens seront envoyés par email
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Selected docs preview */}
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <p className="text-xs font-medium text-slate-500 mb-2">Documents sélectionnés :</p>
              <div className="flex flex-wrap gap-1">
                {documents
                  .filter(d => selectedIds.has(d.id))
                  .map(doc => (
                    <Badge key={doc.id} variant="secondary" className="text-[10px]">
                      {doc.title} ({doc.brand})
                    </Badge>
                  ))}
              </div>
            </div>

            {/* Recipient type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Destinataire</label>
              <Select
                value={sendForm.recipientType}
                onValueChange={(v) => setSendForm(prev => ({ ...prev, recipientType: v, recipientId: '', recipientEmail: '' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Email manuel</SelectItem>
                  <SelectItem value="prospect">Prospect existant</SelectItem>
                  <SelectItem value="client">Client existant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prospect/Client selection */}
            {(sendForm.recipientType === 'prospect' || sendForm.recipientType === 'client') && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {sendForm.recipientType === 'prospect' ? 'Prospect' : 'Client'}
                </label>
                <Select value={sendForm.recipientId} onValueChange={handleProspectSelect}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent className="max-h-48">
                    {prospects
                      .filter(p => sendForm.recipientType === 'client' ? true : true)
                      .map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nom}{p.email ? ` (${p.email})` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Email field */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email du destinataire *</label>
              <Input
                type="email"
                value={sendForm.recipientEmail}
                onChange={(e) => setSendForm(prev => ({ ...prev, recipientEmail: e.target.value }))}
                placeholder="email@exemple.com"
                readOnly={sendForm.recipientType !== 'manual'}
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Message (optionnel)</label>
              <Textarea
                value={sendForm.message}
                onChange={(e) => setSendForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Ajoutez un message personnel..."
                rows={3}
              />
            </div>

            <p className="text-[11px] text-amber-600 flex items-start gap-1.5">
              <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Les documents seront envoyés sous forme de liens publics (pas en pièce jointe). L'email reste léger et rapide.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSend(false)}>Annuler</Button>
            <Button
              onClick={handleSend}
              disabled={sending || !sendForm.recipientEmail}
              className="bg-[#134885] hover:bg-[#0D3A6E] text-white"
            >
              {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              {sending ? 'Envoi en cours...' : 'Envoyer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== DELETE CONFIRM DIALOG ====== */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer le document ?</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Le fichier sera supprimé du stockage.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="rounded-lg bg-red-50 p-3 border border-red-200">
              <p className="text-sm font-medium text-red-800">{deleteTarget.title}</p>
              <p className="text-xs text-red-600">{deleteTarget.fileName} • {formatFileSize(deleteTarget.fileSize)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
