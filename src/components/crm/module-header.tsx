'use client'

import Image from 'next/image'

interface ModuleHeaderProps {
  title: string
  subtitle: string
  actions?: React.ReactNode
}

export function ModuleHeader({ title, subtitle, actions }: ModuleHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="MI HEALTH CARE"
              className="h-10 w-auto shrink-0 object-contain"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#003366]">
                {title}
              </h1>
              <p className="text-xs text-muted-foreground">
                {subtitle}
              </p>
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    </header>
  )
}
