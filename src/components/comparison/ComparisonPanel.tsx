'use client'

import { useMemo } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { useScore } from '@/stores/computed'
import { normalizeAgency } from '@/lib/utils/helpers'
import type { ReportEntry } from '@/types/audit'

function findPreviousAudit(
  history: ReportEntry[],
  reportAgencies: string[],
  mode: 'gerance' | 'copro',
): ReportEntry | null {
  const normalizedSet = new Set(reportAgencies.map((a) => normalizeAgency(a)))
  const sortKey = (e: ReportEntry) => e.timestamp

  // Group history by batchId, find matching batches (same agencies set + mode)
  const batchMap = new Map<string, ReportEntry>()
  for (const entry of history) {
    if (!batchMap.has(entry.batchId)) batchMap.set(entry.batchId, entry)
  }

  const candidates = Array.from(batchMap.values())
    .filter((e) => {
      if (e.mode !== mode) return false
      const entryAgencies = new Set(
        e.agence.split(' + ').map((s) => s.trim()),
      )
      if (entryAgencies.size !== normalizedSet.size) return false
      for (const a of Array.from(entryAgencies)) {
        if (!normalizedSet.has(a)) return false
      }
      return true
    })
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)))

  return candidates[0] ?? null
}

export function ComparisonPanel() {
  const score = useScore()
  const mode = useAuditStore((s) => s.mode)
  const reportHistory = useAuditStore((s) => s.reportHistory)
  const reportAgencies = useAuditStore((s) => s.reportAgencies)
  const agencies = useAuditStore((s) => s.agencies)
  const comparisonEnabled = useAuditStore((s) => s.comparisonEnabled)
  const setComparisonEnabled = useAuditStore((s) => s.setComparisonEnabled)

  const agencyList = reportAgencies.length > 0
    ? reportAgencies
    : agencies.length === 0
    ? []
    : []

  const prev = useMemo(
    () => findPreviousAudit(reportHistory, agencyList, mode),
    [reportHistory, agencyList, mode],
  )

  if (!score || !prev) return null

  const delta = score.scoreGlobal - prev.scoreGlobal
  const deltaStr = (delta >= 0 ? '+' : '') + delta.toFixed(1)
  const deltaColor = delta > 0 ? 'text-status-green' : delta < 0 ? 'text-status-red' : 'text-muted-foreground'

  function formatTs(ts: string): string {
    try {
      return new Date(ts).toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    } catch { return ts }
  }

  return (
    <div className="border border-border rounded-xl p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Comparaison audit précédent
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            className="w-3 h-3"
            checked={comparisonEnabled}
            onChange={(e) => setComparisonEnabled(e.target.checked)}
          />
          Inclure dans le PDF
        </label>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="text-xs text-muted-foreground">{formatTs(prev.timestamp)}</div>
          <div className="text-xs text-muted-foreground">{prev.niveau}</div>
          <div className="text-2xl font-bold text-navy">{prev.scoreGlobal.toFixed(0)}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
        </div>

        <div className="flex flex-col items-center px-4">
          <div className={`text-2xl font-bold ${deltaColor}`}>{deltaStr}</div>
          <div className="text-[10px] text-muted-foreground">points</div>
        </div>

        <div className="flex-1 text-right">
          <div className="text-xs text-muted-foreground">Actuel</div>
          <div className="text-xs text-muted-foreground">{score.niveau.label}</div>
          <div className="text-2xl font-bold text-navy">{score.scoreGlobal.toFixed(0)}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
        </div>
      </div>

      {prev.nbAnomalies !== undefined && (
        <div className="mt-3 pt-3 border-t border-border flex justify-between text-xs text-muted-foreground">
          <span>Anomalies : {prev.nbAnomalies} → {score.anomalies.filter((a) => !a.exclu && a.penalite > 0).length}</span>
          <span>Pénalités : {prev.totalPenalite.toFixed(1)} → {score.totalPenalite.toFixed(1)}</span>
        </div>
      )}
    </div>
  )
}
