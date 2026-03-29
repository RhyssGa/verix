'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function UserMenu() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  if (!user) return null

  const firstName = (user.name || user.email || '').split(/[\s@]/)[0]
  const initial = firstName[0]?.toUpperCase() ?? '?'

  return (
    <>
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.08)] transition-all"
      >
        {/* Avatar */}
        <div className="w-[26px] h-[26px] rounded-full bg-[#C49A2E] flex items-center justify-center text-[11px] font-bold text-[#0B1929] shrink-0">
          {initial}
        </div>
        <span className="text-[12px] font-medium text-white whitespace-nowrap">
          Bonjour {firstName} 👋
        </span>
        <svg
          width="10" height="6" viewBox="0 0 10 6" fill="none"
          className="shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.4 }}
        >
          <path d="M1 1l4 4 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-xl overflow-hidden shadow-2xl z-50"
          style={{ background: '#0F2236', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          {/* User info header */}
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#C49A2E] flex items-center justify-center text-[13px] font-bold text-[#0B1929] shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                {user.name && (
                  <div className="text-[12px] font-semibold text-white truncate">{user.name}</div>
                )}
                <div className="text-[10px] text-[rgba(255,255,255,0.4)] truncate">{user.email}</div>
              </div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={() => { setOpen(false); setConfirmSignOut(true) }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-[12px] font-medium text-left transition-all"
            style={{ color: 'rgba(255,255,255,0.6)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(176,26,26,0.12)'
              e.currentTarget.style.color = '#f87171'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Se déconnecter
          </button>
        </div>
      )}
    </div>

    <AlertDialog open={confirmSignOut} onOpenChange={(o) => { if (!o) setConfirmSignOut(false) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Se déconnecter ?</AlertDialogTitle>
          <AlertDialogDescription>
            Toutes les données de l&apos;audit en cours (fichiers importés, annotations, paramètres) seront perdues.
            L&apos;historique des audits sauvegardés est conservé.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            className="bg-status-red text-white hover:bg-status-red/90"
            onClick={() => signOut()}
          >
            Se déconnecter
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
