'use client'

import { useEffect } from 'react'
import { useCRMStore, type Page } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
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
  LogOut,
  Shield,
  Headphones,
  Stethoscope,
  Mail,
  CalendarDays,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NotificationsBell } from '@/components/crm/notifications-bell'
import { motion, AnimatePresence } from 'framer-motion'

const navItems: { page: Page; label: string; icon: React.ComponentType<{ className?: string }>; roles: string[] }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'commercial', 'technicien'] },
  { page: 'prospects', label: 'Prospects', icon: UserRound, roles: ['admin', 'commercial'] },
  { page: 'events', label: 'Événements', icon: Calendar, roles: ['admin', 'commercial'] },
  { page: 'opportunities', label: 'Opportunités', icon: Briefcase, roles: ['admin', 'commercial'] },
  { page: 'operations', label: 'Opérations', icon: Package, roles: ['admin', 'commercial', 'technicien'] },
  { page: 'tasks', label: 'Tâches', icon: CheckSquare, roles: ['admin', 'commercial', 'technicien'] },
  { page: 'after-sales', label: 'Après-vente', icon: Wrench, roles: ['admin', 'commercial', 'technicien'] },
  { page: 'employees', label: 'Employés', icon: Users, roles: ['admin'] },
  { page: 'rh', label: 'RH', icon: CalendarDays, roles: ['admin', 'commercial', 'technicien'] },
  { page: 'emails', label: 'Emails', icon: Mail, roles: ['admin', 'commercial', 'technicien'] },
  { page: 'documents', label: 'Documents', icon: FileText, roles: ['admin', 'commercial', 'technicien'] },
]

const roleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  admin: Shield,
  commercial: Headphones,
  technicien: Stethoscope,
}

const roleLabels: Record<string, string> = {
  admin: 'Administrateur',
  commercial: 'Commercial',
  technicien: 'Technicien',
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts.map((p) => p[0]).join('').toUpperCase().slice(0, 2)
  }
  return email.slice(0, 2).toUpperCase()
}

export function CRMSidebar() {
  const { currentPage, setCurrentPage, sidebarOpen, setSidebarOpen, toggleSidebar } = useCRMStore()
  const { user, logout } = useAuth()

  // Redirect to dashboard if current page is not accessible to user's role
  useEffect(() => {
    if (user?.role) {
      const accessiblePages = navItems.filter(item => item.roles.includes(user.role!))
      const currentPageAccessible = accessiblePages.some(item => item.page === currentPage)
      if (!currentPageAccessible && currentPage !== 'dashboard') {
        setCurrentPage('dashboard')
      }
    }
  }, [user?.role, currentPage, setCurrentPage])

  const handleNavClick = (page: Page) => {
    setCurrentPage(page)
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }

  const displayName = user?.employeNom || user?.email || 'Utilisateur'
  const displayRole = user?.role || 'commercial'
  const RoleIcon = roleIcons[displayRole] || Shield

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#134885] text-white">
      {/* Logo / Brand Area */}
      <div className="flex items-center gap-3 border-b border-[#0D3A6E] px-4 py-3">
        <img src="/logo.png" alt="MI HEALTH CARE" className="h-10 w-auto shrink-0 object-contain rounded-lg bg-white px-1" />
        {/* Close button on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-8 w-8 text-slate-400 hover:bg-[#1A5A9E] hover:text-white md:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Notifications Bar */}
      <div className="flex items-center justify-between border-b border-[#0D3A6E]/60 px-4 py-2">
        <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
          Notifications
        </span>
        <NotificationsBell />
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.filter(item => item.roles.includes(user?.role || 'commercial')).map((item) => {
            const isActive = currentPage === item.page
            const Icon = item.icon
            return (
              <li key={item.page}>
                <button
                  onClick={() => handleNavClick(item.page)}
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[#F6852A] text-white shadow-md shadow-[#F6852A]/25'
                      : 'text-slate-300 hover:bg-[#1A5A9E]/80 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-400 group-hover:text-[#F6852A] group-hover:scale-110'
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

      {/* User Profile & Logout */}
      <div className="border-t border-[#0D3A6E] px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[#1A5A9E]/80">
              <Avatar className="h-8 w-8 border border-slate-600">
                <AvatarFallback className="bg-[#F6852A] text-xs font-semibold text-white">
                  {getInitials(user?.employeNom || null, user?.email || '')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-slate-200">
                  {displayName}
                </p>
                <div className="flex items-center gap-1">
                  <RoleIcon className="h-3 w-3 text-[#F6852A]" />
                  <span className="text-[11px] text-slate-500">
                    {roleLabels[displayRole] || displayRole}
                  </span>
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            className="w-56 border-slate-200"
          >
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-slate-900">{displayName}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
              onClick={logout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Developer Credit */}
      <div className="border-t border-[#0D3A6E] px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-[#F6852A]" />
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
        className="fixed left-4 top-4 z-50 h-10 w-10 bg-[#134885] text-white shadow-lg hover:bg-[#1A5A9E] hover:text-white md:hidden"
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
