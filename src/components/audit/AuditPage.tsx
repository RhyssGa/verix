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
import { ImportBanner } from './ImportBanner'

interface AuditPageProps {
  mode: 'gerance' | 'copro'
}

const sectionTitleClass = 'text-[11px] font-semibold tracking-[0.8px] uppercase text-[#7A7A8C] mb-[14px] flex items-center gap-[10px]'

export function AuditPage({ mode }: AuditPageProps) {
  const setMode = useAuditStore((s) => s.setMode)
  const score = useScore()
  const hasData = useHasAnyData()

  useEffect(() => {
    setMode(mode)
  }, [mode, setMode])

  return (
    <div className="min-h-screen bg-[#FAF8F4] flex flex-col">
      <TopBar mode={mode} />

      <div className="grid flex-1 min-h-0 overflow-hidden" style={{ gridTemplateColumns: '280px 1fr' }}>
        {/* Sidebar */}
        <Sidebar mode={mode} />

        {/* Main content */}
        <main className="p-7 overflow-y-auto">

          {/* Imports Power BI */}
          <div className={sectionTitleClass}>
            <span>Imports Power BI</span>
            <span className="flex-1 h-px bg-[#E8E4DC]" />
          </div>
          <div className="mb-8">
            <FileUploadGrid mode={mode} />
            <ImportBanner />
          </div>

          {/* Scoring global */}
          {score && (
            <>
              <div className={`${sectionTitleClass} mt-6`}>
                <span>Scoring global de l&apos;audit</span>
                <span className="flex-1 h-px bg-[#E8E4DC]" />
              </div>
              <ScoreBanner score={score} />
            </>
          )}

          {/* Clôture : note + validation */}
          {score && (
            <>
              <div className={`${sectionTitleClass} mt-6`}>
                <span>Clôture de l&apos;audit</span>
                <span className="flex-1 h-px bg-[#E8E4DC]" />
              </div>
              <div className="mb-5"><GlobalNote /></div>
              <ValidationBlock />
            </>
          )}

          {/* Comparaison */}
          {score && <div className="mt-6"><ComparisonPanel /></div>}

          {/* Anomaly cards */}
          <div className={`${sectionTitleClass} mt-6`}>
            <span>Récapitulatif des anomalies</span>
            <span className="flex-1 h-px bg-[#E8E4DC]" />
          </div>

          {hasData ? (
            <div className="grid gap-[14px] mb-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {mode === 'gerance' ? <GeranceCards /> : <CoproCards />}
            </div>
          ) : (
            <div className="text-center px-5 py-[60px] text-[#7A7A8C] text-[13px]">
              <div className="text-[48px] mb-[14px] opacity-40">
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
