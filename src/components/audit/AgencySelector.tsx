'use client'

import { useState, useEffect } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { useAgencySelection } from '@/hooks/useAgencySelection'

const sbLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.8px',
  textTransform: 'uppercase',
  color: '#7A7A8C',
  marginBottom: 14,
  paddingBottom: 8,
  borderBottom: '1px solid #E8E4DC',
}

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
      <div style={sbLabel}>
        Agences ({uniqueAgencies.length})
        {uniqueAgencies.length > 1 && (
          <div style={{ fontWeight: 400, fontSize: 9, color: '#AAA', textTransform: 'none', letterSpacing: 0, marginTop: 3 }}>
            ⌘/Ctrl+clic pour multi
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {uniqueAgencies.map((agency) => {
          const checked = isChecked(agency)
          return (
            <div
              key={normalizeAgency(agency)}
              onClick={(e) => handleClick(agency, e)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                background: checked ? 'rgba(15,31,53,0.08)' : 'transparent',
                color: checked ? '#1A1A2E' : '#7A7A8C',
                fontWeight: checked ? 500 : 400,
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {}}
                style={{ accentColor: '#1A3252', width: 13, height: 13, cursor: 'pointer', pointerEvents: 'none' }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={agency}>
                {normalizeAgency(agency)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
