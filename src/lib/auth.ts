import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

declare module 'next-auth' {
  interface User {
    role?: string
    employeId?: string | null
    employeNom?: string | null
  }
  interface Session {
    user: {
      id: string
      email: string
      role?: string
      employeId?: string | null
      employeNom?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: string
    employeId?: string | null
    employeNom?: string | null
  }
}

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://')

const cookiePrefix = useSecureCookies ? '__Secure-' : ''

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        motDePasse: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.motDePasse) {
          throw new Error('Email et mot de passe requis')
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: { employe: true },
        })

        if (!user) {
          throw new Error('Identifiants invalides')
        }

        const isValid = await bcrypt.compare(credentials.motDePasse, user.motDePasse)
        if (!isValid) {
          throw new Error('Identifiants invalides')
        }

        if (!user.actif) {
          throw new Error('Compte désactivé. Contactez l\'administrateur.')
        }

        // Update derniereConnexion
        await db.user.update({
          where: { id: user.id },
          data: { derniereConnexion: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          employeId: user.employeId,
          employeNom: user.employe?.nom || null,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.employeId = user.employeId
        token.employeNom = user.employeNom
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role
        session.user.employeId = token.employeId
        session.user.employeNom = token.employeNom
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies ? true : false,
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies ? true : false,
      },
    },
    csrfToken: {
      name: `${cookiePrefix}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies ? true : false,
      },
    },
  },
}
