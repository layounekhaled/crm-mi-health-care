'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useCRMStore } from '@/lib/store'
import { signOut } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  MessageCircle,
  X,
  Send,
  Search,
  Plus,
  ArrowLeft,
  Users,
  Loader2,
  CheckCheck,
  AlertCircle,
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
  if (diffHours < 24) return `il y a ${diffHours}h`
  if (diffDays < 7) return `il y a ${diffDays}j`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
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
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isSending, setIsSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const lastPollTimeRef = useRef<string>(new Date().toISOString())

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

  // Poll for new messages
  const pollNewMessages = useCallback(async () => {
    if (!isOpen || !selectedConversation) return
    try {
      const res = await fetch(
        `/api/chat/messages/latest?since=${encodeURIComponent(lastPollTimeRef.current)}`,
        { credentials: 'same-origin' }
      )
      if (res.ok) {
        const data = await res.json()
        const newMsgs = data.messages || data
        if (Array.isArray(newMsgs) && newMsgs.length > 0) {
          const relevantMsgs = newMsgs.filter(
            (m: { conversationId: string }) => m.conversationId === selectedConversation.id
          )
          if (relevantMsgs.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id))
              const filtered = relevantMsgs.filter((m: { id: string }) => !existingIds.has(m.id))
              return [...prev, ...filtered]
            })
          }
          lastPollTimeRef.current = new Date().toISOString()
          fetchConversations()
        }
      }
    } catch {
      // silent fail for polling
    }
  }, [isOpen, selectedConversation, fetchConversations])

  // Start/stop polling
  useEffect(() => {
    if (isOpen) {
      fetchConversations()
      pollingRef.current = setInterval(pollNewMessages, 5000)
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [isOpen, fetchConversations, pollNewMessages])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  // Start new conversation
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
    } catch (error) {
      setChatError('Erreur réseau. Vérifiez votre connexion.')
    } finally {
      setIsLoading(false)
    }
  }

  // Select conversation
  const selectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv)
    await fetchMessages(conv.id)
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

  // Get conversation display name
  const getConvName = (conv: Conversation) => {
    if (conv.type === 'group' && conv.nom) return conv.nom
    const other = conv.participants.find((p) => p.employeId !== employeId)
    return other?.employe?.nom || 'Conversation'
  }

  // Get conversation avatar
  const getConvAvatar = (conv: Conversation) => {
    if (conv.type === 'group') return 'GR'
    const other = conv.participants.find((p) => p.employeId !== employeId)
    return other?.employe?.nom ? getInitials(other.employe.nom) : '??'
  }

  // Get other participant's role
  const getConvRole = (conv: Conversation) => {
    const other = conv.participants.find((p) => p.employeId !== employeId)
    return other?.employe?.role || ''
  }

  // Total unread count
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  // Trier les conversations : Général en premier, puis par date
  const sortedConversations = [...conversations].sort((a, b) => {
    // Canal Général toujours en premier
    if (a.type === 'group' && a.nom === 'Général') return -1
    if (b.type === 'group' && b.nom === 'Général') return 1
    // Ensuite par date de mise à jour
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  // Filter conversations by search
  const filteredConversations = sortedConversations.filter((conv) => {
    if (!searchQuery) return true
    const name = getConvName(conv).toLowerCase()
    return name.includes(searchQuery.toLowerCase())
  })

  // Filter employees by search
  const filteredEmployees = employees.filter((emp) => {
    if (!searchQuery) return true
    return emp.nom.toLowerCase().includes(searchQuery.toLowerCase())
  })

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
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F6852A] px-1 text-[10px] font-bold text-white">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
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
            className="fixed bottom-6 right-6 z-50 flex h-[520px] w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
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
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-white/20 text-xs text-white">
                      {selectedConversation.type === 'group' && selectedConversation.nom === 'Général' ? (
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
                    {selectedConversation.type === 'group' && (
                      <p className="text-[10px] text-white/60">
                        {selectedConversation.participants.length} membres
                      </p>
                    )}
                  </div>
                </div>
              ) : showNewChat ? (
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => { setShowNewChat(false); setSearchQuery(''); setChatError(null) }}
                    className="shrink-0 rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <p className="text-sm font-semibold text-white">Nouvelle conversation</p>
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
              <button
                onClick={() => {
                  setIsOpen(false)
                  setSelectedConversation(null)
                  setShowNewChat(false)
                  setChatError(null)
                  setSearchQuery('')
                }}
                className="shrink-0 rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
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
            {selectedConversation && !showNewChat ? (
              /* Messages View */
              <div className="flex flex-1 flex-col min-h-0">
                <ScrollArea className="flex-1 px-4 py-3">
                  <div className="space-y-3">
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center gap-2 py-8">
                        <MessageCircle className="h-8 w-8 text-slate-300" />
                        <p className="text-sm text-slate-400">Commencez la conversation</p>
                      </div>
                    )}
                    {messages.map((msg) => {
                      const isOwn = msg.expediteurId === employeId
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                              isOwn
                                ? 'bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white rounded-br-md'
                                : 'bg-slate-100 text-slate-800 rounded-bl-md'
                            }`}
                          >
                            {!isOwn && selectedConversation.type === 'group' && (
                              <p className="mb-0.5 text-[10px] font-semibold text-[#134885]">
                                {msg.expediteur?.nom || 'Inconnu'}
                              </p>
                            )}
                            <p className="text-sm leading-relaxed">{msg.contenu}</p>
                            <div
                              className={`mt-1 flex items-center gap-1 ${
                                isOwn ? 'justify-end' : 'justify-start'
                              }`}
                            >
                              <p
                                className={`text-[10px] ${
                                  isOwn ? 'text-white/60' : 'text-slate-400'
                                }`}
                              >
                                {formatTime(msg.createdAt)}
                              </p>
                              {isOwn && <CheckCheck className="h-3 w-3 text-white/60" />}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message Input */}
                <div className="border-t px-4 py-3">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      sendMessage()
                    }}
                    className="flex items-center gap-2"
                  >
                    <Input
                      ref={inputRef}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Écrire un message..."
                      className="h-9 flex-1 rounded-full border-slate-200 bg-slate-50 text-sm focus:border-[#134885] focus:ring-[#134885]/20"
                      disabled={isSending}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!newMessage.trim() || isSending}
                      className="h-9 w-9 shrink-0 rounded-full bg-[#134885] hover:bg-[#0D3A6E]"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </div>
            ) : showNewChat ? (
              /* New Chat View */
              <div className="flex flex-1 flex-col min-h-0">
                <div className="px-4 py-3 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher un employé..."
                      className="h-9 pl-9 rounded-full border-slate-200 bg-slate-50 text-sm"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="py-2">
                    {employeesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                      </div>
                    ) : filteredEmployees.length === 0 ? (
                      <p className="py-8 text-center text-sm text-slate-400">
                        Aucun employé trouvé
                      </p>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <button
                          key={emp.id}
                          onClick={() => startConversation(emp.id)}
                          disabled={isLoading}
                          className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-[#134885]/10 text-xs text-[#134885]">
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
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              /* Conversations List */
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
                  <div className="py-2">
                    {filteredConversations.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 py-8 px-4">
                        <div className="rounded-full bg-slate-100 p-3">
                          <MessageCircle className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-center text-sm text-slate-500">
                          Aucune conversation
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
                      filteredConversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => selectConversation(conv)}
                          className="flex w-full items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback
                                className={
                                  conv.type === 'group' && conv.nom === 'G\u00e9n\u00e9ral'
                                    ? 'bg-gradient-to-br from-[#134885] to-[#1A5A9E] text-xs text-white'
                                    : conv.type === 'group'
                                      ? 'bg-[#F6852A]/10 text-xs text-[#F6852A]'
                                      : 'bg-[#134885]/10 text-xs text-[#134885]'
                                }
                              >
                                {conv.type === 'group' && conv.nom === 'G\u00e9n\u00e9ral' ? (
                                  <Users className="h-5 w-5" />
                                ) : conv.type === 'group' ? (
                                  <Users className="h-4 w-4" />
                                ) : (
                                  getConvAvatar(conv)
                                )}
                              </AvatarFallback>
                            </Avatar>
                            {conv.unreadCount > 0 && (
                              <span className="absolute -right-0.5 -bottom-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F6852A] px-1 text-[9px] font-bold text-white">
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <div className="flex items-center justify-between gap-2">
                              <p
                                className={`truncate text-sm ${
                                  conv.type === 'group' && conv.nom === 'G\u00e9n\u00e9ral'
                                    ? 'font-bold text-[#134885]'
                                    : conv.unreadCount > 0
                                      ? 'font-semibold text-slate-900'
                                      : 'font-medium text-slate-700'
                                }`}
                              >
                                {conv.type === 'group' && conv.nom === 'G\u00e9n\u00e9ral'
                                  ? '📢 G\u00e9n\u00e9ral'
                                  : getConvName(conv)
                                }
                              </p>
                              <span className="shrink-0 text-[10px] text-slate-400">
                                {conv.messages?.[0]
                                  ? formatTime(conv.messages[0].createdAt)
                                  : ''}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-xs text-slate-500">
                                {conv.messages?.[0]
                                  ? conv.messages[0].expediteurId === employeId
                                    ? `Vous: ${conv.messages[0].contenu}`
                                    : conv.messages[0].contenu
                                  : conv.type === 'group'
                                    ? `${conv.participants.length} membres`
                                    : roleLabels[getConvRole(conv)] || ''}
                              </p>
                              {conv.unreadCount > 0 && (
                                <span className="h-2 w-2 shrink-0 rounded-full bg-[#F6852A]" />
                              )}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* New Chat Button */}
                {conversations.length > 0 && (
                  <div className="border-t px-4 py-3">
                    <Button
                      onClick={() => {
                        setShowNewChat(true)
                        setSearchQuery('')
                      }}
                      variant="outline"
                      className="w-full rounded-full border-dashed border-[#134885]/30 text-[#134885] hover:bg-[#134885]/5 hover:border-[#134885]/50"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Nouveau message
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
