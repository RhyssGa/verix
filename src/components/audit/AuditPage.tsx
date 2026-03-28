'use client'

import { useEffect } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { useScore, useHasAnyData } from '@/stores/computed'
import { TopBar } from '@/components/layout/TopBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { ScoreBanner } from './ScoreBanner'
import { FileUploadGrid } from './FileUploadGrid'
import { GeranceCards } from '@/components/cards/GeranceCards'
import { CoproCards } from '@/components/cards/CoproCards'
import { DetailModal } from '@/components/modals/DetailModal'
import { FinancialStateModal } from '@/components/modals/FinancialStateModal'
import { ConfirmDialog } from '@/components/modals/ConfirmDialog'
import { HistoryPanel } from '@/components/modals/HistoryPanel'
import { ComparisonPanel } from '@/components/comparison/ComparisonPanel'
import { GlobalNote } from '@/components/comparison/GlobalNote'
import { ValidationBlock } from './ValidationBlock'

interface AuditPageProps {
  mode: 'gerance' | 'copro'
}

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.8px',
  textTransform: 'uppercase',
  color: '#7A7A8C',
  marginBottom: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
}

export function AuditPage({ mode }: AuditPageProps) {
  const setMode = useAuditStore((s) => s.setMode)
  const score = useScore()
  const hasData = useHasAnyData()

  useEffect(() => {
    setMode(mode)
  }, [mode, setMode])

  return (
    <div style={{ minHeight: '100vh', background: '#FAF8F4', display: 'flex', flexDirection: 'column' }}>
      <TopBar mode={mode} />

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Sidebar */}
        <Sidebar mode={mode} />

        {/* Main content */}
        <main style={{ padding: 28, overflowY: 'auto' }}>

          {/* Imports Power BI */}
          <div style={sectionTitle}>
            <span>Imports Power BI</span>
            <span style={{ flex: 1, height: 1, background: '#E8E4DC' }} />
          </div>
          <FileUploadGrid mode={mode} />

          {/* Scoring global */}
          {score && (
            <>
              <div style={{ ...sectionTitle, marginTop: 24 }}>
                <span>Scoring global de l&apos;audit</span>
                <span style={{ flex: 1, height: 1, background: '#E8E4DC' }} />
              </div>
              <ScoreBanner score={score} />
            </>
          )}

          {/* Clôture : note + validation */}
          {score && (
            <>
              <div style={{ ...sectionTitle, marginTop: 24 }}>
                <span>Clôture de l&apos;audit</span>
                <span style={{ flex: 1, height: 1, background: '#E8E4DC' }} />
              </div>
              <div style={{ marginBottom: 20 }}><GlobalNote /></div>
              <ValidationBlock />
            </>
          )}

          {/* Comparaison */}
          {score && <div style={{ marginTop: 24 }}><ComparisonPanel /></div>}

          {/* Anomaly cards */}
          <div style={{ ...sectionTitle, marginTop: 24 }}>
            <span>Récapitulatif des anomalies</span>
            <span style={{ flex: 1, height: 1, background: '#E8E4DC' }} />
          </div>

          {hasData ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 14,
              marginBottom: 32,
            }}>
              {mode === 'gerance' ? <GeranceCards /> : <CoproCards />}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#7A7A8C', fontSize: 13 }}>
              <div style={{ fontSize: 48, marginBottom: 14, opacity: 0.4 }}>
                {mode === 'gerance' ? '🏠' : '🏢'}
              </div>
              Importez vos fichiers et sélectionnez une agence pour afficher le récapitulatif
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <DetailModal />
      <FinancialStateModal />
      <ConfirmDialog />
      <HistoryPanel />
    </div>
  )
}
