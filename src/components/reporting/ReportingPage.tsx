'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { ReportingTopBar } from './ReportingTopBar'
import { ReportingFilters, type ViewMode } from './ReportingFilters'
import { GroupAvgCard } from './GroupAvgCard'
import { AgencyTable } from './AgencyTable'
import { CumulatedTable } from './CumulatedTable'
import { TrendTable } from './TrendTable'
import { PDFOptions, type PDFSections } from './PDFOptions'
import {
  filterByQuarter,
  computeGroupAvg,
  buildAgencyRows,
  buildTrendRows,
  buildAnomalyAggregates,
  buildCumulatedRows,
  type ReportingEntry,
} from '@/lib/reporting/aggregations'
import { getAvailableYears, quarterLabel, type Quarter } from '@/lib/reporting/quarters'

const SECTION_TITLE = 'text-[11px] font-bold text-[#7A7A8C] uppercase tracking-[0.8px] mb-4 pb-2 border-b border-[#E8E4DC]'
const CARD = 'bg-white border border-[#E8E4DC] rounded-[14px] p-6'

const DEFAULT_PDF_SECTIONS: PDFSections = {
  scoreTable: true,
  groupAvg: true,
  trend: true,
  anomalies: false,
}

export function ReportingPage() {
  const [entries, setEntries] = useState<ReportingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [quarter, setQuarter] = useState<Quarter>(1)
  const [mode, setMode] = useState<'gerance' | 'copro'>('gerance')
  const [viewMode, setViewMode] = useState<ViewMode>('quarter')
  const [target, setTarget] = useState(85)
  const [pdfSections, setPdfSections] = useState<PDFSections>(DEFAULT_PDF_SECTIONS)

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

  // Quand on passe en mode cumulé, year=0 = toutes les années
  function handleViewModeChange(v: ViewMode) {
    setViewMode(v)
    if (v === 'cumul') setYear(0)
    else if (year === 0) setYear(currentYear)
  }

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
  const isCumul = viewMode === 'cumul'

  // Mode trimestriel
  const currentEntries = useMemo(
    () => (isCumul ? [] : filterByQuarter(entries, quarterRef, mode)),
    [isCumul, entries, quarterRef, mode],
  )
  const groupAvg = useMemo(() => computeGroupAvg(currentEntries), [currentEntries])
  const agencyRows = useMemo(
    () => (isCumul ? [] : buildAgencyRows(currentEntries, entries, quarterRef, mode)),
    [isCumul, currentEntries, entries, quarterRef, mode],
  )
  const trendRows = useMemo(
    () => buildTrendRows(entries, year === 0 ? currentYear : year, mode),
    [entries, year, currentYear, mode],
  )
  const anomalyAggregates = useMemo(
    () => buildAnomalyAggregates(isCumul ? [] : currentEntries),
    [isCumul, currentEntries],
  )

  // Mode cumulé
  const cumulatedRows = useMemo(
    () => (isCumul ? buildCumulatedRows(entries, mode, year === 0 ? undefined : year) : []),
    [isCumul, entries, mode, year],
  )
  const cumulatedGroupAvg = useMemo(
    () => (isCumul && cumulatedRows.length > 0
      ? Math.round((cumulatedRows.reduce((s, r) => s + r.scoreGlobal, 0) / cumulatedRows.length) * 10) / 10
      : null),
    [isCumul, cumulatedRows],
  )
  const activeGroupAvg = isCumul ? cumulatedGroupAvg : groupAvg
  const activeEntryCount = isCumul ? cumulatedRows.length : currentEntries.length

  const periodLabel = isCumul
    ? (year === 0 ? 'Tous trimestres' : `Toute l'année ${year}`)
    : quarterLabel(quarterRef)

  async function handleExportPDF() {
    setPdfLoading(true)
    try {
      const payload = {
        period: quarterRef,
        mode,
        exportDate: new Date().toISOString(),
        groupAvg: activeGroupAvg,
        target,
        sections: pdfSections,
        agencies: agencyRows,
        trend: trendRows,
        anomalyAggregates,
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
      a.download = `reporting-${periodLabel.replace(/\s/g, '-')}-${mode}.pdf`
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

        {/* ① Moyenne groupe + objectif — toujours en haut */}
        <GroupAvgCard
          groupAvg={activeGroupAvg}
          target={target}
          entryCount={activeEntryCount}
          onTargetChange={handleTargetChange}
        />

        {/* ② Filtres + Options PDF */}
        <div className={CARD}>
          <div className="flex flex-col gap-5">
            <div>
              <div className={SECTION_TITLE}>Filtres</div>
              <ReportingFilters
                years={years.length > 0 ? years : [currentYear]}
                year={year}
                quarter={quarter}
                mode={mode}
                viewMode={viewMode}
                onYearChange={setYear}
                onQuarterChange={setQuarter}
                onModeChange={setMode}
                onViewModeChange={handleViewModeChange}
              />
            </div>
            <div className="border-t border-[#F0EDE8] pt-5">
              <div className={SECTION_TITLE}>Options du rapport PDF</div>
              <PDFOptions
                sections={pdfSections}
                onChange={setPdfSections}
                onExport={handleExportPDF}
                loading={pdfLoading}
                disabled={activeEntryCount === 0}
              />
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

            {/* ③ Tableau principal */}
            <div className={CARD}>
              <div className={SECTION_TITLE}>
                {isCumul
                  ? `Vue cumulée — ${periodLabel} · ${mode === 'gerance' ? 'Gérance' : 'Copropriété'}`
                  : `Scores par agence — ${periodLabel} · ${mode === 'gerance' ? 'Gérance' : 'Copropriété'}`
                }
              </div>
              {isCumul
                ? <CumulatedTable rows={cumulatedRows} groupAvg={cumulatedGroupAvg} />
                : <AgencyTable rows={agencyRows} groupAvg={groupAvg} target={target} />
              }
            </div>

            {/* ④ Évolution trimestrielle */}
            <div className={CARD}>
              <div className={SECTION_TITLE}>
                Évolution trimestrielle {year === 0 ? currentYear : year} · {mode === 'gerance' ? 'Gérance' : 'Copropriété'}
              </div>
              <TrendTable rows={trendRows} year={year === 0 ? currentYear : year} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
