'use client'

import { useState, useEffect } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { useImportSession } from '@/hooks/useImportSession'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function ImportBanner() {
  const loadedFiles = useAuditStore((s) => s.loadedFiles)
  const setShowHistory = useAuditStore((s) => s.setShowHistory)
  const setHistoryInitialTab = useAuditStore((s) => s.setHistoryInitialTab)
  const { importSessionId, isSaving, saveImportSession } = useImportSession()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Flash "Sauvegardé !" pendant 3 secondes après validation
  useEffect(() => {
    if (justSaved) {
      const t = setTimeout(() => setJustSaved(false), 3000)
      return () => clearTimeout(t)
    }
  }, [justSaved])

  const hasFiles = Object.keys(loadedFiles).length > 0
  if (!hasFiles) return null

  const isValidated = !!importSessionId

  const handleConfirm = async () => {
    setConfirmOpen(false)
    setSaveError(null)
    const id = await saveImportSession()
    if (id) {
      setJustSaved(true)
    } else {
      setSaveError('La sauvegarde a échoué. Vérifiez votre connexion et réessayez.')
    }
  }

  // ── Import sauvegardé ──────────────────────────────────────────────────────
  if (isValidated) {
    return (
      <div className="mt-4 rounded-[10px] px-[16px] py-[11px] flex items-center justify-between gap-3 bg-[#EAF6EF] border border-[#1A7A4A]">
        <div className="flex items-center gap-3">
          <span className="text-[18px]">✅</span>
          <div>
            <div className="text-[11px] font-bold tracking-[0.8px] uppercase text-[#1A7A4A]">
              Import sauvegardé
            </div>
            <div className="text-[12px] mt-0.5 text-[#2A8A55]">
              Retrouvez-le dans <strong>Historique → onglet Imports</strong> pour le rouvrir ou le supprimer.
            </div>
          </div>
        </div>
        <button
          onClick={() => { setHistoryInitialTab('imports'); setShowHistory(true) }}
          className="shrink-0 px-[12px] py-[7px] rounded-[7px] font-[inherit] font-semibold text-[11px] border border-[#1A7A4A] bg-transparent text-[#1A7A4A] cursor-pointer hover:bg-[rgba(26,122,74,0.08)]"
        >
          📋 Historique
        </button>
      </div>
    )
  }

  // ── Import non sauvegardé ──────────────────────────────────────────────────
  return (
    <>
      <div className="mt-4 rounded-[10px] px-[16px] py-[12px] flex items-center justify-between gap-3 bg-[#FDF5E0] border border-[rgba(196,154,46,0.5)]">
        <div className="flex items-center gap-3">
          <span className="text-[18px]">📂</span>
          <div>
            <div className="text-[11px] font-bold tracking-[0.8px] uppercase text-[#A87E20]">
              Import non sauvegardé
            </div>
            <div className="text-[12px] mt-0.5 text-[#7A5A10]">
              {Object.keys(loadedFiles).length} fichier(s) chargé(s) — validez l&apos;import pour pouvoir le retrouver plus tard.
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={isSaving}
            className="flex items-center gap-2 px-[14px] py-[8px] rounded-[8px] font-[inherit] font-bold text-[12px] border-none"
            style={{
              background: isSaving ? 'rgba(196,154,46,0.3)' : 'linear-gradient(135deg, #C49A2E, #A87E20)',
              color: isSaving ? 'rgba(255,255,255,0.5)' : '#FFFFFF',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              boxShadow: isSaving ? 'none' : '0 2px 8px rgba(196,154,46,0.3)',
              minWidth: 140,
            }}
          >
            {justSaved ? (
              '✅ Sauvegardé !'
            ) : isSaving ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sauvegarde…
              </>
            ) : (
              '💾 Valider l\'import'
            )}
          </button>
          {saveError && (
            <div className="text-[10px] text-[#B01A1A] font-semibold max-w-[200px] text-right">
              {saveError}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Valider l&apos;import ?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;état actuel sera sauvegardé en base de données. Vous pourrez retrouver
              cet import dans <strong>Historique → onglet Imports</strong> pour le rouvrir
              ou le supprimer à tout moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Valider l&apos;import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
