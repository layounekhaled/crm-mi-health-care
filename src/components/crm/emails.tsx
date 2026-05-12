'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useCRMStore } from '@/lib/store'
import { ModuleHeader } from '@/components/crm/module-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  FolderOpen,
  AlertCircle,
  Check,
  X,
  Eye,
  EyeOff,
  Shield,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronsUpDown,
  MoreHorizontal,
  ArrowRight,
  Archive,
} from 'lucide-react'
import DOMPurify from 'isomorphic-dompurify'
import QuillEmailEditor, { SignatureEditor } from '@/components/crm/quill-email-editor'

// ─── Interfaces ───────────────────────────────────────────────

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
  signature?: string
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

interface BodyStructurePart {
  type: string
  disposition?: string
  filename?: string
  childNodes?: BodyStructurePart[]
  [key: string]: unknown
}

interface EmailMessage {
  uid: number
  flags: string[] | Set<string>
  envelope: EmailEnvelope
  bodyStructure?: BodyStructurePart
}

interface EmailDetail {
  uid: number
  flags: string[] | Set<string>
  envelope: EmailEnvelope
  textContent: string
  htmlContent: string
  isHtml: boolean
}

// ─── Helper: normalize flags (Set or Array → Array) ──────────

function normalizeFlags(flags: string[] | Set<string> | undefined | null): string[] {
  if (!flags) return []
  if (Array.isArray(flags)) return flags
  if (flags instanceof Set) return [...flags]
  return []
}

function hasFlag(flags: string[] | Set<string> | undefined | null, flag: string): boolean {
  return normalizeFlags(flags).includes(flag)
}

// ─── Presets ──────────────────────────────────────────────────

const emailPresets: Record<string, Partial<EmailConfig> & { helpUrl?: string; helpText?: string }> = {
  gmail: {
    imapHost: 'imap.gmail.com', imapPort: 993, imapTls: true,
    smtpHost: 'smtp.gmail.com', smtpPort: 587, smtpTls: true,
    helpText: 'Gmail nécessite un "Mot de passe d\'application". Allez dans : Paramètres Google → Sécurité → Validation en deux étapes (activée) → Mots de passe d\'application → Créez-en un pour "Mail".',
  },
  outlook: {
    imapHost: 'outlook.office365.com', imapPort: 993, imapTls: true,
    smtpHost: 'smtp.office365.com', smtpPort: 587, smtpTls: true,
    helpText: 'Outlook/Office 365 : Utilisez votre mot de passe habituel. Si l\'authentification à deux facteurs est activée, créez un mot de passe d\'application.',
  },
  yahoo: {
    imapHost: 'imap.mail.yahoo.com', imapPort: 993, imapTls: true,
    smtpHost: 'smtp.mail.yahoo.com', smtpPort: 587, smtpTls: true,
    helpText: 'Yahoo nécessite un "Mot de passe d\'application". Allez dans : Paramètres du compte → Sécurité → Mots de passe d\'application.',
  },
  lws: {
    imapHost: 'mail.wistyty.com', imapPort: 993, imapTls: true,
    smtpHost: 'mail.wistyty.com', smtpPort: 587, smtpTls: true,
    helpText: 'Hébergement LWS Panel : Utilisez le mot de passe de votre compte de messagerie. IMAP port 993 (SSL), SMTP port 587 (STARTTLS). Vous pouvez aussi utiliser mail67.lwspanel.com comme serveur.',
  },
  custom: {},
}

// ─── UI Helpers ───────────────────────────────────────────────

function getFolderIcon(specialUse: string, path: string) {
  if (specialUse === '\\Inbox' || path === 'INBOX') return <Inbox className="h-4 w-4" />
  if (specialUse === '\\Sent') return <Send className="h-4 w-4" />
  if (specialUse === '\\Drafts') return <FileText className="h-4 w-4" />
  if (specialUse === '\\Trash') return <Trash2 className="h-4 w-4" />
  if (specialUse === '\\Junk' || specialUse === '\\Spam') return <AlertCircle className="h-4 w-4" />
  if (specialUse === '\\Flagged' || specialUse === '\\Starred') return <Star className="h-4 w-4" />
  if (specialUse === '\\Archive') return <Archive className="h-4 w-4" />
  // Fallback basé sur le chemin (support LWS/Dovecot français)
  const lowerPath = path.toLowerCase()
  if (lowerPath.includes('sent') || lowerPath.includes('envoy') || lowerPath.includes('éléments envoyés')) return <Send className="h-4 w-4" />
  if (lowerPath.includes('draft') || lowerPath.includes('brouillon')) return <FileText className="h-4 w-4" />
  if (lowerPath.includes('trash') || lowerPath.includes('corbeille') || lowerPath.includes('deleted') || lowerPath.includes('poubelle')) return <Trash2 className="h-4 w-4" />
  if (lowerPath.includes('junk') || lowerPath.includes('spam') || lowerPath.includes('indésirable') || lowerPath.includes('courrier indésirable')) return <AlertCircle className="h-4 w-4" />
  if (lowerPath.includes('flagged') || lowerPath.includes('starred') || lowerPath.includes('favori')) return <Star className="h-4 w-4" />
  if (lowerPath.includes('archive') || lowerPath.includes('all mail') || lowerPath.includes('tous les messages')) return <Archive className="h-4 w-4" />
  return <FolderOpen className="h-4 w-4" />
}

