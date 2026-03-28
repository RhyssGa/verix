'use client'

import type { AnomalyResult } from '@/types/audit'
import { cn } from '@/lib/utils'

interface ScoreDetailProps {
  anomaly: AnomalyResult
}

export function ScoreDetail({ anomaly }: ScoreDetailProps) {
  if (anomaly.exclu) return null

  const isQuittancement = anomaly.id === 'quitt'
  const isBankReconc = anomaly.id === 'bq_nonrapp'
  const isAccountingReconc = anomaly.id === 'cpta_nonrapp'

  const lines: { label: string; detail: string; points: number }[] = []

  if (isQuittancement && anomaly.ratio != null) {
    lines.push({
      label: 'Taux encaissement',
      detail: (anomaly.ratio * 100).toFixed(1) + '%',
      points: anomaly.penalite,
    })
  } else if (isBankReconc) {
    if (anomaly.scoreVolume > 0) {
      lines.push({
        label: 'Volume',
        detail: (anomaly.nb ?? 0) + ' écriture(s)',
        points: anomaly.scoreVolume,
      })
    }
  } else if (isAccountingReconc) {
    if (anomaly.scoreVolume > 0) {
      lines.push({
        label: 'Volume',
        detail: (anomaly.nb ?? 0) + ' écriture(s)',
        points: anomaly.scoreVolume,
      })
    }
  } else {
    if (anomaly.scoreMontant > 0 && anomaly.ratio != null) {
      lines.push({
        label: 'Montant',
        detail: (anomaly.ratio * 100).toFixed(2) + '% de la garantie',
        points: anomaly.scoreMontant,
      })
    }
    if (anomaly.scoreVolume > 0 && anomaly.ratioVolume != null) {
      lines.push({
        label: 'Volume',
        detail: (anomaly.ratioVolume * 100).toFixed(1) + '% du portefeuille',
        points: anomaly.scoreVolume,
      })
    }
  }

  if (lines.length === 0 && anomaly.penalite === 0) return null

  return (
    <div className="mt-2 space-y-0.5 text-[10px]">
      {lines.map((line, index) => (
        <div key={index} className="flex items-center gap-1">
          <span className="font-bold text-status-red min-w-[32px]">
            {line.points > 0 ? '−' + line.points.toFixed(1) : '0'}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-medium">{line.label}</span>
          <span className="text-muted-foreground ml-1">{line.detail}</span>
        </div>
      ))}
      {anomaly.nbExclu > 0 && (
        <div className="flex items-center gap-1 text-status-green">
          <span className="font-bold min-w-[32px]">—</span>
          <span className="text-muted-foreground">·</span>
          <span>{anomaly.nbExclu} ligne(s) justifiée(s)</span>
        </div>
      )}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <span className="font-medium">Total</span>
        <span
          className={cn(
            'font-bold',
            anomaly.penalite > 0 ? 'text-status-red' : 'text-status-green',
          )}
        >
          {anomaly.penalite > 0 ? '−' + anomaly.penalite.toFixed(1) : '0'} /{' '}
          {anomaly.penaliteMax} pts
        </span>
      </div>
    </div>
  )
}
