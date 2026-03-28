'use client'

import { useAuditStore } from '@/stores/useAuditStore'
import { useScore } from '@/stores/computed'
import { useExport } from '@/hooks/useExport'

interface TopBarProps {
  mode: 'gerance' | 'copro'
}

const btnSecondary: React.CSSProperties = {
  background: 'transparent',
  color: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8,
  padding: '8px 16px',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all .15s',
}

export function TopBar({ mode }: TopBarProps) {
  const showHistory = useAuditStore((s) => s.showHistory)
  const setShowHistory = useAuditStore((s) => s.setShowHistory)
  const isGeneratingPdf = useAuditStore((s) => s.isGeneratingPdf)
  const resetAll = useAuditStore((s) => s.resetAll)
  const score = useScore()
  const { generateReport } = useExport()

  const modeLabel = mode === 'gerance' ? 'Gérance' : 'Copropriété'

  return (
    <header style={{
      background: '#0F1F35',
      borderBottom: '2px solid #C49A2E',
      height: 56,
      padding: '0 28px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      {/* Logo badge */}
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: '#C49A2E',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 15, color: '#0F1F35',
        flexShrink: 0,
      }}>
        21
      </div>

      {/* Title */}
      <div>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, letterSpacing: '0.2px' }}>
          Audit {modeLabel}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
          Importez vos exports · Visualisez · Générez le rapport
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Right actions */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={() => setShowHistory(!showHistory)}
          style={btnSecondary}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
          }}
        >
          📋 Historique
        </button>

        <button
          onClick={() => { if (confirm('Réinitialiser toutes les données ?')) resetAll() }}
          style={btnSecondary}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
          }}
        >
          ↺ Réinitialiser
        </button>

        {score && (
          <button
            onClick={generateReport}
            disabled={isGeneratingPdf}
            style={{
              background: isGeneratingPdf ? '#1A7A4A99' : '#1A7A4A',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '9px 20px',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              cursor: isGeneratingPdf ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              whiteSpace: 'nowrap',
            }}
          >
            {isGeneratingPdf ? '⏳ Génération…' : '📄 PDF'}
          </button>
        )}
      </div>
    </header>
  )
}
