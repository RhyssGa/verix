import { useMemo } from 'react'
import { useAuditStore } from './useAuditStore'
import type { GeranceData, CoproData, ExcelRow, ScoreResult } from '@/types/audit'
import { EMPTY_GERANCE, EMPTY_COPRO } from '@/constants/emptyData'
import { normalizeAgency, filterByAgency } from '@/lib/utils/helpers'
import { computeScoreGerance, computeScoreCopro } from '@/lib/scoring/engine'

const EMPTY_ROWS: ExcelRow[] = []

/** Whether agency selection mode is active (Z files loaded) */
export function useAgencySelectMode(): boolean {
  return useAuditStore((s) => s.agencies.length > 0)
}

/** Gerance data filtered by selected agencies */
export function useFilteredGerance(): GeranceData {
  const geranceData = useAuditStore((s) => s.geranceData)
  const agencies = useAuditStore((s) => s.agencies)
  const reportAgencies = useAuditStore((s) => s.reportAgencies)

  return useMemo(() => {
    if (!geranceData) return { ...EMPTY_GERANCE }
    const agencySelectMode = agencies.length > 0
    if (agencySelectMode && reportAgencies.length === 0) return { ...EMPTY_GERANCE }
    if (reportAgencies.length === 0) return geranceData

    const normalizedAgencies = reportAgencies.map((a) => normalizeAgency(a))

    const quittancementRows = filterByAgency(geranceData.quittancement_rows ?? [], 0, normalizedAgencies)
    const quittancement = quittancementRows.reduce(
      (sum, row) => sum + (row[7] != null && !isNaN(Number(row[7])) ? parseFloat(String(row[7])) : 0), 0,
    )
    const encaissement = quittancementRows.reduce(
      (sum, row) => sum + (row[8] != null && !isNaN(Number(row[8])) ? parseFloat(String(row[8])) : 0), 0,
    )

    return {
      ...geranceData,
      quittancement_rows: quittancementRows,
      quittancement,
      encaissement,
      prop_deb: filterByAgency(geranceData.prop_deb, 0, normalizedAgencies),
      prop_deb_sorti: filterByAgency(geranceData.prop_deb_sorti ?? [], 0, normalizedAgencies),
      prop_cred: filterByAgency(geranceData.prop_cred, 0, normalizedAgencies),
      att_deb: filterByAgency(geranceData.att_deb, 0, normalizedAgencies),
      bq_nonrapp: filterByAgency(geranceData.bq_nonrapp, 1, normalizedAgencies),
      bq_nonclot: filterByAgency(geranceData.bq_nonclot ?? [], 1, normalizedAgencies),
      cpta_nonrapp: filterByAgency(geranceData.cpta_nonrapp, 1, normalizedAgencies),
      factures: filterByAgency(geranceData.factures, 1, normalizedAgencies),
      factures_nr30: filterByAgency(geranceData.factures_nr30, 1, normalizedAgencies),
      factures_nr60: filterByAgency(geranceData.factures_nr60, 1, normalizedAgencies),
    }
  }, [geranceData, agencies, reportAgencies])
}

