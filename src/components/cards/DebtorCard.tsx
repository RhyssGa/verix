'use client'

import type { AnomalyResult, ExcelRow } from '@/types/audit'
import { AnomalyCard } from './AnomalyCard'
import { eur } from '@/lib/utils/format'

interface DebtorCardProps {
  icon: string
  iconColor?: string
  label: string
  subtitle: string
  categoryId: string
  sectionNoteId: string
  rows: ExcelRow[]
  nameFn: (row: ExcelRow) => string
  amountFn: (row: ExcelRow) => number
  subFn?: ((row: ExcelRow) => string) | null
  totalLabel?: string
  countLabel?: string
  infoOnly?: boolean
  emptyMessage?: string
  anomaly?: AnomalyResult | null
  noteColumn?: number | null
  onViewMore?: () => void
  onExport?: () => void
  scoreId?: string
}

export function DebtorCard({
  icon,
  iconColor,
  label,
  subtitle,
  categoryId,
  sectionNoteId,
  rows,
  nameFn,
  amountFn,
  subFn,
  totalLabel = 'Montant total',
  countLabel = 'compte(s)',
  infoOnly = false,
  emptyMessage,
  anomaly,
  noteColumn,
  onViewMore,
  onExport,
  scoreId,
}: DebtorCardProps) {
  const total = rows.reduce((sum, r) => sum + Math.abs(amountFn(r)), 0)
  const level = infoOnly ? 'info' : rows.length === 0 ? 'ok' : 'bad'
  const valClass = infoOnly ? 'text-status-info' : 'text-status-red'

  const kvRows =
    rows.length > 0
      ? [
          {
            label: totalLabel,
            value: eur(total, 2),
            valueClass: infoOnly ? 'text-status-info' : rows.length > 0 ? 'text-status-red' : 'text-status-green',
          },
        ]
      : undefined

  return (
    <AnomalyCard
      icon={icon}
      iconColor={iconColor}
      label={label}
      subtitle={subtitle}
      level={level}
      mainStat={rows.length}
      mainStatLabel={countLabel}
      sectionNoteId={sectionNoteId}
      categoryId={categoryId}
      rows={rows}
      maxPreview={4}
      nameFn={nameFn}
      valFn={amountFn}
      valFormatFn={(r) => eur(Math.abs(amountFn(r)), 2)}
      valClass={valClass}
      subFn={subFn}
      anomaly={anomaly}
      infoOnly={infoOnly}
      emptyMessage={emptyMessage}
      kvRows={kvRows}
      onViewMore={onViewMore}
      onExport={onExport}
      noteColumn={noteColumn}
      data-score-id={scoreId}
    />
  )
}
