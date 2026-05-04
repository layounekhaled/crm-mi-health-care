'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useCRMStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Bell, AlertTriangle, Clock, TrendingDown, FileText, Info, Check, CheckCheck, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Notification {
  id: string
  type: string
  titre: string
  message: string
  lue: boolean
  lien: string | null
  referenceId: string | null
  createdAt: string
}

const notificationConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  tache_retard: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50' },
  tache_bientot: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
  opp_stagnante: { icon: TrendingDown, color: 'text-orange-500', bg: 'bg-orange-50' },
  devis_sans_suivi: { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50' },
  info: { icon: Info, color: 'text-slate-500', bg: 'bg-slate-50' },
}

function getConfig(type: string) {
  return notificationConfig[type] || notificationConfig.info
}

function formatTimeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: fr })
  } catch {
    return ''
  }
}

export function NotificationsBell() {
  const { user } = useAuth()
  const { setCurrentPage } = useCRMStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await fetch('/api/notifications?limit=20', {
        headers: { 'x-user-id': user.id },
      })
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        const count = parseInt(res.headers.get('x-unread-count') || '0')
        setUnreadCount(count)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }, [user?.id])

  const detectNotifications = useCallback(async () => {
    if (!user?.id) return
    try {
      await fetch('/api/notifications/detect', { method: 'POST' })
    } catch (error) {
      console.error('Error detecting notifications:', error)
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id) {
      detectNotifications().then(() => fetchNotifications())
    }
  }, [user?.id, fetchNotifications, detectNotifications])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!user?.id) return
    const interval = setInterval(() => {
      detectNotifications().then(() => fetchNotifications())
    }, 60000)
    return () => clearInterval(interval)
  }, [user?.id, fetchNotifications, detectNotifications])

  const markAsRead = async (id: string) => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({ lue: true }),
      })
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, lue: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const deleteNotification = async (id: string) => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user.id },
      })
      if (res.ok) {
        const deleted = notifications.find((n) => n.id === id)
        setNotifications((prev) => prev.filter((n) => n.id !== id))
        if (deleted && !deleted.lue) {
          setUnreadCount((prev) => Math.max(0, prev - 1))
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const markAllAsRead = async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      const res = await fetch(`/api/notifications/mark-all-read?userId=${user.id}`, {
        method: 'PUT',
      })
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, lue: true })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.lue) {
      markAsRead(notification.id)
    }
    if (notification.lien) {
      // Parse the page from the lien query param
      try {
        const url = new URL(notification.lien, 'http://localhost')
        const page = url.searchParams.get('page')
        if (page) {
          setCurrentPage(page as 'dashboard' | 'prospects' | 'events' | 'opportunities' | 'operations' | 'tasks' | 'after-sales' | 'employees')
        }
      } catch {
        // ignore
      }
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 border-0 p-0 shadow-xl sm:w-96"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={markAllAsRead}
                disabled={loading}
              >
                <CheckCheck className="h-3 w-3" />
                Tout lire
              </Button>
            )}
          </div>
        </div>

        {/* Notification list */}
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <Bell className="mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm">Aucune notification</p>
            </div>
          ) : (
            <div className="flex flex-col">
              <AnimatePresence>
                {notifications.map((notification, index) => {
                  const config = getConfig(notification.type)
                  const Icon = config.icon
                  return (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      <div
                        className={`group flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${
                          !notification.lue ? 'bg-emerald-50/30' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        {/* Icon */}
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.bg}`}>
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm leading-tight ${!notification.lue ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                              {notification.titre}
                            </p>
                            {!notification.lue && (
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                            )}
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {formatTimeAgo(notification.createdAt)}
                          </p>
                        </div>

                        {/* Actions on hover */}
                        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          {!notification.lue && (
                            <button
                              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                markAsRead(notification.id)
                              }}
                              title="Marquer comme lu"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteNotification(notification.id)
                            }}
                            title="Supprimer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {index < notifications.length - 1 && <Separator className="mx-4" />}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
