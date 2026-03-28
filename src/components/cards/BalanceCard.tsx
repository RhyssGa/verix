'use client'

import type { AnomalyResult, ExcelRow } from '@/types/audit'
import { AnomalyCard } from './AnomalyCard'
import { computeSeverityLevel } from '@/lib/utils/helpers'
import { eur } from '@/lib/utils/format'

interface BalanceCardProps {
  rows: ExcelRow[]
  anomaly?: AnomalyResult | null
  onViewMore?: () => void
  onExport?: () => void
}

export function BalanceCard({ rows, anomaly, onViewMore, onExport }: BalanceCardProps) {
  const total = rows.reduce(
    (sum, r) => sum + Math.abs(parseFloat(String(r[7] ?? 0)) || 0),
    0,
  )
  const level = rows.length === 0 ? 'ok' : computeSeverityLevel(rows.length, total)

  return (
    <AnomalyCard
      icon="⚖️"
      iconColor="bg-status-red-bg"
      label="Balance déséquilibrée"
      subtitle="Écarts de balance détectés"
      level={level}
      mainStat={rows.length}
      mainStatLabel="balance(s) déséquilibrée(s)"
      sectionNoteId="balance"
      categoryId="balance"
      rows={rows}
      maxPreview={4}
      nameFn={(r) => String(r[3] || r[1] || '—')}
      valFn={(r) => Math.abs(parseFloat(String(r[7] ?? 0)) || 0)}
      valFormatFn={(r) => eur(Math.abs(parseFloat(String(r[7] ?? 0)) || 0), 2)}
      valClass="text-status-red"
      anomaly={anomaly}
      emptyMessage="✓ Aucune balance déséquilibrée"
      kvRows={
        rows.length > 0
          ? [{ label: 'Écart cumulé', value: eur(total, 2), valueClass: 'text-status-red' }]
          : undefined
      }
      onViewMore={onViewMore}
      onExport={onExport}
      data-score-id="balance"
    />
  )
}
