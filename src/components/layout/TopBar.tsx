'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuditStore } from '@/stores/useAuditStore'
import { useScore } from '@/stores/computed'
import { useExport } from '@/hooks/useExport'
import { useAuth } from '@/hooks/useAuth'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface TopBarProps {
  mode: 'gerance' | 'copro'
}

export function TopBar({ mode }: TopBarProps) {
  const showHistory = useAuditStore((s) => s.showHistory)
  const setShowHistory = useAuditStore((s) => s.setShowHistory)
  const isGeneratingPdf = useAuditStore((s) => s.isGeneratingPdf)
  const setResetConfirm = useAuditStore((s) => s.setResetConfirm)
  const resetAll = useAuditStore((s) => s.resetAll)
  const score = useScore()
  const { generateReportV2 } = useExport()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [showGoHomeConfirm, setShowGoHomeConfirm] = useState(false)

  function handleGoHome(e: React.MouseEvent) {
    e.preventDefault()
    setShowGoHomeConfirm(true)
  }


  return (
    <>
    <header className="sticky top-0 z-40 flex items-center h-[68px] px-6 gap-4 shrink-0 bg-[#0B1929] border-b border-[rgba(196,154,46,0.3)]">

      {/* Logo + identité — clic = confirmation + reset + retour accueil */}
      <Link href="/" className="flex items-center gap-4 shrink-0 no-underline" onClick={handleGoHome}>
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
            Audit Comptable
          </div>
        </div>
      </Link>

      <div className="flex-1" />

      {/* Switcher Gérance / Copro */}
      <div className="flex items-center gap-1 rounded-lg p-1 shrink-0 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)]">
        {(['gerance', 'copro'] as const).map((m) => (
          <Link
            key={m}
            href={`/audit/${m}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all no-underline"
            style={{
              background: mode === m ? '#C49A2E' : 'transparent',
              color: mode === m ? '#0B1929' : 'rgba(255,255,255,0.5)',
            }}
          >
            {m === 'gerance' ? '🏠 Gérance' : '🏢 Copro'}
          </Link>
        ))}
      </div>

      {/* Séparateur */}
      <div className="h-8 w-px shrink-0 bg-[rgba(255,255,255,0.1)]" />

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border border-[rgba(255,255,255,0.12)]"
          style={{
            background: showHistory ? 'rgba(255,255,255,0.12)' : 'transparent',
            color: showHistory ? '#fff' : 'rgba(255,255,255,0.6)',
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border border-[rgba(255,255,255,0.08)] bg-transparent text-[rgba(255,255,255,0.5)]"
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

        {/* User info + déconnexion */}
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[rgba(255,255,255,0.45)] max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">
              {user.name || user.email}
            </span>
            <button
              onClick={signOut}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border border-[rgba(255,255,255,0.08)] bg-transparent text-[rgba(255,255,255,0.4)]"
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(176,26,26,0.12)'
                e.currentTarget.style.color = '#f87171'
                e.currentTarget.style.borderColor = 'rgba(176,26,26,0.25)'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
              }}
            >
              Déconnexion
            </button>
          </div>
        )}

        {score && (
          <button
            onClick={generateReportV2}
            disabled={isGeneratingPdf}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all text-[#0B1929] border-none"
            style={{
              background: isGeneratingPdf
                ? 'rgba(196,154,46,0.4)'
                : 'linear-gradient(135deg, #C49A2E, #A87E20)',
              cursor: isGeneratingPdf ? 'not-allowed' : 'pointer',
              boxShadow: isGeneratingPdf ? 'none' : '0 2px 8px rgba(196,154,46,0.35)',
            }}
          >
            {isGeneratingPdf ? '⏳ Génération…' : '📄 Rapport PDF'}
          </button>
        )}
      </div>
    </header>

    <AlertDialog open={showGoHomeConfirm} onOpenChange={(o) => { if (!o) setShowGoHomeConfirm(false) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Retourner à l&apos;accueil ?</AlertDialogTitle>
          <AlertDialogDescription>
            Toutes les données de l&apos;audit en cours (fichiers importés, annotations, paramètres) seront réinitialisées.
            L&apos;historique des audits sauvegardés est conservé.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            className="bg-status-red text-white hover:bg-status-red/90"
            onClick={() => { resetAll(); router.push('/') }}
          >
            Retour à l&apos;accueil
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  )
}
