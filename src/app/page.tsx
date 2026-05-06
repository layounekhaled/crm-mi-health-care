'use client'

import { useCRMStore } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { CRMSidebar } from '@/components/crm/sidebar'
import Dashboard from '@/components/crm/dashboard'
import ProspectsModule from '@/components/crm/prospects'
import ClientsModule from '@/components/crm/clients'
import EventsModule from '@/components/crm/events'
import OpportunitiesModule from '@/components/crm/opportunities'
import OperationsModule from '@/components/crm/operations'
import TasksModule from '@/components/crm/tasks'
import AfterSalesModule from '@/components/crm/after-sales'
import EmployeesModule from '@/components/crm/employees'
import CalendarModule from '@/components/crm/calendar'
import EmailsModule from '@/components/crm/emails'
import RHModule from '@/components/crm/rh'
import DocumentsModule from '@/components/crm/documents'
import { useIsMobile } from '@/hooks/use-mobile'
import { Loader2 } from 'lucide-react'
import ChatWidget from '@/components/crm/chat'
import { GlobalSearch } from '@/components/crm/global-search'

export default function Home() {
  const { currentPage, sidebarOpen } = useCRMStore()
  const { isAuthenticated, isLoading } = useAuth()
  const isMobile = useIsMobile()

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

  const renderPage = () => {
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
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <CRMSidebar />
      <div
        className="transition-all duration-300"
        style={{
          marginLeft: !isMobile && sidebarOpen ? '256px' : '0',
        }}
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
