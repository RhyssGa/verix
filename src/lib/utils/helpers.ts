import type { AnomalyLevel, ExcelRow, Annotation, AnnotationsMap } from '@/types/audit'

/**
 * Determines severity level based on count and amount.
 */
export function computeSeverityLevel(count: number, amount: number): AnomalyLevel {
  if (count === 0) return 'ok'
  let severity = 0
  if (amount > 50000) severity += 3
  else if (amount > 10000) severity += 2
  else if (amount > 2000) severity += 1
  if (count > 10) severity += 2
  else if (count > 3) severity += 1
  return severity >= 3 ? 'bad' : 'warn'
}

/**
 * Normalizes an agency name by removing prefix digits and suffix numbers.
 * e.g. "O1-AGENCE NAME – 3" → "AGENCE NAME"
 */
export function normalizeAgency(name: string): string {
  return name
    .replace(/^[A-Za-z]?\d+[-\s]+/, '')
    .replace(/\s*[-–—]\s*\d+\s*$/, '')
    .trim()
}

/**
 * Filters Excel rows by matching normalized agency names.
 */
export function filterByAgency<T extends ExcelRow>(
  rows: T[],
  column: number,
  normalizedAgencies: string[],
): T[] {
  return rows.filter(row =>
    normalizedAgencies.includes(normalizeAgency(String(row[column] ?? '').trim())),
  )
}

/**
 * Filters rows by a specific agency name.
 */
export function filterRowsByAgency<T extends ExcelRow>(
  rows: T[],
  column: number,
  agency: string,
): T[] {
  const normalized = normalizeAgency(agency)
  return rows.filter(row =>
    normalizeAgency(String(row[column] ?? '').trim()) === normalized,
  )
}

/**
 * Safely extracts a numeric value from an ExcelRow at the given index.
 */
export function getNumericValue(row: ExcelRow, index: number): number {
  const value = row[index]
  return typeof value === 'number' ? value : parseFloat(String(value ?? '')) || 0
}

/**
 * Builds an annotation key from category ID and row index.
 */
export function buildAnnotationKey(categoryId: string, index: number): string {
  return `${categoryId}_${index}`
}

/**
 * Gets the annotation for a specific row, or returns default.
 */
export function getAnnotation(
  annotations: AnnotationsMap,
  categoryId: string,
  index: number,
): Annotation {
  return annotations[buildAnnotationKey(categoryId, index)] || { comment: '', include: true }
}

/**
 * Formats an ISO timestamp to French date string (DD/MM/YYYY).
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Formats an ISO timestamp to French datetime string (DD/MM/YYYY HH:MM).
 */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return `${date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })} ${date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

/**
 * Returns the badge label text for a severity level.
 */
export function getBadgeLabel(level: string): string {
  if (level === 'ok') return '✓ OK'
  if (level === 'warn') return '⚠ Attention'
  if (level === 'bad') return '✗ Anomalie'
  return 'ℹ Info'
}
