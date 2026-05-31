'use client'

import { useEffect, useState } from 'react'
import { useCRMStore, type Page } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { canViewModule, type PermissionModule } from '@/lib/permissions'
import {
  LayoutDashboard,
  UserRound,
  UserCheck,
  Calendar,
  Briefcase,
  Package,
  BookOpen,
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
  CalendarClock,
  FileText,
  Receipt,
  ChevronDown,
  ChevronRight,
  Sparkles,
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

interface NavItem {
  page: Page
  label: string
  icon: React.ComponentType<{ className?: string }>
  permissionModule: PermissionModule
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: '',
    items: [
      { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permissionModule: 'dashboard' },
    ],
  },
  {
    label: 'Commercial',
    items: [
      { page: 'prospects', label: 'Prospects', icon: UserRound, permissionModule: 'prospects' },
      { page: 'clients', label: 'Clients', icon: UserCheck, permissionModule: 'clients' },
      { page: 'events', label: 'Événements', icon: Calendar, permissionModule: 'events' },
      { page: 'opportunities', label: 'Opportunités', icon: Briefcase, permissionModule: 'opportunities' },
    ],
  },
  {
    label: 'Opérations',
    items: [
      { page: 'operations', label: 'Opérations', icon: Package, permissionModule: 'operations' },
      { page: 'catalog', label: 'Catalogue', icon: BookOpen, permissionModule: 'catalog' },
      { page: 'tasks', label: 'Tâches', icon: CheckSquare, permissionModule: 'tasks' },
      { page: 'after-sales', label: 'Après-vente', icon: Wrench, permissionModule: 'afterSales' },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { page: 'employees', label: 'Employés', icon: Users, permissionModule: 'employees' },
      { page: 'charges', label: 'Charges', icon: Receipt, permissionModule: 'charges' },
      { page: 'calendar', label: 'Calendrier', icon: CalendarClock, permissionModule: 'calendar' },
      { page: 'rh', label: 'RH', icon: CalendarDays, permissionModule: 'rh' },
      { page: 'emails', label: 'Emails', icon: Mail, permissionModule: 'emails' },
      { page: 'documents', label: 'Documents', icon: FileText, permissionModule: 'documents' },
    ],
  },
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

function NavGroupSection({
  group,
  currentPage,
  onNavClick,
  defaultOpen = true,
}: {
  group: NavGroup
  currentPage: Page
  onNavClick: (page: Page) => void
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (!group.label) {
    // Ungrouped items (Dashboard) — always visible
    return (
      <ul className="space-y-0.5">
        {group.items.map((item) => (
          <NavItem key={item.page} item={item} currentPage={currentPage} onNavClick={onNavClick} />
        ))}
      </ul>
    )
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-300 transition-colors"
      >
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.2 }}
          className="flex items-center"
        >
          <ChevronDown className="h-3 w-3" />
        </motion.div>
        <span>{group.label}</span>
        <div className="ml-auto h-px flex-1 bg-gradient-to-r from-slate-600/40 to-transparent" />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden space-y-0.5"
          >
            {group.items.map((item) => (
              <NavItem key={item.page} item={item} currentPage={currentPage} onNavClick={onNavClick} />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

function NavItem({
  item,
  currentPage,
  onNavClick,
}: {
  item: NavItem
  currentPage: Page
  onNavClick: (page: Page) => void
}) {
  const isActive = currentPage === item.page
  const Icon = item.icon

  return (
    <li>
      <button
        onClick={() => onNavClick(item.page)}
        className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
          isActive
            ? 'bg-gradient-to-r from-[#F6852A] to-[#e8751a] text-white shadow-lg shadow-[#F6852A]/20'
            : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
        }`}
      >
        {/* Active left accent bar */}
        {isActive && (
          <motion.div
            layoutId="sidebar-active-bar"
            className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-white/90"
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          />
        )}
        <Icon
          className={`h-[17px] w-[17px] shrink-0 transition-all duration-200 ${
            isActive
              ? 'text-white drop-shadow-sm'
              : 'text-slate-500 group-hover:text-[#F6852A] group-hover:scale-110'
          }`}
        />
        <span className={`truncate ${isActive ? 'tracking-wide' : ''}`}>{item.label}</span>
      </button>
    </li>
  )
}

export function CRMSidebar() {
  const { currentPage, setCurrentPage, sidebarOpen, setSidebarOpen, toggleSidebar } = useCRMStore()
  const { user, logout, canViewModule: userCanView } = useAuth()
  const [hoveredItem, setHoveredItem] = useState<Page | null>(null)

  // Redirect to dashboard if current page is not accessible
  useEffect(() => {
    if (user?.role) {
      const allItems = navGroups.flatMap(g => g.items)
      const accessiblePages = allItems.filter(item => userCanView(item.permissionModule))
      const currentPageAccessible = accessiblePages.some(item => item.page === currentPage)
      if (!currentPageAccessible && currentPage !== 'dashboard') {
        setCurrentPage('dashboard')
      }
    }
  }, [user, currentPage, setCurrentPage, userCanView])

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

  // Filter nav groups based on permissions
  const filteredNavGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => userCanView(item.permissionModule)),
  })).filter(group => group.items.length > 0)

  const sidebarContent = (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0f3d6e] via-[#134885] to-[#0e3664] text-white">
      {/* Logo / Brand Area */}
      <div className="relative overflow-hidden border-b border-white/[0.08] px-5 py-4">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/[0.03] to-transparent" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white p-0.5 shadow-lg shadow-black/20">
            <img src="/logo.png" alt="MI HEALTH CARE" className="h-9 w-auto object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-bold tracking-wide text-white">DALIA</h1>
            <p className="text-[9px] font-medium uppercase tracking-[0.15em] text-slate-400">MI HEALTH CARE</p>
          </div>
          {/* Close button on mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8 text-slate-400 hover:bg-white/10 hover:text-white md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Notifications Bar */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06]">
          <NotificationsBell />
        </div>
        <span className="text-[11px] font-medium text-slate-400">Notifications</span>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 scrollbar-thin scrollbar-thumb-slate-600/50 scrollbar-track-transparent">
        <div className="space-y-1.5">
          {filteredNavGroups.map((group, idx) => (
            <NavGroupSection
              key={group.label || `group-${idx}`}
              group={group}
              currentPage={currentPage}
              onNavClick={handleNavClick}
              defaultOpen={true}
            />
          ))}
        </div>
      </nav>

      {/* User Profile & Logout */}
      <div className="border-t border-white/[0.08] p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 hover:bg-white/[0.06]">
              <div className="relative">
                <Avatar className="h-9 w-9 border-2 border-[#F6852A]/40 shadow-md">
                  <AvatarFallback className="bg-gradient-to-br from-[#F6852A] to-[#e06b10] text-xs font-bold text-white">
                    {getInitials(user?.employeNom || null, user?.email || '')}
                  </AvatarFallback>
                </Avatar>
                {/* Online status indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#134885] bg-emerald-500" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] font-semibold text-slate-200">
                  {displayName}
                </p>
                <div className="flex items-center gap-1.5">
                  <RoleIcon className="h-3 w-3 text-[#F6852A]" />
                  <span className="text-[11px] font-medium text-slate-500">
                    {roleLabels[displayRole] || displayRole}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            className="w-56 border-slate-200 shadow-xl"
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
      <div className="border-t border-white/[0.06] px-5 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-[#F6852A]/60" />
          <span className="text-[10px] text-slate-600">
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
