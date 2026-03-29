'use client'

import { useState } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { useHistory } from '@/hooks/useHistory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ReportEntry } from '@/types/audit'

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return ts
  }
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-status-green'
  if (score >= 60) return 'text-status-orange'
  return 'text-status-red'
}

export function HistoryPanel() {
  const showHistory = useAuditStore((s) => s.showHistory)
  const setShowHistory = useAuditStore((s) => s.setShowHistory)
  const reportHistory = useAuditStore((s) => s.reportHistory)
  const setDeleteConfirm = useAuditStore((s) => s.setDeleteConfirm)
  const mode = useAuditStore((s) => s.mode)
  const { restoreFromHistory } = useHistory()

  const [nameFilter, setNameFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')  // format "MM"
  const [yearFilter, setYearFilter] = useState('')

  if (!showHistory) return null

  // Group by batchId — only current mode
  const batchMap = new Map<string, ReportEntry[]>()
  for (const entry of reportHistory) {
    if (entry.mode !== mode) continue
    if (!batchMap.has(entry.batchId)) batchMap.set(entry.batchId, [])
    batchMap.get(entry.batchId)!.push(entry)
  }

  const filtered = Array.from(batchMap.entries()).filter(([, entries]) => {
    const first = entries[0]
    if (nameFilter && !first.agence.toLowerCase().includes(nameFilter.toLowerCase())) return false
    if (monthFilter || yearFilter) {
      const ts = new Date(first.timestamp)
      if (monthFilter && String(ts.getMonth() + 1).padStart(2, '0') !== monthFilter) return false
      if (yearFilter && String(ts.getFullYear()) !== yearFilter) return false
    }
    return true
  })

  const modeLabel = mode === 'gerance' ? 'Gérance' : 'Copropriété'

  // Mois/années disponibles dans les données filtrées par mode
  const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
  const availableYears = Array.from(new Set(
    reportHistory.filter(e => e.mode === mode).map(e => String(new Date(e.timestamp).getFullYear()))
  )).sort((a, b) => Number(b) - Number(a))
  const availableMonths = Array.from(new Set(
    reportHistory.filter(e => e.mode === mode).map(e => String(new Date(e.timestamp).getMonth() + 1).padStart(2, '0'))
  )).sort()

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => setShowHistory(false)}
      />
      {/* Panel */}
      <div className="relative ml-auto w-full max-w-sm h-full bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-navy text-white">
          <div>
            <div className="font-semibold text-sm">Historique des audits</div>
            <div className="text-[11px] text-white/50">{modeLabel}</div>
          </div>
          <button
            onClick={() => setShowHistory(false)}
            className="text-white/70 hover:text-white text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div className="px-3 py-2.5 border-b border-border space-y-2">
          <Input
            placeholder="Filtrer par nom d'agence…"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="h-7 text-xs"
          />
          <div className="flex gap-1.5 items-center">
            {[
              { label: 'Mois', value: monthFilter, onChange: setMonthFilter, options: [
                ['', 'Tous'] as [string, string],
                ...availableMonths.map(m => [m, MONTH_NAMES[Number(m) - 1]] as [string, string]),
              ]},
              { label: 'Année', value: yearFilter, onChange: setYearFilter, options: [
                ['', 'Toutes'] as [string, string],
                ...availableYears.map(y => [y, y] as [string, string]),
              ]},
            ].map(({ label, value, onChange, options }) => (
              <div key={label} className="flex-1">
                <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
                <select
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-full px-1.5 py-[3px] text-[11px] border border-[#E8E4DC] rounded-[6px] font-[inherit] bg-[#FAF8F4] text-[#1A1A2E]"
                >
                  {options.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8">
              Aucun rapport dans l&apos;historique
            </div>
          ) : (
            filtered.map(([batchId, entries]) => {
              const first = entries[0]
              const count = entries.length > 1 ? entries.length : undefined

              return (
                <div
                  key={batchId}
                  className="border border-border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs truncate">{first.agence}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {formatTs(first.timestamp)}
                        {count && ` · ${count} agences`}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {first.nbAnomalies} anomalie{first.nbAnomalies !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className={`text-lg font-bold leading-none ${scoreColor(first.scoreGlobal)}`}>
                        {first.scoreGlobal % 1 === 0 ? first.scoreGlobal.toFixed(0) : first.scoreGlobal.toFixed(1)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{first.niveau}</div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!first.hasSnapshot}
                      className="flex-1 text-xs h-7"
                      onClick={() => restoreFromHistory(first)}
                    >
                      {!first.hasSnapshot ? '⚠ Restaurer' : '↩ Restaurer'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 border-status-red text-status-red hover:bg-status-red-bg px-2"
                      onClick={() => setDeleteConfirm({ batchId, count: entries.length })}
                    >
                      🗑
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
