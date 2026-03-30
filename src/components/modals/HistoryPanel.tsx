'use client'

import { useState, useEffect } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { useHistory } from '@/hooks/useHistory'
import { useImportSession, type ImportSessionSummary } from '@/hooks/useImportSession'
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
  if (score >= 70) return 'text-status-yellow'
  if (score >= 60) return 'text-status-orange'
  return 'text-status-red'
}

export function HistoryPanel() {
  const showHistory = useAuditStore((s) => s.showHistory)
  const setShowHistory = useAuditStore((s) => s.setShowHistory)
  const reportHistory = useAuditStore((s) => s.reportHistory)
  const setDeleteConfirm = useAuditStore((s) => s.setDeleteConfirm)
  const mode = useAuditStore((s) => s.mode)
  const historyInitialTab = useAuditStore((s) => s.historyInitialTab)
  const { restoreFromHistory } = useHistory()
  const { importSessions, importSessionId, restoreImportSession, deleteImportSession, refreshSessions } = useImportSession()

  const [tab, setTab] = useState<'audits' | 'imports'>(historyInitialTab)

  // Sync tab + refresh imports à chaque ouverture du panel
  useEffect(() => {
    if (showHistory) {
      setTab(historyInitialTab)
      refreshSessions()
    }
  }, [showHistory, historyInitialTab, refreshSessions])

  const [nameFilter, setNameFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [deletingImportId, setDeletingImportId] = useState<string | null>(null)

  if (!showHistory) return null

  // ── Audits tab ──────────────────────────────────────────────────────────────
  const batchMap = new Map<string, ReportEntry[]>()
  for (const entry of reportHistory) {
    if (entry.mode !== mode) continue
    if (!batchMap.has(entry.batchId)) batchMap.set(entry.batchId, [])
    batchMap.get(entry.batchId)!.push(entry)
  }

  const filteredAudits = Array.from(batchMap.entries()).filter(([, entries]) => {
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

  const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
  const availableYears = Array.from(new Set(
    reportHistory.filter(e => e.mode === mode).map(e => String(new Date(e.timestamp).getFullYear()))
  )).sort((a, b) => Number(b) - Number(a))
  const availableMonths = Array.from(new Set(
    reportHistory.filter(e => e.mode === mode).map(e => String(new Date(e.timestamp).getMonth() + 1).padStart(2, '0'))
  )).sort()

  // ── Imports tab ─────────────────────────────────────────────────────────────
  const filteredImports = importSessions.filter(s => s.mode === mode)

  const handleDeleteImport = async (session: ImportSessionSummary) => {
    setDeletingImportId(session.id)
    await deleteImportSession(session.id)
    setDeletingImportId(null)
  }

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
            <div className="font-semibold text-sm">Historique</div>
            <div className="text-[11px] text-white/50">{modeLabel}</div>
          </div>
          <button
            onClick={() => setShowHistory(false)}
            className="text-white/70 hover:text-white text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(['audits', 'imports'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'flex-1 py-2 text-[12px] font-semibold font-[inherit] border-none cursor-pointer',
                tab === t
                  ? 'text-[#0B1929] border-b-2 border-[#C49A2E] bg-white'
                  : 'text-[#7A7A8C] bg-[#FAF8F4] hover:bg-[#F0EDE6]',
              ].join(' ')}
            >
              {t === 'audits' ? `Audits (${batchMap.size})` : `Imports (${filteredImports.length})`}
            </button>
          ))}
        </div>

        {/* ── AUDITS ─────────────────────────────────────────────────────── */}
        {tab === 'audits' && (
          <>
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

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              {filteredAudits.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-8">
                  Aucun rapport dans l&apos;historique
                </div>
              ) : (
                filteredAudits.map(([batchId, entries]) => {
                  const first = entries[0]
                  const count = entries.length > 1 ? entries.length : undefined

                  return (
                    <div key={batchId} className="border border-border rounded-lg p-3 space-y-2">
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
          </>
        )}

        {/* ── IMPORTS ────────────────────────────────────────────────────── */}
        {tab === 'imports' && (
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {filteredImports.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8">
                Aucun import sauvegardé ce trimestre
              </div>
            ) : (
              filteredImports.map((session) => {
                const isActive = importSessionId === session.id
                const isDeleting = deletingImportId === session.id

                return (
                  <div
                    key={session.id}
                    className={[
                      'border rounded-lg p-3 space-y-2',
                      isActive ? 'border-[#C49A2E] bg-[#FFFBF0]' : 'border-border',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {session.label && (
                          <div className="font-semibold text-xs truncate">{session.label}</div>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {formatTs(session.createdAt)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {session.agences.length} agence{session.agences.length !== 1 ? 's' : ''}
                          {' · '}Q{session.quarter} {session.quarterYear}
                        </div>
                        {isActive && (
                          <div className="text-[10px] font-semibold text-[#C49A2E] mt-1">
                            ● Import actif
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-7"
                        onClick={() => restoreImportSession(session)}
                      >
                        ↩ Rouvrir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isDeleting}
                        className="text-xs h-7 border-status-red text-status-red hover:bg-status-red-bg px-2"
                        onClick={() => handleDeleteImport(session)}
                      >
                        {isDeleting ? '…' : '🗑'}
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
