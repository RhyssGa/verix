/**
 * Calculs de reporting : moyenne groupe, deltas, agrégation anomalies.
 */

import { getQuarter, getPreviousQuarter, sameQuarter, type QuarterRef, type Quarter } from './quarters'

function scoreToNiveau(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 85) return 'Bien'
  if (score >= 80) return 'Satisfaisant'
  if (score >= 70) return 'Attention'
  if (score >= 60) return 'Vigilance'
  return 'Dégradé'
}

export interface ReportingEntry {
  id: string
  batchId: string
  timestamp: string
  agence: string
  mode: 'gerance' | 'copro'
  scoreGlobal: number
  niveau: string
  nbAnomalies: number
  totalPenalite: number
  metrics: Record<string, { nb?: number; montant?: number; penalite?: number }>
}

export interface AgencyRow {
  agence: string
  scoreGlobal: number
  niveau: string
  nbAnomalies: number
  totalPenalite: number
  deltaGroupe: number | null   // score - moyenneGroupe
  deltaPrev: number | null     // score - score Q précédent
  timestamp: string
}

export interface TrendRow {
  agence: string
  scores: Record<number, number | null> // quarter (1-4) → score | null
}

export interface AnomalyAggregate {
  id: string
  totalNb: number
  totalMontant: number
  totalPenalite: number
  agenceCount: number // nb d'agences concernées (nb > 0)
}

/**
 * Filtre les entrées d'une liste selon le trimestre et le mode.
 * Si plusieurs audits pour la même agence dans le même trimestre,
 * on garde le plus récent (par timestamp).
 */
export function filterByQuarter(
  entries: ReportingEntry[],
  quarter: QuarterRef,
  mode: 'gerance' | 'copro',
): ReportingEntry[] {
  const filtered = entries.filter(
    (e) => e.mode === mode && sameQuarter(getQuarter(new Date(e.timestamp)), quarter),
  )

  // Déduplique par agence — garde le plus récent
  const byAgence = new Map<string, ReportingEntry>()
  for (const e of filtered) {
    const existing = byAgence.get(e.agence)
    if (!existing || e.timestamp > existing.timestamp) {
      byAgence.set(e.agence, e)
    }
  }
  return Array.from(byAgence.values())
}

/** Calcule la moyenne groupe (null si aucun audit). */
export function computeGroupAvg(entries: ReportingEntry[]): number | null {
  if (entries.length === 0) return null
  const sum = entries.reduce((acc, e) => acc + e.scoreGlobal, 0)
  return Math.round((sum / entries.length) * 10) / 10
}

