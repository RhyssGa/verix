import type { CoproData, ExcelRow } from '@/types/audit'

type RawRow = (string | number | null)[]

// eslint-disable-next-line @typescript-eslint/no-var-requires
const getXLSX = () => require('xlsx') as typeof import('xlsx')

function toRows(workbook: import('xlsx').WorkBook): RawRow[] {
  const XLSX = getXLSX()
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as RawRow[]
}

// ─── Z POINTE (Copropriété) ────────────────────────────────────────────────────
// Structure : ligne 1 = en-tête vide, lignes 2+ = une ligne par mandat/résidence
//   col[3] = nb de lots   col[4] = montant garantie   col[7:] = soldes mensuels
//
// garantie = somme des col[4] de toutes les lignes (GF totale du portefeuille)
// pointe   = max absolu parmi tous les soldes mensuels col[7:] (pic de trésorerie)

export function parseCoproZPointe(buffer: ArrayBuffer): Map<string, { garantie: number; pointe: number; nbCopro: number }> {
  const XLSX = getXLSX()
  const wb = XLSX.read(buffer, { type: 'array' })
  const rows = toRows(wb).slice(1).filter(r => r.some(c => c !== null))
  const map = new Map<string, { garantie: number; pointe: number; nbCopro: number }>()
  for (const r of rows) {
    const agence = String(r[0] ?? '').trim()
    if (!agence || agence.startsWith('Total') || agence.startsWith('Filtre')) continue
    const nbCopro = Math.round(parseFloat(String(r[3] ?? 0)) || 0)
    const garantie = Math.abs(parseFloat(String(r[4] ?? 0)) || 0)
    const pointe = Math.abs(parseFloat(String(r[7] ?? 0)) || 0)
    const prev = map.get(agence) ?? { garantie: 0, pointe: 0, nbCopro: 0 }
    map.set(agence, {
      garantie: prev.garantie + garantie,
      pointe: Math.max(prev.pointe, pointe),
      nbCopro: prev.nbCopro + nbCopro,
    })
  }
  return map
}

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

// ─── PARSERS FICHIERS MÉTIER ───────────────────────────────────────────────────

export function parseCopro(
  files: Record<string, ArrayBuffer>,
): Partial<CoproData> {
  const XLSX = getXLSX()
  const result: Partial<CoproData> = {}

  // Balance — col[7]=écart, déséquilibrée si !== 0
  if (files['balance']) {
    const wb = XLSX.read(files['balance'], { type: 'array' })
    const { data, noteCol } = clean(toRows(wb))
    result.balance_bad = data.filter(
      r => r[7] != null && parseFloat(String(r[7])) !== 0,
    ) as ExcelRow[]
    result.balance_nc = noteCol
  }

  // Attente débiteurs — col[9]=solde, conserver si > 0
  if (files['att_deb']) {
    const wb = XLSX.read(files['att_deb'], { type: 'array' })
    const { data, noteCol } = clean(toRows(wb))
    result.att_deb = data.filter(
      r => r[0] && r[9] != null && parseFloat(String(r[9])) > 0,
    ) as ExcelRow[]
    result.att_deb_nc = noteCol
  }

  // Attente créditeurs — col[9]=solde, conserver si < 0
  if (files['att_cred']) {
    const wb = XLSX.read(files['att_cred'], { type: 'array' })
    const { data, noteCol } = clean(toRows(wb))
    result.att_cred = data.filter(
      r => r[0] && r[9] != null && parseFloat(String(r[9])) < 0,
    ) as ExcelRow[]
    result.att_cred_nc = noteCol
  }

  // Ventes non soldées — col[10]=solde, col[9]=ancienneté (jours)
  if (files['ventes']) {
    const wb = XLSX.read(files['ventes'], { type: 'array' })
    const { data, noteCol } = clean(toRows(wb))
    result.ventes_deb = data.filter(
      r => r[10] != null && parseFloat(String(r[10])) > 0,
    ) as ExcelRow[]
    result.ventes_cred = data.filter(
      r => r[10] != null && parseFloat(String(r[10])) < 0,
    ) as ExcelRow[]
    result.ventes_nc = noteCol
  }

  // Fournisseurs débiteurs — col[10]=solde actuel
  if (files['fourn_deb']) {
    const wb = XLSX.read(files['fourn_deb'], { type: 'array' })
    const { data, noteCol } = clean(toRows(wb))
    result.fourn_deb = data.filter(
      r => r[0] && r[10] != null && parseFloat(String(r[10])) > 0,
    ) as ExcelRow[]
    result.fourn_deb_nc = noteCol
  }

  // Factures — col[6]=NbJour, col[11]=MontantTTC, col[12]=Statut
  if (files['factures']) {
    const wb = XLSX.read(files['factures'], { type: 'array' })
    const { data, noteCol } = clean(toRows(wb))
    const notPaid = (r: RawRow) => String(r[12] ?? '').trim().toLowerCase() !== 'réglée'
    const days = (r: RawRow) => parseFloat(String(r[6] ?? '')) || 0
    result.factures    = data.filter(notPaid) as ExcelRow[]
    result.factures_nc = noteCol
    result.factures_nr30 = data.filter(r => notPaid(r) && days(r) > 30) as ExcelRow[]
    result.factures_nr60 = data.filter(r => notPaid(r) && days(r) > 60) as ExcelRow[]
  }

  // Banque non rapprochée — col[13]=statut, exclure 'Cloturé'
  if (files['bq_nonrapp']) {
    const wb = XLSX.read(files['bq_nonrapp'], { type: 'array' })
    const { data, noteCol } = clean(toRows(wb))
    result.bq_nonrapp = data.filter(
      r => r[0] && String(r[13] || '').trim() !== 'Cloturé' &&
        [15, 16, 17, 18, 19].some(i => r[i] != null && String(r[i]).trim() !== ''),
    ) as ExcelRow[]
    result.bq_nonrapp_nc = noteCol
    // Non clôturés: "Réel à ce j." (O=col[14]) in ['absent', 'en cours']
    result.bq_nonclot = data.filter(r => {
      const s = String(r[14] ?? '').trim().toLowerCase()
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

  // Bilan / État financier — garder seulement "En gestion" (col[2]), exclure lignes "Total"
  if (files['bilan']) {
    const wb = XLSX.read(files['bilan'], { type: 'array' })
    const { data } = clean(toRows(wb))
    result.bilan = data.filter(
      r =>
        r[0] &&
        String(r[2] || '').trim().toLowerCase() === 'en gestion' &&
        String(r[1] || '').trim() !== 'Total',
    ) as ExcelRow[]
  }

  return result
}
