'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        motDePasse: password,
        redirect: false,
      })

      if (result?.error) {
        if (result.error.includes('désactivé')) {
          setError('Compte désactivé. Contactez l\'administrateur.')
        } else {
          setError('Email ou mot de passe incorrect')
        }
      } else {
        router.push('/')
        router.refresh()
      }
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Brand panel (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#134885] relative overflow-hidden flex-col items-center justify-center p-12">
        {/* Decorative circles */}
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#1A5A9E]/50 blur-2xl" />
        <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-[#F6852A]/20 blur-2xl" />
        <div className="absolute right-1/4 bottom-1/4 h-40 w-40 rounded-full bg-white/5 blur-xl" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 text-center"
        >
          {/* Logo on white card for contrast on blue panel */}
          <div className="mx-auto mb-8 rounded-2xl bg-white p-5 shadow-2xl shadow-black/20 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="MI HEALTH CARE"
              className="h-24 w-auto"
            />
          </div>
          <div className="text-white/80 max-w-sm mx-auto text-center">
            <p className="text-2xl font-semibold tracking-wide">&quot;DALIA&quot;</p>
            <p className="text-base font-light mt-2">le système qui centralise toute votre activité</p>
            <p className="text-base font-light">prospects, ventes, opérations et suivi des clients</p>
          </div>
          <div className="mt-8 flex items-center justify-center gap-2">
            <div className="h-1 w-8 rounded-full bg-[#F6852A]" />
            <div className="h-1 w-2 rounded-full bg-[#F6852A]/60" />
            <div className="h-1 w-1 rounded-full bg-[#F6852A]/30" />
          </div>
        </motion.div>
      </div>

      {/* Right side - Login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-4 relative">
        {/* Background decoration for mobile */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
          <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-blue-100/40 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-orange-100/40 blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md"
        >
          <Card className="border-0 shadow-2xl shadow-slate-200/50">
            <CardHeader className="space-y-4 pb-2 text-center">
              {/* Logo - visible on ALL screen sizes */}
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className="mx-auto"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="MI HEALTH CARE"
                  className="mx-auto h-16 w-auto object-contain"
                />
              </motion.div>

              {/* Header text */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Connexion
                </h2>
                <CardDescription className="mt-1 text-sm font-medium text-[#134885]">
                  DALIA "le cerveau de l'entreprise"
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Error message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {error}
                  </motion.div>
                )}

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                    Adresse email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="nom@mihealthcare.dz"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11 border-slate-200 bg-white focus:border-[#134885] focus:ring-[#134885]/20"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                    Mot de passe
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 border-slate-200 bg-white focus:border-[#134885] focus:ring-[#134885]/20"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember me */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    className="border-slate-300 data-[state=checked]:bg-[#134885] data-[state=checked]:border-[#134885]"
                  />
                  <Label
                    htmlFor="remember"
                    className="text-sm text-slate-600 cursor-pointer select-none"
                  >
                    Se souvenir de moi
                  </Label>
                </div>

                {/* Submit button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full bg-gradient-to-r from-[#134485] to-[#1A5A9E] text-white font-semibold shadow-lg shadow-[#134885]/25 hover:from-[#0D3A6E] hover:to-[#134885] transition-all duration-200"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connexion en cours...
                    </>
                  ) : (
                    'Se connecter'
                  )}
                </Button>
              </form>

              {/* Demo credentials */}
              <div className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-3">
                <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Comptes de démonstration
                </p>
                <div className="space-y-1 text-xs text-slate-500">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-600">Admin</span>
                    <span>khaled@mihealthcare.dz / admin123</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-600">Commercial</span>
                    <span>amine@mihealthcare.dz / com123</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-600">Technicien</span>
                    <span>youcef@mihealthcare.dz / tech123</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
