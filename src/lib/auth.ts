import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

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
        token.role = (user as { role: string }).role
        token.employeId = (user as { employeId: string | null }).employeId
        token.employeNom = (user as { employeNom: string | null }).employeNom
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        ;(session.user as { role?: string }).role = token.role as string
        ;(session.user as { employeId?: string | null }).employeId = token.employeId as string | null
        ;(session.user as { employeNom?: string | null }).employeNom = token.employeNom as string | null
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}
