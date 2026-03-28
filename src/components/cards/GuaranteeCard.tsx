'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SectionNote } from '@/components/shared/SectionNote'
import { eur } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

interface GuaranteeCardProps {
  guarantee: number
  peak: number
  peakDate: string
}

export function GuaranteeCard({ guarantee, peak, peakDate }: GuaranteeCardProps) {
  if (guarantee === 0 && peak === 0) return null

  const incomplete = guarantee === 0 || peak === 0
  const covered = !incomplete && guarantee > peak
  const level = incomplete ? 'warn' : covered ? 'ok' : 'bad'
  const gap = guarantee - peak
  const peakDateFmt = peakDate ? new Date(peakDate).toLocaleDateString('fr-FR') : '—'

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg bg-status-info-bg">
            🛡️
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Garantie financière</div>
            <div className="text-[11px] text-muted-foreground">Contrôle pointe de garantie</div>
          </div>
          <StatusBadge level={level} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-2">
          <span className={cn('text-2xl font-bold',
            level === 'ok' && 'text-status-green',
            level === 'warn' && 'text-status-orange',
            level === 'bad' && 'text-status-red',
          )}>
            {incomplete ? '—' : covered ? 'Couverte' : 'Dépassée'}
          </span>
          <span className="text-[11px] text-muted-foreground ml-1.5">
            {incomplete ? 'données incomplètes' : 'garantie vs pointe'}
          </span>
        </div>

        <div className="border-t border-border my-2" />

        <div className="flex items-center justify-between text-xs py-0.5">
          <span className="text-muted-foreground">Garantie financière</span>
          <span className="font-medium">{eur(guarantee, 2)}</span>
        </div>
        <div className="flex items-center justify-between text-xs py-0.5">
          <span className="text-muted-foreground">Pointe (au {peakDateFmt})</span>
          <span className={cn('font-medium',
            level === 'ok' && 'text-status-green',
            level === 'bad' && 'text-status-red',
          )}>{eur(peak, 2)}</span>
        </div>

        {!incomplete && (
          <>
            <div className="border-t border-border my-2" />
            <div className="flex items-center justify-between text-xs py-0.5">
              <span className="text-muted-foreground">Écart garantie − pointe</span>
              <span className={cn('font-semibold text-sm',
                covered ? 'text-status-green' : 'text-status-red',
              )}>
                {gap >= 0 ? '+' : ''}{eur(gap, 2)}
              </span>
            </div>
            <div className={cn(
              'mt-2 text-[11px] px-2 py-1.5 rounded-md',
              covered ? 'bg-status-green-bg text-status-green' : 'bg-status-red-bg text-status-red',
            )}>
              {covered
                ? '✓ La garantie couvre la pointe. Situation conforme.'
                : '✗ La pointe dépasse la garantie. Risque de non-conformité.'}
            </div>
          </>
        )}

        {incomplete && (
          <div className="mt-2 text-[11px] px-2 py-1.5 rounded-md bg-status-orange-bg text-status-orange">
            ⚠ Renseignez les deux champs pour le contrôle.
          </div>
        )}

        <SectionNote sectionId="garantie" />
      </CardContent>
    </Card>
  )
}
