'use client'

import { useMemo, useState } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { useScore } from '@/stores/computed'
import { normalizeAgency } from '@/lib/utils/helpers'
import type { ReportEntry } from '@/types/audit'

function findCandidates(
  history: ReportEntry[],
  reportAgencies: string[],
  mode: 'gerance' | 'copro',
): ReportEntry[] {
  const normalizedSet = new Set(reportAgencies.map((a) => normalizeAgency(a)))

  const batchMap = new Map<string, ReportEntry>()
  for (const entry of history) {
    if (!batchMap.has(entry.batchId)) batchMap.set(entry.batchId, entry)
  }

  return Array.from(batchMap.values())
    .filter((e) => {
      if (e.mode !== mode) return false
      const entryAgencies = e.agence.split(' + ').map((s) => normalizeAgency(s.trim()))
      if (entryAgencies.length !== normalizedSet.size) return false
      return entryAgencies.every((a) => normalizedSet.has(a))
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return ts }
}

function fmtScore(s: number) {
  return s % 1 === 0 ? s.toFixed(0) : s.toFixed(1)
}

export function ComparisonPanel() {
  const score = useScore()
  const mode = useAuditStore((s) => s.mode)
  const reportHistory = useAuditStore((s) => s.reportHistory)
  const reportAgencies = useAuditStore((s) => s.reportAgencies)
  const agencies = useAuditStore((s) => s.agencies)
  const comparisonEnabled = useAuditStore((s) => s.comparisonEnabled)
  const setComparisonEnabled = useAuditStore((s) => s.setComparisonEnabled)

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const agencyList = reportAgencies.length > 0 ? reportAgencies : agencies.length === 0 ? [] : []

  const candidates = useMemo(
    () => findCandidates(reportHistory, agencyList, mode),
    [reportHistory, agencyList, mode],
  )

  const prev = useMemo(() => {
    if (candidates.length === 0) return null
    if (selectedId) return candidates.find((c) => c.id === selectedId) ?? candidates[0]
    return candidates[0]
  }, [candidates, selectedId])

  if (!score || candidates.length === 0) return null

  const delta = prev ? score.scoreGlobal - prev.scoreGlobal : 0
  const deltaStr = (delta >= 0 ? '+' : '') + delta.toFixed(1)
  const deltaPositive = delta > 0
  const deltaNeutral = delta === 0
  const deltaColor = deltaPositive ? '#1A7A4A' : deltaNeutral ? '#7A7A8C' : '#B01A1A'
  const deltaBg = deltaPositive ? '#EAF6EF' : deltaNeutral ? '#F2F2F2' : '#FAEAEA'
  const deltaArrow = deltaPositive ? '↑' : deltaNeutral ? '→' : '↓'

  const currentAnomalies = score.anomalies.filter((a) => !a.exclu && a.penalite > 0).length

  return (
    <>
      <div className="flex items-center gap-[10px] text-[11px] font-semibold tracking-[0.8px] uppercase text-[#7A7A8C] mb-[14px]">
        <span>Comparaison audit précédent</span>
        <span className="flex-1 h-px bg-[#E8E4DC]" />
      </div>

      <div className="bg-white border border-[#E8E4DC] rounded-[14px] overflow-hidden">

        {/* Header : sélecteur + toggle PDF */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0EDE8] bg-[#FAF8F4] gap-3">
          {candidates.length > 1 ? (
            <select
              value={selectedId ?? candidates[0]?.id ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="text-[11px] border border-[#E8E4DC] rounded-[7px] px-2 py-[5px] bg-white text-[#1A1A2E] font-[inherit] cursor-pointer flex-1 max-w-[320px]"
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatTs(c.timestamp)} — {fmtScore(c.scoreGlobal)}/100 · {c.niveau}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-[11px] text-[#7A7A8C]">
              Audit du <strong className="text-[#1A1A2E]">{prev ? formatTs(prev.timestamp) : '—'}</strong>
            </div>
          )}

          <label className="flex items-center gap-1.5 text-[11px] text-[#7A7A8C] cursor-pointer whitespace-nowrap select-none">
            <input
              type="checkbox"
              checked={comparisonEnabled}
              onChange={(e) => setComparisonEnabled(e.target.checked)}
              className="accent-[#0B1929] w-[13px] h-[13px]"
            />
            Inclure dans le PDF
          </label>
        </div>

        {/* Corps */}
        {!comparisonEnabled ? (
          <div className="flex items-center justify-center p-6 text-[#7A7A8C] text-[12px] gap-2">
            <span className="opacity-40">—</span>
            <span>Comparaison non incluse dans le rapport PDF</span>
            <span className="opacity-40">—</span>
          </div>
        ) : prev ? (
          <div className="p-5 pb-4">

            {/* Scores : précédent → delta → actuel */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3">

              {/* Score précédent */}
              <div className="bg-[#FAF8F4] border border-[#E8E4DC] rounded-[10px] px-4 py-[14px]">
                <div className="text-[10px] font-semibold text-[#7A7A8C] uppercase tracking-[0.6px] mb-1.5">
                  Précédent
                </div>
                <div className="text-[28px] font-extrabold text-[#1A1A2E] leading-none">
                  {fmtScore(prev.scoreGlobal)}
                  <span className="text-[13px] font-normal text-[#7A7A8C]">/100</span>
                </div>
                <div
                  className="inline-block mt-1.5 px-2 py-[2px] rounded-[20px] text-[10px] font-semibold"
                  style={{
                    background: prev.niveau === 'Excellent' || prev.niveau === 'Bien' || prev.niveau === 'Satisfaisant' ? '#EAF6EF' : prev.niveau === 'Vigilance' ? '#FDF0E6' : '#FAEAEA',
                    color: prev.niveau === 'Excellent' || prev.niveau === 'Bien' || prev.niveau === 'Satisfaisant' ? '#1A7A4A' : prev.niveau === 'Vigilance' ? '#C05C1A' : '#B01A1A',
                  }}
                >
                  {prev.niveau}
                </div>
                <div className="text-[10px] text-[#7A7A8C] mt-1">{formatTs(prev.timestamp)}</div>
              </div>

              {/* Delta */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-[52px] h-[52px] rounded-full flex flex-col items-center justify-center border-[1.5px]"
                  style={{
                    background: deltaBg,
                    borderColor: `${deltaColor}33`,
                  }}
                >
                  <span className="text-[14px]" style={{ color: deltaColor }}>{deltaArrow}</span>
                  <span className="text-[11px] font-extrabold leading-none" style={{ color: deltaColor }}>{deltaStr}</span>
                </div>
                <div className="text-[9px] text-[#7A7A8C] font-semibold tracking-[0.3px]">pts</div>
              </div>

              {/* Score actuel */}
              <div
                className="rounded-[10px] px-4 py-[14px]"
                style={{
                  background: score.niveau.bg,
                  border: `1px solid ${score.niveau.color}33`,
                }}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.6px] mb-1.5" style={{ color: score.niveau.color }}>
                  Actuel
                </div>
                <div className="text-[28px] font-extrabold text-[#1A1A2E] leading-none">
                  {fmtScore(score.scoreGlobal)}
                  <span className="text-[13px] font-normal text-[#7A7A8C]">/100</span>
                </div>
                <div
                  className="inline-block mt-1.5 px-2 py-[2px] rounded-[20px] text-[10px] font-semibold bg-white/60"
                  style={{ color: score.niveau.color }}
                >
                  {score.niveau.label}
                </div>
              </div>
            </div>

            {/* Stats bas */}
            {prev.nbAnomalies !== undefined && (
              <div className="mt-[14px] grid grid-cols-2 gap-2">
                <div className="bg-[#FAF8F4] rounded-[8px] px-[14px] py-[10px] flex justify-between items-center">
                  <span className="text-[11px] text-[#7A7A8C]">Anomalies</span>
                  <span className="text-[12px] font-bold text-[#1A1A2E]">
                    {prev.nbAnomalies}
                    <span className="text-[#7A7A8C] font-normal mx-1">→</span>
                    <span style={{ color: currentAnomalies < prev.nbAnomalies ? '#1A7A4A' : currentAnomalies > prev.nbAnomalies ? '#B01A1A' : '#1A1A2E' }}>
                      {currentAnomalies}
                    </span>
                  </span>
                </div>
                <div className="bg-[#FAF8F4] rounded-[8px] px-[14px] py-[10px] flex justify-between items-center">
                  <span className="text-[11px] text-[#7A7A8C]">Pénalités</span>
                  <span className="text-[12px] font-bold text-[#1A1A2E]">
                    {prev.totalPenalite.toFixed(1)}
                    <span className="text-[#7A7A8C] font-normal mx-1">→</span>
                    <span style={{ color: score.totalPenalite < prev.totalPenalite ? '#1A7A4A' : score.totalPenalite > prev.totalPenalite ? '#B01A1A' : '#1A1A2E' }}>
                      {score.totalPenalite.toFixed(1)}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  )
}
