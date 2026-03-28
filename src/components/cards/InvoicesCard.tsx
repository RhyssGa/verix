'use client'

import type { ExcelRow } from '@/types/audit'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SectionNote } from '@/components/shared/SectionNote'
import { MiniListItem } from './MiniListItem'
import { computeSeverityLevel } from '@/lib/utils/helpers'
import { eur, pct, excelDateFmt } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

interface InvoicesCardProps {
  mode: 'gerance' | 'copro'
  factures_nr30: ExcelRow[]
  factures_nr60: ExcelRow[]
  totalCount: number
  endDate: string
  onViewMore?: () => void
  onExport?: () => void
}

export function InvoicesCard({
  mode,
  factures_nr30,
  factures_nr60,
  totalCount,
  endDate,
  onViewMore,
  onExport,
}: InvoicesCardProps) {
  // Column index for amount depends on mode
  const amountCol = mode === 'gerance' ? 10 : 11
  // Column for mandat/residence name
  const nameCol = mode === 'gerance' ? 4 : 7

  const totalNR60 = factures_nr60.reduce(
    (sum, r) => sum + (parseFloat(String(r[amountCol] ?? 0)) || 0),
    0,
  )
  const p30 = totalCount > 0 ? (factures_nr30.length / totalCount) * 100 : 0
  const p60 = totalCount > 0 ? (factures_nr60.length / totalCount) * 100 : 0

  const level =
    factures_nr30.length === 0
      ? 'ok'
      : computeSeverityLevel(factures_nr60.length, Math.abs(totalNR60))

  const endDateFmt = endDate ? new Date(endDate).toLocaleDateString('fr-FR') : '—'

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg bg-status-orange-bg">
            🧾
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Délais de règlement</div>
            <div className="text-[11px] text-muted-foreground">
              {totalCount} factures · réf. {endDateFmt}
            </div>
          </div>
          <StatusBadge level={level} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-2">
          <span
            className={cn(
              'text-2xl font-bold',
              level === 'ok' && 'text-status-green',
              level === 'warn' && 'text-status-orange',
              level === 'bad' && 'text-status-red',
            )}
          >
            {factures_nr60.length}
          </span>
          <span className="text-[11px] text-muted-foreground ml-1.5">factures non réglées +60j</span>
        </div>

        <div className="border-t border-border my-2" />

        <div className="flex items-center justify-between text-xs py-0.5">
          <span className="text-muted-foreground">Non réglées à +30j</span>
          <span
            className={cn(
              'font-medium',
              factures_nr30.length > 0 ? 'text-status-orange' : 'text-status-green',
            )}
          >
            {factures_nr30.length} ({pct(p30)})
          </span>
        </div>
        <div className="flex items-center justify-between text-xs py-0.5">
          <span className="text-muted-foreground">Non réglées à +60j</span>
          <span
            className={cn(
              'font-medium',
              factures_nr60.length > 0 ? 'text-status-red' : 'text-status-green',
            )}
          >
            {factures_nr60.length} ({pct(p60)}) · {eur(totalNR60, 2)}
          </span>
        </div>

        {factures_nr60.length > 0 && (
          <>
            <div className="border-t border-border my-2" />
            <div>
              {factures_nr60.slice(0, 3).map((r, i) => (
                <MiniListItem
                  key={i}
                  categoryId="fact60"
                  index={i}
                  name={String(r[nameCol] || '—')}
                  value={eur(parseFloat(String(r[amountCol] ?? 0)) || 0, 2)}
                  valueClass="text-status-red"
                />
              ))}
            </div>
            <div className="flex gap-1.5 mt-2">
              {onViewMore && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 flex-1"
                  onClick={onViewMore}
                >
                  Voir plus ({factures_nr60.length})
                </Button>
              )}
              {onExport && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 px-2.5"
                  onClick={onExport}
                >
                  ↓ Excel
                </Button>
              )}
            </div>
          </>
        )}

        <SectionNote sectionId="fact60" />
      </CardContent>
    </Card>
  )
}
