'use client'

import { useCRMStore, type Page } from '@/lib/store'
import {
  LayoutDashboard,
  UserRound,
  Calendar,
  Briefcase,
  Package,
  CheckSquare,
  Wrench,
  Users,
  Menu,
  X,
  Heart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'

const navItems: { page: Page; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'prospects', label: 'Prospects', icon: UserRound },
  { page: 'events', label: 'Événements', icon: Calendar },
  { page: 'opportunities', label: 'Opportunités', icon: Briefcase },
  { page: 'operations', label: 'Opérations', icon: Package },
  { page: 'tasks', label: 'Tâches', icon: CheckSquare },
  { page: 'after-sales', label: 'Après-vente', icon: Wrench },
  { page: 'employees', label: 'Employés', icon: Users },
]

export function CRMSidebar() {
  const { currentPage, setCurrentPage, sidebarOpen, setSidebarOpen, toggleSidebar } = useCRMStore()

  const handleNavClick = (page: Page) => {
    setCurrentPage(page)
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-900 text-white">
      {/* Logo / Brand Area */}
      <div className="flex items-center gap-3 border-b border-slate-700/60 px-5 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 shadow-lg shadow-emerald-600/30">
          <Heart className="h-5 w-5 fill-white text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-wide text-white">MI HEALTH CARE</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-emerald-400/80">
            CRM Platform
          </span>
        </div>
        {/* Close button on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-8 w-8 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentPage === item.page
            const Icon = item.icon
            return (
              <li key={item.page}>
                <button
                  onClick={() => handleNavClick(item.page)}
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-400 group-hover:text-emerald-400 group-hover:scale-110'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="ml-auto h-1.5 w-1.5 rounded-full bg-white"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Developer Credit */}
      <div className="border-t border-slate-700/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-slate-500">
            Developed by{' '}
            <span className="font-semibold text-slate-400">layounekhaled</span>
          </span>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 h-10 w-10 bg-slate-900 text-white shadow-lg hover:bg-slate-800 hover:text-white md:hidden"
        onClick={toggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile overlay with backdrop */}
      <div className="md:hidden">
        <AnimatePresence>
          {sidebarOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                onClick={() => setSidebarOpen(false)}
              />
              {/* Sidebar panel */}
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="fixed inset-y-0 left-0 z-50 w-72 shadow-2xl"
              >
                {sidebarContent}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 256 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 left-0 z-30 hidden overflow-hidden shadow-xl md:block"
      >
        <div className="w-64">{sidebarContent}</div>
      </motion.aside>
    </>
  )
}
