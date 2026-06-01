'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Phone, MessageCircle, Mail, Calendar, PhoneCall, Loader2, ImagePlus, X } from 'lucide-react'

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
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024)

    setPhotos(prev => [...prev, ...validFiles])

    // Generate previews
    validFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setPhotoPreviews(prev => [...prev, ev.target?.result as string])
      }
      reader.readAsDataURL(file)
    })

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast.error('Veuillez saisir des notes')
      return
    }

    setSubmitting(true)
    try {
      // 1. Create the interaction
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

      const interaction = await res.json()

      // 2. Upload photos if any
      if (photos.length > 0) {
        const photoFormData = new FormData()
        photoFormData.append('interactionId', interaction.id)
        photos.forEach(file => {
          photoFormData.append('files', file)
        })

        const photoRes = await fetch('/api/interactions/photos', {
          method: 'POST',
          body: photoFormData,
        })

        if (!photoRes.ok) {
          console.error('Photo upload failed, but interaction was saved')
        }
      }

      // 3. If we need to mark a task as completed
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
      setPhotos([])
      setPhotoPreviews([])
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'enregistrement")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setPhotos([])
      setPhotoPreviews([])
    }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
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

          {/* Photos */}
          <div className="grid gap-2">
            <Label>Photos</Label>
            <div className="flex flex-wrap gap-2">
              {photoPreviews.map((preview, index) => (
                <div key={index} className="relative group">
                  <img
                    src={preview}
                    alt={`Photo ${index + 1}`}
                    className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-[#134885] hover:text-[#134885]"
              >
                <ImagePlus className="h-6 w-6" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              className="hidden"
            />
            {photos.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {photos.length} photo(s) sélectionnée(s)
              </p>
            )}
          </div>

          {onCompleteTask && (
            <p className="text-xs text-amber-600 flex items-center gap-1.5">
              ✅ La tâche sera automatiquement marquée comme terminée
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
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
