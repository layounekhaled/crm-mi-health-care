'use client'

import { createContext, useContext, useEffect } from 'react'
import { SessionProvider, useSession, signOut } from 'next-auth/react'
import { useCRMStore } from '@/lib/store'

interface AuthUser {
  id: string
  email: string
  role: string
  employeId: string | null
  employeNom: string | null
}

interface AuthContextType {
  user: AuthUser | null
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

function mapSessionUser(sessionUser: {
  id?: string
  email?: string | null
  role?: string
  employeId?: string | null
  employeNom?: string | null
}): AuthUser {
  return {
    id: sessionUser.id || '',
    email: sessionUser.email || '',
    role: sessionUser.role || 'commercial',
    employeId: sessionUser.employeId || null,
    employeNom: sessionUser.employeNom || null,
  }
}

function AuthInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const { setCurrentUser, clearCurrentUser } = useCRMStore()

  useEffect(() => {
    if (session?.user) {
      const userData = mapSessionUser(session.user)
      setCurrentUser(userData)
    } else if (status !== 'loading') {
      clearCurrentUser()
    }
  }, [session, status, setCurrentUser, clearCurrentUser])

  const user = session?.user ? mapSessionUser(session.user) : null

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
