export function eur(value: number | null | undefined, decimals = 0): string {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value || 0)
  } catch {
    return '0 €'
  }
}

export function pct(value: number): string {
  return (value || 0).toFixed(1) + '%'
}

export function pctRaw(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '—'
  return (value * 100).toFixed(0) + '%'
}

export function truncate(str: string | null | undefined, n: number = 32): string {
  if (!str) return ''
  return str.length > n ? str.substring(0, n - 1) + '…' : str
}

/**
 * Convertit une date Excel (numéro de série, string ou Date) en chaîne JJ/MM/AAAA.
 * xlsx.js renvoie les dates sous forme de numéro de série par défaut (sans cellDates:true).
 * Formule : (serial - 25569) × 86400000 ms depuis l'epoch JS.
 */
export function excelDateFmt(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  let d: Date
  if (typeof value === 'number') {
    // Excel serial → extract UTC date components to avoid timezone-shift day errors
    const utc = new Date(Math.round((value - 25569) * 86400000))
    d = new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate())
  } else if (value instanceof Date) {
    d = value
  } else {
    const s = String(value).trim()
    // Handle French/Power BI format DD/MM/YYYY (optionally with time suffix)
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (m) {
      d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
    } else {
      d = new Date(s)
    }
  }
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
