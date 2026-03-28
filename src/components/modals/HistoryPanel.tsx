'use client'

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
  if (score >= 85) return 'text-status-green'
  if (score >= 60) return 'text-status-orange'
  return 'text-status-red'
}

export function HistoryPanel() {
  const showHistory = useAuditStore((s) => s.showHistory)
  const setShowHistory = useAuditStore((s) => s.setShowHistory)
  const reportHistory = useAuditStore((s) => s.reportHistory)
  const agencyFilter = useAuditStore((s) => s.agencyFilter)
  const setAgencyFilter = useAuditStore((s) => s.setAgencyFilter)
  const modeFilter = useAuditStore((s) => s.modeFilter)
  const setModeFilter = useAuditStore((s) => s.setModeFilter)
  const setDeleteConfirm = useAuditStore((s) => s.setDeleteConfirm)
  const mode = useAuditStore((s) => s.mode)
  const { restoreFromHistory } = useHistory()

  if (!showHistory) return null

  // Group by batchId
  const batchMap = new Map<string, ReportEntry[]>()
  for (const entry of reportHistory) {
    if (!batchMap.has(entry.batchId)) batchMap.set(entry.batchId, [])
    batchMap.get(entry.batchId)!.push(entry)
  }

  // Filter batches
  const filtered = Array.from(batchMap.entries()).filter(([, entries]) => {
    const first = entries[0]
    if (modeFilter && first.mode !== modeFilter) return false
    if (agencyFilter && !first.agence.toLowerCase().includes(agencyFilter.toLowerCase())) return false
    return true
  })

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
          <span className="font-semibold text-sm">Historique des audits</span>
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
            placeholder="Filtrer par agence…"
            value={agencyFilter}
            onChange={(e) => setAgencyFilter(e.target.value)}
            className="h-7 text-xs"
          />
          <div className="flex gap-1.5">
            {(['', 'gerance', 'copro'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setModeFilter(m)}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  modeFilter === m
                    ? 'bg-navy text-white border-navy'
                    : 'border-border text-muted-foreground hover:border-navy/50'
                }`}
              >
                {m === '' ? 'Tous' : m === 'gerance' ? 'Gérance' : 'Copro'}
              </button>
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
              const isSameMode = first.mode === mode
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
                        {first.mode === 'gerance' ? 'Gérance' : 'Copro'}
                        {' · '}{first.nbAnomalies} anomalie{first.nbAnomalies !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className={`text-lg font-bold leading-none ${scoreColor(first.scoreGlobal)}`}>
                        {first.scoreGlobal.toFixed(0)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{first.niveau}</div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!isSameMode || !first.hasSnapshot}
                      className="flex-1 text-xs h-7"
                      onClick={() => restoreFromHistory(first)}
                    >
                      {!first.hasSnapshot ? '⚠ Restaurer' : '↩ Restaurer'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 border-status-red text-status-red hover:bg-status-red-bg px-2"
                      onClick={() =>
                        setDeleteConfirm({ batchId, count: entries.length })
                      }
                    >
                      🗑
                    </Button>
                  </div>
                  {!isSameMode && (
                    <div className="text-[10px] text-status-orange">
                      Mode différent — ouvrez la page {first.mode === 'gerance' ? 'Gérance' : 'Copro'} pour restaurer
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
