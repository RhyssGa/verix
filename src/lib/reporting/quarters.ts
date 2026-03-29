/**
 * Logique trimestre avec ±30 jours de tolérance.
 *
 * Les audits sont trimestriels (fin mars / juin / septembre / décembre).
 * Avec ±30 jours, un audit déposé début avril compte toujours comme Q1.
 *
 * Découpage (bornes incluses) :
 *   Q1 : 1 jan  → 29 avr
 *   Q2 : 30 avr → 29 jul
 *   Q3 : 30 jul → 29 oct
 *   Q4 : 30 oct → 29 jan (déborde sur année+1)
 */

export type Quarter = 1 | 2 | 3 | 4

export interface QuarterRef {
  year: number
  quarter: Quarter
}

/**
 * Rattache une date à son trimestre d'audit (tolérance ±30 j).
 * Les dates du 1er jan au 29 jan appartiennent au Q4 de l'année précédente.
 */
export function getQuarter(date: Date): QuarterRef {
  const month = date.getMonth() + 1 // 1-12
  const day = date.getDate()
  const year = date.getFullYear()

  // Jan 1 → Jan 29 → Q4 de l'année précédente
  if (month === 1 && day <= 29) {
    return { year: year - 1, quarter: 4 }
  }
  // Jan 30 → Apr 29 → Q1
  if (month < 4 || (month === 4 && day <= 29)) {
    return { year, quarter: 1 }
  }
  // Apr 30 → Jul 29 → Q2
  if (month < 7 || (month === 7 && day <= 29)) {
    return { year, quarter: 2 }
  }
  // Jul 30 → Oct 29 → Q3
  if (month < 10 || (month === 10 && day <= 29)) {
    return { year, quarter: 3 }
  }
  // Oct 30 → Dec 31 → Q4
  return { year, quarter: 4 }
}

/** Trimestre précédent (Q1 → Q4 de l'année précédente). */
export function getPreviousQuarter({ year, quarter }: QuarterRef): QuarterRef {
  if (quarter === 1) return { year: year - 1, quarter: 4 }
  return { year, quarter: (quarter - 1) as Quarter }
}

/** Libellé affiché : "Q1 2025". */
export function quarterLabel({ year, quarter }: QuarterRef): string {
  return `Q${quarter} ${year}`
}

/** Retourne true si deux QuarterRef représentent le même trimestre. */
export function sameQuarter(a: QuarterRef, b: QuarterRef): boolean {
  return a.year === b.year && a.quarter === b.quarter
}

/**
 * Déduit les années disponibles depuis une liste de timestamps ISO.
 * Tient compte du fait que les dates jan 1-29 appartiennent au Q4 précédent.
 */
export function getAvailableYears(timestamps: string[]): number[] {
  const years = new Set<number>()
  for (const ts of timestamps) {
    const q = getQuarter(new Date(ts))
    years.add(q.year)
  }
  return Array.from(years).sort((a, b) => b - a) // décroissant
}
