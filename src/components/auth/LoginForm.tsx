'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

interface FieldProps {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  minLength?: number
}

function Field({ label, type, value, onChange, placeholder, required, minLength }: FieldProps) {
  return (
    <div className="mb-3.5">
      <label className="block text-[11px] font-semibold text-white/50 mb-1.5 tracking-wide uppercase">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="w-full px-4 py-3 text-sm rounded-xl bg-white/[0.06] text-white placeholder:text-white/25 outline-none transition-colors border border-[#C49A2E]/30 focus:border-[#C49A2E]"
      />
    </div>
  )
}

export function LoginForm() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isSignUp) {
        const { error: err } = await authClient.signUp.email({
          name: name || email.split('@')[0],
          email,
          password,
        })
        if (err) { setError(err.message ?? 'Erreur lors de l\'inscription'); return }
      } else {
        const { error: err } = await authClient.signIn.email({ email, password })
        if (err) { setError(err.message ?? 'Email ou mot de passe incorrect'); return }
      }
      router.push('/')
    } catch {
      setError('Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm bg-white/[0.03] border border-[#C49A2E]/20 rounded-2xl px-7 py-8">
      <h2 className="text-base font-bold text-white text-center mb-1">
        {isSignUp ? 'Créer un compte' : 'Connexion'}
      </h2>
      <p className="text-xs text-white/40 text-center mb-6">
        {isSignUp
          ? 'Remplissez les informations ci-dessous'
          : 'Connectez-vous pour accéder à l\'application'}
      </p>

      {error && (
        <div className="px-3.5 py-2.5 rounded-lg bg-status-red-bg border border-status-red/40 text-status-red text-xs text-center mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {isSignUp && (
          <Field label="Nom" type="text" value={name} onChange={setName} placeholder="Votre nom" />
        )}
        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="nom@exemple.com" required />
        <Field label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="••••••••" required minLength={8} />

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3 rounded-xl text-[13px] font-bold uppercase tracking-wide text-navy transition-all"
          style={{
            background: loading ? 'rgba(196,154,46,0.4)' : 'linear-gradient(135deg, #C49A2E, #A87E20)',
            boxShadow: loading ? 'none' : '0 4px 16px rgba(196,154,46,0.3)',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '⏳ Chargement…' : isSignUp ? 'Créer le compte' : 'Se connecter'}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-white/40">
        {isSignUp ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
        <button
          onClick={() => { setIsSignUp(!isSignUp); setError('') }}
          className="text-[#C49A2E] font-semibold underline underline-offset-2 bg-transparent border-none cursor-pointer text-xs"
        >
          {isSignUp ? 'Se connecter' : 'Créer un compte'}
        </button>
      </p>
    </div>
  )
}
