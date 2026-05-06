'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  MessageSquare,
  Eye,
  Users,
  Wrench,
  Package,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar as CalendarIcon,
  LayoutGrid,
  List,
  Columns3,
  Building2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useIsMobile } from '@/hooks/use-mobile'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Task {
  id: string
  titre: string
  type: string
  statut: string
  dateEcheance: string | null
  priorite: string
  description: string | null
  assigneA: { id: string; nom: string } | null
  prospect: { id: string; nom: string } | null
  opportunity: { id: string; nomProjet: string } | null
}

interface CRMEvent {
  id: string
  nom: string
  ville: string | null
  date: string
  type: string
  marques: string | null
  equipe: string | null
  notes: string | null
}

interface Interaction {
  id: string
  type: string
  notes: string | null
  date: string
  prospect: { id: string; nom: string } | null
  employe: { id: string; nom: string } | null
}

interface AfterSale {
  id: string
  type: string
  statut: string
  date: string | null
  client: { id: string; nom: string }
  employe: { id: string; nom: string } | null
}

// Union type for calendar items
type CalendarItem =
  | { kind: 'task'; data: Task }
  | { kind: 'event'; data: CRMEvent }
  | { kind: 'interaction'; data: Interaction }
  | { kind: 'sav'; data: AfterSale }

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const TASK_STATUS_COLORS: Record<string, string> = {
  en_attente: '#134885',
  en_cours: '#F6852A',
  terminee: '#059669',
}

const TASK_STATUS_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  terminee: 'Terminée',
}

const EVENT_COLOR = '#7C3AED'

const INTERACTION_TYPE_COLORS: Record<string, string> = {
  appel: '#0284C7',
  email: '#6366F1',
  whatsapp: '#16A34A',
  visite: '#059669',
  reunion: '#D97706',
}

const INTERACTION_TYPE_LABELS: Record<string, string> = {
  appel: 'Appel',
  email: 'Email',
  whatsapp: 'WhatsApp',
  visite: 'Visite',
  reunion: 'Réunion',
}

const INTERACTION_TYPE_ICONS: Record<string, React.ReactNode> = {
  appel: <Phone className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  whatsapp: <MessageSquare className="h-3.5 w-3.5" />,
  visite: <Eye className="h-3.5 w-3.5" />,
  reunion: <Users className="h-3.5 w-3.5" />,
}

const SAV_STATUS_COLORS: Record<string, string> = {
  en_attente: '#DC2626',
  en_cours: '#EA580C',
  terminee: '#059669',
}

const SAV_STATUS_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  terminee: 'Terminée',
}

const SAV_TYPE_LABELS: Record<string, string> = {
  livraison: 'Livraison',
  installation: 'Installation',
  maintenance: 'Maintenance',
  formation: 'Formation',
  réparation: 'Réparation',
  reparation: 'Réparation',
}

const TASK_TYPE_LABELS: Record<string, string> = {
  commerciale: 'Commerciale',
  suivi: 'Suivi',
  administrative: 'Administrative',
  technique: 'Technique',
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  congres: 'Congrès',
  salon: 'Salon',
  formation: 'Formation',
}

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8) // 8..18

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getDateKey(dateStr: string | null): string | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    return toDateString(d)
  } catch {
    return null
  }
}

function isToday(date: Date): boolean {
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function isSameMonth(date: Date, refDate: Date): boolean {
  return date.getFullYear() === refDate.getFullYear() && date.getMonth() === refDate.getMonth()
}

function getMonthDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Day of week: 0=Sun, 1=Mon... We want Mon=0
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6 // Sunday wraps to 6

  const days: Date[] = []

  // Previous month days
  for (let i = startDow - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i))
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d))
  }

  // Next month days to complete the grid (always 6 rows x 7 = 42 cells)
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push(new Date(year, month + 1, i))
  }

  return days
}

function getWeekDays(refDate: Date): Date[] {
  const d = new Date(refDate)
  let dow = d.getDay() - 1
  if (dow < 0) dow = 6
  const monday = new Date(d)
  monday.setDate(d.getDate() - dow)

  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    days.push(day)
  }
  return days
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

function formatDateFull(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function getHourFromDate(dateStr: string | null): number | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    return d.getHours()
  } catch {
    return null
  }
}

