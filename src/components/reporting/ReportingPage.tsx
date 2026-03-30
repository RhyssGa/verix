'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { ReportingTopBar } from './ReportingTopBar'
import { ReportingFilters } from './ReportingFilters'
import { GroupAvgCard } from './GroupAvgCard'
import { AgencyTable } from './AgencyTable'
import { TrendTable } from './TrendTable'
import {
  filterByQuarter,
  computeGroupAvg,
  buildAgencyRows,
  buildTrendRows,
  buildMultiQuarterAgencyRows,
  type ReportingEntry,
} from '@/lib/reporting/aggregations'
import { getAvailableYears, quarterLabel, type Quarter } from '@/lib/reporting/quarters'

const SECTION_TITLE = 'text-[11px] font-bold text-[#7A7A8C] uppercase tracking-[0.8px] mb-4 pb-2 border-b border-[#E8E4DC]'
const CARD = 'bg-white border border-[#E8E4DC] rounded-[14px] p-6'

export function ReportingPage() {
  const [entries, setEntries] = useState<ReportingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [quarter, setQuarter] = useState<Quarter>(1)
  const [mode, setMode] = useState<'gerance' | 'copro'>('gerance')
  const [target, setTarget] = useState(85)

  // Déterminer le trimestre courant au montage
  useEffect(() => {
    const now = new Date()
    const month = now.getMonth() + 1
    const day = now.getDate()
    if (month < 4 || (month === 4 && day <= 29)) setQuarter(1)
    else if (month < 7 || (month === 7 && day <= 29)) setQuarter(2)
    else if (month < 10 || (month === 10 && day <= 29)) setQuarter(3)
    else setQuarter(4)
  }, [])

  // Charger l'objectif depuis localStorage
  useEffect(() => {
    const stored = localStorage.getItem('reporting_target')
    if (stored) {
      const v = Number(stored)
      if (!isNaN(v) && v >= 0 && v <= 100) setTarget(v)
    }
  }, [])

  const handleTargetChange = useCallback((v: number) => {
    setTarget(v)
    localStorage.setItem('reporting_target', String(v))
  }, [])

  // Fetch tous les audits
  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/audits')
      .then((r) => {
        if (!r.ok) throw new Error('Erreur réseau')
        return r.json()
      })
      .then((data: ReportingEntry[]) => setEntries(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const years = useMemo(() => getAvailableYears(entries.map((e) => e.timestamp)), [entries])

  const quarterRef = useMemo(() => ({ year, quarter }), [year, quarter])

  const currentEntries = useMemo(
    () => filterByQuarter(entries, quarterRef, mode),
    [entries, quarterRef, mode],
  )
  const groupAvg = useMemo(() => computeGroupAvg(currentEntries), [currentEntries])
  const agencyRows = useMemo(
    () => buildAgencyRows(currentEntries, entries, quarterRef, mode),
    [currentEntries, entries, quarterRef, mode],
  )
  const trendRows = useMemo(
    () => buildTrendRows(entries, year, mode),
    [entries, year, mode],
  )

  // Multi-quarter averages pour le PDF
  const multiQuarterAgencyRows = useMemo(
    () => buildMultiQuarterAgencyRows(entries, year, mode),
    [entries, year, mode],
  )
  const multiQuarterGroupAvg = useMemo(
    () => multiQuarterAgencyRows.length > 0
      ? Math.round((multiQuarterAgencyRows.reduce((s, r) => s + r.scoreGlobal, 0) / multiQuarterAgencyRows.length) * 10) / 10
      : null,
    [multiQuarterAgencyRows],
  )

  const periodLabel = quarterLabel(quarterRef)

  async function handleExportPDF() {
    setPdfLoading(true)
    try {
      const payload = {
        period: { year },
        mode,
        groupAvg: multiQuarterGroupAvg,
        agencies: multiQuarterAgencyRows,
        trend: trendRows,
      }
      const res = await fetch('/api/rapport/reporting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Erreur génération PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporting-${year}-${mode}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4] flex flex-col">
      <ReportingTopBar />

      <div className="flex-1 px-8 py-7 flex flex-col gap-6 max-w-[1100px] w-full mx-auto">

        {/* ① Moyenne groupe + objectif */}
        <GroupAvgCard
          groupAvg={groupAvg}
          target={target}
          entryCount={currentEntries.length}
          onTargetChange={handleTargetChange}
        />

        {/* ② Filtres + Export PDF */}
        <div className={CARD}>
          <div className="flex flex-col gap-5">
            <div>
              <div className={SECTION_TITLE}>Filtres</div>
              <ReportingFilters
                years={years.length > 0 ? years : [currentYear]}
                year={year}
                quarter={quarter}
                mode={mode}
                onYearChange={setYear}
                onQuarterChange={setQuarter}
                onModeChange={setMode}
              />
            </div>
            <div className="border-t border-[#F0EDE8] pt-5 flex items-center justify-between">
              <div className="text-[12px] text-[#7A7A8C]">
                Le PDF exporte le rapport annuel complet {year} (moyennes par agence + évolution trimestrielle).
              </div>
              <button
                onClick={handleExportPDF}
                disabled={pdfLoading || multiQuarterAgencyRows.length === 0}
                className={[
                  'flex items-center gap-2 px-5 py-[9px] rounded-[9px] text-[13px] font-bold transition-all whitespace-nowrap',
                  pdfLoading || multiQuarterAgencyRows.length === 0
                    ? 'bg-[#E8E4DC] text-[#B0B0C8] cursor-not-allowed'
                    : 'bg-[#0B1929] text-[#C49A2E] hover:bg-[#1A3252] cursor-pointer',
                ].join(' ')}
              >
                {pdfLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[#C49A2E]/30 border-t-[#C49A2E] rounded-full animate-spin" />
                    Génération…
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <path d="M2 11.5V13H13V11.5M7.5 2V10M7.5 10L4.5 7M7.5 10L10.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Exporter PDF {year}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-[#7A7A8C]">
            <span className="w-6 h-6 border-2 border-[#E8E4DC] border-t-[#C49A2E] rounded-full animate-spin mr-3" />
            Chargement des audits…
          </div>
        )}

        {error && (
          <div className="bg-[#FAEAEA] border border-[#F5AAAA] rounded-[12px] px-5 py-4 text-[#B01A1A] text-[13px] font-semibold">
            Erreur : {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ③ Tableau par trimestre */}
            <div className={CARD}>
              <div className={SECTION_TITLE}>
                Scores par agence — {periodLabel} · {mode === 'gerance' ? 'Gérance' : 'Copropriété'}
              </div>
              <AgencyTable rows={agencyRows} groupAvg={groupAvg} target={target} />
            </div>

            {/* ④ Évolution trimestrielle */}
            <div className={CARD}>
              <div className={SECTION_TITLE}>
                Évolution trimestrielle {year} · {mode === 'gerance' ? 'Gérance' : 'Copropriété'}
              </div>
              <TrendTable rows={trendRows} year={year} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