/** Copro data filtered by selected agencies */
export function useFilteredCopro(): CoproData {
  const coproData = useAuditStore((s) => s.coproData)
  const agencies = useAuditStore((s) => s.agencies)
  const reportAgencies = useAuditStore((s) => s.reportAgencies)

  return useMemo(() => {
    if (!coproData) return { ...EMPTY_COPRO }
    const agencySelectMode = agencies.length > 0
    if (agencySelectMode && reportAgencies.length === 0) return { ...EMPTY_COPRO }
    if (reportAgencies.length === 0) return coproData

    const normalizedAgencies = reportAgencies.map((a) => normalizeAgency(a))

    return {
      ...coproData,
      balance_bad: filterByAgency(coproData.balance_bad, 0, normalizedAgencies),
      att_deb: filterByAgency(coproData.att_deb, 0, normalizedAgencies),
      att_cred: filterByAgency(coproData.att_cred, 0, normalizedAgencies),
      ventes_deb: filterByAgency(coproData.ventes_deb, 0, normalizedAgencies),
      ventes_cred: filterByAgency(coproData.ventes_cred, 0, normalizedAgencies),
      fourn_deb: filterByAgency(coproData.fourn_deb, 0, normalizedAgencies),
      bq_nonrapp: filterByAgency(coproData.bq_nonrapp, 0, normalizedAgencies),
      bq_nonclot: filterByAgency(coproData.bq_nonclot ?? [], 0, normalizedAgencies),
      cpta_nonrapp: filterByAgency(coproData.cpta_nonrapp, 0, normalizedAgencies),
      factures: filterByAgency(coproData.factures, 1, normalizedAgencies),
      factures_nr30: filterByAgency(coproData.factures_nr30, 1, normalizedAgencies),
      factures_nr60: filterByAgency(coproData.factures_nr60, 1, normalizedAgencies),
      bilan: filterByAgency(coproData.bilan, 0, normalizedAgencies),
    }
  }, [coproData, agencies, reportAgencies])
}

/** Gerance data with forcedOk overrides applied */
export function useScoredGerance(): GeranceData {
  const filtered = useFilteredGerance()
  const forcedOk = useAuditStore((s) => s.forcedOk)
  const loadedFiles = useAuditStore((s) => s.loadedFiles)

  return useMemo(() => ({
    ...filtered,
    quittancement: (forcedOk['quittancement'] && !loadedFiles['quittancement']) ? 0 : filtered.quittancement,
    encaissement: (forcedOk['quittancement'] && !loadedFiles['quittancement']) ? 0 : filtered.encaissement,
    factures: (forcedOk['factures'] && !loadedFiles['factures']) ? EMPTY_ROWS : filtered.factures,
    factures_nr30: (forcedOk['factures'] && !loadedFiles['factures']) ? EMPTY_ROWS : filtered.factures_nr30,
    factures_nr60: (forcedOk['factures'] && !loadedFiles['factures']) ? EMPTY_ROWS : filtered.factures_nr60,
    prop_deb: (forcedOk['prop_deb'] && !loadedFiles['prop_deb']) ? EMPTY_ROWS : filtered.prop_deb,
    prop_deb_sorti: (forcedOk['prop_deb'] && !loadedFiles['prop_deb']) ? EMPTY_ROWS : filtered.prop_deb_sorti ?? EMPTY_ROWS,
    prop_cred: (forcedOk['prop_cred'] && !loadedFiles['prop_cred']) ? EMPTY_ROWS : filtered.prop_cred,
    att_deb: (forcedOk['att_deb'] && !loadedFiles['att_deb']) ? EMPTY_ROWS : filtered.att_deb,
    bq_nonrapp: (forcedOk['bq_nonrapp'] && !loadedFiles['bq_nonrapp']) ? EMPTY_ROWS : filtered.bq_nonrapp,
    cpta_nonrapp: (forcedOk['cpta_nonrapp'] && !loadedFiles['cpta_nonrapp']) ? EMPTY_ROWS : filtered.cpta_nonrapp,
  }), [filtered, forcedOk, loadedFiles])
}

