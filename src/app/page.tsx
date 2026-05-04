'use client'

import { useCRMStore } from '@/lib/store'
import { CRMSidebar } from '@/components/crm/sidebar'
import Dashboard from '@/components/crm/dashboard'
import ProspectsModule from '@/components/crm/prospects'
import EventsModule from '@/components/crm/events'
import OpportunitiesModule from '@/components/crm/opportunities'
import OperationsModule from '@/components/crm/operations'
import TasksModule from '@/components/crm/tasks'
import AfterSalesModule from '@/components/crm/after-sales'
import EmployeesModule from '@/components/crm/employees'
import { useIsMobile } from '@/hooks/use-mobile'

export default function Home() {
  const { currentPage, sidebarOpen } = useCRMStore()
  const isMobile = useIsMobile()

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />
      case 'prospects':
        return <ProspectsModule />
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
    </div>
  )
}
