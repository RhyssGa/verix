'use client'

import { useState } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { useScore } from '@/stores/computed'
import { useExport } from '@/hooks/useExport'
import { useImportSession } from '@/hooks/useImportSession'
import { normalizeAgency } from '@/lib/utils/helpers'
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

export function ValidationBlock() {
  const reportAgencies = useAuditStore((s) => s.reportAgencies)
  const validatedAgencies = useAuditStore((s) => s.validatedAgencies)
  const setValidateConfirm = useAuditStore((s) => s.setValidateConfirm)
  const setValidateMultiConfirm = useAuditStore((s) => s.setValidateMultiConfirm)
  const isGeneratingPdf = useAuditStore((s) => s.isGeneratingPdf)
  const loadedFiles = useAuditStore((s) => s.loadedFiles)
  const score = useScore()
  const { generateReportV2 } = useExport()
  const { importSessionId, isSaving, saveImportSession } = useImportSession()

  const [confirmImport, setConfirmImport] = useState(false)

  const hasFiles = Object.keys(loadedFiles).length > 0
  const hasScore = score !== null && reportAgencies.length > 0

  // Rend le bloc si fichiers chargés OU score calculé
  if (!hasFiles && !hasScore) return null

  // Déduplique par nom normalisé
  const seen = new Set<string>()
  const uniqueAgencies = reportAgencies.filter((a) => {
    const norm = normalizeAgency(a)
    if (seen.has(norm)) return false
    seen.add(norm)
    return true
  })

  const allValidated = uniqueAgencies.length > 0 && uniqueAgencies.every((a) => validatedAgencies.has(normalizeAgency(a)))
  const isSessionValidated = !!importSessionId

  const handleConfirmImport = async () => {
    setConfirmImport(false)
    await saveImportSession()
  }

  return (
    <>
      {/* Bandeau import */}
      {hasFiles && (
        <div className={[
          'rounded-[10px] px-[16px] py-[11px] mb-2 flex items-center justify-between gap-3',
          isSessionValidated
            ? 'bg-[#0E2318] border border-[#1A7A4A]'
            : 'bg-[#1A0E00] border border-[rgba(196,154,46,0.35)]',
        ].join(' ')}>
          <div className="flex items-center gap-2">
            <span className="text-[18px]">{isSessionValidated ? '✅' : '📂'}</span>
            <div>
              <div className={[
                'text-[11px] font-bold tracking-[0.8px] uppercase',
                isSessionValidated ? 'text-[#1A7A4A]' : 'text-[rgba(196,154,46,0.9)]',
              ].join(' ')}>
                {isSessionValidated ? 'Import validé' : 'Import non validé'}
              </div>
              <div className={[
                'text-[12px]',
                isSessionValidated ? 'text-[rgba(26,122,74,0.8)]' : 'text-[rgba(255,255,255,0.55)]',
              ].join(' ')}>
                {isSessionValidated
                  ? 'Cet import a été sauvegardé — vous pouvez reprendre plus tard.'
                  : `${Object.keys(loadedFiles).length} fichier(s) chargé(s) — non sauvegardé`}
              </div>
            </div>
          </div>
          {!isSessionValidated && (
            <button
              onClick={() => setConfirmImport(true)}
              disabled={isSaving}
              className="shrink-0 px-[14px] py-[7px] rounded-[7px] font-[inherit] font-semibold text-[12px] border-none cursor-pointer"
              style={{
                background: isSaving ? 'rgba(196,154,46,0.2)' : 'rgba(196,154,46,0.18)',
                color: isSaving ? 'rgba(196,154,46,0.4)' : '#C49A2E',
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? '⏳ Sauvegarde…' : '💾 Valider l\'import'}
            </button>
          )}
        </div>
      )}

      {/* Bloc clôture audit — visible si score calculé */}
      {hasScore && (
        <div className={[
          'mt-0 rounded-[12px] p-[18px_20px] flex items-center gap-4 flex-wrap',
          allValidated
            ? 'border-[1.5px] border-[#1A7A4A] bg-[#EAF6EF]'
            : 'border-[1.5px] border-[rgba(196,154,46,0.5)] bg-[#0B1929]',
        ].join(' ')}>
          {/* Icône + texte */}
          <div className="flex-1 min-w-[180px]">
            <div className={[
              'text-[11px] font-bold tracking-[1px] uppercase mb-1',
              allValidated ? 'text-[#1A7A4A]' : 'text-[rgba(196,154,46,0.8)]',
            ].join(' ')}>
              {allValidated ? 'Audit sauvegardé' : 'Clôturer l\'audit'}
            </div>
            <div className={[
              'text-[13px] font-semibold',
              allValidated ? 'text-[#1A7A4A]' : 'text-white',
            ].join(' ')}>
              {allValidated
                ? "L'audit a été validé et enregistré dans l'historique."
                : 'Validez et sauvegardez cet audit dans l\'historique.'}
            </div>
          </div>

          {/* Boutons */}
          <div className="flex gap-2 flex-wrap items-center">
            {/* Rapport PDF */}
            <button
              onClick={generateReportV2}
              disabled={isGeneratingPdf}
              className="px-[22px] py-[10px] rounded-[8px] cursor-pointer font-[inherit] font-bold text-[13px] tracking-[0.3px] flex items-center gap-2 border-none"
              style={{
                background: isGeneratingPdf ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.1)',
                color: isGeneratingPdf ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)',
                cursor: isGeneratingPdf ? 'not-allowed' : 'pointer',
                ...(allValidated ? { background: 'rgba(26,122,74,0.12)', color: '#1A7A4A' } : {}),
              }}
            >
              {isGeneratingPdf ? '⏳ Génération…' : '📄 Rapport PDF'}
            </button>
            {uniqueAgencies.length === 1 ? (
              <button
                onClick={() => setValidateConfirm(uniqueAgencies[0])}
                className={[
                  'px-[22px] py-[10px] rounded-[8px] cursor-pointer font-[inherit] font-bold text-[13px] tracking-[0.3px]',
                  allValidated
                    ? 'bg-transparent text-[#1A7A4A] border-[1.5px] border-[#1A7A4A] shadow-none'
                    : 'bg-gradient-to-br from-[#C49A2E] to-[#A87E20] text-[#0B1929] border-none shadow-[0_2px_8px_rgba(196,154,46,0.35)]',
                ].join(' ')}
              >
                {allValidated ? '↩ Re-valider' : `Valider — ${normalizeAgency(uniqueAgencies[0])}`}
              </button>
            ) : (
              <button
                onClick={() => setValidateMultiConfirm(uniqueAgencies)}
                className={[
                  'px-[22px] py-[10px] rounded-[8px] cursor-pointer font-[inherit] font-bold text-[13px]',
                  allValidated
                    ? 'bg-transparent text-[#1A7A4A] border-[1.5px] border-[#1A7A4A] shadow-none'
                    : 'bg-gradient-to-br from-[#C49A2E] to-[#A87E20] text-[#0B1929] border-none shadow-[0_2px_8px_rgba(196,154,46,0.35)]',
                ].join(' ')}
              >
                {allValidated ? `↩ Re-valider ${uniqueAgencies.length} agences` : `Valider ${uniqueAgencies.length} agences`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirmation import */}
      <AlertDialog open={confirmImport} onOpenChange={setConfirmImport}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Valider l&apos;import ?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;état actuel de l&apos;import sera sauvegardé en base de données.
              Vous pourrez le retrouver dans l&apos;historique et reprendre exactement là où vous en étiez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>
              Valider l&apos;import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