/** Copro data with forcedOk overrides applied */
export function useScoredCopro(): CoproData {
  const filtered = useFilteredCopro()
  const forcedOk = useAuditStore((s) => s.forcedOk)
  const loadedFiles = useAuditStore((s) => s.loadedFiles)

  return useMemo(() => ({
    ...filtered,
    balance_bad: (forcedOk['balance'] && !loadedFiles['balance']) ? EMPTY_ROWS : filtered.balance_bad,
    att_deb: (forcedOk['att_deb'] && !loadedFiles['att_deb']) ? EMPTY_ROWS : filtered.att_deb,
    att_cred: (forcedOk['att_cred'] && !loadedFiles['att_cred']) ? EMPTY_ROWS : filtered.att_cred,
    ventes_deb: (forcedOk['ventes'] && !loadedFiles['ventes']) ? EMPTY_ROWS : filtered.ventes_deb,
    ventes_cred: (forcedOk['ventes'] && !loadedFiles['ventes']) ? EMPTY_ROWS : filtered.ventes_cred,
    fourn_deb: (forcedOk['fourn_deb'] && !loadedFiles['fourn_deb']) ? EMPTY_ROWS : filtered.fourn_deb,
    factures: (forcedOk['factures'] && !loadedFiles['factures']) ? EMPTY_ROWS : filtered.factures,
    factures_nr30: (forcedOk['factures'] && !loadedFiles['factures']) ? EMPTY_ROWS : filtered.factures_nr30,
    factures_nr60: (forcedOk['factures'] && !loadedFiles['factures']) ? EMPTY_ROWS : filtered.factures_nr60,
    bq_nonrapp: (forcedOk['bq_nonrapp'] && !loadedFiles['bq_nonrapp']) ? EMPTY_ROWS : filtered.bq_nonrapp,
    cpta_nonrapp: (forcedOk['cpta_nonrapp'] && !loadedFiles['cpta_nonrapp']) ? EMPTY_ROWS : filtered.cpta_nonrapp,
    bilan: (forcedOk['bilan'] && !loadedFiles['bilan']) ? EMPTY_ROWS : filtered.bilan,
  }), [filtered, forcedOk, loadedFiles])
}

/** Computed audit score */
export function useScore(): ScoreResult | null {
  const mode = useAuditStore((s) => s.mode)
  const scoredGerance = useScoredGerance()
  const scoredCopro = useScoredCopro()
  const guarantee = useAuditStore((s) => s.guarantee)
  const mandateCount = useAuditStore((s) => s.mandateCount)
  const annotations = useAuditStore((s) => s.annotations)
  const forcedOk = useAuditStore((s) => s.forcedOk)
  const geranceData = useAuditStore((s) => s.geranceData)
  const coproData = useAuditStore((s) => s.coproData)
  const peak = useAuditStore((s) => s.peak)
  const agencySelectMode = useAgencySelectMode()
  const reportAgencies = useAuditStore((s) => s.reportAgencies)

  return useMemo(() => {
    // Check if we have any data to score
    const hasData = (() => {
      if (Object.values(forcedOk).some(Boolean)) return true
      if (guarantee > 0 || peak > 0) return true
      if (mode === 'gerance') {
        return (
          geranceData.quittancement > 0 ||
          geranceData.prop_deb.length > 0 ||
          geranceData.factures.length > 0 ||
          geranceData.bq_nonrapp.length > 0 ||
          geranceData.att_deb.length > 0
        )
      }
      return (
        coproData.balance_bad.length > 0 ||
        coproData.fourn_deb.length > 0 ||
        coproData.att_deb.length > 0 ||
        coproData.ventes_deb.length > 0 ||
        coproData.ventes_cred.length > 0 ||
        coproData.factures.length > 0 ||
        coproData.bq_nonrapp.length > 0 ||
        coproData.bilan.length > 0
      )
    })()

    if (!hasData || (agencySelectMode && reportAgencies.length === 0)) return null

    return mode === 'gerance'
      ? computeScoreGerance(scoredGerance, guarantee, annotations, mandateCount)
      : computeScoreCopro(scoredCopro, guarantee, annotations)
  }, [
    mode, scoredGerance, scoredCopro, guarantee, mandateCount,
    annotations, forcedOk, geranceData, coproData, peak,
    agencySelectMode, reportAgencies,
  ])
}

/** Whether any data has been loaded */
export function useHasAnyData(): boolean {
  const score = useScore()
  return score !== null
}
