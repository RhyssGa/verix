'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function ReportingTopBar() {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-40 flex items-center h-[68px] px-6 gap-4 shrink-0 bg-[#0B1929] border-b border-[rgba(196,154,46,0.3)]">

      {/* Logo + identité — clic = accueil */}
      <Link href="/" className="flex items-center gap-4 shrink-0 no-underline">
        <div className="relative h-10 w-10 shrink-0">
          <Image
            src="/report-assets/logo_sceau_blanc.png"
            alt="Century 21"
            fill
            className="object-contain"
          />
        </div>
        <div className="pl-3 border-l border-[rgba(255,255,255,0.12)]">
          <div className="text-[9px] font-bold tracking-[2px] uppercase text-[#C49A2E]">
            Century 21 · Groupe Martinot
          </div>
          <div className="text-[14px] font-semibold text-white leading-tight tracking-wide">
            Reporting groupe
          </div>
        </div>
      </Link>

      <div className="flex-1" />

      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border border-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.12)] hover:text-white"
      >
        ← Retour à l&apos;audit
      </button>

    </header>
  )
}
