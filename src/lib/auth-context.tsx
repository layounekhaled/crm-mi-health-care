'use client'

import { createContext, useContext, useEffect } from 'react'
import { SessionProvider, useSession, signOut } from 'next-auth/react'
import { useCRMStore } from '@/lib/store'

interface AuthContextType {
  user: {
    id: string
    email: string
    role: string
    employeId: string | null
    employeNom: string | null
  } | null
  isAuthenticated: boolean
  isLoading: boolean
  role: string | null
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  role: null,
  logout: () => {},
})

function AuthInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const { setCurrentUser, clearCurrentUser } = useCRMStore()

  useEffect(() => {
    if (session?.user) {
      const userData = {
        id: session.user.id,
        email: session.user.email || '',
        role: (session.user as { role?: string }).role || 'commercial',
        employeId: (session.user as { employeId?: string | null }).employeId || null,
        employeNom: (session.user as { employeNom?: string | null }).employeNom || null,
      }
      setCurrentUser(userData)
    } else if (status !== 'loading') {
      clearCurrentUser()
    }
  }, [session, status, setCurrentUser, clearCurrentUser])

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email || '',
        role: (session.user as { role?: string }).role || 'commercial',
        employeId: (session.user as { employeId?: string | null }).employeId || null,
        employeNom: (session.user as { employeNom?: string | null }).employeNom || null,
      }
    : null

  const logout = () => {
    clearCurrentUser()
    signOut({ callbackUrl: '/login' })
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!session,
        isLoading: status === 'loading',
        role: user?.role || null,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthInner>{children}</AuthInner>
    </SessionProvider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
