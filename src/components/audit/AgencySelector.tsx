'use client'

import { useState, useEffect } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { useAgencySelection } from '@/hooks/useAgencySelection'

export function AgencySelector() {
  const agencies = useAuditStore((s) => s.agencies)
  const reportAgencies = useAuditStore((s) => s.reportAgencies)
  const setReportAgencies = useAuditStore((s) => s.setReportAgencies)
  const { autoFillFromSelection, handleAgencyChange, normalizeAgency } = useAgencySelection()

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted || agencies.length === 0) return null

  // Déduplique par nom normalisé — garde le premier représentant brut de chaque groupe
  const seen = new Set<string>()
  const uniqueAgencies = agencies.filter((a) => {
    const norm = normalizeAgency(a)
    if (seen.has(norm)) return false
    seen.add(norm)
    return true
  })

  // Vérifie si une agence est cochée (comparaison par nom normalisé)
  const isChecked = (agency: string) =>
    reportAgencies.some((ra) => normalizeAgency(ra) === normalizeAgency(agency))

  const handleClick = (agency: string, e: React.MouseEvent) => {
    e.preventDefault()
    const isMulti = e.metaKey || e.ctrlKey
    const norm = normalizeAgency(agency)
    const alreadyChecked = reportAgencies.some((ra) => normalizeAgency(ra) === norm)

    if (isMulti) {
      // Cmd/Ctrl+clic : ajoute à la sélection existante (pas de swap d'annotations)
      if (alreadyChecked) return
      const next = [...reportAgencies, agency]
      setReportAgencies(next)
      autoFillFromSelection(next)
    } else {
      if (alreadyChecked) {
        // Clic sur une agence déjà cochée : la retirer
        const next = reportAgencies.filter((ra) => normalizeAgency(ra) !== norm)
        setReportAgencies(next)
        if (next.length > 0) {
          autoFillFromSelection(next)
          handleAgencyChange(next[0])
        } else {
          handleAgencyChange(null)
        }
      } else {
        // Clic sur une agence non cochée : sélection exclusive
        setReportAgencies([agency])
        autoFillFromSelection([agency])
        handleAgencyChange(agency)
      }
    }
  }

  return (
    <div>
      <div className="text-[10px] font-semibold tracking-[0.8px] uppercase text-[#7A7A8C] mb-[14px] pb-2 border-b border-[#E8E4DC]">
        Agences ({uniqueAgencies.length})
        {uniqueAgencies.length > 1 && (
          <div className="font-normal text-[9px] text-[#AAA] normal-case tracking-normal mt-[3px]">
            ⌘/Ctrl+clic pour multi
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        {uniqueAgencies.map((agency) => {
          const checked = isChecked(agency)
          return (
            <div
              key={normalizeAgency(agency)}
              onClick={(e) => handleClick(agency, e)}
              className={[
                'flex items-center gap-2 px-2 py-1 rounded-[6px] cursor-pointer text-[12px] select-none',
                checked
                  ? 'bg-[rgba(15,31,53,0.08)] text-[#1A1A2E] font-medium'
                  : 'bg-transparent text-[#7A7A8C] font-normal',
              ].join(' ')}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {}}
                className="w-[13px] h-[13px] cursor-pointer pointer-events-none accent-[#1A3252]"
              />
              <span className="overflow-hidden text-ellipsis whitespace-nowrap" title={agency}>
                {normalizeAgency(agency)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
