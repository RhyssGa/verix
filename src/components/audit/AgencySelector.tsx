'use client'

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
  const toggleReportAgency = useAuditStore((s) => s.toggleReportAgency)
  const { autoFillFromSelection, normalizeAgency } = useAgencySelection()

  if (agencies.length === 0) return null

  const handleToggle = (agency: string) => {
    const isChecked = reportAgencies.includes(agency)
    toggleReportAgency(agency)
    const next = isChecked
      ? reportAgencies.filter((a) => a !== agency)
      : [...reportAgencies, agency]
    if (next.length > 0) autoFillFromSelection(next)
  }

  return (
    <div>
      <div style={sbLabel}>Agences ({agencies.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 192, overflowY: 'auto' }}>
        {agencies.map((agency) => {
          const checked = reportAgencies.includes(agency)
          return (
            <label
              key={agency}
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
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => handleToggle(agency)}
                style={{ accentColor: '#1A3252', width: 13, height: 13, cursor: 'pointer' }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={agency}>
                {normalizeAgency(agency)}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
