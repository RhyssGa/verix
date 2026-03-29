'use client'

import type { AnomalyResult } from '@/types/audit'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SectionNote } from '@/components/shared/SectionNote'
import { ScoreDetail } from '@/components/shared/ScoreDetail'
import { eur, pct } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

interface QuittancementCardProps {
  quittancement: number
  encaissement: number
  endDate: string
  anomaly?: AnomalyResult | null
}

export function QuittancementCard({
  quittancement: q,
  encaissement: e,
  endDate,
  anomaly,
}: QuittancementCardProps) {
  if (q === 0) return null

  const ratio = q > 0 ? (e / q) * 100 : 0
  const level =
    ratio > 100 ? 'ok' : ratio >= 95 ? 'warn' : 'bad'
  const barColor =
    level === 'ok' ? '#1A7A4A' : level === 'warn' ? '#C05C1A' : '#B01A1A'
  const endDateFmt = endDate
    ? new Date(endDate).toLocaleDateString('fr-FR')
    : '—'

  return (
    <Card className="shadow-card" data-score-id="quitt">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg bg-status-info-bg">
            💰
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Quittancement / Encaissement</div>
            <div className="text-[11px] text-muted-foreground">
              Ratio de recouvrement · réf. {endDateFmt}
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
            {pct(ratio)}
          </span>
          <span className="text-[11px] text-muted-foreground ml-1.5">de recouvrement</span>
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, ratio).toFixed(1)}%`,
                background: barColor,
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
            <span>0%</span>
            <span className="font-semibold" style={{ color: barColor }}>{pct(ratio)}</span>
            <span>100%</span>
          </div>
        </div>

        <div className="border-t border-border my-2" />

        <div className="flex items-center justify-between text-xs py-0.5">
          <span className="text-muted-foreground">Quittancé</span>
          <span className="font-medium">{eur(q, 2)}</span>
        </div>
        <div className="flex items-center justify-between text-xs py-0.5">
          <span className="text-muted-foreground">Encaissé</span>
          <span className="font-medium">{eur(e, 2)}</span>
        </div>
        <div className="flex items-center justify-between text-xs py-0.5">
          <span className="text-muted-foreground">Écart</span>
          <span
            className={cn(
              'font-medium',
              level === 'ok' && 'text-status-green',
              level !== 'ok' && 'text-status-red',
            )}
          >
            {eur(q - e, 2)}
          </span>
        </div>

        {anomaly && <ScoreDetail anomaly={anomaly} />}
        <SectionNote sectionId="quitt" />
      </CardContent>
    </Card>
  )
}
