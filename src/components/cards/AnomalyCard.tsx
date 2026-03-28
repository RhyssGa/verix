'use client'

import type { AnomalyResult, ExcelRow } from '@/types/audit'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SectionNote } from '@/components/shared/SectionNote'
import { ScoreDetail } from '@/components/shared/ScoreDetail'
import { MiniListItem } from './MiniListItem'
import { cn } from '@/lib/utils'

type ColDef = {
  header: string
  fn: (row: ExcelRow, noteColumn: number | null) => string
  right?: boolean
}

interface AnomalyCardProps {
  icon: string
  iconColor?: string
  label: string
  subtitle: string
  level: string
  mainStat: string | number
  mainStatLabel: string
  sectionNoteId: string
  categoryId: string
  rows: ExcelRow[]
  maxPreview?: number
  nameFn: (row: ExcelRow) => string
  valFn: (row: ExcelRow) => number
  valFormatFn: (row: ExcelRow) => string
  valClass?: string
  subFn?: ((row: ExcelRow) => string) | null
  anomaly?: AnomalyResult | null
  infoOnly?: boolean
  emptyMessage?: string
  children?: React.ReactNode
  kvRows?: { label: string; value: string; valueClass?: string }[]
  onViewMore?: () => void
  onExport?: () => void
  cols?: ColDef[]
  noteColumn?: number | null
  extraContent?: React.ReactNode
  'data-score-id'?: string
}

export function AnomalyCard({
  icon,
  iconColor = 'bg-status-info-bg',
  label,
  subtitle,
  level,
  mainStat,
  mainStatLabel,
  sectionNoteId,
  categoryId,
  rows,
  maxPreview = 3,
  nameFn,
  valFn,
  valFormatFn,
  valClass = 'text-status-red',
  subFn,
  anomaly,
  infoOnly = false,
  emptyMessage = '✓ Aucune anomalie',
  children,
  kvRows,
  onViewMore,
  onExport,
  extraContent,
  'data-score-id': scoreId,
}: AnomalyCardProps) {
  return (
    <Card
      className={cn('shadow-card', infoOnly && 'border-status-info/20')}
      data-score-id={scoreId}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center text-lg',
              iconColor,
            )}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{label}</div>
            <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>
          </div>
          <StatusBadge level={level} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {infoOnly && (
          <div className="text-[11px] text-status-info bg-status-info-bg rounded px-2 py-1 mb-2">
            ℹ Information uniquement — hors logique d&apos;anomalie et de score.
          </div>
        )}

        <div className="mb-2">
          <span
            className={cn(
              'text-2xl font-bold',
              level === 'ok' && 'text-status-green',
              level === 'warn' && 'text-status-orange',
              level === 'bad' && 'text-status-red',
              level === 'info' && 'text-status-info',
            )}
          >
            {mainStat}
          </span>
          <span className="text-[11px] text-muted-foreground ml-1.5">{mainStatLabel}</span>
        </div>

        {kvRows && kvRows.length > 0 && (
          <>
            <div className="border-t border-border my-2" />
            {kvRows.map((kv, index) => (
              <div key={index} className="flex items-center justify-between text-xs py-0.5">
                <span className="text-muted-foreground">{kv.label}</span>
                <span className={cn('font-medium', kv.valueClass)}>{kv.value}</span>
              </div>
            ))}
          </>
        )}

        {rows.length > 0 ? (
          <>
            <div className="border-t border-border my-2" />
            <div>
              {rows.slice(0, maxPreview).map((row, index) => (
                <MiniListItem
                  key={index}
                  categoryId={categoryId}
                  index={index}
                  name={nameFn(row)}
                  value={valFormatFn(row)}
                  valueClass={valClass}
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
                  Voir plus ({rows.length})
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
        ) : (
          <div className="text-xs text-status-green pt-1">{emptyMessage}</div>
        )}

        {anomaly && <ScoreDetail anomaly={anomaly} />}

        {extraContent}
        {children}

        <SectionNote sectionId={sectionNoteId} />
      </CardContent>
    </Card>
  )
}
