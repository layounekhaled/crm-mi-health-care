'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useCRMStore } from '@/lib/store'
import { ModuleHeader } from '@/components/crm/module-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  Mail,
  Send,
  Inbox,
  FileText,
  Trash2,
  RefreshCw,
  Settings,
  Search,
  Star,
  Paperclip,
  Reply,
  Forward,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  AlertCircle,
  Check,
  X,
  Eye,
} from 'lucide-react'

interface EmailConfig {
  employeId: string
  email: string
  imapHost: string
  imapPort: number
  imapTls: boolean
  smtpHost: string
  smtpPort: number
  smtpTls: boolean
  isConfigured: boolean
}

interface EmailFolder {
  name: string
  path: string
  count: number
  unseen: number
  specialUse: string
}

interface EmailEnvelope {
  date: string
  subject: string | null
  from: { name: string; address: string }[]
  to: { name: string; address: string }[]
  cc?: { name: string; address: string }[]
  messageId: string
  inReplyTo?: string
}

interface EmailMessage {
  uid: number
  flags: string[]
  envelope: EmailEnvelope
}

interface EmailDetail {
  uid: number
  flags: string[]
  envelope: EmailEnvelope
  textContent: string
  htmlContent: string
  isHtml: boolean
}

// Presets de configuration pour les fournisseurs courants
const emailPresets: Record<string, Partial<EmailConfig>> = {
  gmail: { imapHost: 'imap.gmail.com', imapPort: 993, imapTls: true, smtpHost: 'smtp.gmail.com', smtpPort: 587, smtpTls: true },
  outlook: { imapHost: 'outlook.office365.com', imapPort: 993, imapTls: true, smtpHost: 'smtp.office365.com', smtpPort: 587, smtpTls: true },
  yahoo: { imapHost: 'imap.mail.yahoo.com', imapPort: 993, imapTls: true, smtpHost: 'smtp.mail.yahoo.com', smtpPort: 587, smtpTls: true },
  custom: {},
}

function getFolderIcon(specialUse: string, path: string) {
  if (specialUse === '\\Inbox' || path === 'INBOX') return <Inbox className="h-4 w-4" />
  if (specialUse === '\\Sent') return <Send className="h-4 w-4" />
  if (specialUse === '\\Drafts') return <FileText className="h-4 w-4" />
  if (specialUse === '\\Trash') return <Trash2 className="h-4 w-4" />
  if (specialUse === '\\Junk' || specialUse === '\\Spam') return <AlertCircle className="h-4 w-4" />
  if (specialUse === '\\Flagged' || specialUse === '\\Starred') return <Star className="h-4 w-4" />
  return <FolderOpen className="h-4 w-4" />
}