function getFolderLabel(path: string) {
  if (path === 'INBOX') return 'Boîte de réception'
  // Utiliser des correspondances partielles insensibles à la casse pour supporter LWS/Dovecot
  const lowerPath = path.toLowerCase()
  if (lowerPath.includes('sent') || lowerPath.includes('envoy') || lowerPath.includes('éléments envoyés')) return 'Envoyés'
  if (lowerPath.includes('draft') || lowerPath.includes('brouillon')) return 'Brouillons'
  if (lowerPath.includes('trash') || lowerPath.includes('corbeille') || lowerPath.includes('deleted') || lowerPath.includes('poubelle')) return 'Corbeille'
  if (lowerPath.includes('junk') || lowerPath.includes('spam') || lowerPath.includes('indésirable') || lowerPath.includes('courrier indésirable')) return 'Indésirables'
  if (lowerPath.includes('flagged') || lowerPath.includes('starred') || lowerPath.includes('favori')) return 'Favoris'
  if (lowerPath.includes('archive') || lowerPath.includes('all mail') || lowerPath.includes('tous les messages')) return 'Archives'
  // Pour les dossiers Gmail qui commencent par [Gmail]/, afficher un nom plus propre
  if (path.startsWith('[Gmail]/')) {
    const gmailName = path.replace('[Gmail]/', '')
    return gmailName.replace(/([A-Z])/g, ' $1').trim()
  }
  // Pour les dossiers INBOX.xxx (Dovecot), afficher le nom après le séparateur
  if (path.startsWith('INBOX.')) {
    return path.replace('INBOX.', '')
  }
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

function formatFullDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString('fr-FR', {
      dateStyle: 'long',
      timeStyle: 'short',
    })
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

function extractSnippet(msg: EmailMessage): string {
  // bodyStructure may contain a preview but envelope doesn't have a text preview
  // We return empty for now – the real snippet would need a separate fetch
  return ''
}

function hasAttachments(bodyStructure?: BodyStructurePart): boolean {
  if (!bodyStructure) return false
  const check = (part: BodyStructurePart): boolean => {
    if (part.disposition === 'attachment') return true
    if (part.childNodes) return part.childNodes.some(check)
    return false
  }
  return check(bodyStructure)
}

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'div', 'span',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      'a', 'img', 'figure', 'figcaption',
      'b', 'i', 'u', 's', 'em', 'strong', 'small', 'sub', 'sup',
      'blockquote', 'pre', 'code',
      'font', 'center',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'width', 'height', 'style',
      'class', 'id', 'colspan', 'rowspan', 'cellpadding', 'cellspacing',
      'border', 'align', 'valign', 'bgcolor', 'color', 'size', 'face',
      'target', 'rel',
    ],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
  })
}

// ─── Component ────────────────────────────────────────────────

