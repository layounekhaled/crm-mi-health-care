'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useCRMStore } from '@/lib/store'
import { signOut } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  MessageCircle,
  X,
  Send,
  Search,
  Plus,
  ArrowLeft,
  Users,
  UserPlus,
  Loader2,
  CheckCheck,
  AlertCircle,
  Bell,
  BellOff,
  Check,
  Hash,
  Smile,
  Trash2,
  Link2,
  Image as ImageIcon,
  Paperclip,
  MoreVertical,
  Phone,
  Video,
  ArrowDown,
  Settings,
  Pencil,
  UserMinus,
  LogOut,
} from 'lucide-react'

interface Conversation {
  id: string
  type: string
  nom: string | null
  updatedAt: string
  participants: {
    id: string
    employeId: string
    employe: { id: string; nom: string; role: string }
    lastReadAt: string
  }[]
  messages: {
    id: string
    contenu: string
    createdAt: string
    expediteurId: string
    expediteur: { id: string; nom: string }
  }[]
  unreadCount: number
}

interface Employee {
  id: string
  nom: string
  role: string
}

interface ChatMessage {
  id: string
  conversationId: string
  contenu: string
  createdAt: string
  expediteurId: string
  expediteur: { id: string; nom: string }
}

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  commercial: 'bg-blue-100 text-blue-700',
  technicien: 'bg-green-100 text-green-700',
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  commercial: 'Commercial',
  technicien: 'Technicien',
}

// Couleurs d'avatar uniques par nom
const avatarColors = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-sky-600',
  'from-fuchsia-500 to-purple-600',
  'from-lime-500 to-green-600',
  'from-red-500 to-rose-600',
  'from-yellow-500 to-orange-600',
]

function getAvatarColor(nom: string) {
  let hash = 0
  for (let i = 0; i < nom.length; i++) {
    hash = nom.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

// Emojis fréquents
const quickEmojis = ['👍', '❤️', '😊', '🎉', '👏', '🙏', '💯', '🔥', '✅', '⭐', '😂', '🤝']

function getInitials(nom: string) {
  return nom
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "à l'instant"
  if (diffMins < 60) return `il y a ${diffMins}min`
  if (diffHours < 24) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (diffDays < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatMessageTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// Vérifier si deux dates sont le même jour
function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

function formatDateSeparator(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)

  if (isSameDay(d, now)) return "Aujourd'hui"
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (isSameDay(d, yesterday)) return 'Hier'

  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// Vérifier si un texte contient une URL
function linkifyText(text: string) {
  const urlRegex = /(https?:\/\/[^\s<]+)/g
  const parts = text.split(urlRegex)
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:opacity-80 break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part.length > 50 ? part.slice(0, 50) + '...' : part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

// Son de notification
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1)
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2)
    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.35)
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.35)
  } catch {
    // Audio non supporté
  }
}

