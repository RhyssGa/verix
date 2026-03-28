'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useAuditStore } from '@/stores/useAuditStore'
import { useScore } from '@/stores/computed'
import { useExport } from '@/hooks/useExport'

interface TopBarProps {
  mode: 'gerance' | 'copro'
}

export function TopBar({ mode }: TopBarProps) {
  const showHistory = useAuditStore((s) => s.showHistory)
  const setShowHistory = useAuditStore((s) => s.setShowHistory)
  const isGeneratingPdf = useAuditStore((s) => s.isGeneratingPdf)
  const setResetConfirm = useAuditStore((s) => s.setResetConfirm)
  const score = useScore()
  const { generateReport } = useExport()


  return (
    <header className="sticky top-0 z-40 flex items-center h-[68px] px-6 gap-4 shrink-0"
      style={{ background: '#0B1929', borderBottom: '1px solid rgba(196,154,46,0.3)' }}>

      {/* Logo + identité — clic = retour accueil */}
      <Link href="/" className="flex items-center gap-4 shrink-0" style={{ textDecoration: 'none' }}>
        <div className="relative h-10 w-10 shrink-0">
          <Image
            src="/report-assets/logo_sceau_blanc.png"
            alt="Century 21"
            fill
            className="object-contain"
          />
        </div>
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.12)' }} className="pl-3">
          <div className="text-[9px] font-bold tracking-[2px] uppercase" style={{ color: '#C49A2E' }}>
            Century 21 · Groupe Martinot
          </div>
          <div className="text-[14px] font-semibold text-white leading-tight tracking-wide">
            Audit Comptable
          </div>
        </div>
      </Link>

      <div className="flex-1" />

      {/* Switcher Gérance / Copro */}
      <div className="flex items-center gap-1 rounded-lg p-1 shrink-0"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {(['gerance', 'copro'] as const).map((m) => (
          <Link
            key={m}
            href={`/audit/${m}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all"
            style={{
              background: mode === m ? '#C49A2E' : 'transparent',
              color: mode === m ? '#0B1929' : 'rgba(255,255,255,0.5)',
              textDecoration: 'none',
            }}
          >
            {m === 'gerance' ? '🏠 Gérance' : '🏢 Copro'}
          </Link>
        ))}
      </div>

      {/* Séparateur */}
      <div className="h-8 w-px shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
          style={{
            background: showHistory ? 'rgba(255,255,255,0.12)' : 'transparent',
            color: showHistory ? '#fff' : 'rgba(255,255,255,0.6)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = showHistory ? 'rgba(255,255,255,0.12)' : 'transparent'
            e.currentTarget.style.color = showHistory ? '#fff' : 'rgba(255,255,255,0.6)'
          }}
        >
          <span>📋</span> Historique
        </button>

        <button
          onClick={() => setResetConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
          style={{ background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(176,26,26,0.15)'
            e.currentTarget.style.color = '#f87171'
            e.currentTarget.style.borderColor = 'rgba(176,26,26,0.3)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
          }}
        >
          <span>↺</span> Réinitialiser
        </button>

        {score && (
          <button
            onClick={generateReport}
            disabled={isGeneratingPdf}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
            style={{
              background: isGeneratingPdf
                ? 'rgba(196,154,46,0.4)'
                : 'linear-gradient(135deg, #C49A2E, #A87E20)',
              color: '#0B1929',
              border: 'none',
              cursor: isGeneratingPdf ? 'not-allowed' : 'pointer',
              boxShadow: isGeneratingPdf ? 'none' : '0 2px 8px rgba(196,154,46,0.35)',
            }}
          >
            {isGeneratingPdf ? '⏳ Génération…' : '📄 Rapport PDF'}
          </button>
        )}
      </div>
    </header>
  )
}
