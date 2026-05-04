import { create } from 'zustand'

export type Page = 
  | 'dashboard' 
  | 'prospects' 
  | 'events' 
  | 'opportunities' 
  | 'operations' 
  | 'tasks' 
  | 'after-sales' 
  | 'employees'

interface CRMStore {
  currentPage: Page
  sidebarOpen: boolean
  setCurrentPage: (page: Page) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

export const useCRMStore = create<CRMStore>((set) => ({
  currentPage: 'dashboard',
  sidebarOpen: true,
  setCurrentPage: (page) => set({ currentPage: page }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}))
