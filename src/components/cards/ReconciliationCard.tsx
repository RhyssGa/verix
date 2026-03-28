'use client'

import type { AnomalyResult, ExcelRow } from '@/types/audit'
import { AnomalyCard } from './AnomalyCard'
import { eur } from '@/lib/utils/format'
import { excelDateFmt } from '@/lib/utils/format'

interface ReconciliationCardProps {
  type: 'bq' | 'cpta'
  mode: 'gerance' | 'copro'
  rows: ExcelRow[]
  noteColumn?: number | null
  anomaly?: AnomalyResult | null
  onViewMore?: () => void
  onExport?: () => void
}

export function ReconciliationCard({
  type,
  mode,
  rows,
  noteColumn,
  anomaly,
  onViewMore,
  onExport,
}: ReconciliationCardProps) {
  const isBq = type === 'bq'

  // Column indices by type and mode
  const dateCol = isBq
    ? mode === 'gerance' ? 14 : 15
    : mode === 'gerance' ? 12 : 10
  const labelCol = isBq
    ? mode === 'gerance' ? 7 : 19
    : 14
  const labelFallbackCol = isBq ? undefined : mode === 'gerance' ? 6 : 0
  const amountCol = isBq
    ? mode === 'gerance' ? 15 : 18
    : 13
  const ageCol = isBq ? undefined : mode === 'gerance' ? 15 : 11

  const penalty = anomaly?.penalite ?? 0
  const level =
    rows.length === 0 ? 'ok' : penalty === 0 ? 'ok' : penalty <= 5 ? 'warn' : 'bad'

  // Max age for CPTA subtitle
  let ageMax: number | null = null
  if (!isBq && ageCol !== undefined && rows.length > 0) {
    const ages = rows.map((r) => {
      const v = parseFloat(String(r[ageCol] ?? ''))
      return isNaN(v) ? 0 : v
    })
    ageMax = Math.max(...ages)
  }

  const label = isBq ? 'Rapprochement Banque 512' : 'Rapprochement Compta'
  const subtitle = isBq
    ? 'Écritures non rapprochées · pénalité volume'
    : `Écritures non rapprochées${ageMax != null ? ` · Ancienneté max : ${ageMax} j` : ''}`
  const categoryId = isBq ? 'bqrapp' : 'cptarapp'
  const sectionNoteId = isBq ? 'bqrapp' : 'cptarapp'
  const scoreId = isBq ? 'bq_nonrapp' : 'cpta_nonrapp'
  const emptyMsg = isBq ? '✓ Banque à jour' : '✓ Compta à jour'

  const nameFn = (r: ExcelRow) =>
    `${excelDateFmt(r[dateCol])} · ${String(r[labelCol] || (labelFallbackCol !== undefined ? r[labelFallbackCol] : null) || '—')}`

  const amountFn = (r: ExcelRow) =>
    Math.abs(parseFloat(String(r[amountCol] ?? 0)) || 0)

  const subFn = (r: ExcelRow) => {
    const parts: string[] = []
    if (r[dateCol]) parts.push(excelDateFmt(r[dateCol]))
    if (!isBq && mode === 'copro' && r[1]) parts.push(String(r[1]))
    if (!isBq && ageCol !== undefined && r[ageCol] != null) parts.push(`${r[ageCol]} j`)
    if (!isBq && noteColumn != null && r[noteColumn]) parts.push(`Note : ${String(r[noteColumn])}`)
    return parts.filter(Boolean).join(' · ')
  }

  return (
    <AnomalyCard
      icon={isBq ? '🏦' : '📒'}
      label={label}
      subtitle={subtitle}
      level={level}
      mainStat={rows.length}
      mainStatLabel="écriture(s) non rapp."
      sectionNoteId={sectionNoteId}
      categoryId={categoryId}
      rows={rows}
      maxPreview={3}
      nameFn={nameFn}
      valFn={amountFn}
      valFormatFn={(r) => eur(amountFn(r), 2)}
      valClass="text-status-red"
      subFn={subFn}
      anomaly={anomaly}
      emptyMessage={emptyMsg}
      onViewMore={onViewMore}
      onExport={onExport}
      noteColumn={noteColumn}
      data-score-id={scoreId}
    />
  )
}
