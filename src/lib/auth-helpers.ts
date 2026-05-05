import { getToken } from 'next-auth/jwt'
import { NextRequest } from 'next/server'

export interface AuthUser {
  id: string
  email: string
  role: string
  employeId: string | null
  employeNom: string | null
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })
    if (!token) return null
    return {
      id: token.id as string,
      email: token.email as string,
      role: token.role as string,
      employeId: token.employeId as string | null,
      employeNom: token.employeNom as string | null,
    }
  } catch {
    return null
  }
}

export function canAccess(authUser: AuthUser | null, requiredRoles: string[]): boolean {
  if (!authUser) return false
  return requiredRoles.includes(authUser.role)
}

export function isAdmin(authUser: AuthUser | null): boolean {
  return authUser?.role === 'admin'
}

export function isCommercial(authUser: AuthUser | null): boolean {
  return authUser?.role === 'commercial'
}

export function isTechnicien(authUser: AuthUser | null): boolean {
  return authUser?.role === 'technicien'
}
