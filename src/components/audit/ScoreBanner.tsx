'use client'

import type { ScoreResult } from '@/types/audit'
import { scoreLevelText } from '@/lib/scoring/engine'
import { cn } from '@/lib/utils'

interface ScoreBannerProps {
  score: ScoreResult
}

export function ScoreBanner({ score }: ScoreBannerProps) {
  const { scoreGlobal, niveau, anomalies, totalPenalite } = score
  const circumference = 251.3
  const offset = (circumference * (1 - scoreGlobal / 100)).toFixed(1)

  const activeAnomalies = anomalies.filter((a) => !a.exclu && a.penalite > 0).length
  const criticalCount = anomalies.filter((a) => a.type === 'critique' && (a.nb ?? 0) > 0).length
  const blockingCount = anomalies.filter((a) => a.bloquant).length
  const infoCount = anomalies.filter((a) => a.exclu).length

  return (
    <div className="flex items-center gap-6 bg-white rounded-xl p-5 shadow-card" style={{ border: `1.5px solid ${niveau.color}22`, boxShadow: `0 4px 20px ${niveau.color}18, 0 1px 4px rgba(0,0,0,0.06)` }}>
      {/* Score Gauge */}
      <div className="relative w-24 h-24 flex-shrink-0">
        <svg className="w-full h-full" viewBox="0 0 96 96">
          <circle
            cx="48" cy="48" r="40"
            fill="none"
            stroke="#E8E4DC"
            strokeWidth="6"
          />
          <circle
            cx="48" cy="48" r="40"
            fill="none"
            stroke={niveau.color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={String(circumference)}
            strokeDashoffset={String(offset)}
            transform="rotate(-90 48 48)"
            className="animate-score-fill"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold" style={{ color: niveau.color }}>
            {scoreGlobal}
          </span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
      </div>

      {/* Score Info */}
      <div className="flex-1 min-w-0">
        <span
          className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mb-1"
          style={{ background: niveau.bg, color: niveau.color }}
        >
          {niveau.label}
        </span>
        <div className="text-sm font-bold">Score d&apos;audit</div>
        <div className="text-xs text-muted-foreground">{scoreLevelText(niveau)}</div>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {activeAnomalies > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-status-orange-bg text-status-orange">
              {activeAnomalies} anomalie(s) pénalisante(s)
            </span>
          )}
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-status-red-bg text-status-red">
              {criticalCount} critique(s)
            </span>
          )}
          {blockingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-status-orange-bg text-status-orange">
              {blockingCount} bloquante(s) (ratio &gt;1%)
            </span>
          )}
          {infoCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-status-info-bg text-status-info">
              {infoCount} info uniquement
            </span>
          )}
          {activeAnomalies === 0 && criticalCount === 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-status-green-bg text-status-green">
              Aucune anomalie pénalisante
            </span>
          )}
        </div>
      </div>

      {/* Total Penalty */}
      <div className="text-right min-w-[110px] flex-shrink-0">
        <div className="text-[10px] text-muted-foreground mb-1">Pénalité totale</div>
        <div
          className={cn(
            'text-[22px] font-extrabold',
            totalPenalite > 0 ? 'text-status-red' : 'text-status-green',
          )}
        >
          {totalPenalite > 0 ? '−' + totalPenalite.toFixed(1) : '0'}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">
          {anomalies.filter((a) => !a.exclu).length} éléments évalués
        </div>
      </div>
    </div>
  )
}
