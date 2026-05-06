'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Phone, MessageCircle, Mail, Calendar, PhoneCall, Loader2 } from 'lucide-react'

const INTERACTION_TYPES = [
  { value: 'appel', label: 'Appel téléphonique', icon: Phone, color: 'text-blue-600' },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-green-600' },
  { value: 'email', label: 'Email', icon: Mail, color: 'text-purple-600' },
  { value: 'visite', label: 'Visite', icon: Calendar, color: 'text-amber-600' },
  { value: 'autre', label: 'Autre', icon: PhoneCall, color: 'text-slate-600' },
]

export { INTERACTION_TYPES }

interface AddInteractionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Context: which entity is this interaction linked to
  prospectId?: string
  opportunityId?: string
  taskId?: string
  afterSaleId?: string
  // Display
  contextLabel: string // e.g. "Dr Benali" or "Opportunité CHU Sétif"
  // Optional: auto-close task when adding interaction
  onCompleteTask?: string // task ID to mark as completed
  onSuccess?: () => void
}

export function AddInteractionDialog({
  open,
  onOpenChange,
  prospectId,
  opportunityId,
  taskId,
  afterSaleId,
  contextLabel,
  onCompleteTask,
  onSuccess,
}: AddInteractionDialogProps) {
  const [type, setType] = useState('appel')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast.error('Veuillez saisir des notes')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          notes: notes.trim(),
          date,
          prospectId: prospectId || undefined,
          opportunityId: opportunityId || undefined,
          taskId: taskId || undefined,
          afterSaleId: afterSaleId || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur')
      }

      // If we need to mark a task as completed
      if (onCompleteTask) {
        await fetch(`/api/tasks/${onCompleteTask}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statut: 'terminee' }),
        })
      }

      toast.success(
        onCompleteTask
          ? 'Tâche terminée et interaction enregistrée'
          : 'Interaction enregistrée'
      )

      // Reset form
      setType('appel')
      setNotes('')
      setDate(new Date().toISOString().split('T')[0])
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'enregistrement")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-[#134885]" />
            Ajouter une interaction
          </DialogTitle>
          <DialogDescription>
            Enregistrez une interaction avec {contextLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Type */}
          <div className="grid gap-2">
            <Label>Type d&apos;interaction</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERACTION_TYPES.map((t) => {
                  const Icon = t.icon
                  return (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${t.color}`} />
                        {t.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="grid gap-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label>Notes *</Label>
            <Textarea
              placeholder="Détails de l'interaction..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          {onCompleteTask && (
            <p className="text-xs text-amber-600 flex items-center gap-1.5">
              ✅ La tâche sera automatiquement marquée comme terminée
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !notes.trim()}
            className="bg-[#134885] hover:bg-[#0D3A6E] text-white"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement...
              </span>
            ) : onCompleteTask ? (
              'Terminer + Enregistrer'
            ) : (
              'Enregistrer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
