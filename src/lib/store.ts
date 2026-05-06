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
  | 'emails'
  | 'rh'

interface CurrentUser {
  id: string
  email: string
  role: string
  employeId: string | null
  employeNom: string | null
}

interface CRMStore {
  currentPage: Page
  sidebarOpen: boolean
  currentUser: CurrentUser | null
  setCurrentPage: (page: Page) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setCurrentUser: (user: CurrentUser) => void
  clearCurrentUser: () => void
}

export const useCRMStore = create<CRMStore>((set) => ({
  currentPage: 'dashboard',
  sidebarOpen: true,
  currentUser: null,
  setCurrentPage: (page) => set({ currentPage: page }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setCurrentUser: (user) => set({ currentUser: user }),
  clearCurrentUser: () => set({ currentUser: null }),
}))