export default function EmailsModule() {
  const { user } = useAuth()
  const { currentUser } = useCRMStore()
  const employeId = user?.employeId || currentUser?.employeId

  // State
  const [config, setConfig] = useState<EmailConfig | null>(null)
  const [folders, setFolders] = useState<EmailFolder[]>([])
  const [selectedFolder, setSelectedFolder] = useState('INBOX')
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [selectedMessage, setSelectedMessage] = useState<EmailDetail | null>(null)
  const [isLoadingFolders, setIsLoadingFolders] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLoadingMessage, setIsLoadingMessage] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [selectedUids, setSelectedUids] = useState<Set<number>>(new Set())
  const [messagePage, setMessagePage] = useState(1)
  const [totalMessages, setTotalMessages] = useState(0)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)

  // Compose form
  const [composeForm, setComposeForm] = useState({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    text: '',
    html: '',
    inReplyTo: '',
    replyTo: '',
  })
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [signature, setSignature] = useState('')
  const [signatureDraft, setSignatureDraft] = useState('')
  const [showSignatureSettings, setShowSignatureSettings] = useState(false)

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

  // Test result state
  const [testResult, setTestResult] = useState<{
    success: boolean
    results?: {
      imap: { success: boolean; message: string }
      smtp: { success: boolean; message: string }
    }
  } | null>(null)

  // Auto-refresh interval ref
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── API calls ──────────────────────────────────────────────

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
        // Charger la signature
        if (data.signature) {
          setSignature(data.signature)
          setSignatureDraft(data.signature)
        }
      }
    } catch (err) {
      console.error('[EMAILS] Erreur fetch config:', err)
    }
  }, [])

  const fetchFolders = useCallback(async () => {
    if (!config?.isConfigured) return
    setIsLoadingFolders(true)
    setConnectionError(null)
    try {
      const res = await fetch('/api/emails/folders', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setFolders(data.folders || [])
      } else {
        const err = await res.json().catch(() => ({}))
        const errorMessage = err.error || 'Impossible de charger les dossiers'
        setConnectionError(errorMessage)
        toast.error('Erreur de connexion', { description: errorMessage, duration: 8000 })
      }
    } catch {
      setConnectionError('Erreur réseau')
    } finally {
      setIsLoadingFolders(false)
    }
  }, [config?.isConfigured])

  const fetchMessages = useCallback(async (folder: string, search?: string, page: number = 1, append: boolean = false) => {
    if (!config?.isConfigured) return
    setIsLoadingMessages(true)
    try {
      const params = new URLSearchParams({ folder, page: String(page), limit: '25' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/emails/inbox?${params}`, { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        const newMessages = (data.messages || []).map((msg: EmailMessage) => ({
          ...msg,
          flags: normalizeFlags(msg.flags),
        }))
        if (append) {
          setMessages((prev) => [...prev, ...newMessages])
        } else {
          setMessages(newMessages)
        }
        setTotalMessages(data.total || 0)
        setHasMoreMessages(data.page < data.totalPages)
      } else {
        const err = await res.json().catch(() => ({}))
        const errorMessage = err.error || 'Impossible de charger les emails'
        setConnectionError(errorMessage)
        toast.error('Erreur de connexion', { description: errorMessage, duration: 8000 })
      }
    } catch {
      console.error('[EMAILS] Erreur fetch messages')
    } finally {
      setIsLoadingMessages(false)
    }
  }, [config?.isConfigured])

  const fetchMessage = async (uid: number, folder: string) => {
    setIsLoadingMessage(true)
    try {
      const res = await fetch(
        `/api/emails/message?uid=${uid}&folder=${encodeURIComponent(folder)}`,
        { credentials: 'same-origin' }
      )
      if (res.ok) {
        const data = await res.json()
        data.flags = normalizeFlags(data.flags)
        setSelectedMessage(data)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error('Erreur', { description: err.error || 'Impossible de lire le message' })
      }
    } catch {
      console.error('[EMAILS] Erreur fetch message')
    } finally {
      setIsLoadingMessage(false)
    }
  }

  const toggleFlag = async (uid: number, flag: string, add: boolean) => {
    try {
      const res = await fetch('/api/emails/flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          folder: selectedFolder,
          uid,
          addFlags: add ? [flag] : undefined,
          removeFlags: add ? undefined : [flag],
        }),
      })
      if (res.ok) {
        // Update local state
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.uid !== uid) return msg
            const flags = normalizeFlags(msg.flags)
            const newFlags = add
              ? flags.includes(flag) ? flags : [...flags, flag]
              : flags.filter((f) => f !== flag)
            return { ...msg, flags: newFlags }
          })
        )
        if (selectedMessage?.uid === uid) {
          const flags = normalizeFlags(selectedMessage.flags)
          const newFlags = add
            ? flags.includes(flag) ? flags : [...flags, flag]
            : flags.filter((f) => f !== flag)
          setSelectedMessage({ ...selectedMessage, flags: newFlags })
        }
      } else {
        toast.error('Erreur', { description: 'Impossible de modifier le flag' })
      }
    } catch {
      toast.error('Erreur réseau')
    }
  }

  const bulkAction = async (action: 'read' | 'unread' | 'delete') => {
    if (selectedUids.size === 0) return
    const uids = Array.from(selectedUids)

    if (action === 'delete') {
      for (const uid of uids) {
        try {
          await fetch('/api/emails/message', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ folder: selectedFolder, uid }),
          })
        } catch { /* ignore individual errors */ }
      }
      toast.success(`${uids.length} email(s) supprimé(s)`)
      setSelectedUids(new Set())
      if (selectedMessage && uids.includes(selectedMessage.uid)) {
        setSelectedMessage(null)
      }
      fetchMessages(selectedFolder, searchQuery || undefined)
      fetchFolders()
      return
    }

    const flag = '\\Seen'
    const add = action === 'read'
    for (const uid of uids) {
      try {
        await fetch('/api/emails/flags', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            folder: selectedFolder,
            uid,
            addFlags: add ? [flag] : undefined,
            removeFlags: add ? undefined : [flag],
          }),
        })
      } catch { /* ignore */ }
    }
    toast.success(`${uids.length} email(s) marqué(s) comme ${action === 'read' ? 'lu' : 'non lu'}`)
    setMessages((prev) =>
      prev.map((msg) => {
        if (!selectedUids.has(msg.uid)) return msg
        const flags = normalizeFlags(msg.flags)
        const newFlags = add
          ? flags.includes(flag) ? flags : [...flags, flag]
          : flags.filter((f) => f !== flag)
        return { ...msg, flags: newFlags }
      })
    )
    setSelectedUids(new Set())
    fetchFolders()
  }

  const testConnection = async () => {
    if (!configForm.email || !configForm.imapHost || !configForm.smtpHost || !configForm.emailPassword) {
      toast.error('Champs manquants', { description: 'Remplissez tous les champs avant de tester la connexion.' })
      return
    }
    setIsTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/emails/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(configForm),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success !== undefined) {
        setTestResult(data)
        if (data.success) {
          toast.success('Connexion réussie', { description: 'IMAP et SMTP fonctionnent correctement' })
        } else {
          const failedParts: string[] = []
          if (data.results?.imap && !data.results.imap.success) failedParts.push(`IMAP: ${data.results.imap.message}`)
          if (data.results?.smtp && !data.results.smtp.success) failedParts.push(`SMTP: ${data.results.smtp.message}`)
          toast.error('Échec de connexion', { description: failedParts.join(' | ') || data.error || 'Échec', duration: 15000 })
        }
      } else {
        // Erreur serveur - afficher les détails avec steps de diagnostic
        const errorDetail = data.details || data.error || 'Erreur inconnue'
        const errorCode = data.code || ''
        const steps = (data.steps || []).join(' → ')
        let desc = errorCode ? `${errorDetail} (code: ${errorCode})` : errorDetail
        if (steps) desc += ` | Étapes: ${steps}`
        toast.error(data.error || 'Erreur de test', { description: desc, duration: 20000 })
        // Mettre à jour testResult avec l'erreur
        setTestResult(data)
      }
    } catch {
      toast.error('Erreur réseau', { description: 'Impossible de joindre le serveur' })
    } finally {
      setIsTesting(false)
    }
  }

  const saveConfig = async () => {
    if (!configForm.email || !configForm.imapHost || !configForm.smtpHost) {
      toast.error('Champs requis', { description: 'Email, serveur IMAP et SMTP sont obligatoires' })
      return
    }
    if (!configForm.emailPassword && !config?.isConfigured) {
      toast.error('Mot de passe requis', { description: 'Le mot de passe d\'application est obligatoire pour la première configuration' })
      return
    }
    setIsTesting(true)
    try {
      const testRes = await fetch('/api/emails/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(configForm),
      })
      const testData = await testRes.json().catch(() => ({}))
      if (testRes.ok && testData.success !== undefined) {
        setTestResult(testData)
        if (!testData.success) {
          setIsTesting(false)
          const failedParts: string[] = []
          if (testData.results?.imap && !testData.results.imap.success) failedParts.push(`IMAP: ${testData.results.imap.message}`)
          if (testData.results?.smtp && !testData.results.smtp.success) failedParts.push(`SMTP: ${testData.results.smtp.message}`)
          toast.error('Échec de connexion', { description: failedParts.join(' | ') || testData.error || 'Échec', duration: 15000 })
          return
        }
      } else {
        // Erreur serveur pendant le test
        setIsTesting(false)
        const errorDetail = testData.details || testData.error || 'Erreur inconnue'
        toast.error('Échec de connexion', { description: errorDetail, duration: 15000 })
        if (testData.results) setTestResult(testData)
        return
      }
    } catch {
      setIsTesting(false)
      toast.error('Erreur réseau lors du test')
      return
    }
    setIsTesting(false)
    try {
      // Exclure le champ preset avant d'envoyer
      const { preset: _preset, ...configData } = configForm as any
      const res = await fetch('/api/emails/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(configData),
      })
      if (res.ok) {
        const data = await res.json()
        setConfig({ ...data, isConfigured: true })
        toast.success('Configuration sauvegardée', { description: 'Votre boîte email est connectée' })
        setShowConfig(false)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error('Erreur', { description: err.error || err.details || 'Impossible de sauvegarder la configuration', duration: 10000 })
      }
    } catch {
      toast.error('Erreur réseau')
    }
  }

  const sendEmail = async () => {
    if (!composeForm.to || !composeForm.subject) {
      toast.error('Champs requis', { description: 'Destinataire et sujet sont obligatoires' })
      return
    }
    setIsSending(true)
    try {
      // Construire le HTML final avec signature
      const finalHtml = composeForm.html
        ? (signature ? `${composeForm.html}<br><br>${signature}` : composeForm.html)
        : (signature ? `<p>${composeForm.text.replace(/\n/g, '</p><p>')}</p><br><br>${signature}` : undefined)

      // Générer une version texte brute (fallback)
      const plainText = composeForm.text || composeForm.html?.replace(/<[^>]*>/g, '') || ''

      const payload: Record<string, unknown> = {
        to: composeForm.to,
        cc: composeForm.cc || undefined,
        bcc: composeForm.bcc || undefined,
        subject: composeForm.subject,
        text: plainText,
        html: finalHtml,
      }
      if (composeForm.replyTo) {
        payload.replyTo = composeForm.replyTo
      }
      if (composeForm.inReplyTo) {
        payload.inReplyTo = composeForm.inReplyTo
      }
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const data = await res.json()
        const desc = data.savedToImap
          ? `À ${composeForm.to} · Copie sauvegardée dans Envoyés`
          : `À ${composeForm.to}`
        toast.success('Email envoyé', { description: desc })
        setShowCompose(false)
        setComposeForm({ to: '', cc: '', bcc: '', subject: '', text: '', html: '', inReplyTo: '', replyTo: '' })
        // Rafraîchir la liste des dossiers pour mettre à jour le compteur
        fetchFolders()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error("Erreur d'envoi", { description: err.error || err.details || 'Impossible d\'envoyer l\'email' })
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setIsSending(false)
    }
  }

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
    } catch {
      toast.error('Erreur de suppression')
    }
  }

  const replyToEmail = (email: EmailDetail) => {
    const sender = email.envelope.from?.[0]
    const replyToAddr = sender ? (sender.name ? `${sender.name} <${sender.address}>` : sender.address) : ''
    const subject = email.envelope.subject?.startsWith('Re:') ? email.envelope.subject : `Re: ${email.envelope.subject || ''}`
    // Construire le HTML du message original cité
    const quotedHtml = `
      <br><br>
      <div style="border-left: 3px solid #ccc; padding-left: 10px; margin-left: 0; color: #666;">
        <p style="margin: 0; font-size: 12px; color: #999;">Le ${formatFullDate(email.envelope.date)}, ${extractEmailAddress(email.envelope.from)} a écrit :</p>
        ${email.isHtml && email.htmlContent ? email.htmlContent : `<p>${(email.textContent || '').replace(/\n/g, '</p><p>')}</p>`}
      </div>`
    setComposeForm({
      to: replyToAddr,
      cc: '',
      bcc: '',
      subject,
      text: `\n\n--- Message original ---\nDe: ${extractEmailAddress(email.envelope.from)}\nDate: ${email.envelope.date}\n\n${email.textContent || ''}`,
      html: quotedHtml,
      inReplyTo: email.envelope.messageId || '',
      replyTo: email.envelope.messageId || '',
    })
    setShowCcBcc(false)
    setShowCompose(true)
  }

  const forwardEmail = (email: EmailDetail) => {
    const fwdHtml = `
      <br><br>
      <div style="background: #f9f9f9; border: 1px solid #ddd; padding: 10px; border-radius: 4px;">
        <p style="margin: 0 0 5px; font-size: 12px; color: #666;"><b>Message transféré</b></p>
        <p style="margin: 0 0 3px; font-size: 12px; color: #666;">De: ${extractEmailAddress(email.envelope.from)}</p>
        <p style="margin: 0 0 3px; font-size: 12px; color: #666;">Date: ${formatFullDate(email.envelope.date)}</p>
        <p style="margin: 0 0 3px; font-size: 12px; color: #666;">Sujet: ${email.envelope.subject || ''}</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 8px 0;">
        ${email.isHtml && email.htmlContent ? email.htmlContent : `<p>${(email.textContent || '').replace(/\n/g, '</p><p>')}</p>`}
      </div>`
    setComposeForm({
      to: '',
      cc: '',
      bcc: '',
      subject: email.envelope.subject?.startsWith('Fwd:') ? email.envelope.subject : `Fwd: ${email.envelope.subject || ''}`,
      text: `\n\n--- Message transféré ---\nDe: ${extractEmailAddress(email.envelope.from)}\nDate: ${email.envelope.date}\n\n${email.textContent || ''}`,
      html: fwdHtml,
      inReplyTo: '',
      replyTo: '',
    })
    setShowCcBcc(false)
    setShowCompose(true)
  }

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
    setTestResult(null)
  }

  const openCompose = () => {
    setComposeForm({ to: '', cc: '', bcc: '', subject: '', text: '', html: '', inReplyTo: '', replyTo: '' })
    setShowCcBcc(false)
    setShowCompose(true)
  }

  // ─── Effects ────────────────────────────────────────────────

  useEffect(() => { fetchConfig() }, [fetchConfig])

  useEffect(() => {
    if (config?.isConfigured) fetchFolders()
  }, [config?.isConfigured, fetchFolders])

  useEffect(() => {
    if (config?.isConfigured && selectedFolder) {
      setMessagePage(1)
      setSelectedUids(new Set())
      fetchMessages(selectedFolder)
      setSelectedMessage(null)
    }
  }, [selectedFolder, config?.isConfigured, fetchMessages])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!config?.isConfigured) return
    intervalRef.current = setInterval(() => {
      fetchFolders()
      fetchMessages(selectedFolder, searchQuery || undefined)
    }, 60000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [config?.isConfigured, selectedFolder, searchQuery, fetchFolders, fetchMessages])

  // ─── Select-all logic ───────────────────────────────────────

  const allSelected = messages.length > 0 && messages.every((m) => selectedUids.has(m.uid))
  const someSelected = selectedUids.size > 0 && !allSelected

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedUids(new Set())
    } else {
      setSelectedUids(new Set(messages.map((m) => m.uid)))
    }
  }

  const toggleSelect = (uid: number) => {
    setSelectedUids((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  // ─── Load more ──────────────────────────────────────────────

  const loadMore = () => {
    const nextPage = messagePage + 1
    setMessagePage(nextPage)
    fetchMessages(selectedFolder, searchQuery || undefined, nextPage, true)
  }

  // ─── Config Setup Screen ────────────────────────────────────

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
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {/* Preset selector */}
              <div>
                <Label className="text-sm font-medium text-slate-700">Fournisseur email</Label>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {[
                    { id: 'gmail', label: 'Gmail' },
                    { id: 'outlook', label: 'Outlook' },
                    { id: 'yahoo', label: 'Yahoo' },
                    { id: 'lws', label: 'LWS' },
                    { id: 'custom', label: 'Autre' },
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

              {configForm.preset !== 'custom' && emailPresets[configForm.preset]?.helpText && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                      {emailPresets[configForm.preset].helpText}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium text-slate-700">Adresse email</Label>
                <Input
                  value={configForm.email}
                  onChange={(e) => { setConfigForm((prev) => ({ ...prev, email: e.target.value })); setTestResult(null) }}
                  placeholder="votre@email.com"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">Mot de passe de l&apos;application</Label>
                <Input
                  type="password"
                  value={configForm.emailPassword}
                  onChange={(e) => { setConfigForm((prev) => ({ ...prev, emailPassword: e.target.value })); setTestResult(null) }}
                  placeholder="Mot de passe d'application"
                  className="mt-1"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  {configForm.preset === 'custom'
                    ? 'Utilisez un mot de passe d\'application si votre fournisseur le requiert.'
                    : 'Collez ici le mot de passe d\'application généré ci-dessus.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Serveur IMAP</Label>
                  <Input
                    value={configForm.imapHost}
                    onChange={(e) => { setConfigForm((prev) => ({ ...prev, imapHost: e.target.value })); setTestResult(null) }}
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
                    onChange={(e) => { setConfigForm((prev) => ({ ...prev, smtpHost: e.target.value })); setTestResult(null) }}
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

              {testResult && (
                <div className={`rounded-lg border p-3 ${
                  testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.success ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-red-600" />}
                    <span className={`text-sm font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                      {testResult.success ? 'Connexion réussie' : 'Échec de connexion'}
                    </span>
                  </div>
                  {testResult.results && (
                    <div className="space-y-1.5 ml-6">
                      <div className="flex items-center gap-2">
                        {testResult.results.imap.success ? <Check className="h-3.5 w-3.5 text-green-500" /> : <X className="h-3.5 w-3.5 text-red-500" />}
                        <span className="text-xs text-slate-700">IMAP : {testResult.results.imap.message}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {testResult.results.smtp.success ? <Check className="h-3.5 w-3.5 text-green-500" /> : <X className="h-3.5 w-3.5 text-red-500" />}
                        <span className="text-xs text-slate-700">SMTP : {testResult.results.smtp.message}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={testConnection}
                  variant="outline"
                  className="flex-1 border-slate-200"
                  disabled={isTesting || !configForm.email || !configForm.imapHost || !configForm.smtpHost || !configForm.emailPassword}
                >
                  {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}
                  Tester la connexion
                </Button>
                <Button
                  onClick={saveConfig}
                  className="flex-1 bg-[#134885] hover:bg-[#0D3A6E]"
                  disabled={isTesting || !configForm.email || !configForm.imapHost || !configForm.smtpHost}
                >
                  {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Connecter
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Main Email Interface ───────────────────────────────────

  const currentMessage = selectedMessage ? {
    ...selectedMessage,
    flags: normalizeFlags(selectedMessage.flags),
  } : null

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
            <Button size="sm" className="bg-[#134885] hover:bg-[#0D3A6E]" onClick={openCompose}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Nouveau message
            </Button>
            <Button
              onClick={() => { setTestResult(null); setShowConfig(true) }}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-slate-600"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* Connection error banner */}
      {connectionError && (
        <div className="mx-4 mt-2 rounded-lg border border-red-200 bg-red-50 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-red-500 shrink-0" />
            <span className="text-sm text-red-700">{connectionError}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 h-7 text-xs"
              onClick={() => { fetchFolders(); fetchMessages(selectedFolder) }}>
              <RefreshCw className="h-3 w-3 mr-1" /> Réessayer
            </Button>
            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 h-7 text-xs"
              onClick={() => { setTestResult(null); setShowConfig(true) }}>
              <Settings className="h-3 w-3 mr-1" /> Config
            </Button>
          </div>
        </div>
      )}

      {/* 3-Pane Layout */}
      <div className={`flex ${connectionError ? 'h-[calc(100vh-130px)]' : 'h-[calc(100vh-80px)]'}`}>

        {/* ── Pane 1: Folders Sidebar ─────────────────────────── */}
        <div className="w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col">
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
                    {folder.unseen > 0 ? (
                      <Badge className="h-5 min-w-5 flex items-center justify-center rounded-full bg-[#F6852A] px-1 text-[10px] font-bold text-white border-0">
                        {folder.unseen}
                      </Badge>
                    ) : folder.count > 0 ? (
                      <span className="text-[10px] text-slate-400">{folder.count}</span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ── Pane 2: Message List ────────────────────────────── */}
        <div className={`shrink-0 border-r border-slate-200 bg-white flex flex-col transition-all ${currentMessage ? 'w-80' : 'w-96'}`}>
          {/* List header */}
          <div className="border-b border-slate-100 px-3 py-2 flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              ref={(el) => {
                if (el) {
                  (el as unknown as HTMLButtonElement).dataset.state = someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked'
                }
              }}
              onCheckedChange={toggleSelectAll}
              className="shrink-0"
            />
            <h3 className="text-sm font-semibold text-slate-700 flex-1">
              {getFolderLabel(selectedFolder)}
            </h3>
            <span className="text-xs text-slate-400">{totalMessages} message{totalMessages > 1 ? 's' : ''}</span>

            {/* Bulk actions dropdown */}
            {selectedUids.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-[#134885]">
                    Actions ({selectedUids.size})
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => bulkAction('read')}>
                    <Eye className="mr-2 h-3.5 w-3.5" /> Marquer comme lu
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkAction('unread')}>
                    <EyeOff className="mr-2 h-3.5 w-3.5" /> Marquer comme non lu
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkAction('delete')} className="text-red-600 focus:text-red-600">
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Message list */}
          <ScrollArea className="flex-1">
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
              <>
                {messages.map((msg) => {
                  const flags = normalizeFlags(msg.flags)
                  const isUnread = !flags.includes('\\Seen')
                  const isFlagged = flags.includes('\\Flagged')
                  const isSelected = currentMessage?.uid === msg.uid
                  const isChecked = selectedUids.has(msg.uid)
                  const hasAttach = hasAttachments(msg.bodyStructure)
                  const snippet = extractSnippet(msg)

                  return (
                    <div
                      key={msg.uid}
                      className={`flex gap-2 border-b border-slate-50 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#134885]/5 border-l-2 border-l-[#134885]'
                          : isUnread
                            ? 'bg-white hover:bg-slate-50 border-l-2 border-l-[#F6852A]'
                            : 'bg-slate-50/50 hover:bg-slate-50 border-l-2 border-l-transparent'
                      }`}
                      onClick={() => fetchMessage(msg.uid, selectedFolder)}
                    >
                      {/* Checkbox + Star column */}
                      <div className="flex flex-col items-center gap-1.5 pt-0.5 shrink-0">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleSelect(msg.uid)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3.5 w-3.5"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFlag(msg.uid, '\\Flagged', !isFlagged)
                          }}
                          className="p-0 hover:scale-110 transition-transform"
                        >
                          <Star className={`h-3.5 w-3.5 ${isFlagged ? 'text-[#F6852A] fill-[#F6852A]' : 'text-slate-300 hover:text-[#F6852A]'}`} />
                        </button>
                      </div>

                      {/* Message content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate text-sm ${isUnread ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                            {extractSenderName(msg.envelope.from)}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {hasAttach && <Paperclip className="h-3 w-3 text-slate-400" />}
                            <span className="text-[10px] text-slate-400" title={formatFullDate(msg.envelope.date)}>
                              {formatDate(msg.envelope.date)}
                            </span>
                          </div>
                        </div>
                        <p className={`truncate text-sm ${isUnread ? 'font-medium text-slate-800' : 'text-slate-500'}`}>
                          {msg.envelope.subject || '(Sans sujet)'}
                        </p>
                        {snippet && (
                          <p className="truncate text-xs text-slate-400 mt-0.5">{snippet}</p>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Load more button */}
                {hasMoreMessages && (
                  <div className="flex justify-center py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#134885] text-xs"
                      onClick={loadMore}
                      disabled={isLoadingMessages}
                    >
                      {isLoadingMessages ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Charger plus
                    </Button>
                  </div>
                )}
              </>
            )}
          </ScrollArea>
        </div>

        {/* ── Pane 3: Message Detail ──────────────────────────── */}
        <div className="flex-1 bg-white">
          {isLoadingMessage ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-[#134885]" />
            </div>
          ) : currentMessage ? (
            <div className="flex h-full flex-col">
              {/* Message Header + Toolbar */}
              <div className="border-b border-slate-200 px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-slate-900">
                      {currentMessage.envelope.subject || '(Sans sujet)'}
                    </h2>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-[#134885]/10 text-[11px] font-semibold text-[#134885]">
                            {extractSenderName(currentMessage.envelope.from).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-medium text-slate-800">
                            {extractSenderName(currentMessage.envelope.from)}
                          </span>
                          <span className="ml-1 text-slate-400 text-xs">
                            &lt;{currentMessage.envelope.from?.[0]?.address}&gt;
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 pl-10">
                        À: {currentMessage.envelope.to?.map((r) => r.address).join(', ')}
                      </div>
                      {currentMessage.envelope.cc && currentMessage.envelope.cc.length > 0 && (
                        <div className="text-xs text-slate-400 pl-10">
                          Cc: {currentMessage.envelope.cc.map((r) => r.address).join(', ')}
                        </div>
                      )}
                      <div className="text-xs text-slate-400 pl-10">
                        {formatFullDate(currentMessage.envelope.date)}
                      </div>
                    </div>
                  </div>

                  {/* Action toolbar */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-[#134885]" onClick={() => replyToEmail(currentMessage)} title="Répondre">
                      <Reply className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-[#134885]" onClick={() => forwardEmail(currentMessage)} title="Transférer">
                      <Forward className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className={hasFlag(currentMessage.flags, '\\Seen') ? 'text-[#134885]' : 'text-slate-400 hover:text-[#134885]'}
                      onClick={() => toggleFlag(currentMessage.uid, '\\Seen', hasFlag(currentMessage.flags, '\\Seen') ? false : true)}
                      title={hasFlag(currentMessage.flags, '\\Seen') ? 'Marquer comme non lu' : 'Marquer comme lu'}
                    >
                      {hasFlag(currentMessage.flags, '\\Seen') ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className={hasFlag(currentMessage.flags, '\\Flagged') ? 'text-[#F6852A]' : 'text-slate-400 hover:text-[#F6852A]'}
                      onClick={() => toggleFlag(currentMessage.uid, '\\Flagged', !hasFlag(currentMessage.flags, '\\Flagged'))}
                      title={hasFlag(currentMessage.flags, '\\Flagged') ? 'Retirer l\'étoile' : 'Ajouter une étoile'}
                    >
                      <Star className={`h-4 w-4 ${hasFlag(currentMessage.flags, '\\Flagged') ? 'fill-[#F6852A]' : ''}`} />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => replyToEmail(currentMessage)}>
                          <Reply className="mr-2 h-3.5 w-3.5" /> Répondre
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => forwardEmail(currentMessage)}>
                          <Forward className="mr-2 h-3.5 w-3.5" /> Transférer
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleFlag(currentMessage.uid, '\\Seen', !hasFlag(currentMessage.flags, '\\Seen'))}>
                          {hasFlag(currentMessage.flags, '\\Seen') ? <EyeOff className="mr-2 h-3.5 w-3.5" /> : <Eye className="mr-2 h-3.5 w-3.5" />}
                          {hasFlag(currentMessage.flags, '\\Seen') ? 'Marquer comme non lu' : 'Marquer comme lu'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteEmail(currentMessage.uid)} className="text-red-600 focus:text-red-600">
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-500" onClick={() => deleteEmail(currentMessage.uid)} title="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Message Body */}
              <ScrollArea className="flex-1">
                <div className="p-6">
                  {currentMessage.isHtml && currentMessage.htmlContent ? (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentMessage.htmlContent) }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">
                      {currentMessage.textContent || '(Aucun contenu)'}
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
                        if (target.value.trim()) replyToEmail(currentMessage)
                      }
                    }}
                    onFocus={(e) => {
                      if (!e.target.value) replyToEmail(currentMessage)
                    }}
                  />
                  <Button size="sm" variant="outline" className="border-[#134885]/30 text-[#134885] hover:bg-[#134885]/5" onClick={() => replyToEmail(currentMessage)}>
                    <Reply className="h-3.5 w-3.5 mr-1" /> Répondre
                  </Button>
                  <Button size="sm" variant="outline" className="border-[#134885]/30 text-[#134885] hover:bg-[#134885]/5" onClick={() => forwardEmail(currentMessage)}>
                    <ArrowRight className="h-3.5 w-3.5 mr-1" /> Transférer
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

      {/* ── Compose Dialog ────────────────────────────────────── */}
      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0">
          {/* ── Compose Header ──────────────────────────────────── */}
          <div className="border-b border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
            <DialogTitle className="text-base font-semibold text-slate-900">
              {composeForm.inReplyTo ? 'Répondre' : composeForm.replyTo ? 'Transférer' : 'Nouveau message'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-xs text-slate-400 h-7"
                onClick={() => setShowSignatureSettings(!showSignatureSettings)}
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                Signature
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCompose(false)} className="h-7 text-xs">Annuler</Button>
              <Button
                onClick={sendEmail}
                disabled={isSending || !composeForm.to || !composeForm.subject}
                className="bg-[#134885] hover:bg-[#0D3A6E] h-7 text-xs"
                size="sm"
              >
                {isSending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                Envoyer
              </Button>
            </div>
          </div>

          {/* ── Compose Body ────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5">
            {/* À */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="text-sm font-medium text-slate-500 w-10 shrink-0">À</span>
              <Input
                value={composeForm.to}
                onChange={(e) => setComposeForm((prev) => ({ ...prev, to: e.target.value }))}
                placeholder="destinataire@email.com"
                className="border-0 shadow-none h-7 text-sm focus-visible:ring-0 px-0"
              />
              {!showCcBcc && (
                <Button variant="ghost" size="sm" className="text-xs text-slate-400 h-6 px-1.5 shrink-0"
                  onClick={() => setShowCcBcc(true)}>
                  Cc/Cci
                </Button>
              )}
            </div>

            {/* Cc / Cci */}
            {showCcBcc && (
              <>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="text-sm font-medium text-slate-500 w-10 shrink-0">Cc</span>
                  <Input
                    value={composeForm.cc}
                    onChange={(e) => setComposeForm((prev) => ({ ...prev, cc: e.target.value }))}
                    placeholder="copie@email.com (optionnel)"
                    className="border-0 shadow-none h-7 text-sm focus-visible:ring-0 px-0"
                  />
                </div>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="text-sm font-medium text-slate-500 w-10 shrink-0">Cci</span>
                  <Input
                    value={composeForm.bcc}
                    onChange={(e) => setComposeForm((prev) => ({ ...prev, bcc: e.target.value }))}
                    placeholder="copie cachée@email.com (optionnel)"
                    className="border-0 shadow-none h-7 text-sm focus-visible:ring-0 px-0"
                  />
                </div>
              </>
            )}

            {/* Sujet */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="text-sm font-medium text-slate-500 w-10 shrink-0">Sujet</span>
              <Input
                value={composeForm.subject}
                onChange={(e) => setComposeForm((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Sujet du message"
                className="border-0 shadow-none h-7 text-sm font-medium focus-visible:ring-0 px-0"
              />
            </div>

            {/* Signature settings panel (collapsible) */}
            {showSignatureSettings && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Signature email</span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-[#134885]"
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/emails/config', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'same-origin',
                            body: JSON.stringify({ ...configForm, signature: signatureDraft }),
                          })
                          if (res.ok) {
                            setSignature(signatureDraft)
                            toast.success('Signature sauvegardée')
                          }
                        } catch {
                          toast.error('Erreur de sauvegarde')
                        }
                      }}>
                      <Check className="h-3 w-3 mr-1" /> Sauvegarder
                    </Button>
                  </div>
                </div>
                <div className="quill-compose-signature">
                  <SignatureEditor
                    value={signatureDraft}
                    onChange={setSignatureDraft}
                    placeholder="Creez votre signature : nom, poste, entreprise, téléphone..."
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  La signature sera ajoutée automatiquement à la fin de chaque email envoyé.
                </p>
              </div>
            )}

            {/* Signature preview (if exists and not editing) */}
            {!showSignatureSettings && signature && (
              <div className="border-b border-slate-100 pb-1">
                <p className="text-[10px] text-slate-400 mb-0.5">Signature ajoutée automatiquement :</p>
                <div
                  className="text-xs text-slate-500 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(signature) }}
                />
              </div>
            )}

            {/* Rich Text Editor */}
            <div className="quill-compose-editor">
              <QuillEmailEditor
                value={composeForm.html}
                onChange={(html) => setComposeForm((prev) => ({
                  ...prev,
                  html,
                  text: html.replace(/<[^>]*>/g, ''),
                }))}
                placeholder="Écrivez votre message..."
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Config Dialog ─────────────────────────────────────── */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configuration email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Preset selector */}
            <div>
              <Label className="text-sm font-medium">Fournisseur</Label>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {[
                  { id: 'gmail', label: 'Gmail' },
                  { id: 'outlook', label: 'Outlook' },
                  { id: 'yahoo', label: 'Yahoo' },
                  { id: 'custom', label: 'Autre' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePresetChange(p.id)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
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

            {/* Help text */}
            {configForm.preset !== 'custom' && emailPresets[configForm.preset]?.helpText && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                <div className="flex items-start gap-2">
                  <Shield className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {emailPresets[configForm.preset].helpText}
                  </p>
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium">Adresse email</Label>
              <Input
                value={configForm.email}
                onChange={(e) => { setConfigForm((prev) => ({ ...prev, email: e.target.value })); setTestResult(null) }}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Mot de passe de l&apos;application</Label>
              <Input
                type="password"
                value={configForm.emailPassword}
                onChange={(e) => { setConfigForm((prev) => ({ ...prev, emailPassword: e.target.value })); setTestResult(null) }}
                placeholder="Laisser vide pour ne pas changer"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Serveur IMAP</Label>
                <Input
                  value={configForm.imapHost}
                  onChange={(e) => { setConfigForm((prev) => ({ ...prev, imapHost: e.target.value })); setTestResult(null) }}
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
                  onChange={(e) => { setConfigForm((prev) => ({ ...prev, smtpHost: e.target.value })); setTestResult(null) }}
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

            {/* Test result in dialog */}
            {testResult && (
              <div className={`rounded-lg border p-3 ${
                testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {testResult.success ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-red-600" />}
                  <span className={`text-sm font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {testResult.success ? 'Connexion réussie' : 'Échec de connexion'}
                  </span>
                </div>
                {testResult.results && (
                  <div className="space-y-1.5 ml-6">
                    <div className="flex items-center gap-2">
                      {testResult.results.imap.success ? <Check className="h-3.5 w-3.5 text-green-500" /> : <X className="h-3.5 w-3.5 text-red-500" />}
                      <span className="text-xs text-slate-700">IMAP : {testResult.results.imap.message}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {testResult.results.smtp.success ? <Check className="h-3.5 w-3.5 text-green-500" /> : <X className="h-3.5 w-3.5 text-red-500" />}
                      <span className="text-xs text-slate-700">SMTP : {testResult.results.smtp.message}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                <Button variant="outline" size="sm" onClick={testConnection} disabled={isTesting}>
                  {isTesting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wifi className="mr-1.5 h-3.5 w-3.5" />}
                  Tester
                </Button>
                <Button variant="outline" onClick={() => setShowConfig(false)}>Annuler</Button>
                <Button onClick={saveConfig} className="bg-[#134885] hover:bg-[#0D3A6E]" disabled={isTesting}>
                  {isTesting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
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
