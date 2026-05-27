'use client'

import { createContext, useContext, useEffect, useMemo } from 'react'
import { SessionProvider, useSession, signOut } from 'next-auth/react'
import { useCRMStore } from '@/lib/store'
import { hasPermission as checkPermission, canViewModule as checkView, type PermissionModule, type PermissionAction } from '@/lib/permissions'

interface AuthUser {
  id: string
  email: string
  role: string
  employeId: string | null
  employeNom: string | null
  permissions: Record<string, unknown> | null
}

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  role: string | null
  logout: () => void
  hasPermission: (module: PermissionModule, action: PermissionAction) => boolean
  canViewModule: (module: PermissionModule) => boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  role: null,
  logout: () => {},
  hasPermission: () => false,
  canViewModule: () => false,
})

function mapSessionUser(sessionUser: {
  id?: string
  email?: string | null
  role?: string
  employeId?: string | null
  employeNom?: string | null
  permissions?: Record<string, unknown> | null
}): AuthUser {
  return {
    id: sessionUser.id || '',
    email: sessionUser.email || '',
    role: sessionUser.role || 'commercial',
    employeId: sessionUser.employeId || null,
    employeNom: sessionUser.employeNom || null,
    permissions: sessionUser.permissions || null,
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

  const userHasPermission = useMemo(() => {
    return (module: PermissionModule, action: PermissionAction) => {
      if (!user) return false
      return checkPermission(user.role, user.permissions, module, action)
    }
  }, [user])

  const userCanViewModule = useMemo(() => {
    return (module: PermissionModule) => {
      if (!user) return false
      return checkView(user.role, user.permissions, module)
    }
  }, [user])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!session,
        isLoading: status === 'loading',
        role: user?.role || null,
        logout,
        hasPermission: userHasPermission,
        canViewModule: userCanViewModule,
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
