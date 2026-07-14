'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import {
  Database, Download, Loader2, Trash2, RefreshCw, HardDrive,
  Clock, CheckCircle2, XCircle, AlertTriangle, Shield,
  Calendar, User, Info, ArrowRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
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
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'

interface BackupRecord {
  id: string
  type: string
  statut: string
  blobUrl: string | null
  blobPathname: string | null
  fileSize: number | null
  recordCount: number | null
  tableCount: number | null
  durationMs: number | null
  erreur: string | null
  declenchePar: string | null
  createdAt: string
  employe: { id: string; nom: string } | null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  manual: { label: 'Manuel', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  auto: { label: 'Automatique', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  pre_restore: { label: 'Avant restauration', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  in_progress: { label: 'En cours', icon: Loader2, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  completed: { label: 'Terminé', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  failed: { label: 'Échoué', icon: XCircle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function BackupModule() {
  const { toast } = useToast()
  const { user } = useAuth()

  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const fetchBackups = useCallback(async () => {
    try {
      const res = await fetch('/api/backups')
      if (res.ok) {
        const data = await res.json()
        setBackups(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch backups:', err)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchBackups()
      // Check if auto backup is needed and trigger it silently
      if (user?.role === 'admin') {
        fetch('/api/backups/check-auto').catch(() => {})
      }
      setLoading(false)
    }
    load()
  }, [fetchBackups, user?.role])

  const handleCreateBackup = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'manual' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la sauvegarde')

      toast({
        title: 'Sauvegarde créée',
        description: data.message,
      })
      await fetchBackups()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      toast({ title: 'Erreur', description: message, variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      const res = await fetch(`/api/backups/${deletingId}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Sauvegarde supprimée' })
        setShowDeleteDialog(false)
        setDeletingId(null)
        await fetchBackups()
      }
    } catch (err) {
      console.error('Delete failed:', err)
      toast({ title: 'Erreur', description: 'Impossible de supprimer la sauvegarde.', variant: 'destructive' })
    }
  }

  // Stats
  const completedBackups = backups.filter(b => b.statut === 'completed')
  const totalSize = completedBackups.reduce((sum, b) => sum + (b.fileSize || 0), 0)
  const lastBackup = completedBackups[0]
  const autoBackups = completedBackups.filter(b => b.type === 'auto')
  const lastAutoBackup = autoBackups[0]

  // Check if auto-backup is needed (no auto backup in last 24h)
  const needsAutoBackup = !lastAutoBackup ||
    (Date.now() - new Date(lastAutoBackup.createdAt).getTime()) > 24 * 60 * 60 * 1000

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
                  Sauvegardes
                </h1>
                <p className="text-xs text-muted-foreground">
                  Protection des données & sauvegardes automatiques
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchBackups}
                className="gap-1.5"
              >
                <RefreshCw className="size-3.5" />
                Actualiser
              </Button>
              <Button
                onClick={handleCreateBackup}
                disabled={creating}
                className="gap-1.5 bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white shadow-lg shadow-[#134885]/25 hover:from-[#0D3A6E] hover:to-[#134885]"
              >
                {creating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Database className="size-4" />
                )}
                {creating ? 'Sauvegarde en cours...' : 'Sauvegarder maintenant'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <HardDrive className="size-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Espace utilisé</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{formatBytes(totalSize)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sauvegardes réussies</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{completedBackups.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#134885]/10 dark:bg-[#134885]/20">
                <Clock className="size-5 text-[#134885] dark:text-[#F6852A]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dernière sauvegarde</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {lastBackup ? formatDate(lastBackup.createdAt) : 'Aucune'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${needsAutoBackup ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                {needsAutoBackup ? (
                  <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Shield className="size-5 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Statut auto</p>
                <p className={`text-sm font-bold ${needsAutoBackup ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {needsAutoBackup ? 'Sauvegarde nécessaire' : 'À jour'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Banner */}
        <Card className="border-0 bg-blue-50/80 shadow-sm dark:bg-blue-950/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="size-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium">Comment fonctionne la sauvegarde ?</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs text-blue-700 dark:text-blue-300">
                  <li>Les sauvegardes exportent <strong>toutes les données</strong> de la base (prospects, clients, opportunités, opérations, documents, etc.)</li>
                  <li>Elles sont stockées sur <strong>Vercel Blob</strong> (stockage cloud sécurisé et persistant)</li>
                  <li>Une sauvegarde <strong>automatique quotidienne</strong> est effectuée à 2h du matin</li>
                  <li>Les <strong>30 dernières sauvegardes</strong> sont conservées, les plus anciennes sont supprimées automatiquement</li>
                  <li>Vous pouvez télécharger n'importe quelle sauvegarde au format JSON</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Backup List */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="size-5 text-[#134885] dark:text-[#F6852A]" />
            Historique des sauvegardes
          </h2>

          {loading ? (
            <LoadingSkeleton />
          ) : backups.length === 0 ? (
            <Card className="border-0 bg-white/70 shadow-sm dark:bg-slate-900/70">
              <CardContent className="py-12 text-center">
                <Database className="mx-auto size-12 text-slate-300 dark:text-slate-600" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Aucune sauvegarde</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                  Créez votre première sauvegarde pour protéger les données du CRM.
                </p>
                <Button
                  onClick={handleCreateBackup}
                  disabled={creating}
                  className="mt-4 gap-1.5 bg-gradient-to-r from-[#134885] to-[#1A5A9E] text-white"
                >
                  {creating ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
                  Créer une sauvegarde
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {backups.map((backup) => {
                  const statusCfg = STATUS_CONFIG[backup.statut] || STATUS_CONFIG.failed
                  const typeCfg = TYPE_LABELS[backup.type] || TYPE_LABELS.manual
                  const StatusIcon = statusCfg.icon

                  return (
                    <motion.div
                      key={backup.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className="border-0 bg-white/70 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900/70">
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            {/* Left: Info */}
                            <div className="flex items-start gap-3">
                              <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                                backup.statut === 'completed'
                                  ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                  : backup.statut === 'failed'
                                    ? 'bg-red-50 dark:bg-red-900/20'
                                    : 'bg-blue-50 dark:bg-blue-900/20'
                              }`}>
                                <StatusIcon className={`size-5 ${
                                  backup.statut === 'in_progress' ? 'animate-spin text-blue-600' :
                                  backup.statut === 'completed' ? 'text-emerald-600 dark:text-emerald-400' :
                                  'text-red-600 dark:text-red-400'
                                }`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {formatDate(backup.createdAt)}
                                  </span>
                                  <Badge variant="outline" className={`gap-1 text-[10px] ${typeCfg.color}`}>
                                    {typeCfg.label}
                                  </Badge>
                                  <Badge variant="outline" className={`gap-1 text-[10px] ${statusCfg.color}`}>
                                    <StatusIcon className="size-2.5" />
                                    {statusCfg.label}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  {backup.employe && (
                                    <span className="flex items-center gap-1">
                                      <User className="size-3" />
                                      {backup.employe.nom}
                                    </span>
                                  )}
                                  {backup.recordCount != null && (
                                    <span>{backup.recordCount} enregistrements</span>
                                  )}
                                  {backup.fileSize != null && (
                                    <span>{formatBytes(backup.fileSize)}</span>
                                  )}
                                  {backup.durationMs != null && (
                                    <span>{formatDuration(backup.durationMs)}</span>
                                  )}
                                </div>
                                {backup.erreur && (
                                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                    Erreur : {backup.erreur}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-2">
                              {backup.blobUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1.5 text-xs"
                                  asChild
                                >
                                  <a href={backup.blobUrl} target="_blank" rel="noopener noreferrer" download>
                                    <Download className="size-3.5" />
                                    Télécharger
                                  </a>
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                onClick={() => {
                                  setDeletingId(backup.id)
                                  setShowDeleteDialog(true)
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette sauvegarde ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement le fichier de sauvegarde du stockage cloud.
              Cette opération est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
