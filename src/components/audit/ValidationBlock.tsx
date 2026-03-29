'use client'

import { useAuditStore } from '@/stores/useAuditStore'
import { useScore } from '@/stores/computed'
import { normalizeAgency } from '@/lib/utils/helpers'

export function ValidationBlock() {
  const reportAgencies = useAuditStore((s) => s.reportAgencies)
  const validatedAgencies = useAuditStore((s) => s.validatedAgencies)
  const setValidateConfirm = useAuditStore((s) => s.setValidateConfirm)
  const setValidateMultiConfirm = useAuditStore((s) => s.setValidateMultiConfirm)
  const score = useScore()

  if (!score || reportAgencies.length === 0) return null

  // Déduplique par nom normalisé
  const seen = new Set<string>()
  const uniqueAgencies = reportAgencies.filter((a) => {
    const norm = normalizeAgency(a)
    if (seen.has(norm)) return false
    seen.add(norm)
    return true
  })

  const allValidated = uniqueAgencies.every((a) => validatedAgencies.has(normalizeAgency(a)))

  return (
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
            ? 'L\'audit a été validé et enregistré dans l\'historique.'
            : 'Validez et sauvegardez cet audit dans l\'historique.'}
        </div>
      </div>

      {/* Boutons */}
      <div className="flex gap-2 flex-wrap">
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
  )
}
