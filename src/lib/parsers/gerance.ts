import type { GeranceData, ExcelRow } from '@/types/audit'

type RawRow = (string | number | null)[]

// eslint-disable-next-line @typescript-eslint/no-var-requires
const getXLSX = () => require('xlsx') as typeof import('xlsx')

function toRows(workbook: import('xlsx').WorkBook): RawRow[] {
  const XLSX = getXLSX()
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as RawRow[]
}

// ─── Z POINTE (Gérance) ────────────────────────────────────────────────────────
// Structure : ligne 1 = en-tête vide, lignes 2+ = une ligne par mandat/résidence
//   col[2] = montant garantie financière (col C)   col[7:] = soldes mensuels (pour la pointe)

export function parseGeranceZPointe(buffer: ArrayBuffer): Map<string, { garantie: number; pointe: number }> {
  const XLSX = getXLSX()
  const wb = XLSX.read(buffer, { type: 'array' })
  const rows = toRows(wb).slice(1).filter(r => r.some(c => c !== null))
  const map = new Map<string, { garantie: number; pointe: number }>()
  for (const r of rows) {
    const agence = String(r[0] ?? '').trim()
    if (!agence || agence.startsWith('Total') || agence.startsWith('Filtre')) continue
    const garantie = Math.abs(parseFloat(String(r[2] ?? 0)) || 0)
    const pointe = Math.abs(parseFloat(String(r[7] ?? 0)) || 0)
    const prev = map.get(agence) ?? { garantie: 0, pointe: 0 }
    map.set(agence, {
      garantie: prev.garantie + garantie,
      pointe: Math.max(prev.pointe, pointe),
    })
  }
  return map
}

// ─── Z LISTE MANDATS (Gérance) ─────────────────────────────────────────────────
// Structure : ligne 1 = en-tête vide, lignes 2+ = une ligne par mandat actif
// Le nombre de mandats = nombre de lignes de données non vides

export function parseGeranceZMandats(buffer: ArrayBuffer): Map<string, number> {
  const XLSX = getXLSX()
  const wb = XLSX.read(buffer, { type: 'array' })
  const rows = toRows(wb).slice(1).filter(r => r.some(c => c !== null))
  const map = new Map<string, number>()
  for (const r of rows) {
    const agence = String(r[0] ?? '').trim()
    const statut = String(r[8] ?? '').trim().toLowerCase()
    if (!agence || agence.startsWith('Total') || agence.startsWith('Filtre') || statut !== 'en gestion') continue
    map.set(agence, (map.get(agence) ?? 0) + 1)
  }
  return map
}

// ─── PARSERS FICHIERS MÉTIER ───────────────────────────────────────────────────

function clean(rawRows: RawRow[]): {
  headers: string[]
  data: RawRow[]
  noteCol: number | null
} {
  if (!rawRows.length) return { headers: [], data: [], noteCol: null }
  const headers = rawRows[0].map(h => (h ? String(h).trim() : ''))
  const noteIdx = headers.findIndex(h => {
    const t = h.trim()
    return /^(nota[\s_-]*bene|notes?|commentaire)$/i.test(t) || /\.notes$/i.test(t) || / notes$/i.test(t)
  })
  const data = rawRows.slice(1).filter(
    r =>
      r.some(c => c !== null && c !== undefined) &&
      !String(r[0] || '').startsWith('Total') &&
      !String(r[0] || '').startsWith('Filtre'),
  )
  return { headers, data, noteCol: noteIdx >= 0 ? noteIdx : null }
}