export default function ChatWidget() {
  const { user } = useAuth()
  const { currentUser } = useCRMStore()
  const [isOpen, setIsOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Conversation['messages']>([])
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [newChatMode, setNewChatMode] = useState<'direct' | 'group'>('direct')
  const [groupName, setGroupName] = useState('')
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<Set<string>>(new Set())
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isSending, setIsSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [lastSeenUnread, setLastSeenUnread] = useState(0)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [contextMenuMsg, setContextMenuMsg] = useState<string | null>(null)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [showGroupSettings, setShowGroupSettings] = useState(false)
  const [editGroupName, setEditGroupName] = useState('')
  const [groupSettingsEmployees, setGroupSettingsEmployees] = useState<Employee[]>([])
  const [groupSettingsLoading, setGroupSettingsLoading] = useState(false)
  const [addMembersSearch, setAddMembersSearch] = useState('')
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [convContextMenu, setConvContextMenu] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const lastPollTimeRef = useRef<string>(new Date().toISOString())
  const previousConversationsRef = useRef<Map<string, { unreadCount: number; lastMessageId: string }>>(new Map())
  const hasInitializedRef = useRef(false)

  const employeId = user?.employeId || currentUser?.employeId

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/conversations', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setConversations(data)
        }
      } else if (res.status === 401) {
        const err = await res.json().catch(() => ({}))
        if (err.action === 'relogin') {
          setChatError('Session obsolète. Reconnexion en cours...')
          setTimeout(() => signOut({ callbackUrl: '/login' }), 2000)
        }
      }
    } catch (err) {
      console.error('[CHAT] Erreur fetch conversations:', err)
    }
  }, [])

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}`, { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        if (data && Array.isArray(data.messages)) {
          setMessages(data.messages)
          lastPollTimeRef.current = new Date().toISOString()
        }
      }
    } catch (err) {
      console.error('[CHAT] Erreur fetch messages:', err)
    }
  }, [])

  // Get conversation name helper
  const getConvNameHelper = useCallback((conv: Conversation) => {
    if (conv.type === 'group' && conv.nom) return conv.nom
    const other = conv.participants.find((p) => p.employeId !== employeId)
    return other?.employe?.nom || 'Conversation'
  }, [employeId])

  // Poll for new messages
  const pollNewMessages = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/chat/messages/latest?since=${encodeURIComponent(lastPollTimeRef.current)}`,
        { credentials: 'same-origin' }
      )
      if (res.ok) {
        const data = await res.json()
        const newMsgs: ChatMessage[] = data.messages || data
        if (Array.isArray(newMsgs) && newMsgs.length > 0) {
          const otherMsgs = newMsgs.filter((m) => m.expediteurId !== employeId)

          if (otherMsgs.length > 0) {
            if (isOpen && selectedConversation) {
              const relevantMsgs = otherMsgs.filter(
                (m) => m.conversationId === selectedConversation.id
              )
              if (relevantMsgs.length > 0) {
                setMessages((prev) => {
                  const existingIds = new Set(prev.map((m) => m.id))
                  const filtered = relevantMsgs.filter((m) => !existingIds.has(m.id))
                  return [...prev, ...filtered]
                })
              }
            }

            if (notificationsEnabled) {
              const msgsByConv = new Map<string, ChatMessage[]>()
              otherMsgs.forEach((msg) => {
                const existing = msgsByConv.get(msg.conversationId) || []
                existing.push(msg)
                msgsByConv.set(msg.conversationId, existing)
              })

              for (const [convId, convMsgs] of msgsByConv) {
                const isCurrentConv = isOpen && selectedConversation?.id === convId
                if (isCurrentConv) continue

                const conv = conversations.find((c) => c.id === convId)
                const convName = conv ? getConvNameHelper(conv) : 'Nouvelle conversation'

                const lastMsg = convMsgs[convMsgs.length - 1]
                const senderName = lastMsg.expediteur?.nom || 'Quelqu\'un'
                const preview = lastMsg.contenu.length > 50
                  ? lastMsg.contenu.slice(0, 50) + '...'
                  : lastMsg.contenu

                toast.info(`${senderName} - ${convName}`, {
                  description: preview,
                  duration: 4000,
                  action: {
                    label: 'Voir',
                    onClick: () => {
                      setIsOpen(true)
                      if (conv) selectConversation(conv)
                    },
                  },
                })

                playNotificationSound()
              }
            }
          }

          lastPollTimeRef.current = new Date().toISOString()
          fetchConversations()
        }
      }
    } catch {
      // silent fail
    }
  }, [isOpen, selectedConversation, employeId, conversations, getConvNameHelper, fetchConversations, notificationsEnabled])

  // Detect unread count changes for notifications
  useEffect(() => {
    const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

    if (hasInitializedRef.current && totalUnread > lastSeenUnread && !isOpen) {
      const increasedConv = conversations.find((conv) => {
        const prev = previousConversationsRef.current.get(conv.id)
        return prev && conv.unreadCount > prev.unreadCount
      })

      if (increasedConv && notificationsEnabled) {
        const convName = getConvNameHelper(increasedConv)
        const lastMsg = increasedConv.messages?.[0]
        const senderName = lastMsg?.expediteur?.nom || 'Quelqu\'un'
        const preview = lastMsg?.contenu
          ? lastMsg.contenu.length > 50
            ? lastMsg.contenu.slice(0, 50) + '...'
            : lastMsg.contenu
          : 'Nouveau message'

        playNotificationSound()

        toast.info(`${senderName} - ${convName}`, {
          description: preview,
          duration: 4000,
          action: {
            label: 'Ouvrir',
            onClick: () => setIsOpen(true),
          },
        })
      }
    }

    const newMap = new Map<string, { unreadCount: number; lastMessageId: string }>()
    conversations.forEach((conv) => {
      newMap.set(conv.id, {
        unreadCount: conv.unreadCount,
        lastMessageId: conv.messages?.[0]?.id || '',
      })
    })
    previousConversationsRef.current = newMap
    setLastSeenUnread(totalUnread)
    hasInitializedRef.current = true
  }, [conversations, isOpen, lastSeenUnread, getConvNameHelper, notificationsEnabled])

  // Mark as read when selecting a conversation
  useEffect(() => {
    if (selectedConversation && isOpen) {
      fetch(`/api/chat/conversations/${selectedConversation.id}/read`, {
        method: 'POST',
        credentials: 'same-origin',
      }).catch(() => {})
    }
  }, [selectedConversation, isOpen])

  // Polling
  useEffect(() => {
    fetchConversations()
    pollingRef.current = setInterval(() => {
      pollNewMessages()
      if (isOpen) fetchConversations()
    }, 5000)

    const convPollRef = setInterval(() => {
      if (!isOpen) fetchConversations()
    }, 15000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      clearInterval(convPollRef)
    }
  }, [isOpen, fetchConversations, pollNewMessages])

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = inputRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
    }
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close context menus on outside click
  useEffect(() => {
    const handleClick = () => {
      setConvContextMenu(null)
      setContextMenuMsg(null)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Focus input when conversation selected
  useEffect(() => {
    if (selectedConversation && !showNewChat) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [selectedConversation, showNewChat])

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || isSending) return
    setIsSending(true)
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          contenu: newMessage.trim(),
        }),
      })
      if (res.ok) {
        const msg = await res.json()
        setMessages((prev) => [...prev, msg])
        setNewMessage('')
        adjustTextareaHeight()
        fetchConversations()
      } else {
        const err = await res.json().catch(() => ({}))
        console.error('[CHAT] Erreur envoi message:', err)
      }
    } catch (err) {
      console.error('[CHAT] Erreur réseau envoi:', err)
    } finally {
      setIsSending(false)
    }
  }

  // Delete message
  const deleteMessage = async (msgId: string) => {
    try {
      const res = await fetch(`/api/chat/messages/${msgId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== msgId))
        toast.success('Message supprimé')
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur réseau')
    }
    setContextMenuMsg(null)
  }

  // Start new direct conversation
  const startConversation = async (targetEmployeId: string) => {
    setIsLoading(true)
    setChatError(null)
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          type: 'direct',
          participantIds: [targetEmployeId],
        }),
      })

      if (res.ok) {
        const conv = await res.json()
        setSelectedConversation(conv)
        setMessages(conv.messages || [])
        setShowNewChat(false)
        setSearchQuery('')
        fetchConversations()
      } else if (res.status === 401) {
        const err = await res.json().catch(() => ({}))
        if (err.action === 'relogin') {
          setChatError('Session obsolète. Reconnexion en cours...')
          setTimeout(() => signOut({ callbackUrl: '/login' }), 2000)
        } else {
          setChatError('Session expirée. Rechargez la page et reconnectez-vous.')
        }
      } else {
        const err = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
        setChatError(err.details || err.error || 'Erreur lors de la création de la conversation')
      }
    } catch {
      setChatError('Erreur réseau. Vérifiez votre connexion.')
    } finally {
      setIsLoading(false)
    }
  }

  // Start new group conversation
  const startGroupConversation = async () => {
    if (!groupName.trim() || selectedGroupMembers.size === 0) return
    setIsLoading(true)
    setChatError(null)
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          type: 'group',
          nom: groupName.trim(),
          participantIds: Array.from(selectedGroupMembers),
        }),
      })
      if (res.ok) {
        const conv = await res.json()
        setSelectedConversation(conv)
        setMessages(conv.messages || [])
        setShowNewChat(false)
        setSearchQuery('')
        setGroupName('')
        setSelectedGroupMembers(new Set())
        setNewChatMode('direct')
        fetchConversations()
      } else if (res.status === 401) {
        const err = await res.json().catch(() => ({}))
        if (err.action === 'relogin') {
          setChatError('Session obsolète. Reconnexion en cours...')
          setTimeout(() => signOut({ callbackUrl: '/login' }), 2000)
        } else {
          setChatError('Session expirée. Rechargez la page et reconnectez-vous.')
        }
      } else {
        const err = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
        setChatError(err.details || err.error || 'Erreur lors de la création du groupe')
      }
    } catch {
      setChatError('Erreur réseau. Vérifiez votre connexion.')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleGroupMember = (empId: string) => {
    setSelectedGroupMembers(prev => {
      const next = new Set(prev)
      if (next.has(empId)) next.delete(empId)
      else next.add(empId)
      return next
    })
  }

  const selectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv)
    setShowGroupSettings(false)
    setDeleteConfirm(false)
    setShowAddMembers(false)
    await fetchMessages(conv.id)
  }

  // Open group settings
  const openGroupSettings = () => {
    if (!selectedConversation || selectedConversation.type !== 'group') return
    setEditGroupName(selectedConversation.nom || '')
    setShowGroupSettings(true)
    setDeleteConfirm(false)
    setShowAddMembers(false)
    setAddMembersSearch('')
    // Fetch employees for adding members
    setGroupSettingsLoading(true)
    fetch('/api/employees/list', { credentials: 'same-origin' })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) setGroupSettingsEmployees(data)
        else setGroupSettingsEmployees([])
      })
      .catch(() => setGroupSettingsEmployees([]))
      .finally(() => setGroupSettingsLoading(false))
  }

  // Update group name
  const updateGroupName = async () => {
    if (!selectedConversation || !editGroupName.trim()) return
    try {
      const res = await fetch(`/api/chat/conversations/${selectedConversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ nom: editGroupName.trim() }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSelectedConversation({ ...selectedConversation, nom: updated.nom, participants: updated.participants })
        fetchConversations()
        toast.success('Nom du groupe modifié')
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Erreur lors de la modification')
      }
    } catch {
      toast.error('Erreur réseau')
    }
  }

  // Add members to group
  const addMembersToGroup = async (memberIds: string[]) => {
    if (!selectedConversation || memberIds.length === 0) return
    try {
      const res = await fetch(`/api/chat/conversations/${selectedConversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ addMemberIds: memberIds }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSelectedConversation({ ...selectedConversation, nom: updated.nom, participants: updated.participants })
        fetchConversations()
        toast.success(`${memberIds.length} membre(s) ajouté(s)`)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur réseau')
    }
  }

  // Remove member from group
  const removeMemberFromGroup = async (memberId: string) => {
    if (!selectedConversation) return
    try {
      const res = await fetch(`/api/chat/conversations/${selectedConversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ removeMemberIds: [memberId] }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSelectedConversation({ ...selectedConversation, nom: updated.nom, participants: updated.participants })
        fetchConversations()
        toast.success('Membre retiré du groupe')
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur réseau')
    }
  }

  // Leave group (remove self)
  const leaveGroup = async () => {
    if (!selectedConversation || !employeId) return
    try {
      const res = await fetch(`/api/chat/conversations/${selectedConversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ removeMemberIds: [employeId] }),
      })
      if (res.ok) {
        setSelectedConversation(null)
        setShowGroupSettings(false)
        fetchConversations()
        toast.success('Vous avez quitté le groupe')
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur réseau')
    }
  }

  // Delete group
  const deleteGroup = async () => {
    if (!selectedConversation) return
    try {
      const res = await fetch(`/api/chat/conversations/${selectedConversation.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (res.ok) {
        setSelectedConversation(null)
        setShowGroupSettings(false)
        setDeleteConfirm(false)
        fetchConversations()
        toast.success('Groupe supprimé')
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur réseau')
    }
  }

  // Fetch employees for new chat
  useEffect(() => {
    if (showNewChat) {
      setEmployeesLoading(true)
      setChatError(null)
      fetch('/api/employees/list', { credentials: 'same-origin' })
        .then((res) => {
          if (res.ok) return res.json()
          if (res.status === 401) {
            setChatError('Session expirée. Veuillez vous reconnecter.')
            return []
          }
          return []
        })
        .then((data) => {
          if (Array.isArray(data)) {
            setEmployees(data)
          } else {
            setEmployees([])
          }
        })
        .catch(() => setEmployees([]))
        .finally(() => setEmployeesLoading(false))
    }
  }, [showNewChat])

  const getConvName = (conv: Conversation) => {
    if (conv.type === 'group' && conv.nom) return conv.nom
    const other = conv.participants.find((p) => p.employeId !== employeId)
    return other?.employe?.nom || 'Conversation'
  }

  const getConvAvatar = (conv: Conversation) => {
    if (conv.type === 'group') return 'GR'
    const other = conv.participants.find((p) => p.employeId !== employeId)
    return other?.employe?.nom ? getInitials(other.employe.nom) : '??'
  }

  const getConvRole = (conv: Conversation) => {
    const other = conv.participants.find((p) => p.employeId !== employeId)
    return other?.employe?.role || ''
  }

  // Get other participant's avatar color
  const getConvAvatarColor = (conv: Conversation) => {
    const other = conv.participants.find((p) => p.employeId !== employeId)
    return other?.employe?.nom ? getAvatarColor(other.employe.nom) : 'from-slate-400 to-slate-500'
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.type === 'group' && a.nom === 'Général') return -1
    if (b.type === 'group' && b.nom === 'Général') return 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  const filteredConversations = sortedConversations.filter((conv) => {
    if (!searchQuery) return true
    const name = getConvName(conv).toLowerCase()
    return name.includes(searchQuery.toLowerCase())
  })

  const filteredEmployees = employees.filter((emp) => {
    if (!searchQuery) return true
    return emp.nom.toLowerCase().includes(searchQuery.toLowerCase())
  })

  // Group messages by date for separators
  const messagesWithSeparators = useMemo(() => {
    const result: { type: 'separator' | 'message'; date?: string; msg?: Conversation['messages'][0] }[] = []
    let lastDate = ''

    messages.forEach((msg) => {
      const msgDate = new Date(msg.createdAt).toDateString()
      if (msgDate !== lastDate) {
        result.push({ type: 'separator', date: msg.createdAt })
        lastDate = msgDate
      }
      result.push({ type: 'message', msg })
    })

    return result
  }, [messages])

  // Check if message is consecutive (same sender, within 2 min)
  const isConsecutive = (index: number) => {
    if (index === 0) return false
    const prev = messages[index - 1]
    const curr = messages[index]
    if (prev.expediteurId !== curr.expediteurId) return false
    const diff = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime()
    return diff < 120000 // 2 minutes
  }

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white shadow-xl shadow-[#134885]/30 hover:shadow-2xl hover:shadow-[#134885]/40 transition-shadow"
          >
            <MessageCircle className="h-6 w-6" />
            {totalUnread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F6852A] px-1 text-[10px] font-bold text-white"
              >
                {totalUnread > 99 ? '99+' : totalUnread}
              </motion.span>
            )}
            {totalUnread > 0 && (
              <span className="absolute inset-0 rounded-full animate-ping bg-[#F6852A]/30" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 flex h-[580px] w-[400px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b bg-gradient-to-r from-[#134885] to-[#1A5A9E] px-4 py-3">
              {selectedConversation && !showNewChat ? (
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="shrink-0 rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <Avatar className="h-9 w-9 shrink-0 ring-2 ring-white/20">
                    <AvatarFallback className={
                      selectedConversation.type === 'group'
                        ? `bg-[#F6852A]/20 text-xs text-[#F6852A]`
                        : `bg-gradient-to-br ${getConvAvatarColor(selectedConversation)} text-xs text-white`
                    }>
                      {selectedConversation.type === 'group' ? (
                        <Users className="h-4 w-4" />
                      ) : (
                        getConvAvatar(selectedConversation)
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {selectedConversation.type === 'group' && selectedConversation.nom === 'Général'
                        ? '📢 Général'
                        : getConvName(selectedConversation)
                      }
                    </p>
                    {selectedConversation.type === 'group' ? (
                      <p className="text-[10px] text-white/60">
                        {selectedConversation.participants.length} membres
                        {selectedConversation.nom !== 'Général' && (
                          <> · {selectedConversation.participants.map(p => p.employe?.nom?.split(' ')[0]).filter(Boolean).join(', ')}</>
                        )}
                      </p>
                    ) : (
                      <p className="text-[10px] text-white/60">
                        {roleLabels[getConvRole(selectedConversation)] || ''}
                      </p>
                    )}
                  </div>
                </div>
              ) : showNewChat ? (
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => { setShowNewChat(false); setSearchQuery(''); setChatError(null); setNewChatMode('direct'); setGroupName(''); setSelectedGroupMembers(new Set()) }}
                    className="shrink-0 rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <p className="text-sm font-semibold text-white">
                    {newChatMode === 'group' ? 'Nouveau groupe' : 'Nouvelle conversation'}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <MessageCircle className="h-5 w-5 text-white" />
                  <p className="text-sm font-semibold text-white">Messages</p>
                  {totalUnread > 0 && (
                    <span className="rounded-full bg-[#F6852A] px-2 py-0.5 text-[10px] font-bold text-white">
                      {totalUnread}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1">
                {selectedConversation && selectedConversation.type === 'group' && selectedConversation.nom !== 'Général' && !showNewChat && (
                  <button
                    onClick={() => showGroupSettings ? setShowGroupSettings(false) : openGroupSettings()}
                    className={`shrink-0 rounded-full p-1.5 transition-colors ${
                      showGroupSettings
                        ? 'bg-white/20 text-white'
                        : 'text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                    title="Paramètres du groupe"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  className="shrink-0 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                  title={notificationsEnabled ? 'Désactiver les notifications' : 'Activer les notifications'}
                >
                  {notificationsEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setSelectedConversation(null)
                    setShowNewChat(false)
                    setChatError(null)
                    setSearchQuery('')
                    setShowGroupSettings(false)
                  }}
                  className="shrink-0 rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {chatError && (
              <div className="flex items-center gap-2 bg-red-50 border-b border-red-100 px-4 py-2 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{chatError}</span>
                <button onClick={() => setChatError(null)} className="shrink-0 text-red-400 hover:text-red-600">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Content */}
            {selectedConversation && !showNewChat && showGroupSettings && selectedConversation.type === 'group' && selectedConversation.nom !== 'Général' ? (
              /* ===== Group Settings View ===== */
              <div className="flex flex-1 flex-col min-h-0">
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                  {/* Group Avatar & Name */}
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F6852A]/10">
                      <Users className="h-8 w-8 text-[#F6852A]" />
                    </div>
                    <div className="flex items-center gap-2 w-full max-w-[280px]">
                      <Input
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        className="h-9 text-center text-sm font-semibold rounded-full border-slate-200 bg-slate-50 focus:border-[#F6852A] focus:ring-[#F6852A]/20"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') updateGroupName()
                        }}
                      />
                      <Button
                        size="icon"
                        className="h-9 w-9 shrink-0 rounded-full bg-[#F6852A] hover:bg-[#E0752A]"
                        disabled={!editGroupName.trim() || editGroupName.trim() === selectedConversation.nom}
                        onClick={updateGroupName}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Groupe créé le {new Date(selectedConversation.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Members List */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Membres ({selectedConversation.participants.length})
                      </p>
                      {!showAddMembers ? (
                        <button
                          onClick={() => setShowAddMembers(true)}
                          className="flex items-center gap-1 text-[11px] font-medium text-[#F6852A] hover:text-[#E0752A] transition-colors"
                        >
                          <UserPlus className="h-3 w-3" />
                          Ajouter
                        </button>
                      ) : (
                        <button
                          onClick={() => { setShowAddMembers(false); setAddMembersSearch('') }}
                          className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          Fermer
                        </button>
                      )}
                    </div>

                    {/* Add Members Panel */}
                    {showAddMembers && (
                      <div className="mb-3 rounded-xl border border-dashed border-[#F6852A]/30 bg-[#F6852A]/5 p-3 space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          <Input
                            value={addMembersSearch}
                            onChange={(e) => setAddMembersSearch(e.target.value)}
                            placeholder="Rechercher un employé..."
                            className="h-8 pl-8 text-xs rounded-full border-slate-200 bg-white"
                          />
                        </div>
                        {groupSettingsLoading ? (
                          <div className="flex justify-center py-3">
                            <Loader2 className="h-4 w-4 animate-spin text-[#F6852A]" />
                          </div>
                        ) : (
                          <div className="max-h-[140px] overflow-y-auto space-y-0.5">
                            {groupSettingsEmployees
                              .filter(emp => {
                                // Only show employees not already in the group
                                const isAlreadyMember = selectedConversation.participants.some(p => p.employeId === emp.id)
                                if (isAlreadyMember) return false
                                if (!addMembersSearch) return true
                                return emp.nom.toLowerCase().includes(addMembersSearch.toLowerCase())
                              })
                              .map(emp => (
                                <button
                                  key={emp.id}
                                  onClick={() => addMembersToGroup([emp.id])}
                                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white transition-colors"
                                >
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className={`bg-gradient-to-br ${getAvatarColor(emp.nom)} text-[8px] text-white`}>
                                      {getInitials(emp.nom)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium text-slate-700">{emp.nom}</span>
                                  <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-medium ${roleColors[emp.role] || 'bg-slate-100 text-slate-600'}`}>
                                    {roleLabels[emp.role] || emp.role}
                                  </span>
                                  <Plus className="h-3 w-3 text-[#F6852A]" />
                                </button>
                              ))
                            }
                            {groupSettingsEmployees.filter(emp => !selectedConversation.participants.some(p => p.employeId === emp.id)).length === 0 && (
                              <p className="text-center text-[11px] text-slate-400 py-2">Tous les employés sont déjà dans le groupe</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Current Members */}
                    <div className="space-y-0.5">
                      {selectedConversation.participants.map((p) => {
                        const isSelf = p.employeId === employeId
                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-50 transition-colors"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className={`bg-gradient-to-br ${getAvatarColor(p.employe?.nom || '?')} text-[9px] text-white`}>
                                {getInitials(p.employe?.nom || '??')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-800 truncate">
                                {p.employe?.nom || 'Inconnu'}
                                {isSelf && <span className="text-slate-400 font-normal"> (vous)</span>}
                              </p>
                              <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium ${roleColors[p.employe?.role || ''] || 'bg-slate-100 text-slate-600'}`}>
                                {roleLabels[p.employe?.role || ''] || p.employe?.role}
                              </span>
                            </div>
                            {!isSelf && (
                              <button
                                onClick={() => removeMemberFromGroup(p.employeId)}
                                className="shrink-0 rounded-full p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Retirer du groupe"
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    {!deleteConfirm ? (
                      <>
                        <button
                          onClick={leaveGroup}
                          className="flex items-center gap-2 w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Quitter le groupe
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(true)}
                          className="flex items-center gap-2 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Supprimer le groupe
                        </button>
                      </>
                    ) : (
                      <div className="rounded-xl border border-red-300 bg-red-50 p-3 space-y-2">
                        <p className="text-xs font-medium text-red-700">
                          Êtes-vous sûr de vouloir supprimer ce groupe ? Cette action est irréversible et tous les messages seront perdus.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setDeleteConfirm(false)}
                            variant="outline"
                            size="sm"
                            className="flex-1 rounded-full border-slate-200 text-xs h-8"
                          >
                            Annuler
                          </Button>
                          <Button
                            onClick={deleteGroup}
                            size="sm"
                            className="flex-1 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs h-8"
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            Supprimer
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : selectedConversation && !showNewChat ? (
              /* ===== Messages View ===== */
              <div className="flex flex-1 flex-col min-h-0">
                <div
                  ref={scrollAreaRef}
                  className="flex-1 overflow-y-auto px-4 py-3 scroll-smooth"
                  onScroll={(e) => {
                    const el = e.currentTarget
                    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
                    setShowScrollDown(!isNearBottom)
                  }}
                >
                  <div className="space-y-1">
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center gap-3 py-12">
                        <div className="rounded-full bg-slate-100 p-4">
                          <MessageCircle className="h-8 w-8 text-slate-300" />
                        </div>
                        <p className="text-sm font-medium text-slate-500">Commencez la conversation</p>
                        <p className="text-xs text-slate-400">Envoyez votre premier message</p>
                      </div>
                    )}

                    {messagesWithSeparators.map((item, idx) => {
                      if (item.type === 'separator' && item.date) {
                        return (
                          <div key={`sep-${idx}`} className="flex items-center justify-center py-3">
                            <div className="flex items-center gap-3 w-full">
                              <div className="flex-1 h-px bg-slate-200" />
                              <span className="text-[10px] font-medium text-slate-400 bg-white px-2 rounded-full">
                                {formatDateSeparator(item.date)}
                              </span>
                              <div className="flex-1 h-px bg-slate-200" />
                            </div>
                          </div>
                        )
                      }

                      const msg = item.msg!
                      const isOwn = msg.expediteurId === employeId
                      const consecutive = isConsecutive(messages.indexOf(msg))
                      const msgIndex = messages.indexOf(msg)

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${
                            consecutive ? 'mt-0.5' : 'mt-3'
                          } group relative`}
                        >
                          {/* Other's avatar (only for non-consecutive group messages) */}
                          {!isOwn && selectedConversation.type === 'group' && !consecutive && (
                            <Avatar className="h-7 w-7 shrink-0 mr-2 mt-0.5">
                              <AvatarFallback className={`bg-gradient-to-br ${getAvatarColor(msg.expediteur?.nom || '?')} text-[9px] text-white`}>
                                {getInitials(msg.expediteur?.nom || '??')}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          {!isOwn && selectedConversation.type === 'group' && consecutive && (
                            <div className="w-7 mr-2 shrink-0" />
                          )}

                          <div className={`max-w-[78%] relative ${isOwn ? 'flex flex-col items-end' : ''}`}>
                            {/* Sender name for group (non-consecutive) */}
                            {!isOwn && selectedConversation.type === 'group' && !consecutive && (
                              <p className="mb-1 text-[10px] font-semibold text-slate-500 ml-1">
                                {msg.expediteur?.nom || 'Inconnu'}
                              </p>
                            )}

                            <div
                              className={`rounded-2xl px-3.5 py-2 transition-colors ${
                                isOwn
                                  ? 'bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white rounded-br-md'
                                  : 'bg-slate-100 text-slate-800 rounded-bl-md'
                              }`}
                            >
                              <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                                {linkifyText(msg.contenu)}
                              </p>
                              <div
                                className={`mt-0.5 flex items-center gap-1 ${
                                  isOwn ? 'justify-end' : 'justify-start'
                                }`}
                              >
                                <p className={`text-[10px] ${isOwn ? 'text-white/50' : 'text-slate-400'}`}>
                                  {formatMessageTime(msg.createdAt)}
                                </p>
                                {isOwn && <CheckCheck className="h-3 w-3 text-white/50" />}
                              </div>
                            </div>

                            {/* Context menu on hover */}
                            {isOwn && (
                              <button
                                onClick={() => setContextMenuMsg(contextMenuMsg === msg.id ? null : msg.id)}
                                className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-slate-200"
                              >
                                <MoreVertical className="h-3.5 w-3.5 text-slate-400" />
                              </button>
                            )}
                            {!isOwn && (
                              <button
                                onClick={() => setContextMenuMsg(contextMenuMsg === msg.id ? null : msg.id)}
                                className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-slate-200"
                              >
                                <MoreVertical className="h-3.5 w-3.5 text-slate-400" />
                              </button>
                            )}

                            {/* Context dropdown */}
                            {contextMenuMsg === msg.id && (
                              <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} top-full mt-1 z-10 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[140px]`}>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(msg.contenu); toast.success('Copié'); setContextMenuMsg(null) }}
                                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                  Copier le texte
                                </button>
                                {isOwn && (
                                  <button
                                    onClick={() => deleteMessage(msg.id)}
                                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Supprimer
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Scroll to bottom button */}
                {showScrollDown && (
                  <button
                    onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    className="absolute bottom-20 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                )}

                {/* Message Input */}
                <div className="border-t px-3 py-2 bg-white">
                  {/* Emoji row (when picker open) */}
                  {showEmojiPicker && (
                    <div className="flex flex-wrap gap-1 mb-2 p-2 bg-slate-50 rounded-xl">
                      {quickEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            setNewMessage(prev => prev + emoji)
                            inputRef.current?.focus()
                          }}
                          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-200 transition-colors text-base"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      sendMessage()
                    }}
                    className="flex items-end gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`shrink-0 h-9 w-9 flex items-center justify-center rounded-full transition-colors ${
                        showEmojiPicker ? 'bg-amber-100 text-amber-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Smile className="h-5 w-5" />
                    </button>
                    <div className="flex-1 relative">
                      <textarea
                        ref={inputRef}
                        value={newMessage}
                        onChange={(e) => {
                          setNewMessage(e.target.value)
                          adjustTextareaHeight()
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendMessage()
                          }
                        }}
                        placeholder="Écrire un message..."
                        rows={1}
                        className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] focus:border-[#134885] focus:ring-2 focus:ring-[#134885]/20 focus:outline-none transition-all max-h-[120px] leading-relaxed"
                        disabled={isSending}
                      />
                    </div>
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!newMessage.trim() || isSending}
                      className="h-9 w-9 shrink-0 rounded-full bg-[#134885] hover:bg-[#0D3A6E] disabled:opacity-40 transition-all"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                  <p className="text-[9px] text-slate-400 mt-1 text-center">
                    Entrée pour envoyer · Shift+Entrée pour saut de ligne
                  </p>
                </div>
              </div>
            ) : showNewChat ? (
              /* ===== New Chat View ===== */
              <div className="flex flex-1 flex-col min-h-0">
                <div className="flex gap-1 px-4 pt-3 pb-2">
                  <button
                    onClick={() => { setNewChatMode('direct'); setSearchQuery('') }}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      newChatMode === 'direct'
                        ? 'bg-[#134885] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Message direct
                  </button>
                  <button
                    onClick={() => { setNewChatMode('group'); setSearchQuery('') }}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      newChatMode === 'group'
                        ? 'bg-[#F6852A] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    Groupe
                  </button>
                </div>

                {newChatMode === 'group' && (
                  <div className="px-4 pb-2">
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="Nom du groupe..."
                        className="h-9 pl-9 rounded-full border-slate-200 bg-slate-50 text-sm focus:border-[#F6852A] focus:ring-[#F6852A]/20"
                      />
                    </div>
                    {selectedGroupMembers.size > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Array.from(selectedGroupMembers).map((empId) => {
                          const emp = employees.find(e => e.id === empId)
                          if (!emp) return null
                          return (
                            <span
                              key={empId}
                              className="inline-flex items-center gap-1 rounded-full bg-[#F6852A]/10 px-2 py-0.5 text-[10px] font-medium text-[#F6852A]"
                            >
                              {emp.nom}
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleGroupMember(empId) }}
                                className="ml-0.5 rounded-full hover:bg-[#F6852A]/20 p-0.5"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="px-4 pb-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={newChatMode === 'group' ? 'Ajouter des membres...' : 'Rechercher un employé...'}
                      className="h-9 pl-9 rounded-full border-slate-200 bg-slate-50 text-sm"
                    />
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="py-1">
                    {employeesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                      </div>
                    ) : filteredEmployees.length === 0 ? (
                      <p className="py-8 text-center text-sm text-slate-400">
                        Aucun employé trouvé
                      </p>
                    ) : newChatMode === 'direct' ? (
                      filteredEmployees.map((emp) => (
                        <button
                          key={emp.id}
                          onClick={() => startConversation(emp.id)}
                          disabled={isLoading}
                          className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className={`bg-gradient-to-br ${getAvatarColor(emp.nom)} text-xs text-white`}>
                              {getInitials(emp.nom)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-left flex-1">
                            <p className="text-sm font-medium text-slate-800">{emp.nom}</p>
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                roleColors[emp.role] || 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {roleLabels[emp.role] || emp.role}
                            </span>
                          </div>
                          {isLoading && (
                            <Loader2 className="h-4 w-4 animate-spin text-[#134885]" />
                          )}
                        </button>
                      ))
                    ) : (
                      filteredEmployees.map((emp) => {
                        const isSelected = selectedGroupMembers.has(emp.id)
                        return (
                          <button
                            key={emp.id}
                            onClick={() => toggleGroupMember(emp.id)}
                            className={`flex w-full items-center gap-3 px-4 py-2.5 transition-colors ${
                              isSelected ? 'bg-[#F6852A]/5' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                              isSelected ? 'border-[#F6852A] bg-[#F6852A]' : 'border-slate-300'
                            }`}>
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className={`bg-gradient-to-br ${getAvatarColor(emp.nom)} text-xs text-white`}>
                                {getInitials(emp.nom)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="text-left flex-1">
                              <p className={`text-sm ${isSelected ? 'font-semibold text-slate-800' : 'font-medium text-slate-700'}`}>{emp.nom}</p>
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  roleColors[emp.role] || 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {roleLabels[emp.role] || emp.role}
                              </span>
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>

                {newChatMode === 'group' && (
                  <div className="border-t px-4 py-3">
                    <Button
                      onClick={startGroupConversation}
                      disabled={!groupName.trim() || selectedGroupMembers.size === 0 || isLoading}
                      className="w-full rounded-full bg-[#F6852A] hover:bg-[#E0752A] text-white disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Users className="mr-2 h-4 w-4" />
                      )}
                      Créer le groupe{selectedGroupMembers.size > 0 ? ` (${selectedGroupMembers.size})` : ''}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* ===== Conversations List ===== */
              <div className="flex flex-1 flex-col min-h-0">
                <div className="px-4 py-3 border-b space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher une conversation..."
                      className="h-9 pl-9 rounded-full border-slate-200 bg-slate-50 text-sm"
                    />
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="py-1">
                    {filteredConversations.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 py-12 px-4">
                        <div className="rounded-full bg-slate-100 p-4">
                          <MessageCircle className="h-8 w-8 text-slate-300" />
                        </div>
                        <p className="text-center text-sm font-medium text-slate-500">
                          Aucune conversation
                        </p>
                        <p className="text-center text-xs text-slate-400">
                          Commencez par envoyer un message
                        </p>
                        <Button
                          onClick={() => setShowNewChat(true)}
                          size="sm"
                          className="rounded-full bg-[#134885] hover:bg-[#0D3A6E]"
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Nouveau message
                        </Button>
                      </div>
                    ) : (
                      filteredConversations.map((conv) => {
                        const lastMsg = conv.messages?.[0]
                        const isGeneral = conv.type === 'group' && conv.nom === 'Général'
                        const otherEmpName = conv.type === 'direct'
                          ? conv.participants.find(p => p.employeId !== employeId)?.employe?.nom
                          : null

                        return (
                          <div key={conv.id} className="relative group">
                            <button
                              onClick={() => { selectConversation(conv); setConvContextMenu(null) }}
                              className={`flex w-full items-center gap-3 px-4 py-3 transition-colors ${
                                conv.unreadCount > 0 ? 'bg-slate-50/80 hover:bg-slate-100' : 'hover:bg-slate-50'
                              }`}
                            >
                            <div className="relative">
                              <Avatar className="h-11 w-11 ring-1 ring-slate-100">
                                <AvatarFallback
                                  className={
                                    isGeneral
                                      ? 'bg-gradient-to-br from-[#134885] to-[#1A5A9E] text-xs text-white'
                                      : conv.type === 'group'
                                        ? 'bg-[#F6852A]/10 text-xs text-[#F6852A]'
                                        : `bg-gradient-to-br ${getAvatarColor(otherEmpName || '')} text-xs text-white`
                                  }
                                >
                                  {isGeneral ? (
                                    <Users className="h-5 w-5" />
                                  ) : conv.type === 'group' ? (
                                    <Users className="h-4 w-4" />
                                  ) : (
                                    getConvAvatar(conv)
                                  )}
                                </AvatarFallback>
                              </Avatar>
                              {conv.unreadCount > 0 && (
                                <span className="absolute -right-0.5 -bottom-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F6852A] px-1 text-[9px] font-bold text-white ring-2 ring-white">
                                  {conv.unreadCount}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <div className="flex items-center justify-between gap-2">
                                <p
                                  className={`truncate text-sm ${
                                    isGeneral
                                      ? 'font-bold text-[#134885]'
                                      : conv.unreadCount > 0
                                        ? 'font-semibold text-slate-900'
                                        : 'font-medium text-slate-700'
                                  }`}
                                >
                                  {isGeneral ? '📢 Général' : getConvName(conv)}
                                </p>
                                <span className={`shrink-0 text-[10px] ${conv.unreadCount > 0 ? 'text-[#F6852A] font-semibold' : 'text-slate-400'}`}>
                                  {lastMsg ? formatTime(lastMsg.createdAt) : ''}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-0.5">
                                <p className={`truncate text-xs ${conv.unreadCount > 0 ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                                  {lastMsg
                                    ? lastMsg.expediteurId === employeId
                                      ? `Vous : ${lastMsg.contenu}`
                                      : conv.type === 'group'
                                        ? `${lastMsg.expediteur?.nom?.split(' ')[0] || ''} : ${lastMsg.contenu}`
                                        : lastMsg.contenu
                                    : conv.type === 'group'
                                      ? `${conv.participants.length} membres`
                                      : roleLabels[getConvRole(conv)] || ''
                                  }
                                </p>
                                {conv.unreadCount > 0 && (
                                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#F6852A]" />
                                )}
                              </div>
                            </div>
                            {/* 3-dot menu for groups */}
                            {conv.type === 'group' && conv.nom !== 'Général' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setConvContextMenu(convContextMenu === conv.id ? null : conv.id) }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-slate-200 transition-opacity"
                              >
                                <MoreVertical className="h-3.5 w-3.5 text-slate-400" />
                              </button>
                            )}
                            </button>
                            {/* Context menu for groups */}
                            {convContextMenu === conv.id && conv.type === 'group' && conv.nom !== 'Général' && (
                              <div className="absolute right-2 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[160px]">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setConvContextMenu(null)
                                    selectConversation(conv)
                                    setTimeout(() => openGroupSettings(), 100)
                                  }}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                                >
                                  <Settings className="h-3.5 w-3.5" />
                                  Paramètres du groupe
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    setConvContextMenu(null)
                                    if (confirm('Voulez-vous vraiment supprimer ce groupe ?')) {
                                      try {
                                        const res = await fetch(`/api/chat/conversations/${conv.id}`, {
                                          method: 'DELETE',
                                          credentials: 'same-origin',
                                        })
                                        if (res.ok) {
                                          fetchConversations()
                                          toast.success('Groupe supprimé')
                                        } else {
                                          const err = await res.json().catch(() => ({}))
                                          toast.error(err.error || 'Erreur')
                                        }
                                      } catch {
                                        toast.error('Erreur réseau')
                                      }
                                    }
                                  }}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Supprimer le groupe
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>

                {/* New Chat Buttons */}
                {conversations.length > 0 && (
                  <div className="border-t px-4 py-3 space-y-2">
                    <Button
                      onClick={() => {
                        setShowNewChat(true)
                        setSearchQuery('')
                        setNewChatMode('direct')
                      }}
                      variant="outline"
                      className="w-full rounded-full border-dashed border-[#134885]/30 text-[#134885] hover:bg-[#134885]/5 hover:border-[#134885]/50"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Nouveau message
                    </Button>
                    <Button
                      onClick={() => {
                        setShowNewChat(true)
                        setSearchQuery('')
                        setNewChatMode('group')
                      }}
                      variant="outline"
                      className="w-full rounded-full border-dashed border-[#F6852A]/30 text-[#F6852A] hover:bg-[#F6852A]/5 hover:border-[#F6852A]/50"
                    >
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                      Créer un groupe
                    </Button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