function getItemColor(item: CalendarItem): string {
  switch (item.kind) {
    case 'task':
      return TASK_STATUS_COLORS[item.data.statut] || '#134885'
    case 'event':
      return EVENT_COLOR
    case 'interaction':
      return INTERACTION_TYPE_COLORS[item.data.type] || '#0284C7'
    case 'sav':
      return SAV_STATUS_COLORS[item.data.statut] || '#DC2626'
  }
}

function getItemLabel(item: CalendarItem): string {
  switch (item.kind) {
    case 'task':
      return item.data.titre
    case 'event':
      return item.data.nom
    case 'interaction':
      return item.data.notes
        ? `${INTERACTION_TYPE_LABELS[item.data.type] || item.data.type} — ${item.data.notes.slice(0, 40)}`
        : `${INTERACTION_TYPE_LABELS[item.data.type] || item.data.type}`
    case 'sav':
      return `${SAV_TYPE_LABELS[item.data.type] || item.data.type} — ${item.data.client.nom}`
  }
}

function getItemIcon(item: CalendarItem): React.ReactNode {
  switch (item.kind) {
    case 'task':
      return <CheckCircle2 className="h-3.5 w-3.5" />
    case 'event':
      return <CalendarDays className="h-3.5 w-3.5" />
    case 'interaction':
      return INTERACTION_TYPE_ICONS[item.data.type] || <Phone className="h-3.5 w-3.5" />
    case 'sav':
      return <Wrench className="h-3.5 w-3.5" />
  }
}

function getKindLabel(kind: CalendarItem['kind']): string {
  switch (kind) {
    case 'task': return 'Tâche'
    case 'event': return 'Événement'
    case 'interaction': return 'Interaction'
    case 'sav': return 'SAV'
  }
}

// ─── Calendar Pill ───────────────────────────────────────────────────────────

function CalendarPill({
  item,
  onClick,
  compact = false,
}: {
  item: CalendarItem
  onClick: () => void
  compact?: boolean
}) {
  const color = getItemColor(item)
  const label = getItemLabel(item)

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="group/pill w-full text-left"
      title={label}
    >
      <div
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-white transition-all hover:brightness-110 hover:shadow-sm"
        style={{ backgroundColor: color }}
      >
        {compact ? null : (
          <span className="shrink-0 opacity-80">{getItemIcon(item)}</span>
        )}
        <span className={`truncate text-[11px] font-medium leading-tight ${compact ? 'text-[10px]' : ''}`}>
          {label}
        </span>
      </div>
    </button>
  )
}

// ─── Legend ──────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TASK_STATUS_COLORS.en_attente }} />
        <span>Tâche en attente</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TASK_STATUS_COLORS.en_cours }} />
        <span>Tâche en cours</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TASK_STATUS_COLORS.terminee }} />
        <span>Tâche terminée</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: EVENT_COLOR }} />
        <span>Événement</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: INTERACTION_TYPE_COLORS.appel }} />
        <span>Appel</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: INTERACTION_TYPE_COLORS.visite }} />
        <span>Visite</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: INTERACTION_TYPE_COLORS.reunion }} />
        <span>Réunion</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SAV_STATUS_COLORS.en_attente }} />
        <span>SAV en attente</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SAV_STATUS_COLORS.en_cours }} />
        <span>SAV en cours</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SAV_STATUS_COLORS.terminee }} />
        <span>SAV terminé</span>
      </div>
    </div>
  )
}

// ─── Event Detail Dialog ─────────────────────────────────────────────────────

