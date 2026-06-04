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
    <div className="flex min-h-screen relative overflow-hidden">
      {/* ── Animated Background ── */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0B2545] via-[#134885] to-[#1A5A9E]">
        {/* SVG Grid pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Floating nodes / data points */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.12]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
          {/* Connection lines */}
          <line x1="150" y1="200" x2="350" y2="150" stroke="white" strokeWidth="1" />
          <line x1="350" y1="150" x2="500" y2="280" stroke="white" strokeWidth="1" />
          <line x1="500" y1="280" x2="300" y2="400" stroke="white" strokeWidth="1" />
          <line x1="300" y1="400" x2="150" y2="200" stroke="white" strokeWidth="1" />
          <line x1="500" y1="280" x2="700" y2="200" stroke="white" strokeWidth="1" />
          <line x1="700" y1="200" x2="900" y2="320" stroke="white" strokeWidth="1" />
          <line x1="900" y1="320" x2="1050" y2="180" stroke="white" strokeWidth="1" />
          <line x1="700" y1="200" x2="800" y2="450" stroke="white" strokeWidth="1" />
          <line x1="800" y1="450" x2="600" y2="550" stroke="white" strokeWidth="1" />
          <line x1="600" y1="550" x2="400" y2="600" stroke="white" strokeWidth="1" />
          <line x1="400" y1="600" x2="300" y2="400" stroke="white" strokeWidth="1" />
          <line x1="900" y1="320" x2="1000" y2="500" stroke="white" strokeWidth="1" />
          <line x1="1000" y1="500" x2="800" y2="450" stroke="white" strokeWidth="1" />
          <line x1="200" y1="550" x2="400" y2="600" stroke="white" strokeWidth="1" />
          <line x1="200" y1="550" x2="150" y2="200" stroke="white" strokeWidth="1" />

          {/* Nodes */}
          <circle cx="150" cy="200" r="4" fill="#F6852A" />
          <circle cx="350" cy="150" r="3" fill="white" />
          <circle cx="500" cy="280" r="5" fill="#F6852A" />
          <circle cx="300" cy="400" r="3" fill="white" />
          <circle cx="700" cy="200" r="4" fill="white" />
          <circle cx="900" cy="320" r="3" fill="#F6852A" />
          <circle cx="1050" cy="180" r="3" fill="white" />
          <circle cx="800" cy="450" r="4" fill="white" />
          <circle cx="600" cy="550" r="3" fill="#F6852A" />
          <circle cx="400" cy="600" r="3" fill="white" />
          <circle cx="1000" cy="500" r="3" fill="white" />
          <circle cx="200" cy="550" r="3" fill="#F6852A" />
        </svg>

        {/* Glowing orbs */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[10%] left-[8%] h-72 w-72 rounded-full bg-[#F6852A]/20 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-[15%] right-[10%] h-96 w-96 rounded-full bg-[#1A5A9E]/40 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.08, 0.15, 0.08] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
          className="absolute top-[50%] left-[40%] h-64 w-64 rounded-full bg-white/10 blur-3xl"
        />

        {/* Floating dashboard mockup elements - top left */}
        <div className="hidden lg:block absolute top-12 left-12 opacity-[0.08]">
          <svg width="200" height="140" viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="196" height="136" rx="8" stroke="white" strokeWidth="1.5" />
            <line x1="2" y1="28" x2="198" y2="28" stroke="white" strokeWidth="1" />
            <circle cx="16" cy="15" r="3" fill="#F6852A" />
            <circle cx="28" cy="15" r="3" fill="white" opacity="0.5" />
            <circle cx="40" cy="15" r="3" fill="white" opacity="0.3" />
            <rect x="12" y="40" width="80" height="8" rx="2" fill="white" opacity="0.4" />
            <rect x="12" y="56" width="60" height="8" rx="2" fill="white" opacity="0.3" />
            <rect x="12" y="72" width="90" height="8" rx="2" fill="white" opacity="0.2" />
            <rect x="12" y="88" width="45" height="8" rx="2" fill="white" opacity="0.3" />
            <rect x="108" y="40" width="80" height="80" rx="4" stroke="white" strokeWidth="1" />
            <polyline points="118,108 133,85 148,95 163,70 178,78" stroke="#F6852A" strokeWidth="2" fill="none" />
          </svg>
        </div>

        {/* Floating chart elements - bottom right */}
        <div className="hidden lg:block absolute bottom-16 right-16 opacity-[0.08]">
          <svg width="180" height="120" viewBox="0 0 180 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="176" height="116" rx="8" stroke="white" strokeWidth="1.5" />
            <rect x="16" y="80" width="20" height="28" rx="2" fill="white" opacity="0.3" />
            <rect x="44" y="60" width="20" height="48" rx="2" fill="white" opacity="0.4" />
            <rect x="72" y="40" width="20" height="68" rx="2" fill="#F6852A" opacity="0.5" />
            <rect x="100" y="55" width="20" height="53" rx="2" fill="white" opacity="0.35" />
            <rect x="128" y="70" width="20" height="38" rx="2" fill="white" opacity="0.25" />
            <line x1="10" y1="110" x2="170" y2="110" stroke="white" opacity="0.3" />
          </svg>
        </div>

        {/* Floating people icons - middle left */}
        <div className="hidden lg:block absolute top-[45%] left-[5%] opacity-[0.06]">
          <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="30" cy="25" r="12" stroke="white" strokeWidth="1.5" />
            <path d="M10 65 C10 48 50 48 50 65" stroke="white" strokeWidth="1.5" />
            <circle cx="80" cy="20" r="10" stroke="white" strokeWidth="1.5" />
            <path d="M62 55 C62 42 98 42 98 55" stroke="white" strokeWidth="1.5" />
            <line x1="55" y1="35" x2="65" y2="30" stroke="white" strokeWidth="1" />
          </svg>
        </div>

        {/* Radial gradient overlay for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(11,37,69,0.4)_70%)]" />
      </div>

      {/* ── Left Panel: Branding ── */}
      <div className="hidden lg:flex lg:w-[45%] relative z-10 flex-col items-center justify-center p-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center"
        >
          {/* Logo */}
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 150, delay: 0.3 }}
            className="mx-auto mb-10 rounded-2xl bg-white/10 backdrop-blur-xl p-6 shadow-2xl border border-white/10 inline-block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="MI HEALTH CARE"
              className="h-28 w-auto"
            />
          </motion.div>

          {/* Brand text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <h1 className="text-4xl font-bold text-white tracking-wide">
              DALIA
            </h1>
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="h-[2px] w-12 rounded-full bg-[#F6852A]" />
              <p className="text-sm font-medium text-[#F6852A] uppercase tracking-[0.2em]">CRM</p>
              <div className="h-[2px] w-12 rounded-full bg-[#F6852A]" />
            </div>
            <p className="mt-4 text-white/70 text-lg font-light leading-relaxed max-w-xs mx-auto">
              Le système qui centralise toute votre activité
            </p>
            <p className="text-white/50 text-base font-light">
              prospects, ventes, opérations et suivi des clients
            </p>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-8 flex flex-wrap justify-center gap-2"
          >
            {['Prospects', 'Opportunités', 'Opérations', 'SAV', 'Documents'].map((feature, i) => (
              <span
                key={feature}
                className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white/60 border border-white/10 backdrop-blur-sm"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {feature}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* ── Right Panel: Login Form ── */}
      <div className="flex w-full lg:w-[55%] items-center justify-center p-4 relative z-10">
        {/* Mobile background decoration */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
          <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-[#F6852A]/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-[#1A5A9E]/20 blur-3xl" />
        </div>

        {/* Mobile logo */}
        <div className="lg:hidden absolute top-6 left-1/2 -translate-x-1/2 z-20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="MI HEALTH CARE" className="h-10 w-auto opacity-80" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative z-10 w-full max-w-md mt-16 lg:mt-0"
        >
          <Card className="border-white/10 bg-white/[0.07] backdrop-blur-2xl shadow-2xl shadow-black/20">
            <CardHeader className="space-y-4 pb-2 text-center">
              {/* Logo inside card (desktop) */}
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
                className="mx-auto hidden lg:block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="MI HEALTH CARE"
                  className="mx-auto h-14 w-auto object-contain brightness-0 invert opacity-80"
                />
              </motion.div>

              {/* Header text */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  Connexion
                </h2>
                <CardDescription className="mt-1 text-sm font-medium text-white/60">
                  DALIA &quot;le cerveau de l&apos;entreprise&quot;
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
                    className="rounded-lg border border-red-400/30 bg-red-500/10 backdrop-blur-sm px-4 py-3 text-sm text-red-300"
                  >
                    {error}
                  </motion.div>
                )}

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-white/70">
                    Adresse email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="nom@mihealthcare.dz"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11 border-white/10 bg-white/[0.06] text-white placeholder:text-white/30 focus:border-[#F6852A]/50 focus:ring-[#F6852A]/20"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-white/70">
                    Mot de passe
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 border-white/10 bg-white/[0.06] text-white placeholder:text-white/30 focus:border-[#F6852A]/50 focus:ring-[#F6852A]/20"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
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
                    className="border-white/20 data-[state=checked]:bg-[#F6852A] data-[state=checked]:border-[#F6852A]"
                  />
                  <Label
                    htmlFor="remember"
                    className="text-sm text-white/50 cursor-pointer select-none"
                  >
                    Se souvenir de moi
                  </Label>
                </div>

                {/* Submit button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full bg-gradient-to-r from-[#F6852A] to-[#e57a22] text-white font-semibold shadow-lg shadow-[#F6852A]/25 hover:from-[#e5761f] hover:to-[#d46a18] transition-all duration-200"
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
            </CardContent>
          </Card>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-white/30">
            MI HEALTH CARE &copy; {new Date().getFullYear()} — Tous droits réservés
          </p>
        </motion.div>
      </div>
    </div>
  )
}
