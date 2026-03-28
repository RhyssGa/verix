'use client'

import { useAuditStore } from '@/stores/useAuditStore'
import { useScore } from '@/stores/computed'
import { normalizeAgency } from '@/lib/utils/helpers'

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

export function AgencyValidation() {
  const reportAgencies = useAuditStore((s) => s.reportAgencies)
  const validatedAgencies = useAuditStore((s) => s.validatedAgencies)
  const setValidateConfirm = useAuditStore((s) => s.setValidateConfirm)
  const setValidateMultiConfirm = useAuditStore((s) => s.setValidateMultiConfirm)
  const score = useScore()

  if (reportAgencies.length === 0) return null

  return (
    <div>
      <div style={sbLabel}>Validation</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {reportAgencies.map((agency) => {
          const norm = normalizeAgency(agency)
          const isValidated = validatedAgencies.has(norm)
          return (
            <button
              key={agency}
              disabled={!score}
              onClick={() => setValidateConfirm(agency)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                padding: '6px 8px',
                borderRadius: 6,
                border: '1px solid #1A7A4A',
                color: '#1A7A4A',
                background: 'transparent',
                cursor: score ? 'pointer' : 'not-allowed',
                opacity: score ? 1 : 0.4,
                fontFamily: 'inherit',
                transition: 'background .15s',
                textAlign: 'left' as const,
              }}
              onMouseOver={(e) => { if (score) e.currentTarget.style.background = '#EAF6EF' }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <span>{isValidated ? '✅' : '☐'}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{norm}</span>
            </button>
          )
        })}
        {reportAgencies.length >= 2 && (
          <button
            disabled={!score}
            onClick={() => setValidateMultiConfirm(reportAgencies)}
            style={{
              marginTop: 4,
              fontSize: 11,
              padding: '6px 8px',
              borderRadius: 6,
              border: '1px solid #1A3252',
              color: '#1A3252',
              background: 'transparent',
              cursor: score ? 'pointer' : 'not-allowed',
              opacity: score ? 1 : 0.4,
              fontFamily: 'inherit',
              fontWeight: 500,
            }}
            onMouseOver={(e) => { if (score) e.currentTarget.style.background = 'rgba(15,31,53,0.08)' }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            ✅ Valider {reportAgencies.length} agences ensemble
          </button>
        )}
      </div>
    </div>
  )
}