function EventDetailDialog({
  item,
  open,
  onClose,
  onTaskComplete,
}: {
  item: CalendarItem | null
  open: boolean
  onClose: () => void
  onTaskComplete: (taskId: string) => void
}) {
  if (!item) return null

  const color = getItemColor(item)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: color }}
            >
              {getItemIcon(item)}
            </div>
            <span className="truncate">{getItemLabel(item)}</span>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs"
              style={{ borderColor: color, color }}
            >
              {getKindLabel(item.kind)}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Date */}
          <div className="flex items-start gap-3">
            <CalendarIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {item.kind === 'task' && item.data.dateEcheance
                  ? formatDateFull(item.data.dateEcheance)
                  : item.kind === 'event'
                  ? formatDateFull(item.data.date)
                  : item.kind === 'interaction'
                  ? formatDateFull(item.data.date)
                  : item.kind === 'sav' && item.data.date
                  ? formatDateFull(item.data.date)
                  : 'Date non renseignée'}
              </p>
              {(item.kind === 'interaction' || item.kind === 'event') && (
                <p className="text-xs text-muted-foreground">
                  {formatTime(
                    item.kind === 'event' ? item.data.date : item.data.date
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Status (for tasks and SAV) */}
          {(item.kind === 'task' || item.kind === 'sav') && (
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {item.kind === 'task'
                    ? TASK_STATUS_LABELS[item.data.statut] || item.data.statut
                    : SAV_STATUS_LABELS[item.data.statut] || item.data.statut}
                </p>
              </div>
            </div>
          )}

          {/* Type */}
          <div className="flex items-start gap-3">
            <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {item.kind === 'task'
                  ? TASK_TYPE_LABELS[item.data.type] || item.data.type
                  : item.kind === 'event'
                  ? EVENT_TYPE_LABELS[item.data.type] || item.data.type
                  : item.kind === 'interaction'
                  ? INTERACTION_TYPE_LABELS[item.data.type] || item.data.type
                  : SAV_TYPE_LABELS[item.data.type] || item.data.type}
              </p>
            </div>
          </div>

          {/* Priority (for tasks) */}
          {item.kind === 'task' && (
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium capitalize">{item.data.priorite}</p>
              </div>
            </div>
          )}

          {/* Related prospect/client */}
          {(item.kind === 'task' && item.data.prospect) && (
            <div className="flex items-start gap-3">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Prospect</p>
                <p className="text-sm font-medium">{item.data.prospect.nom}</p>
              </div>
            </div>
          )}

          {(item.kind === 'task' && item.data.opportunity) && (
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Opportunité</p>
                <p className="text-sm font-medium">{item.data.opportunity.nomProjet}</p>
              </div>
            </div>
          )}

          {item.kind === 'interaction' && item.data.prospect && (
            <div className="flex items-start gap-3">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Prospect</p>
                <p className="text-sm font-medium">{item.data.prospect.nom}</p>
              </div>
            </div>
          )}

          {item.kind === 'sav' && (
            <div className="flex items-start gap-3">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Client</p>
                <p className="text-sm font-medium">{item.data.client.nom}</p>
              </div>
            </div>
          )}

          {/* Assigned employee */}
          {(item.kind === 'task' && item.data.assigneA) && (
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Assigné à</p>
                <p className="text-sm font-medium">{item.data.assigneA.nom}</p>
              </div>
            </div>
          )}

          {(item.kind === 'interaction' && item.data.employe) && (
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Employé</p>
                <p className="text-sm font-medium">{item.data.employe.nom}</p>
              </div>
            </div>
          )}

          {(item.kind === 'sav' && item.data.employe) && (
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Employé</p>
                <p className="text-sm font-medium">{item.data.employe.nom}</p>
              </div>
            </div>
          )}

          {/* Event specific: ville, marques, equipe */}
          {item.kind === 'event' && (
            <>
              {item.data.ville && (
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ville</p>
                    <p className="text-sm font-medium">{item.data.ville}</p>
                  </div>
                </div>
              )}
              {item.data.marques && (
                <div className="flex items-start gap-3">
                  <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Marques</p>
                    <p className="text-sm font-medium">{item.data.marques}</p>
                  </div>
                </div>
              )}
              {item.data.equipe && (
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Équipe</p>
                    <p className="text-sm font-medium">{item.data.equipe}</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Notes */}
          {(item.kind === 'task' && item.data.description) && (
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-4 w-4 shrink-0 flex items-center justify-center text-muted-foreground">
                <List className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="text-sm whitespace-pre-wrap">{item.data.description}</p>
              </div>
            </div>
          )}

          {(item.kind === 'interaction' && item.data.notes) && (
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-4 w-4 shrink-0 flex items-center justify-center text-muted-foreground">
                <List className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{item.data.notes}</p>
              </div>
            </div>
          )}

          {(item.kind === 'event' && item.data.notes) && (
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-4 w-4 shrink-0 flex items-center justify-center text-muted-foreground">
                <List className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{item.data.notes}</p>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Quick Actions */}
        <DialogFooter>
          {item.kind === 'task' && item.data.statut !== 'terminee' && (
            <Button
              onClick={() => {
                onTaskComplete(item.data.id)
                onClose()
              }}
              className="gap-1.5 bg-gradient-to-r from-[#059669] to-emerald-600 text-white hover:from-[#047857] hover:to-[#059669]"
            >
              <CheckCircle2 className="h-4 w-4" />
              Marquer terminée
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Day Detail Dialog ───────────────────────────────────────────────────────

function DayDetailDialog({
  date,
  items,
  open,
  onClose,
  onSelectItem,
}: {
  date: Date
  items: CalendarItem[]
  open: boolean
  onClose: () => void
  onSelectItem: (item: CalendarItem) => void
}) {
  const dateLabel = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Sort: events first, then tasks, then interactions, then SAV
  const kindOrder: Record<string, number> = { event: 0, task: 1, interaction: 2, sav: 3 }
  const sorted = [...items].sort((a, b) => (kindOrder[a.kind] ?? 4) - (kindOrder[b.kind] ?? 4))

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#134885]" />
            {dateLabel}
          </DialogTitle>
          <DialogDescription>
            {items.length} élément{items.length > 1 ? 's' : ''} prévu{items.length > 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2 pr-3">
            {sorted.map((item, idx) => (
              <button
                key={`${item.kind}-${item.data.id}-${idx}`}
                onClick={() => onSelectItem(item)}
                className="w-full text-left"
              >
                <div
                  className="flex items-center gap-3 rounded-lg border p-3 transition-all hover:shadow-md"
                  style={{ borderLeftWidth: 4, borderLeftColor: getItemColor(item) }}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: getItemColor(item) }}
                  >
                    {getItemIcon(item)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{getItemLabel(item)}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                        style={{ borderColor: getItemColor(item), color: getItemColor(item) }}
                      >
                        {getKindLabel(item.kind)}
                      </Badge>
                      {item.kind === 'task' && (
                        <span>{TASK_STATUS_LABELS[item.data.statut]}</span>
                      )}
                      {item.kind === 'sav' && (
                        <span>{SAV_STATUS_LABELS[item.data.statut]}</span>
                      )}
                      {item.kind === 'interaction' && (
                        <span>{formatTime(item.data.date)}</span>
                      )}
                      {item.kind === 'event' && (
                        <span>{formatTime(item.data.date)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}

            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarDays className="mb-2 h-10 w-10 text-slate-300" />
                <p className="text-sm text-muted-foreground">Aucun élément ce jour</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ─── Monthly View ────────────────────────────────────────────────────────────

function MonthlyView({
  currentDate,
  groupedItems,
  onSelectItem,
  onSelectDay,
  isMobile,
}: {
  currentDate: Date
  groupedItems: Map<string, CalendarItem[]>
  onSelectItem: (item: CalendarItem) => void
  onSelectDay: (date: Date, items: CalendarItem[]) => void
  isMobile: boolean
}) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const days = useMemo(() => getMonthDays(year, month), [year, month])
  const today = new Date()

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
        {DAYS_FR.map((day) => (
          <div
            key={day}
            className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const key = toDateString(day)
          const items = groupedItems.get(key) || []
          const isCurrentMonth = isSameMonth(day, currentDate)
          const isDateToday = isToday(day)
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          const displayItems = items.slice(0, 3)
          const moreCount = items.length - 3

          return (
            <div
              key={idx}
              onClick={() => items.length > 0 && onSelectDay(day, items)}
              className={`group relative min-h-[80px] sm:min-h-[100px] border-b border-r border-slate-100 p-1 sm:p-1.5 transition-colors ${
                isCurrentMonth
                  ? 'bg-white hover:bg-slate-50/80'
                  : 'bg-slate-50/50'
              } ${isWeekend && isCurrentMonth ? 'bg-slate-50/30' : ''} ${
                items.length > 0 ? 'cursor-pointer' : ''
              }`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isDateToday
                      ? 'bg-[#134885] text-white font-bold'
                      : isCurrentMonth
                      ? 'text-slate-700'
                      : 'text-slate-400'
                  }`}
                >
                  {day.getDate()}
                </span>
                {items.length > 0 && isMobile && (
                  <span
                    className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#F6852A] px-1 text-[9px] font-bold text-white"
                  >
                    {items.length}
                  </span>
                )}
              </div>

              {/* Event pills - hidden on very small screens, shown on sm+ */}
              <div className="mt-0.5 hidden flex-col gap-0.5 sm:flex">
                {displayItems.map((item, i) => (
                  <CalendarPill
                    key={`${item.kind}-${item.data.id}-${i}`}
                    item={item}
                    onClick={() => onSelectItem(item)}
                    compact
                  />
                ))}
                {moreCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectDay(day, items)
                    }}
                    className="px-1.5 text-[10px] font-medium text-[#134885] hover:text-[#0D3A6E] hover:underline"
                  >
                    +{moreCount} autre{moreCount > 1 ? 's' : ''}
                  </button>
                )}
              </div>

              {/* Mobile: show dots instead of pills */}
              <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                {items.slice(0, 5).map((item, i) => (
                  <span
                    key={`${item.kind}-${item.data.id}-${i}`}
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: getItemColor(item) }}
                    title={getItemLabel(item)}
                  />
                ))}
                {items.length > 5 && (
                  <span className="text-[9px] text-muted-foreground">+{items.length - 5}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Weekly View ─────────────────────────────────────────────────────────────

function WeeklyView({
  currentDate,
  groupedItems,
  onSelectItem,
  isMobile,
}: {
  currentDate: Date
  groupedItems: Map<string, CalendarItem[]>
  onSelectItem: (item: CalendarItem) => void
  isMobile: boolean
}) {
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate])

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Day headers */}
      <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50/80">
        <div className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
          Heure
        </div>
        {weekDays.map((day) => {
          const isDateToday = isToday(day)
          return (
            <div
              key={day.toISOString()}
              className={`px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${
                isDateToday ? 'text-[#134885]' : 'text-slate-500'
              }`}
            >
              <div>{DAYS_FR[day.getDay() === 0 ? 6 : day.getDay() - 1]}</div>
              <div className={`mt-0.5 text-lg font-bold ${isDateToday ? 'text-[#134885]' : 'text-slate-700'}`}>
                {isDateToday ? (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#134885] text-white text-sm">
                    {day.getDate()}
                  </span>
                ) : (
                  day.getDate()
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Time slots */}
      <ScrollArea className="max-h-[70vh]">
        <div className="grid grid-cols-8">
          {HOURS.map((hour) => (
            <>
              {/* Time label */}
              <div
                key={`time-${hour}`}
                className="border-b border-r border-slate-100 px-2 py-3 text-right text-xs text-slate-400"
              >
                {String(hour).padStart(2, '0')}:00
              </div>

              {/* Day cells */}
              {weekDays.map((day) => {
                const key = toDateString(day)
                const dayItems = groupedItems.get(key) || []
                // Filter items that fall within this hour
                const hourItems = dayItems.filter((item) => {
                  let dateStr: string | null = null
                  if (item.kind === 'task') dateStr = item.data.dateEcheance
                  else if (item.kind === 'event') dateStr = item.data.date
                  else if (item.kind === 'interaction') dateStr = item.data.date
                  else if (item.kind === 'sav') dateStr = item.data.date

                  if (!dateStr) return hour === 8 // Show dateless items at 8:00
                  const h = getHourFromDate(dateStr)
                  if (h === null) return hour === 8
                  return h >= hour && h < hour + 1
                })

                const isDateToday = isToday(day)

                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className={`border-b border-r border-slate-100 p-1 transition-colors ${
                      isDateToday ? 'bg-[#134885]/[0.02]' : ''
                    } ${hourItems.length > 0 ? 'hover:bg-slate-50/80' : ''}`}
                    style={{ minHeight: isMobile ? '48px' : '56px' }}
                  >
                    <div className="flex flex-col gap-0.5">
                      {hourItems.map((item, i) => (
                        <CalendarPill
                          key={`${item.kind}-${item.data.id}-${i}`}
                          item={item}
                          onClick={() => onSelectItem(item)}
                          compact={isMobile}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Daily View ──────────────────────────────────────────────────────────────

function DailyView({
  currentDate,
  groupedItems,
  onSelectItem,
  isMobile,
}: {
  currentDate: Date
  groupedItems: Map<string, CalendarItem[]>
  onSelectItem: (item: CalendarItem) => void
  isMobile: boolean
}) {
  const key = toDateString(currentDate)
  const dayItems = groupedItems.get(key) || []

  // Separate items with time and without
  const itemsWithTime: { item: CalendarItem; hour: number }[] = []
  const itemsWithoutTime: CalendarItem[] = []

  dayItems.forEach((item) => {
    let dateStr: string | null = null
    if (item.kind === 'task') dateStr = item.data.dateEcheance
    else if (item.kind === 'event') dateStr = item.data.date
    else if (item.kind === 'interaction') dateStr = item.data.date
    else if (item.kind === 'sav') dateStr = item.data.date

    const hour = getHourFromDate(dateStr)
    if (hour !== null && hour >= 8 && hour <= 18) {
      itemsWithTime.push({ item, hour })
    } else {
      itemsWithoutTime.push(item)
    }
  })

  const dateLabel = currentDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-4">
      {/* Date header */}
      <Card className="border-0 bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white shadow-md">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-8 w-8 opacity-80" />
            <div>
              <h3 className="text-lg font-bold capitalize sm:text-xl">{dateLabel}</h3>
              <p className="text-sm text-white/70">
                {dayItems.length} élément{dayItems.length !== 1 ? 's' : ''} prévu{dayItems.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All-day / No-time items */}
      {itemsWithoutTime.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Toute la journée / Sans heure
          </h4>
          <div className="space-y-2">
            {itemsWithoutTime.map((item, i) => (
              <button
                key={`${item.kind}-${item.data.id}-${i}`}
                onClick={() => onSelectItem(item)}
                className="w-full text-left"
              >
                <div
                  className="flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm transition-all hover:shadow-md"
                  style={{ borderLeftWidth: 4, borderLeftColor: getItemColor(item) }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: getItemColor(item) }}
                  >
                    {getItemIcon(item)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{getItemLabel(item)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                        style={{ borderColor: getItemColor(item), color: getItemColor(item) }}
                      >
                        {getKindLabel(item.kind)}
                      </Badge>
                      {item.kind === 'task' && (
                        <>
                          <span>{TASK_STATUS_LABELS[item.data.statut]}</span>
                          <span className="capitalize">{item.data.priorite}</span>
                        </>
                      )}
                      {item.kind === 'task' && item.data.assigneA && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.data.assigneA.nom}
                        </span>
                      )}
                      {item.kind === 'sav' && (
                        <span>{SAV_STATUS_LABELS[item.data.statut]}</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hourly schedule */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100">
          {HOURS.map((hour) => {
            const hourItems = itemsWithTime
              .filter((entry) => entry.hour === hour)
              .map((entry) => entry.item)
            const isNow =
              isToday(currentDate) && new Date().getHours() === hour

            return (
              <div
                key={hour}
                className={`flex ${isNow ? 'bg-[#134885]/[0.03]' : ''}`}
              >
                {/* Time column */}
                <div className="flex w-16 shrink-0 items-start justify-end border-r border-slate-100 px-2 py-3 sm:w-20">
                  <span className={`text-xs font-medium ${isNow ? 'text-[#134885] font-bold' : 'text-slate-400'}`}>
                    {String(hour).padStart(2, '0')}:00
                  </span>
                </div>

                {/* Items column */}
                <div className="min-h-[56px] flex-1 p-2 sm:p-3">
                  {hourItems.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {hourItems.map((item, i) => (
                        <CalendarPill
                          key={`${item.kind}-${item.data.id}-${i}`}
                          item={item}
                          onClick={() => onSelectItem(item)}
                        />
                      ))}
                    </div>
                  ) : isNow ? (
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-[#134885]/30" />
                      <span className="text-[10px] font-semibold text-[#134885]">Maintenant</span>
                      <div className="h-px flex-1 bg-[#134885]/30" />
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Loading Skeletons ───────────────────────────────────────────────────────

function CalendarSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
        {DAYS_FR.map((d) => (
          <div key={d} className="px-2 py-2.5 text-center">
            <Skeleton className="mx-auto h-3 w-8" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="min-h-[100px] border-b border-r border-slate-100 p-2">
            <Skeleton className="mb-2 h-5 w-5 rounded-full" />
            <Skeleton className="mb-1 h-4 w-full rounded" />
            <Skeleton className="mb-1 h-4 w-3/4 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Calendar Module ────────────────────────────────────────────────────

export default function CalendarModule() {
  const isMobile = useIsMobile()

  // State
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month')
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null)
  const [detailDay, setDetailDay] = useState<{ date: Date; items: CalendarItem[] } | null>(null)

  // Data
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<CRMEvent[]>([])
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [afterSales, setAfterSales] = useState<AfterSale[]>([])
  const [loading, setLoading] = useState(true)

  // ─── Fetch all data on mount ───────────────────────────────────────────

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      try {
        const [tasksRes, eventsRes, interactionsRes, savRes] = await Promise.allSettled([
          fetch('/api/tasks'),
          fetch('/api/events'),
          fetch('/api/interactions'),
          fetch('/api/after-sales'),
        ])

        if (tasksRes.status === 'fulfilled' && tasksRes.value.ok) {
          const data = await tasksRes.value.json()
          setTasks(Array.isArray(data) ? data : [])
        }
        if (eventsRes.status === 'fulfilled' && eventsRes.value.ok) {
          const data = await eventsRes.value.json()
          setEvents(Array.isArray(data) ? data : [])
        }
        if (interactionsRes.status === 'fulfilled' && interactionsRes.value.ok) {
          const data = await interactionsRes.value.json()
          setInteractions(Array.isArray(data) ? data : [])
        }
        if (savRes.status === 'fulfilled' && savRes.value.ok) {
          const data = await savRes.value.json()
          setAfterSales(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error('[Calendar] fetch error:', err)
        toast.error('Erreur lors du chargement des données')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // ─── Group items by date ───────────────────────────────────────────────

  const groupedItems = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()

    // Tasks
    for (const task of tasks) {
      const key = getDateKey(task.dateEcheance)
      if (key) {
        const arr = map.get(key) || []
        arr.push({ kind: 'task', data: task })
        map.set(key, arr)
      }
    }

    // Events
    for (const event of events) {
      const key = getDateKey(event.date)
      if (key) {
        const arr = map.get(key) || []
        arr.push({ kind: 'event', data: event })
        map.set(key, arr)
      }
    }

    // Interactions
    for (const interaction of interactions) {
      const key = getDateKey(interaction.date)
      if (key) {
        const arr = map.get(key) || []
        arr.push({ kind: 'interaction', data: interaction })
        map.set(key, arr)
      }
    }

    // After-sales
    for (const sav of afterSales) {
      const key = getDateKey(sav.date)
      if (key) {
        const arr = map.get(key) || []
        arr.push({ kind: 'sav', data: sav })
        map.set(key, arr)
      }
    }

    return map
  }, [tasks, events, interactions, afterSales])

  // ─── Navigation ────────────────────────────────────────────────────────

  const navigatePrev = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev)
      if (viewMode === 'month') {
        d.setMonth(d.getMonth() - 1)
      } else if (viewMode === 'week') {
        d.setDate(d.getDate() - 7)
      } else {
        d.setDate(d.getDate() - 1)
      }
      return d
    })
  }, [viewMode])

  const navigateNext = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev)
      if (viewMode === 'month') {
        d.setMonth(d.getMonth() + 1)
      } else if (viewMode === 'week') {
        d.setDate(d.getDate() + 7)
      } else {
        d.setDate(d.getDate() + 1)
      }
      return d
    })
  }, [viewMode])

  const navigateToday = useCallback(() => {
    setCurrentDate(new Date())
  }, [])

  // ─── Title formatting ──────────────────────────────────────────────────

  const titleText = useMemo(() => {
    if (viewMode === 'month') {
      return `${MONTHS_FR[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    }
    if (viewMode === 'week') {
      const weekDays = getWeekDays(currentDate)
      const start = weekDays[0]
      const end = weekDays[6]
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} - ${end.getDate()} ${MONTHS_FR[start.getMonth()]} ${start.getFullYear()}`
      }
      return `${formatDateShort(start)} - ${formatDateShort(end)} ${start.getFullYear()}`
    }
    // day
    return currentDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }, [currentDate, viewMode])

  // ─── Task complete handler ─────────────────────────────────────────────

  const handleTaskComplete = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'terminee' }),
      })
      if (res.ok) {
        toast.success('Tâche marquée comme terminée')
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, statut: 'terminee' } : t))
        )
      } else {
        toast.error('Impossible de terminer la tâche')
      }
    } catch {
      toast.error('Erreur lors de la mise à jour')
    }
  }, [])

  // ─── Summary stats ─────────────────────────────────────────────────────

  const todayKey = toDateString(new Date())
  const todayItems = groupedItems.get(todayKey) || []
  const upcomingTasks = tasks.filter(
    (t) => t.statut !== 'terminee' && t.dateEcheance && new Date(t.dateEcheance) >= new Date()
  )
  const pendingSAV = afterSales.filter((s) => s.statut !== 'terminee')

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-3">
            {/* Top row: Logo + title */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="MI HEALTH CARE"
                  className="h-9 w-auto shrink-0 object-contain"
                />
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-[#134885]">
                    Calendrier
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Vue d&apos;agenda — DALIA CRM
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* View mode toggle */}
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
                  <button
                    onClick={() => setViewMode('month')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      viewMode === 'month'
                        ? 'bg-[#134885] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    {!isMobile && 'Mois'}
                  </button>
                  <button
                    onClick={() => setViewMode('week')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      viewMode === 'week'
                        ? 'bg-[#134885] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Columns3 className="h-3.5 w-3.5" />
                    {!isMobile && 'Semaine'}
                  </button>
                  <button
                    onClick={() => setViewMode('day')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      viewMode === 'day'
                        ? 'bg-[#134885] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <List className="h-3.5 w-3.5" />
                    {!isMobile && 'Jour'}
                  </button>
                </div>
              </div>

              {/* Navigation controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={navigateToday}
                  className="gap-1.5 text-xs font-medium border-[#134885]/20 text-[#134885] hover:bg-[#134885]/5"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Aujourd&apos;hui
                </Button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={navigatePrev}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={navigateNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <h2 className="min-w-0 text-sm font-bold text-[#134885] sm:text-base">
                  {titleText}
                </h2>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6">
        {/* Quick stats row */}
        {!loading && (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-0 bg-white/70 shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 text-[#134885]" />
                  Aujourd&apos;hui
                </div>
                <p className="mt-1 text-xl font-bold text-[#134885]">
                  {todayItems.length}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-white/70 shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#F6852A]" />
                  Tâches à venir
                </div>
                <p className="mt-1 text-xl font-bold text-[#F6852A]">
                  {upcomingTasks.length}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-white/70 shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarIcon className="h-3.5 w-3.5 text-[#7C3AED]" />
                  Événements
                </div>
                <p className="mt-1 text-xl font-bold text-[#7C3AED]">
                  {events.length}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-white/70 shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Wrench className="h-3.5 w-3.5 text-[#DC2626]" />
                  SAV en cours
                </div>
                <p className="mt-1 text-xl font-bold text-[#DC2626]">
                  {pendingSAV.length}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Legend */}
        {!loading && (
          <div className="mb-4 rounded-lg border border-slate-100 bg-white/50 px-4 py-2.5">
            <Legend />
          </div>
        )}

        {/* Calendar views */}
        {loading ? (
          <CalendarSkeleton />
        ) : viewMode === 'month' ? (
          <MonthlyView
            currentDate={currentDate}
            groupedItems={groupedItems}
            onSelectItem={setSelectedItem}
            onSelectDay={(date, items) => setDetailDay({ date, items })}
            isMobile={isMobile}
          />
        ) : viewMode === 'week' ? (
          <WeeklyView
            currentDate={currentDate}
            groupedItems={groupedItems}
            onSelectItem={setSelectedItem}
            isMobile={isMobile}
          />
        ) : (
          <DailyView
            currentDate={currentDate}
            groupedItems={groupedItems}
            onSelectItem={setSelectedItem}
            isMobile={isMobile}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-white/60">
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 flex items-center justify-center gap-3">
          <img
            src="/logo.png"
            alt="MI HEALTH CARE"
            className="h-6 w-auto object-contain opacity-60"
          />
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} MI HEALTH CARE — Tous droits réservés
          </p>
        </div>
      </footer>

      {/* Event Detail Dialog */}
      <EventDetailDialog
        item={selectedItem}
        open={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        onTaskComplete={handleTaskComplete}
      />

      {/* Day Detail Dialog */}
      {detailDay && (
        <DayDetailDialog
          date={detailDay.date}
          items={detailDay.items}
          open={detailDay !== null}
          onClose={() => setDetailDay(null)}
          onSelectItem={(item) => {
            setDetailDay(null)
            setTimeout(() => setSelectedItem(item), 150)
          }}
        />
      )}
    </div>
  )
}
