import { useCallback } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { useScoredGerance, useScoredCopro, useScore } from '@/stores/computed'
import { normalizeAgency, getAnnotation } from '@/lib/utils/helpers'
import { INFO_CATEGORY_IDS } from '@/constants/infoCids'
import { buildPDFPayload } from '@/lib/report/pdf'
import type { ExcelRow } from '@/types/audit'

type ColDef = {
  header: string
  fn: (row: ExcelRow, noteColumn: number | null) => string
  right?: boolean
}

export function useExport() {
  const scoredGerance = useScoredGerance()
  const scoredCopro = useScoredCopro()
  const score = useScore()

  const exportXlsx = useCallback(
    (
      filename: string,
      sheetTitle: string,
      categoryId: string,
      rows: ExcelRow[],
      nameFn: (row: ExcelRow) => string,
      valFn: (row: ExcelRow) => number,
      subFn: ((row: ExcelRow) => string) | null,
      cols?: ColDef[],
      noteColumn?: number | null,
    ) => {
      const XLSX = require('xlsx') as typeof import('xlsx')
      const state = useAuditStore.getState()
      const isInfoExport = INFO_CATEGORY_IDS.has(categoryId)

      const data = rows.map((row, index) => {
        const annotation = getAnnotation(state.annotations, categoryId, index)
        let exportRow: Record<string, string | number>

        if (cols) {
          exportRow = {}
          cols.forEach((col) => {
            exportRow[col.header] = col.fn(row, noteColumn ?? null)
          })
        } else {
          exportRow = { Libellé: nameFn(row), Montant: valFn(row) }
          if (subFn) exportRow['Détail'] = subFn(row)
        }

        if (annotation.comment) exportRow['Note auditeur'] = annotation.comment
        if (!isInfoExport) {
          exportRow['Statut'] = annotation.include ? 'Injustifié' : 'Justifié'
        }
        return exportRow
      })

      const worksheet = XLSX.utils.json_to_sheet(data)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle.slice(0, 31))
      const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const anchor = document.createElement('a')
      anchor.href = URL.createObjectURL(blob)
      anchor.download = filename + '.xlsx'
      anchor.click()
    },
    [],
  )

  const generateReport = useCallback(async () => {
    if (!score) return
    const state = useAuditStore.getState()
    if (state.isGeneratingPdf) return

    state.setIsGeneratingPdf(true)

    const uniqueGroupNames = Array.from(
      new Set(state.reportAgencies.map((a) => normalizeAgency(a))),
    ).filter(Boolean)
    const agencyLabel =
      uniqueGroupNames.length > 0
        ? uniqueGroupNames.join(' + ')
        : state.selectedAgency
          ? normalizeAgency(state.selectedAgency)
          : state.reportAgencies[0] || ''

    const sortedCurrentNorms = [...uniqueGroupNames].sort()
    const agencySetsMatch = (entryAgency: string) => {
      const entryNorms = entryAgency
        .split(' + ')
        .map((s) => s.trim())
        .sort()
      if (entryNorms.length !== sortedCurrentNorms.length) return false
      return entryNorms.every((n, i) => n === sortedCurrentNorms[i])
    }

    const eligible = state.reportHistory
      .filter(
        (entry) =>
          (entry.status ?? 'valid') === 'valid' &&
          entry.batchId !== state.sessionBatchId &&
          entry.mode === state.mode &&
          agencySetsMatch(entry.agence),
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    const lastImport = state.comparisonEnabled
      ? state.comparisonRefId
        ? eligible.find((e) => e.id === state.comparisonRefId) ?? eligible[0] ?? null
        : eligible[0] ?? null
      : null

    const payload = buildPDFPayload(
      state.mode,
      scoredGerance,
      scoredCopro,
      score,
      state.annotations,
      state.sectionNotes,
      {
        agence: agencyLabel,
        garantie: state.guarantee,
        pointe: state.peak,
        pointeDate: state.peakDate,
        dateDebut: state.startDate,
        dateFin: state.endDate,
        nbMandats: state.mandateCount,
      },
      lastImport,
    )

    // Filter non-closed reconciliations
    if (payload.bqNonClot) {
      payload.bqNonClot = payload.bqNonClot.filter(
        (item) => state.nonClosedIncluded[item.name] !== false,
      )
      const nonClosedSection = payload.sections?.find((s) => s.id === 'bq_nonclot')
      if (nonClosedSection) {
        nonClosedSection.rows = nonClosedSection.rows.filter(
          (row) => state.nonClosedIncluded[row.name] !== false,
        )
        const count = nonClosedSection.rows.length
        nonClosedSection.mainStat = String(count)
        nonClosedSection.subtitle =
          count === 0
            ? 'Aucun rapprochement non clôturé'
            : `${count} compte(s) · absent ou en cours`
      }
    }

    try {
      const response = await fetch('/api/rapport/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(await response.text())

      const blob = await response.blob()
      const anchor = document.createElement('a')
      anchor.href = URL.createObjectURL(blob)
      const slug = agencyLabel.replace(/[^a-zA-Z0-9]/g, '_') || 'agence'
      anchor.download = `Rapport_Audit_${
        state.mode === 'gerance' ? 'Gerance' : 'Copro'
      }_${slug}.pdf`
      anchor.click()
    } catch (error) {
      console.error('Error generating report', error)
      const detail = error instanceof Error ? error.message : String(error)
      alert(`Erreur lors de la génération du rapport PDF.\n\n${detail}`)
    } finally {
      useAuditStore.getState().setIsGeneratingPdf(false)
    }
  }, [score, scoredGerance, scoredCopro])

  const generateReportV2 = useCallback(async () => {
    if (!score) return
    const state = useAuditStore.getState()
    if (state.isGeneratingPdf) return

    state.setIsGeneratingPdf(true)

    const uniqueGroupNames = Array.from(
      new Set(state.reportAgencies.map((a) => normalizeAgency(a))),
    ).filter(Boolean)
    const agencyLabel =
      uniqueGroupNames.length > 0
        ? uniqueGroupNames.join(' + ')
        : state.selectedAgency
          ? normalizeAgency(state.selectedAgency)
          : state.reportAgencies[0] || ''

    const sortedCurrentNorms = [...uniqueGroupNames].sort()
    const agencySetsMatch = (entryAgency: string) => {
      const entryNorms = entryAgency.split(' + ').map((s) => s.trim()).sort()
      if (entryNorms.length !== sortedCurrentNorms.length) return false
      return entryNorms.every((n, i) => n === sortedCurrentNorms[i])
    }

    const eligible = state.reportHistory
      .filter(
        (entry) =>
          (entry.status ?? 'valid') === 'valid' &&
          entry.batchId !== state.sessionBatchId &&
          entry.mode === state.mode &&
          agencySetsMatch(entry.agence),
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    const lastImport = state.comparisonEnabled
      ? state.comparisonRefId
        ? eligible.find((e) => e.id === state.comparisonRefId) ?? eligible[0] ?? null
        : eligible[0] ?? null
      : null

    const payload = buildPDFPayload(
      state.mode,
      scoredGerance,
      scoredCopro,
      score,
      state.annotations,
      state.sectionNotes,
      {
        agence: agencyLabel,
        garantie: state.guarantee,
        pointe: state.peak,
        pointeDate: state.peakDate,
        dateDebut: state.startDate,
        dateFin: state.endDate,
        nbMandats: state.mandateCount,
      },
      lastImport,
    )

    if (payload.bqNonClot) {
      payload.bqNonClot = payload.bqNonClot.filter(
        (item) => state.nonClosedIncluded[item.name] !== false,
      )
      const nonClosedSection = payload.sections?.find((s) => s.id === 'bq_nonclot')
      if (nonClosedSection) {
        nonClosedSection.rows = nonClosedSection.rows.filter(
          (row) => state.nonClosedIncluded[row.name] !== false,
        )
        const count = nonClosedSection.rows.length
        nonClosedSection.mainStat = String(count)
        nonClosedSection.subtitle =
          count === 0 ? 'Aucun rapprochement non clôturé' : `${count} compte(s) · absent ou en cours`
      }
    }

    try {
      const response = await fetch('/api/rapport/pdf-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(await response.text())

      const blob = await response.blob()
      const anchor = document.createElement('a')
      anchor.href = URL.createObjectURL(blob)
      const slug = agencyLabel.replace(/[^a-zA-Z0-9]/g, '_') || 'agence'
      anchor.download = `Rapport_Audit_V2_${state.mode === 'gerance' ? 'Gerance' : 'Copro'}_${slug}.pdf`
      anchor.click()
    } catch (error) {
      console.error('Error generating V2 report', error)
      const detail = error instanceof Error ? error.message : String(error)
      alert(`Erreur lors de la génération du rapport PDF V2.\n\n${detail}`)
    } finally {
      useAuditStore.getState().setIsGeneratingPdf(false)
    }
  }, [score, scoredGerance, scoredCopro])

  return { exportXlsx, generateReport, generateReportV2 }
}