function getFolderLabel(path: string) {
  if (path === 'INBOX') return 'Boîte de réception'
  if (path === 'Sent' || path === 'Sent Messages' || path === 'Envoyés') return 'Envoyés'
  if (path === 'Drafts' || path === 'Brouillons') return 'Brouillons'
  if (path === 'Trash' || path === 'Corbeille') return 'Corbeille'
  if (path === 'Junk' || path === 'Spam' || path === 'Indésirables') return 'Indésirables'
  if (path === 'Flagged' || path === 'Starred' || path === 'Favoris') return 'Favoris'
  return path
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffDays < 1) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    if (diffDays < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' })
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

function extractSenderName(from: { name: string; address: string }[]) {
  if (!from || from.length === 0) return 'Inconnu'
  const sender = from[0]
  if (sender.name) return sender.name
  return sender.address?.split('@')[0] || 'Inconnu'
}

function extractEmailAddress(from: { name: string; address: string }[]) {
  if (!from || from.length === 0) return ''
  return from.map((f) => f.name ? `${f.name} <${f.address}>` : f.address).join(', ')
}

export default function EmailsModule() {
  const { user } = useAuth()
  const { currentUser } = useCRMStore()
  const employeId = user?.employeId || currentUser?.employeId

  const [config, setConfig] = useState<EmailConfig | null>(null)
  const [folders, setFolders] = useState<EmailFolder[]>([])
  const [selectedFolder, setSelectedFolder] = useState('INBOX')
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [selectedMessage, setSelectedMessage] = useState<EmailDetail | null>(null)
  const [isLoadingFolders, setIsLoadingFolders] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLoadingMessage, setIsLoadingMessage] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [showCompose, setShowCompose] = useState(false)

  // Config form state
  const [configForm, setConfigForm] = useState({
    email: '',
    imapHost: '',
    imapPort: 993,
    imapTls: true,
    smtpHost: '',
    smtpPort: 587,
    smtpTls: true,
    emailPassword: '',
    preset: 'custom',
  })

  // Compose form state
  const [composeForm, setComposeForm] = useState({
    to: '',
    cc: '',
    subject: '',
    text: '',
  })

  // Fetch email config
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/emails/config', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
        if (data.email) {
          setConfigForm((prev) => ({
            ...prev,
            email: data.email,
            imapHost: data.imapHost || '',
            imapPort: data.imapPort || 993,
            imapTls: data.imapTls !== false,
            smtpHost: data.smtpHost || '',
            smtpPort: data.smtpPort || 587,
            smtpTls: data.smtpTls !== false,
          }))
        }
      }
    } catch (err) {
      console.error('[EMAILS] Erreur fetch config:', err)
    }
  }, [])

  // Fetch folders
  const fetchFolders = useCallback(async () => {
    if (!config?.isConfigured) return
    setIsLoadingFolders(true)
    try {
      const res = await fetch('/api/emails/folders', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setFolders(data.folders || [])
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error('Erreur', { description: err.error || 'Impossible de charger les dossiers' })
      }
    } catch (err) {
      console.error('[EMAILS] Erreur fetch folders:', err)
    } finally {
      setIsLoadingFolders(false)
    }
  }, [config?.isConfigured])

  // Fetch messages in a folder
  const fetchMessages = useCallback(async (folder: string, search?: string) => {
    if (!config?.isConfigured) return
    setIsLoadingMessages(true)
    try {
      const params = new URLSearchParams({ folder })
      if (search) params.set('search', search)
      const res = await fetch(`/api/emails/inbox?${params}`, { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error('Erreur', { description: err.error || 'Impossible de charger les emails' })
      }
    } catch (err) {
      console.error('[EMAILS] Erreur fetch messages:', err)
    } finally {
      setIsLoadingMessages(false)
    }
  }, [config?.isConfigured])

  // Fetch a specific message
  const fetchMessage = async (uid: number, folder: string) => {
    setIsLoadingMessage(true)
    try {
      const res = await fetch(
        `/api/emails/message?uid=${uid}&folder=${encodeURIComponent(folder)}`,
        { credentials: 'same-origin' }
      )
      if (res.ok) {
        const data = await res.json()
        setSelectedMessage(data)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error('Erreur', { description: err.error || 'Impossible de lire le message' })
      }
    } catch (err) {
      console.error('[EMAILS] Erreur fetch message:', err)
    } finally {
      setIsLoadingMessage(false)
    }
  }

  // Save config
  const saveConfig = async () => {
    try {
      const res = await fetch('/api/emails/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(configForm),
      })
      if (res.ok) {
        const data = await res.json()
        setConfig({ ...data, isConfigured: true })
        toast.success('Configuration sauvegardée', { description: 'Votre boîte email est connectée' })
        setShowConfig(false)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error('Erreur', { description: err.error || 'Impossible de sauvegarder la configuration' })
      }
    } catch (err) {
      toast.error('Erreur réseau')
    }
  }

  // Send email
  const sendEmail = async () => {
    if (!composeForm.to || !composeForm.subject) {
      toast.error('Champs requis', { description: 'Destinataire et sujet sont obligatoires' })
      return
    }
    setIsSending(true)
    try {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(composeForm),
      })
      if (res.ok) {
        toast.success('Email envoyé', { description: `À ${composeForm.to}` })
        setShowCompose(false)
        setComposeForm({ to: '', cc: '', subject: '', text: '' })
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error("Erreur d'envoi", { description: err.error || err.details || 'Impossible d\'envoyer l\'email' })
      }
    } catch (err) {
      toast.error('Erreur réseau')
    } finally {
      setIsSending(false)
    }
  }

  // Delete email
  const deleteEmail = async (uid: number) => {
    try {
      const res = await fetch('/api/emails/message', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ folder: selectedFolder, uid }),
      })
      if (res.ok) {
        toast.success('Email supprimé')
        setSelectedMessage(null)
        fetchMessages(selectedFolder, searchQuery || undefined)
        fetchFolders()
      }
    } catch (err) {
      toast.error('Erreur de suppression')
    }
  }

  // Reply to email
  const replyToEmail = (email: EmailDetail) => {
    const sender = email.envelope.from?.[0]
    const replyTo = sender ? (sender.name ? `${sender.name} <${sender.address}>` : sender.address) : ''
    const subject = email.envelope.subject?.startsWith('Re:') ? email.envelope.subject : `Re: ${email.envelope.subject || ''}`
    setComposeForm({
      to: replyTo,
      cc: '',
      subject,
      text: `\n\n--- Message original ---\nDe: ${extractEmailAddress(email.envelope.from)}\nDate: ${email.envelope.date}\n\n${email.textContent || ''}`,
    })
    setShowCompose(true)
  }

  // Forward email
  const forwardEmail = (email: EmailDetail) => {
    setComposeForm({
      to: '',
      cc: '',
      subject: email.envelope.subject?.startsWith('Fwd:') ? email.envelope.subject : `Fwd: ${email.envelope.subject || ''}`,
      text: `\n\n--- Message transféré ---\nDe: ${extractEmailAddress(email.envelope.from)}\nDate: ${email.envelope.date}\n\n${email.textContent || ''}`,
    })
    setShowCompose(true)
  }

  // Initial load
  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  // Load folders when config is ready
  useEffect(() => {
    if (config?.isConfigured) {
      fetchFolders()
    }
  }, [config?.isConfigured, fetchFolders])

  // Load messages when folder changes
  useEffect(() => {
    if (config?.isConfigured && selectedFolder) {
      fetchMessages(selectedFolder)
      setSelectedMessage(null)
    }
  }, [selectedFolder, config?.isConfigured, fetchMessages])

  // Handle preset change
  const handlePresetChange = (preset: string) => {
    const p = emailPresets[preset] || {}
    setConfigForm((prev) => ({
      ...prev,
      preset,
      imapHost: p.imapHost || '',
      imapPort: p.imapPort || 993,
      imapTls: p.imapTls !== false,
      smtpHost: p.smtpHost || '',
      smtpPort: p.smtpPort || 587,
      smtpTls: p.smtpTls !== false,
    }))
  }

  // Configuration setup screen
  if (!config?.isConfigured) {
    return (
      <div className="min-h-screen bg-slate-50">
        <ModuleHeader title="Emails" subtitle="Accédez à votre boîte email depuis le CRM" />
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#134885]/10">
                <Mail className="h-8 w-8 text-[#134885]" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Configurez votre email</h2>
              <p className="mt-2 text-sm text-slate-500 max-w-md">
                Connectez votre boîte email professionnelle pour lire et envoyer des messages directement depuis le CRM.
                Vos identifiants sont chiffrés et sécurisés.
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {/* Preset selector */}
              <div>
                <Label className="text-sm font-medium text-slate-700">Fournisseur email</Label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {[
                    { id: 'gmail', label: 'Gmail' },
                    { id: 'outlook', label: 'Outlook' },
                    { id: 'yahoo', label: 'Yahoo' },
                    { id: 'custom', label: 'Personnalisé' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handlePresetChange(p.id)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        configForm.preset === p.id
                          ? 'border-[#134885] bg-[#134885]/5 text-[#134885]'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">Adresse email</Label>
                <Input
                  value={configForm.email}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="votre@email.com"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">Mot de passe de l'application</Label>
                <Input
                  type="password"
                  value={configForm.emailPassword}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, emailPassword: e.target.value }))}
                  placeholder="Mot de passe d'application"
                  className="mt-1"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Utilisez un mot de passe d&apos;application (pas votre mot de passe habituel). Gmail : Paramètres &gt; Sécurité &gt; Mots de passe d&apos;application.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Serveur IMAP</Label>
                  <Input
                    value={configForm.imapHost}
                    onChange={(e) => setConfigForm((prev) => ({ ...prev, imapHost: e.target.value }))}
                    placeholder="imap.example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Port IMAP</Label>
                  <Input
                    type="number"
                    value={configForm.imapPort}
                    onChange={(e) => setConfigForm((prev) => ({ ...prev, imapPort: parseInt(e.target.value) || 993 }))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Serveur SMTP</Label>
                  <Input
                    value={configForm.smtpHost}
                    onChange={(e) => setConfigForm((prev) => ({ ...prev, smtpHost: e.target.value }))}
                    placeholder="smtp.example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Port SMTP</Label>
                  <Input
                    type="number"
                    value={configForm.smtpPort}
                    onChange={(e) => setConfigForm((prev) => ({ ...prev, smtpPort: parseInt(e.target.value) || 587 }))}
                    className="mt-1"
                  />
                </div>
              </div>

              <Button
                onClick={saveConfig}
                className="w-full bg-[#134885] hover:bg-[#0D3A6E]"
                disabled={!configForm.email || !configForm.imapHost || !configForm.smtpHost}
              >
                <Mail className="mr-2 h-4 w-4" />
                Connecter ma boîte email
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main email interface
  return (
    <div className="min-h-screen bg-slate-50">
      <ModuleHeader
        title="Emails"
        subtitle={config.email}
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                fetchFolders()
                fetchMessages(selectedFolder, searchQuery || undefined)
              }}
              variant="outline"
              size="sm"
              className="border-slate-200"
              disabled={isLoadingFolders || isLoadingMessages}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoadingFolders || isLoadingMessages ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Dialog open={showCompose} onOpenChange={setShowCompose}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-[#134885] hover:bg-[#0D3A6E]">
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Nouveau message
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nouveau message</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label className="text-sm font-medium">À</Label>
                    <Input
                      value={composeForm.to}
                      onChange={(e) => setComposeForm((prev) => ({ ...prev, to: e.target.value }))}
                      placeholder="destinataire@email.com"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Cc</Label>
                    <Input
                      value={composeForm.cc}
                      onChange={(e) => setComposeForm((prev) => ({ ...prev, cc: e.target.value }))}
                      placeholder="copie@email.com (optionnel)"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Sujet</Label>
                    <Input
                      value={composeForm.subject}
                      onChange={(e) => setComposeForm((prev) => ({ ...prev, subject: e.target.value }))}
                      placeholder="Sujet du message"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Message</Label>
                    <Textarea
                      value={composeForm.text}
                      onChange={(e) => setComposeForm((prev) => ({ ...prev, text: e.target.value }))}
                      placeholder="Écrivez votre message..."
                      rows={12}
                      className="resize-none"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="text-slate-400">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => setShowCompose(false)}>
                        Annuler
                      </Button>
                      <Button
                        onClick={sendEmail}
                        disabled={isSending || !composeForm.to || !composeForm.subject}
                        className="bg-[#134885] hover:bg-[#0D3A6E]"
                      >
                        {isSending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Envoyer
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              onClick={() => setShowConfig(true)}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-slate-600"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar: Folders */}
        <div className="w-56 shrink-0 border-r border-slate-200 bg-white">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  if (e.target.value.length >= 2 || e.target.value.length === 0) {
                    fetchMessages(selectedFolder, e.target.value || undefined)
                  }
                }}
                placeholder="Rechercher..."
                className="h-8 pl-8 text-xs border-slate-200"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="px-2 pb-2">
              {isLoadingFolders ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : (
                folders.map((folder) => (
                  <button
                    key={folder.path}
                    onClick={() => setSelectedFolder(folder.path)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      selectedFolder === folder.path
                        ? 'bg-[#134885]/10 text-[#134885] font-medium'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className={selectedFolder === folder.path ? 'text-[#134885]' : 'text-slate-400'}>
                      {getFolderIcon(folder.specialUse, folder.path)}
                    </span>
                    <span className="flex-1 truncate text-left">{getFolderLabel(folder.path)}</span>
                    {folder.unseen > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F6852A] px-1 text-[10px] font-bold text-white">
                        {folder.unseen}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Message List */}
        <div className={`shrink-0 border-r border-slate-200 bg-white transition-all ${selectedMessage ? 'w-80' : 'w-96'}`}>
          <div className="border-b border-slate-100 px-4 py-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">
                {getFolderLabel(selectedFolder)}
              </h3>
              <span className="text-xs text-slate-400">{messages.length} message{messages.length > 1 ? 's' : ''}</span>
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-130px)]">
            {isLoadingMessages ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#134885]" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 px-4">
                <Mail className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-400">Aucun message</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isUnread = !msg.flags.includes('\\Seen')
                const isSelected = selectedMessage?.uid === msg.uid
                return (
                  <button
                    key={msg.uid}
                    onClick={() => fetchMessage(msg.uid, selectedFolder)}
                    className={`flex w-full flex-col gap-1 border-b border-slate-50 px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? 'bg-[#134885]/5 border-l-2 border-l-[#134885]'
                        : isUnread
                          ? 'bg-white hover:bg-slate-50 border-l-2 border-l-[#F6852A]'
                          : 'bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${isUnread ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                        {extractSenderName(msg.envelope.from)}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {formatDate(msg.envelope.date)}
                      </span>
                    </div>
                    <p className={`truncate text-sm ${isUnread ? 'font-medium text-slate-800' : 'text-slate-500'}`}>
                      {msg.envelope.subject || '(Sans sujet)'}
                    </p>
                    {msg.flags.includes('\\Flagged') && (
                      <Star className="h-3 w-3 text-[#F6852A] fill-[#F6852A]" />
                    )}
                  </button>
                )
              })
            )}
          </ScrollArea>
        </div>

        {/* Message Detail */}
        <div className="flex-1 bg-white">
          {isLoadingMessage ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-[#134885]" />
            </div>
          ) : selectedMessage ? (
            <div className="flex h-full flex-col">
              {/* Message Header */}
              <div className="border-b border-slate-200 px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-slate-900">
                      {selectedMessage.envelope.subject || '(Sans sujet)'}
                    </h2>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-[#134885]/10 text-[10px] font-semibold text-[#134885]">
                            {extractSenderName(selectedMessage.envelope.from).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-medium text-slate-800">
                            {extractSenderName(selectedMessage.envelope.from)}
                          </span>
                          <span className="ml-1 text-slate-400 text-xs">
                            &lt;{selectedMessage.envelope.from?.[0]?.address}&gt;
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 pl-9">
                        À: {selectedMessage.envelope.to?.map((r) => r.address).join(', ')}
                      </div>
                      {selectedMessage.envelope.cc && selectedMessage.envelope.cc.length > 0 && (
                        <div className="text-xs text-slate-400 pl-9">
                          Cc: {selectedMessage.envelope.cc.map((r) => r.address).join(', ')}
                        </div>
                      )}
                      <div className="text-xs text-slate-400 pl-9">
                        {new Date(selectedMessage.envelope.date).toLocaleString('fr-FR', {
                          dateStyle: 'long',
                          timeStyle: 'short',
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-[#134885]"
                      onClick={() => replyToEmail(selectedMessage)}
                    >
                      <Reply className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-[#134885]"
                      onClick={() => forwardEmail(selectedMessage)}
                    >
                      <Forward className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-red-500"
                      onClick={() => deleteEmail(selectedMessage.uid)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Message Body */}
              <ScrollArea className="flex-1">
                <div className="p-6">
                  {selectedMessage.isHtml && selectedMessage.htmlContent ? (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: selectedMessage.htmlContent }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">
                      {selectedMessage.textContent || '(Aucun contenu)'}
                    </pre>
                  )}
                </div>
              </ScrollArea>

              {/* Quick Reply */}
              <div className="border-t border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Réponse rapide..."
                    className="h-9 flex-1 text-sm border-slate-200"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const target = e.target as HTMLInputElement
                        if (target.value.trim()) {
                          replyToEmail(selectedMessage)
                        }
                      }
                    }}
                    onFocus={(e) => {
                      if (!e.target.value) {
                        replyToEmail(selectedMessage)
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#134885]/30 text-[#134885] hover:bg-[#134885]/5"
                    onClick={() => replyToEmail(selectedMessage)}
                  >
                    <Reply className="h-3.5 w-3.5 mr-1" />
                    Répondre
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
              <Eye className="h-12 w-12 text-slate-200" />
              <p className="text-sm">Sélectionnez un message pour le lire</p>
            </div>
          )}
        </div>
      </div>

      {/* Config Dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configuration email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-sm font-medium">Adresse email</Label>
              <Input
                value={configForm.email}
                onChange={(e) => setConfigForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Mot de passe de l&apos;application</Label>
              <Input
                type="password"
                value={configForm.emailPassword}
                onChange={(e) => setConfigForm((prev) => ({ ...prev, emailPassword: e.target.value }))}
                placeholder="Laisser vide pour ne pas changer"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Serveur IMAP</Label>
                <Input
                  value={configForm.imapHost}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, imapHost: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Port IMAP</Label>
                <Input
                  type="number"
                  value={configForm.imapPort}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, imapPort: parseInt(e.target.value) || 993 }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Serveur SMTP</Label>
                <Input
                  value={configForm.smtpHost}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, smtpHost: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Port SMTP</Label>
                <Input
                  type="number"
                  value={configForm.smtpPort}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, smtpPort: parseInt(e.target.value) || 587 }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await fetch('/api/emails/config', { method: 'DELETE', credentials: 'same-origin' })
                  setConfig(null)
                  setShowConfig(false)
                  toast.success('Configuration supprimée')
                }}
              >
                Supprimer la config
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowConfig(false)}>Annuler</Button>
                <Button onClick={saveConfig} className="bg-[#134885] hover:bg-[#0D3A6E]">
                  Sauvegarder
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