export function parseGerance(
  files: Record<string, ArrayBuffer>,
): Partial<GeranceData> {
  const XLSX = getXLSX()
  const result: Partial<GeranceData> = {}

  // Quittancement — col[0]=agence, col[7]=quittancé, col[8]=encaissé
  if (files['quittancement']) {
    const wb = XLSX.read(files['quittancement'], { type: 'array' })
    const { data } = clean(toRows(wb))
    result.quittancement_rows = data as ExcelRow[]
    let q = 0
    let e = 0
    data.forEach(r => {
      if (r[7] != null && !isNaN(Number(r[7]))) q += parseFloat(String(r[7]))
      if (r[8] != null && !isNaN(Number(r[8]))) e += parseFloat(String(r[8]))
    })
    result.quittancement = q
    result.encaissement = e
  }

  // Factures — col[7]=NbJour, col[10]=Montant, col[12]=Statut
  if (files['factures']) {
    const wb = XLSX.read(files['factures'], { type: 'array' })
    const { data, noteCol } = clean(toRows(wb))
    const notPaid = (r: RawRow) => String(r[12] ?? '').trim().toLowerCase() !== 'réglée'
    const days = (r: RawRow) => parseFloat(String(r[7] ?? '')) || 0
    result.factures    = data.filter(notPaid) as ExcelRow[]
    result.factures_nc = noteCol
    result.factures_nr30 = data.filter(r => notPaid(r) && days(r) > 30) as ExcelRow[]
    result.factures_nr60 = data.filter(r => notPaid(r) && days(r) > 60) as ExcelRow[]
  }

  // Propriétaires débiteurs — col[2]=date_sortie (null=actif), col[8]=Débits actifs, col[10]=Débits sortis
  if (files['prop_deb']) {
    const wb = XLSX.read(files['prop_deb'], { type: 'array' })
    const { data, noteCol } = clean(toRows(wb))
    const all = data.filter(r => r[0] && !String(r[0]).startsWith('Total')) as ExcelRow[]
    result.prop_deb = all.filter(r => !r[2] && (parseFloat(String(r[8] ?? 0)) || 0) > 0)
    result.prop_deb_sorti = all.filter(r => r[2] && (parseFloat(String(r[10] ?? 0)) || 0) > 0)
    result.prop_deb_nc = noteCol
    result.prop_deb_sorti_nc = noteCol
  }

  // Propriétaires sortis créditeurs — col[6]=montant
  if (files['prop_cred']) {
    const wb = XLSX.read(files['prop_cred'], { type: 'array' })
    const { data, noteCol } = clean(toRows(wb))
    result.prop_cred = data.filter(r => r[0] && !String(r[0]).startsWith('Total')) as ExcelRow[]
    result.prop_cred_nc = noteCol
  }

  // Attente débiteurs — col[8]=solde, conserver si > 0
  if (files['att_deb']) {
    const wb = XLSX.read(files['att_deb'], { type: 'array' })
    const { data, noteCol } = clean(toRows(wb))
    result.att_deb = data.filter(
      r => r[0] && r[8] != null && parseFloat(String(r[8])) > 0,
    ) as ExcelRow[]
    result.att_deb_nc = noteCol
  }

  // Banque non rapprochée — col[11]=statut, exclure 'Cloturé'
  if (files['bq_nonrapp']) {
    const wb = XLSX.read(files['bq_nonrapp'], { type: 'array' })
    const { data, noteCol } = clean(toRows(wb))
    result.bq_nonrapp = data.filter(
      r => r[0] && String(r[11] || '').trim() !== 'Cloturé' &&
        [13, 14, 15, 16].some(i => r[i] != null && String(r[i]).trim() !== ''),
    ) as ExcelRow[]
    result.bq_nonrapp_nc = noteCol
    // Non clôturés: Situation Act (M=col[12]) in ['absent', 'en cours']
    result.bq_nonclot = data.filter(r => {
      const s = String(r[12] ?? '').trim().toLowerCase()
      return s === 'absent' || s === 'en cours'
    }) as ExcelRow[]
  }

  // Compta non rapprochée — toutes lignes non vides
  if (files['cpta_nonrapp']) {
    const wb = XLSX.read(files['cpta_nonrapp'], { type: 'array' })
    const { data, noteCol } = clean(toRows(wb))
    result.cpta_nonrapp = data.filter(r => r[0]) as ExcelRow[]
    result.cpta_nonrapp_nc = noteCol
  }

  return result
}
