import { LoginBranding } from '@/components/auth/LoginBranding'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-6 py-8 relative">
      <LoginBranding />
      <LoginForm />
      <p className="absolute bottom-6 text-[10px] text-white/20 tracking-wide">
        Century 21 · Groupe Martinot · Audit Comptable
      </p>
    </div>
  )
}
