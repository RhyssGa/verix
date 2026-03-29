'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { ReportingFilters } from './ReportingFilters'
import { GroupAvgCard } from './GroupAvgCard'
import { AgencyTable } from './AgencyTable'
import { TrendTable } from './TrendTable'
import { PDFOptions, type PDFSections } from './PDFOptions'
import {
  filterByQuarter,
  computeGroupAvg,
  buildAgencyRows,
  buildTrendRows,
  buildAnomalyAggregates,
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

  // Fetch tous les audits
  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/audits')
      .then((r) => {
        if (!r.ok) throw new Error('Erreur réseau')
        return r.json()
      })
      .then((data: ReportingEntry[]) => {
        setEntries(data)
      })
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

  const anomalyAggregates = useMemo(
    () => buildAnomalyAggregates(currentEntries),
    [currentEntries],
  )

  async function handleExportPDF() {
    setPdfLoading(true)
    try {
      const payload = {
        period: quarterRef,
        mode,
        exportDate: new Date().toISOString(),
        groupAvg,
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
      a.download = `reporting-${quarterLabel(quarterRef).replace(' ', '-')}-${mode}.pdf`
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
      {/* Header */}
      <div className="bg-[#0B1929] px-8 py-5 flex items-center gap-4 border-b border-[rgba(196,154,46,0.2)]">
        <div>
          <div className="text-[11px] font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-[0.8px]">
            Century 21
          </div>
          <div className="text-[20px] font-extrabold text-white tracking-[-0.3px]">
            Reporting <span className="text-[#C49A2E]">groupe</span>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 px-8 py-7 flex flex-col gap-6 max-w-[1100px] w-full mx-auto">
        {/* Filtres */}
        <div className={CARD}>
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
            {/* KPIs groupe */}
            <GroupAvgCard
              groupAvg={groupAvg}
              target={target}
              entryCount={currentEntries.length}
              onTargetChange={handleTargetChange}
            />

            {/* Tableau agences */}
            <div className={CARD}>
              <div className={SECTION_TITLE}>
                Scores par agence — {quarterLabel(quarterRef)} · {mode === 'gerance' ? 'Gérance' : 'Copropriété'}
              </div>
              <AgencyTable rows={agencyRows} groupAvg={groupAvg} target={target} />
            </div>

            {/* Évolution trimestrielle */}
            <div className={CARD}>
              <div className={SECTION_TITLE}>
                Évolution trimestrielle {year} · {mode === 'gerance' ? 'Gérance' : 'Copropriété'}
              </div>
              <TrendTable rows={trendRows} year={year} />
            </div>

            {/* Options PDF + export */}
            <div className={CARD}>
              <div className={SECTION_TITLE}>Options du rapport PDF</div>
              <PDFOptions
                sections={pdfSections}
                onChange={setPdfSections}
                onExport={handleExportPDF}
                loading={pdfLoading}
                disabled={currentEntries.length === 0}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
