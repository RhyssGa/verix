'use client'

import { useAuditStore } from '@/stores/useAuditStore'
import { AgencySelector } from '@/components/audit/AgencySelector'

interface ManualDataFormProps {
  mode: 'gerance' | 'copro'
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: '#7A7A8C',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #E8E4DC',
  borderRadius: 7,
  fontFamily: 'inherit',
  fontSize: 13,
  color: '#1A1A2E',
  background: '#FAF8F4',
  boxSizing: 'border-box',
}

const manualInputStyle: React.CSSProperties = {
  ...inputStyle,
  background: '#FFFCF0',
  borderColor: '#E8C840',
}

export function ManualDataForm({ mode }: ManualDataFormProps) {
  const startDate = useAuditStore((s) => s.startDate)
  const endDate = useAuditStore((s) => s.endDate)
  const guarantee = useAuditStore((s) => s.guarantee)
  const peak = useAuditStore((s) => s.peak)
  const peakDate = useAuditStore((s) => s.peakDate)
  const mandateCount = useAuditStore((s) => s.mandateCount)
  const setStartDate = useAuditStore((s) => s.setStartDate)
  const setEndDate = useAuditStore((s) => s.setEndDate)
  const setGuarantee = useAuditStore((s) => s.setGuarantee)
  const setPeak = useAuditStore((s) => s.setPeak)
  const setPeakDate = useAuditStore((s) => s.setPeakDate)
  const setMandateCount = useAuditStore((s) => s.setMandateCount)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Identification */}
      <div>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.8px',
          textTransform: 'uppercase', color: '#7A7A8C',
          marginBottom: 14, paddingBottom: 8,
          borderBottom: '1px solid #E8E4DC',
        }}>
        
        </div>
        <AgencySelector />
        <div style={{ marginTop: 16, marginBottom: 12 }}>
          <label style={labelStyle}>Début de période</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            style={inputStyle} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Fin de période</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            style={inputStyle} />
        </div>
      </div>

      {/* Données manuelles */}
      <div>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.8px',
          textTransform: 'uppercase', color: '#7A7A8C',
          marginBottom: 14, paddingBottom: 8,
          borderBottom: '1px solid #E8E4DC',
        }}>
          Informations agences
          <div style={{ fontWeight: 400, fontSize: 9, color: '#AAA', textTransform: 'none', letterSpacing: 0, marginTop: 3 }}>Modifications possibles</div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Garantie financière (€) ✏</label>
          <input type="number" value={guarantee || ''} onChange={(e) => setGuarantee(parseFloat(e.target.value) || 0)}
            placeholder="0" style={manualInputStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Pointe (€) ✏</label>
            <input type="number" value={peak || ''} onChange={(e) => setPeak(parseFloat(e.target.value) || 0)}
              placeholder="0" style={manualInputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Date pointe ✏</label>
            <input type="date" value={peakDate} onChange={(e) => setPeakDate(e.target.value)}
              style={manualInputStyle} />
          </div>
        </div>
        {mode === 'gerance' && (
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Nb mandats ✏</label>
            <input type="number" value={mandateCount || ''} onChange={(e) => setMandateCount(parseInt(e.target.value) || 0)}
              placeholder="0" style={manualInputStyle} />
          </div>
        )}
      </div>
    </div>
  )
}
