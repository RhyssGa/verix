'use client'

import type { ExcelRow } from '@/types/audit'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SectionNote } from '@/components/shared/SectionNote'
import { useAuditStore } from '@/stores/useAuditStore'
import { excelDateFmt, truncate } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

interface NonClosedCardProps {
  mode: 'gerance' | 'copro'
  rows: ExcelRow[]
}

const MAX_PREVIEW = 4

export function NonClosedCard({ mode, rows }: NonClosedCardProps) {
  const nonClosedIncluded = useAuditStore((s) => s.nonClosedIncluded)
  const showAllNonClosed = useAuditStore((s) => s.showAllNonClosed)
  const toggleNonClosedIncluded = useAuditStore((s) => s.toggleNonClosedIncluded)
  const setShowAllNonClosed = useAuditStore((s) => s.setShowAllNonClosed)

  const nameCol = mode === 'gerance' ? 7 : 2
  const dateCol = mode === 'gerance' ? 10 : 11

  // Deduplicate by name
  const seen = new Map<string, string | number | null>()
  for (const r of rows) {
    const name = String(r[nameCol] ?? '').trim()
    if (!name) continue
    if (!seen.has(name)) {
      const d = r[dateCol]
      seen.set(name, d != null && String(d).trim() !== '' ? d : null)
    }
  }

  const items = Array.from(seen.entries())
  const displayItems = showAllNonClosed ? items : items.slice(0, MAX_PREVIEW)
  const includedCount = items.filter(([name]) => nonClosedIncluded[name] !== false).length
  const entityLabel = mode === 'gerance' ? 'banque(s)' : 'résidence(s)'

  return (
    <Card className="shadow-card border-status-info/20" data-score-id="bq_nonclot">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg bg-status-info-bg">
            🔄
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Rapprochements non clôturés</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {mode === 'gerance' ? 'Banques' : 'Résidences'} · absent ou en cours
            </div>
          </div>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-status-info-bg text-status-info border border-status-info/20">
            Info
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-[11px] text-status-info bg-status-info-bg rounded px-2 py-1 mb-2">
          ℹ Information uniquement — hors logique d&apos;anomalie et de score.
        </div>

        <div className="mb-2">
          <span className="text-2xl font-bold text-status-info">{items.length}</span>
          <span className="text-[11px] text-muted-foreground ml-1.5">
            {entityLabel} non rapprochée(s)
          </span>
        </div>

        {items.length > 0 ? (
          <>
            <div className="border-t border-border my-2" />
            <div className="text-[11px] text-muted-foreground mb-1">
              {includedCount}/{items.length} inclus dans le rapport PDF
            </div>
            <div>
              {displayItems.map(([name, rawDate]) => {
                const dateStr =
                  rawDate != null
                    ? excelDateFmt(rawDate)
                    : 'Aucun rapprochement fait'
                const included = nonClosedIncluded[name] !== false
                return (
                  <div key={name} className="py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex-1 text-xs truncate',
                          !included && 'line-through text-muted-foreground',
                        )}
                        title={name}
                      >
                        {truncate(name, 24)}
                      </span>
                      <span
                        className={cn(
                          'text-xs text-muted-foreground whitespace-nowrap',
                          !included && 'line-through',
                        )}
                      >
                        {dateStr}
                      </span>
                      <button
                        className={cn(
                          'w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold border transition-colors',
                          included
                            ? 'border-status-red text-status-red hover:bg-status-red-bg'
                            : 'border-status-green text-status-green bg-status-green-bg',
                        )}
                        onClick={() => toggleNonClosedIncluded(name)}
                        title={included ? 'Exclure du rapport PDF' : 'Inclure dans le rapport PDF'}
                      >
                        {included ? '✗' : '✓'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {items.length > MAX_PREVIEW && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 mt-1 text-muted-foreground"
                onClick={() => setShowAllNonClosed(!showAllNonClosed)}
              >
                {showAllNonClosed ? 'Voir moins' : `Voir tous (${items.length})`}
              </Button>
            )}
          </>
        ) : (
          <div className="text-xs text-status-info pt-1">Tous rapprochements clôturés</div>
        )}

        <SectionNote sectionId="bq_nonclot" />
      </CardContent>
    </Card>
  )
}
