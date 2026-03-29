'use client'

import { useAuditStore } from '@/stores/useAuditStore'
import { useScore } from '@/stores/computed'
import { normalizeAgency } from '@/lib/utils/helpers'

export function AgencyValidation() {
  const reportAgencies = useAuditStore((s) => s.reportAgencies)
  const validatedAgencies = useAuditStore((s) => s.validatedAgencies)
  const setValidateConfirm = useAuditStore((s) => s.setValidateConfirm)
  const setValidateMultiConfirm = useAuditStore((s) => s.setValidateMultiConfirm)
  const score = useScore()

  if (reportAgencies.length === 0) return null

  // Déduplique par nom normalisé
  const seen = new Set<string>()
  const uniqueAgencies = reportAgencies.filter((a) => {
    const norm = normalizeAgency(a)
    if (seen.has(norm)) return false
    seen.add(norm)
    return true
  })

  return (
    <div>
      <div className="text-[10px] font-semibold tracking-[0.8px] uppercase text-muted-foreground mb-3.5 pb-2 border-b border-border">Validation</div>
      <div className="flex flex-col gap-1.5">
        {uniqueAgencies.map((agency) => {
          const norm = normalizeAgency(agency)
          const isValidated = validatedAgencies.has(norm)
          return (
            <button
              key={agency}
              disabled={!score}
              onClick={() => setValidateConfirm(agency)}
              className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md border border-[#1A7A4A] text-[#1A7A4A] bg-transparent font-[inherit] transition-colors duration-150 text-left hover:bg-[#EAF6EF] ${score ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-40'}`}
            >
              <span>{isValidated ? '✅' : '☐'}</span>
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">{norm}</span>
            </button>
          )
        })}
        {uniqueAgencies.length >= 2 && (
          <button
            disabled={!score}
            onClick={() => setValidateMultiConfirm(uniqueAgencies)}
            className={`mt-1 text-[11px] px-2 py-1.5 rounded-md border border-navy2 text-navy2 bg-transparent font-[inherit] font-medium hover:bg-[rgba(15,31,53,0.08)] ${score ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-40'}`}
          >
            ✅ Valider {uniqueAgencies.length} agences ensemble
          </button>
        )}
      </div>
    </div>
  )
}