/** Formate un delta avec signe : "+3.5" ou "−2.0" ou "0.0". */
export function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta.toFixed(1)}`
  if (delta < 0) return `−${Math.abs(delta).toFixed(1)}`
  return '0.0'
}

/**
 * Construit les lignes du tableau agences pour le trimestre sélectionné.
 */
export function buildAgencyRows(
  current: ReportingEntry[],
  allEntries: ReportingEntry[],
  quarter: QuarterRef,
  mode: 'gerance' | 'copro',
): AgencyRow[] {
  const groupAvg = computeGroupAvg(current)
  const prevQuarter = getPreviousQuarter(quarter)
  const previous = filterByQuarter(allEntries, prevQuarter, mode)
  const prevByAgence = new Map(previous.map((e) => [e.agence, e]))

  return current
    .map((e) => {
      const deltaGroupe = groupAvg !== null ? Math.round((e.scoreGlobal - groupAvg) * 10) / 10 : null
      const prevEntry = prevByAgence.get(e.agence)
      const deltaPrev = prevEntry
        ? Math.round((e.scoreGlobal - prevEntry.scoreGlobal) * 10) / 10
        : null

      return {
        agence: e.agence,
        scoreGlobal: e.scoreGlobal,
        niveau: scoreToNiveau(e.scoreGlobal),
        nbAnomalies: e.nbAnomalies,
        totalPenalite: e.totalPenalite,
        deltaGroupe,
        deltaPrev,
        timestamp: e.timestamp,
      }
    })
    .sort((a, b) => b.scoreGlobal - a.scoreGlobal)
}

/**
 * Construit les lignes d'évolution trimestrielle (une ligne par agence, 4 colonnes Q1-Q4).
 */
export function buildTrendRows(
  allEntries: ReportingEntry[],
  year: number,
  mode: 'gerance' | 'copro',
): TrendRow[] {
  const agences = new Set<string>()
  const scoresByAgenceAndQuarter = new Map<string, Map<number, number>>()

  for (const q of [1, 2, 3, 4] as const) {
    const entries = filterByQuarter(allEntries, { year, quarter: q }, mode)
    for (const e of entries) {
      agences.add(e.agence)
      if (!scoresByAgenceAndQuarter.has(e.agence)) {
        scoresByAgenceAndQuarter.set(e.agence, new Map())
      }
      scoresByAgenceAndQuarter.get(e.agence)!.set(q, e.scoreGlobal)
    }
  }

  return Array.from(agences)
    .map((agence) => {
      const qMap = scoresByAgenceAndQuarter.get(agence) ?? new Map()
      return {
        agence,
        scores: {
          1: qMap.get(1) ?? null,
          2: qMap.get(2) ?? null,
          3: qMap.get(3) ?? null,
          4: qMap.get(4) ?? null,
        },
      }
    })
    .sort((a, b) => a.agence.localeCompare(b.agence))
}

export interface CumulatedRow {
  agence: string
  scoreGlobal: number
  niveau: string
  nbAnomalies: number
  totalPenalite: number
  deltaGroupe: number | null
  year: number
  quarter: Quarter
  timestamp: string
}

/**
 * Vue cumulée : toutes les entrées (par mode, optionnellement filtrées par année).
 * Une ligne par (agence, year, quarter) — garde le plus récent si doublons.
 */
export function buildCumulatedRows(
  allEntries: ReportingEntry[],
  mode: 'gerance' | 'copro',
  filterYear?: number,
): CumulatedRow[] {
  const grouped = new Map<string, { entry: ReportingEntry; year: number; quarter: Quarter }>()

  for (const e of allEntries) {
    if (e.mode !== mode) continue
    const q = getQuarter(new Date(e.timestamp))
    if (filterYear !== undefined && q.year !== filterYear) continue
    const key = `${e.agence}__${q.year}__${q.quarter}`
    const existing = grouped.get(key)
    if (!existing || e.timestamp > existing.entry.timestamp) {
      grouped.set(key, { entry: e, year: q.year, quarter: q.quarter })
    }
  }

  const all = Array.from(grouped.values())
  const groupAvg = all.length > 0
    ? Math.round((all.reduce((s, x) => s + x.entry.scoreGlobal, 0) / all.length) * 10) / 10
    : null

  return all
    .map(({ entry, year, quarter }) => ({
      agence: entry.agence,
      scoreGlobal: entry.scoreGlobal,
      niveau: scoreToNiveau(entry.scoreGlobal),
      nbAnomalies: entry.nbAnomalies,
      totalPenalite: entry.totalPenalite,
      deltaGroupe: groupAvg !== null ? Math.round((entry.scoreGlobal - groupAvg) * 10) / 10 : null,
      year,
      quarter,
      timestamp: entry.timestamp,
    }))
    .sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year
      if (b.quarter !== a.quarter) return b.quarter - a.quarter
      return b.scoreGlobal - a.scoreGlobal
    })
}

/**
 * Agrège les métriques par type d'anomalie sur toutes les entrées.
 */
export function buildAnomalyAggregates(entries: ReportingEntry[]): AnomalyAggregate[] {
  const acc = new Map<string, AnomalyAggregate>()

  for (const e of entries) {
    for (const [id, metric] of Object.entries(e.metrics ?? {})) {
      if (!acc.has(id)) {
        acc.set(id, { id, totalNb: 0, totalMontant: 0, totalPenalite: 0, agenceCount: 0 })
      }
      const agg = acc.get(id)!
      agg.totalNb += metric.nb ?? 0
      agg.totalMontant += metric.montant ?? 0
      agg.totalPenalite += metric.penalite ?? 0
      if ((metric.nb ?? 0) > 0) agg.agenceCount++
    }
  }

  return Array.from(acc.values()).sort((a, b) => b.totalPenalite - a.totalPenalite)
}
