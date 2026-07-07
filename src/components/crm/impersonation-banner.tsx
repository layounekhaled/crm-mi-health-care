'use client'

import { useAuth } from '@/lib/auth-context'
import { ArrowLeftRight, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export function ImpersonationBanner() {
  const { isImpersonating, user, stopImpersonating } = useAuth()
  const [isStopping, setIsStopping] = useState(false)

  if (!isImpersonating) return null

  const handleStop = async () => {
    setIsStopping(true)
    try {
      await stopImpersonating()
    } catch {
      setIsStopping(false)
    }
  }

  return (
    <div className="sticky top-0 z-[100] bg-amber-500 text-amber-950 shadow-lg">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">
            Vous consultez en tant que <strong>{user?.employeNom || user?.email}</strong>
          </span>
          {user?.impersonatedByNom && (
            <span className="text-xs opacity-80">
              (accès par {user.impersonatedByNom})
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleStop}
          disabled={isStopping}
          className="h-7 border-amber-700 bg-amber-500 text-amber-950 hover:bg-amber-600 hover:text-amber-950 disabled:opacity-60"
        >
          {isStopping ? (
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-950 border-t-transparent" />
              Chargement...
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <LogOut className="h-3 w-3" />
              Revenir à mon compte
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}
