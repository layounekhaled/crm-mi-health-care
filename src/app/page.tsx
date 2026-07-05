'use client'

import { useEffect } from 'react'
import { useCRMStore } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { CRMSidebar } from '@/components/crm/sidebar'
import Dashboard from '@/components/crm/dashboard'
import ProspectsModule from '@/components/crm/prospects'
import ClientsModule from '@/components/crm/clients'
import EventsModule from '@/components/crm/events'
import OpportunitiesModule from '@/components/crm/opportunities'
import OperationsModule from '@/components/crm/operations'
import CatalogModule from '@/components/crm/catalog'
import TasksModule from '@/components/crm/tasks'
import AfterSalesModule from '@/components/crm/after-sales'
import EmployeesModule from '@/components/crm/employees'
import CalendarModule from '@/components/crm/calendar'
import EmailsModule from '@/components/crm/emails'
import RHModule from '@/components/crm/rh'
import DocumentsModule from '@/components/crm/documents'
import ChargesModule from '@/components/crm/charges'
import CashManagement from '@/components/crm/cash'
import { useIsMobile } from '@/hooks/use-mobile'
import { Loader2, ShieldAlert } from 'lucide-react'
import ChatWidget from '@/components/crm/chat'
import { GlobalSearch } from '@/components/crm/global-search'
import { ImpersonationBanner } from '@/components/crm/impersonation-banner'

// Map between store Page keys and permission module keys.
// This is needed to verify that the current page is actually allowed for the user.
const PAGE_PERMISSION_MAP: Record<string, string> = {
  dashboard: 'dashboard',
  prospects: 'prospects',
  clients: 'clients',
  events: 'events',
  opportunities: 'opportunities',
  operations: 'operations',
  catalog: 'catalog',
  tasks: 'tasks',
  'after-sales': 'afterSales',
  employees: 'employees',
  calendar: 'calendar',
  emails: 'emails',
  rh: 'rh',
  documents: 'documents',
  charges: 'charges',
  caisse: 'caisse',
}

// Default landing page per role — used when the user has no explicit page
// permission for 'dashboard'. We pick the first module they CAN view in
// the order they appear in the sidebar.
const PREFERRED_FALLBACK_ORDER: string[] = [
  'dashboard',
  'prospects',
  'clients',
  'events',
  'opportunities',
  'operations',
  'catalog',
  'tasks',
  'after-sales',
  'calendar',
  'emails',
  'documents',
  'rh',
  'charges',
  'caisse',
  'employees',
]

export default function Home() {
  const { currentPage, setCurrentPage, sidebarOpen } = useCRMStore()
  const { isAuthenticated, isLoading, user, canViewModule } = useAuth()
  const isMobile = useIsMobile()

  // Safety net: if the user is authenticated but their currentPage is not
  // accessible, redirect them to the first accessible page. This duplicates
  // the logic in CRMSidebar, but is important because:
  // 1) the sidebar effect only runs when CRMSidebar is mounted
  // 2) it provides defense-in-depth in case the sidebar effect is bypassed
  useEffect(() => {
    if (!isAuthenticated || !user) return

    const permissionModule = PAGE_PERMISSION_MAP[currentPage]
    if (permissionModule && canViewModule(permissionModule as Parameters<typeof canViewModule>[0])) {
      return // current page is accessible
    }

    // Find the first accessible page in the preferred order
    const firstAccessible = PREFERRED_FALLBACK_ORDER.find((page) => {
      const mod = PAGE_PERMISSION_MAP[page]
      if (!mod) return false
      return canViewModule(mod as Parameters<typeof canViewModule>[0])
    })

    if (firstAccessible && firstAccessible !== currentPage) {
      setCurrentPage(firstAccessible as typeof currentPage)
    }
  }, [isAuthenticated, user, currentPage, canViewModule, setCurrentPage])

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#134885]" />
          <p className="text-sm text-slate-500">Chargement...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, middleware will redirect - show nothing
  if (!isAuthenticated) {
    return null
  }

  // Permission guard for the current page
  const currentPermissionModule = PAGE_PERMISSION_MAP[currentPage]
  const canViewCurrent =
    !currentPermissionModule ||
    canViewModule(currentPermissionModule as Parameters<typeof canViewModule>[0])

  // If no module is accessible at all, show an access-denied screen
  const hasAnyAccessiblePage = PREFERRED_FALLBACK_ORDER.some((page) => {
    const mod = PAGE_PERMISSION_MAP[page]
    if (!mod) return false
    return canViewModule(mod as Parameters<typeof canViewModule>[0])
  })

  const renderPage = () => {
    if (!canViewCurrent) {
      if (!hasAnyAccessiblePage) {
        return (
          <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <ShieldAlert className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Accès refusé</h1>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              Vous n&apos;avez accès à aucun module du CRM. Veuillez contacter un
              administrateur pour qu&apos;il vous attribue les permissions nécessaires.
            </p>
          </div>
        )
      }
      // While the redirect effect hasn't kicked in yet, show a loading spinner
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#134885]" />
            <p className="text-sm text-slate-500">Redirection...</p>
          </div>
        </div>
      )
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />
      case 'prospects':
        return <ProspectsModule />
      case 'clients':
        return <ClientsModule />
      case 'events':
        return <EventsModule />
      case 'opportunities':
        return <OpportunitiesModule />
      case 'operations':
        return <OperationsModule />
      case 'catalog':
        return <CatalogModule />
      case 'tasks':
        return <TasksModule />
      case 'after-sales':
        return <AfterSalesModule />
      case 'employees':
        return <EmployeesModule />
      case 'calendar':
        return <CalendarModule />
      case 'rh':
        return <RHModule />
      case 'emails':
        return <EmailsModule />
      case 'documents':
        return <DocumentsModule />
      case 'charges':
        return <ChargesModule />
      case 'caisse':
        return <CashManagement />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ImpersonationBanner />
      <CRMSidebar />
      <div
        className={`transition-all duration-300 ease-in-out ${!isMobile && sidebarOpen ? 'ml-64' : 'ml-0'}`}
      >
        <main className="min-h-screen">
          {renderPage()}
        </main>
      </div>
      <ChatWidget />
      <GlobalSearch />
    </div>
  )
}
