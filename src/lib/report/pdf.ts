/**
 * PDF Report — types + payload builder + HTML renderer
 *
 * buildPDFPayload : runs CLIENT-SIDE (no browser APIs, pure data transform)
 * renderReportHTML : runs SERVER-SIDE in the API route (pure function, no React/DOM)
 */

import type { GeranceData, CoproData, AnnotationsMap, ScoreResult, AnomalyResult, ExcelRow, ReportEntry } from '@/types/audit'
import { eur, pct, excelDateFmt } from '@/lib/utils/format'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PDFKVRow { label: string; value: string; level?: string }
export interface PDFScoreLine { label: string; detail: string; pts: number }
export interface PDFTableRow { name: string; amount: string; detail?: string; comment: string; justified: boolean }

export interface PDFSection {
  id: string
  icon: string
  title: string
  subtitle: string
  level: 'ok' | 'warn' | 'bad' | 'info'
  mainStat: string
  mainStatLabel: string
  kvRows: PDFKVRow[]
  scoreLines: PDFScoreLine[]
  penalite: number
  penaliteMax: number
  nbExclu: number
  note: string
  infoOnly: boolean
  tableHeaders: string[]
  rows: PDFTableRow[]
}

export interface PDFFactures {
  note: string
  total: number
  nr30: number
  nr60: number
  nr60Amount: number
  level: string
  rows: PDFTableRow[]
}

export interface PDFComparisonRow {
  id: string
  label: string
  prevNb: number | null
  currNb: number | null
  prevMontant: number | null
  currMontant: number | null
}

export interface PDFComparison {
  refDate: string
  refAgence: string
  prevScore: number
  currScore: number
  rows: PDFComparisonRow[]
}

export interface PDFBilanGroup {
  riskLabel: string
  riskColor: string
  rows: Array<{
    name: string; lots: string
    impayes: string; impayesAnomalie: boolean
    charges: string; chargesAnomalie: boolean
    travaux: string; travauxAnomalie: boolean
    tresorerie: string; tresorerieAnomalie: boolean
  }>
}

export interface PDFPayload {
  agence: string
  mode: 'gerance' | 'copro'
  dateDebut: string
  dateFin: string
  garantie: number
  pointe: number
  pointeDate: string
  nbMandats?: number
  nbCopro?: number
  score: { global: number; penalite: number; niveauLabel: string; niveauColor: string; niveauBg: string }
  syntheseRows: Array<{ label: string; type: string; penalite: number; penaliteMax: number; nb: number | null; montant: number | null; exclu: boolean }>
  sections: PDFSection[]
  factures?: PDFFactures
  bilan?: { note: string; total: number; nbRisque: number; groups: PDFBilanGroup[] }
  comparison?: PDFComparison
  bqNonClot?: Array<{ name: string; dateStr: string }>
  globalNote?: string
}

// ─── buildPDFPayload ──────────────────────────────────────────────────────────

export function buildPDFPayload(
  mode: 'gerance' | 'copro',
  scoredG: GeranceData,
  scoredC: CoproData,
  score: ScoreResult,
  annots: AnnotationsMap,
  sectionNotes: Record<string, string>,
  params: {
    agence: string
    garantie: number
    pointe: number
    pointeDate: string
    dateDebut: string
    dateFin: string
    nbMandats?: number
  },
  lastImport?: ReportEntry | null,
): PDFPayload {
  try {
    const { agence, garantie, pointe, pointeDate, dateDebut, dateFin, nbMandats } = params

    // ── Inner helpers ─────────────────────────────────────────────────────────

    const v = (r: ExcelRow, i: number): string => String(r[i] ?? '').trim()
    const n = (r: ExcelRow, i: number): number => {
      const x = r[i]
      return typeof x === 'number' ? x : parseFloat(String(x ?? '')) || 0
    }
    const getAnnot = (cId: string, i: number) =>
      annots[`${cId}_${i}`] || { comment: '', include: true }
    const toRows = (
      items: ExcelRow[],
      cId: string,
      nameFn: (r: ExcelRow) => string,
      amtFn: (r: ExcelRow) => number,
      detailFn?: (r: ExcelRow) => string,
    ): PDFTableRow[] =>
      items.map((r, i) => {
        const a = getAnnot(cId, i)
        return {
          name: nameFn(r) || `Ligne ${i + 1}`,
          amount: eur(Math.abs(amtFn(r))),
          detail: detailFn ? detailFn(r) : undefined,
          comment: a.comment,
          justified: !a.include,
        }
      })

    const ga = (id: string): AnomalyResult | undefined =>
      score.anomalies.find(a => a.id === id)

    const anomLevel = (a: AnomalyResult | undefined, nb: number): 'ok' | 'warn' | 'bad' | 'info' => {
      if (nb === 0) return 'ok'
      if (!a || a.exclu) return 'info'
      if (a.penalite === 0) return 'warn'
      return a.penalite >= a.penaliteMax * 0.6 ? 'bad' : 'warn'
    }

    const scoreLines = (a: AnomalyResult | undefined): PDFScoreLine[] => {
      if (!a || a.exclu) return []
      const lines: PDFScoreLine[] = []
      if (a.id === 'quitt' && a.ratio != null) {
        lines.push({ label: 'Taux encaissement', detail: (a.ratio * 100).toFixed(1) + '%', pts: a.penalite })
      } else if (a.id === 'bq_nonrapp') {
        if (a.scoreVolume > 0) lines.push({ label: 'Volume', detail: (a.nb ?? 0) + ' écriture(s)', pts: a.scoreVolume })
      } else if (a.id === 'cpta_nonrapp') {
        if (a.scoreAnciennete > 0 && a.anciennete != null) lines.push({ label: 'Ancienneté max', detail: a.anciennete + ' j', pts: a.scoreAnciennete })
      } else {
        if (a.scoreMontant > 0 && a.ratio != null)
          lines.push({ label: 'Montant', detail: (a.ratio * 100).toFixed(2) + '% garantie', pts: a.scoreMontant })
        if (a.scoreVolume > 0 && a.ratioVolume != null)
          lines.push({ label: 'Volume', detail: (a.ratioVolume * 100).toFixed(1) + '% portefeuille', pts: a.scoreVolume })
      }
      return lines
    }

    // ── Build bqNonClot early (needed for sections + syntheseRows) ────────────

    const nameColNC = mode === 'gerance' ? 7 : 2
    const dateColNC = mode === 'gerance' ? 10 : 11
    const sitColNC  = mode === 'gerance' ? 12 : 14
    const rawBqRows = mode === 'gerance' ? scoredG.bq_nonclot ?? [] : scoredC.bq_nonclot ?? []
    const ncSeen = new Map<string, string>()
    for (const r of rawBqRows) {
      const sitAct = String(r[sitColNC] ?? '').trim().toLowerCase()
      if (sitAct !== 'absent' && sitAct !== 'en cours') continue
      const name = String(r[nameColNC] ?? '').trim()
      if (!name || ncSeen.has(name)) continue
      const d = r[dateColNC]
      const dateStr = (d != null && String(d).trim() !== '') ? excelDateFmt(d) : 'Aucun rapprochement fait'
      ncSeen.set(name, dateStr)
    }
    const bqNonClot = Array.from(ncSeen.entries()).map(([name, dateStr]) => ({ name, dateStr }))

    const nonClotSection = (): PDFSection => ({
      id: 'bq_nonclot',
      icon: '🔄',
      title: 'Rapprochements non clôturés',
      subtitle: bqNonClot.length === 0
        ? 'Aucun rapprochement non clôturé'
        : `${bqNonClot.length} compte(s) · absent ou en cours`,
      level: 'info',
      mainStat: String(bqNonClot.length),
      mainStatLabel: mode === 'gerance' ? 'banque(s) concernée(s)' : 'résidence(s) concernée(s)',
      kvRows: [],
      scoreLines: [],
      penalite: 0,
      penaliteMax: 0,
      nbExclu: 0,
      note: sectionNotes['bq_nonclot'] || '',
      infoOnly: true,
      tableHeaders: [mode === 'gerance' ? 'Banque' : 'Résidence', 'Dernier rapprochement'],
      rows: bqNonClot.map(item => ({
        name: item.name,
        amount: item.dateStr,
        detail: undefined,
        comment: '',
        justified: false,
      })),
    })

    // ── Sections ──────────────────────────────────────────────────────────────

    const sections: PDFSection[] = []

    if (mode === 'gerance') {
      const { quittancement, encaissement, prop_deb, prop_cred, att_deb, bq_nonrapp, cpta_nonrapp } = scoredG

      // 1. Quittancement
      const aQuitt = ga('quitt')
      sections.push({
        id: 'quitt',
        icon: '💰',
        title: 'Quittancement / Encaissement',
        subtitle: quittancement > 0 ? `Quittancé : ${eur(quittancement)} · Encaissé : ${eur(encaissement)}` : 'Pas de données',
        level: anomLevel(aQuitt, quittancement > 0 ? 1 : 0),
        mainStat: quittancement > 0 ? pct(encaissement / quittancement * 100) : '—',
        mainStatLabel: "taux d'encaissement",
        kvRows: [
          { label: 'Quittancé', value: eur(quittancement) },
          { label: 'Encaissé', value: eur(encaissement) },
        ],
        scoreLines: scoreLines(aQuitt),
        penalite: aQuitt?.penalite ?? 0,
        penaliteMax: 10,
        nbExclu: aQuitt?.nbExclu ?? 0,
        note: sectionNotes['quitt'] || '',
        infoOnly: false,
        tableHeaders: [],
        rows: [],
      })

      // 2. Proprios débiteurs
      const aPropDeb = ga('propdeb')
      const totalPD = prop_deb.reduce((s, r) => s + Math.abs(n(r, 6)), 0)
      sections.push({
        id: 'propdeb',
        icon: '🔴',
        title: 'Propriétaires débiteurs actifs',
        subtitle: `${prop_deb.length} propriétaire(s) · ${eur(totalPD)}`,
        level: anomLevel(aPropDeb, prop_deb.length),
        mainStat: String(prop_deb.length),
        mainStatLabel: 'propriétaire(s) débiteur(s)',
        kvRows: [
          { label: 'Montant total', value: eur(totalPD) },
          { label: 'Ratio / Garantie', value: garantie > 0 ? pct(totalPD / garantie * 100) : '—' },
        ],
        scoreLines: scoreLines(aPropDeb),
        penalite: aPropDeb?.penalite ?? 0,
        penaliteMax: aPropDeb?.penaliteMax ?? 17.5,
        nbExclu: aPropDeb?.nbExclu ?? 0,
        note: sectionNotes['propdeb'] || '',
        infoOnly: false,
        tableHeaders: ['Propriétaire', 'Montant'],
        rows: toRows(prop_deb, 'propdeb', r => v(r, 1) || v(r, 0) || '—', r => n(r, 6)),
      })

      // 2b. Propriétaires débiteurs sortis
      const propSorti = scoredG.prop_deb_sorti ?? []
      const aPropSorti = ga('propdbsorti')
      const totalPS = propSorti.reduce((s, r) => s + Math.abs(n(r, 10)), 0)
      sections.push({
        id: 'propdbsorti',
        icon: '🔴',
        title: 'Propriétaires débiteurs sortis',
        subtitle: `${propSorti.length} propriétaire(s) · ${eur(totalPS)}`,
        level: anomLevel(aPropSorti, propSorti.length),
        mainStat: String(propSorti.length),
        mainStatLabel: 'propriétaire(s) sorti(s) débiteur(s)',
        kvRows: [
          { label: 'Montant total', value: eur(totalPS) },
          { label: 'Ratio / Garantie', value: garantie > 0 ? pct(totalPS / garantie * 100) : '—' },
        ],
        scoreLines: scoreLines(aPropSorti),
        penalite: aPropSorti?.penalite ?? 0,
        penaliteMax: aPropSorti?.penaliteMax ?? 25,
        nbExclu: aPropSorti?.nbExclu ?? 0,
        note: sectionNotes['propdbsorti'] || '',
        infoOnly: false,
        tableHeaders: ['Propriétaire', 'Montant', 'Date sortie'],
        rows: toRows(propSorti, 'propdbsorti',
          r => v(r, 1) || v(r, 0) || '—',
          r => n(r, 10),
          r => r[2] != null ? excelDateFmt(r[2]) : '',
        ),
      })

      // 3. Proprios sortis créditeurs (info)
      const totalPC = prop_cred.reduce((s, r) => s + Math.abs(n(r, 6)), 0)
      sections.push({
        id: 'propcred',
        icon: '🟡',
        title: 'Propriétaires créditeurs sortis',
        subtitle: 'Hors scoring — information uniquement',
        level: prop_cred.length === 0 ? 'ok' : 'info',
        mainStat: String(prop_cred.length),
        mainStatLabel: 'propriétaire(s) à rembourser',
        kvRows: [{ label: 'Montant total', value: eur(totalPC) }],
        scoreLines: [],
        penalite: 0,
        penaliteMax: 0,
        nbExclu: 0,
        note: sectionNotes['propcred'] || '',
        infoOnly: true,
        tableHeaders: ['Propriétaire', 'Montant', 'Date sortie'],
        rows: toRows(prop_cred, 'propcred',
          r => v(r, 1) || v(r, 0) || '—',
          r => n(r, 6),
          r => r[2] != null ? excelDateFmt(r[2]) : '',
        ),
      })

      // 4. Attente débiteurs
      const aAttDeb = ga('attdeb')
      const totalAD = att_deb.reduce((s, r) => s + Math.abs(n(r, 8)), 0)
      sections.push({
        id: 'attdeb',
        icon: '⏳',
        title: "Comptes d'attente débiteurs",
        subtitle: `${att_deb.length} compte(s) · ${eur(totalAD)}`,
        level: anomLevel(aAttDeb, att_deb.length),
        mainStat: String(att_deb.length),
        mainStatLabel: 'compte(s) en anomalie',
        kvRows: [
          { label: 'Montant total', value: eur(totalAD) },
          { label: 'Ratio / Garantie', value: garantie > 0 ? pct(totalAD / garantie * 100) : '—' },
        ],
        scoreLines: scoreLines(aAttDeb),
        penalite: aAttDeb?.penalite ?? 0,
        penaliteMax: aAttDeb?.penaliteMax ?? 17.5,
        nbExclu: aAttDeb?.nbExclu ?? 0,
        note: sectionNotes['attdeb'] || '',
        infoOnly: false,
        tableHeaders: ['Mandat · Libellé', 'Montant', 'Note Gesteam'],
        rows: toRows(att_deb, 'attdeb',
          r => (v(r, 3) || '—') + (v(r, 1) ? ' · ' + v(r, 1) : ''),
          r => n(r, 8),
          r => scoredG.att_deb_nc != null ? v(r, scoredG.att_deb_nc) : '',
        ),
      })

      // 5. Rapprochements non clôturés (gérance)
      sections.push(nonClotSection())

      // 6. Rapprochement Banque 512 (gérance: date=14, libellé=7||0, montant=15)
      const aBQ = ga('bq_nonrapp')
      sections.push({
        id: 'bqrapp',
        icon: '🏦',
        title: 'Rapprochement Banque 512',
        subtitle: "Écritures non rapprochées · pénalité volume",
        level: bq_nonrapp.length === 0 ? 'ok' : bq_nonrapp.length === 1 ? 'warn' : 'bad',
        mainStat: String(bq_nonrapp.length),
        mainStatLabel: 'écriture(s) non rapprochée(s)',
        kvRows: [
          { label: 'Règle : 1 écriture', value: '−10 pts' },
          { label: 'Règle : >1 écriture', value: '−15 pts' },
        ],
        scoreLines: scoreLines(aBQ),
        penalite: aBQ?.penalite ?? 0,
        penaliteMax: aBQ?.penaliteMax ?? 15,
        nbExclu: aBQ?.nbExclu ?? 0,
        note: sectionNotes['bqrapp'] || '',
        infoOnly: false,
        tableHeaders: ['Banque · Date · Libellé', 'Montant'],
        rows: toRows(bq_nonrapp, 'bqrapp',
          r => `${v(r, 0)} · ${excelDateFmt(r[14])} · ${v(r, 7) || '—'}`,
          r => n(r, 15),
        ),
      })

      // 7. Rapprochement Compta (gérance: date=12, libellé=14||6, montant=13)
      const aCPTA = ga('cpta_nonrapp')
      const penCPTA = aCPTA?.penalite ?? 0
      sections.push({
        id: 'cptarapp',
        icon: '📒',
        title: 'Rapprochement Compta',
        subtitle: "Écritures non rapprochées",
        level: cpta_nonrapp.length === 0 ? 'ok' : penCPTA === 0 ? 'ok' : penCPTA <= 5 ? 'warn' : 'bad',
        mainStat: String(cpta_nonrapp.length),
        mainStatLabel: 'écriture(s) non rapprochée(s)',
        kvRows: [],
        scoreLines: scoreLines(aCPTA),
        penalite: penCPTA,
        penaliteMax: aCPTA?.penaliteMax ?? 15,
        nbExclu: aCPTA?.nbExclu ?? 0,
        note: sectionNotes['cptarapp'] || '',
        infoOnly: false,
        tableHeaders: ['Banque · Date · Libellé', 'Montant'],
        rows: toRows(cpta_nonrapp, 'cptarapp',
          r => `${v(r, 6)} · ${excelDateFmt(r[12])} · ${v(r, 14) || '—'}`,
          r => n(r, 13),
        ),
      })

    } else {
      // ── COPROPRIÉTÉ ───────────────────────────────────────────────────────────
      const { balance_bad, fourn_deb, att_deb, att_cred, ventes_deb, ventes_cred, bq_nonrapp, cpta_nonrapp,
        fourn_deb_nc, att_deb_nc, att_cred_nc, ventes_nc, bq_nonrapp_nc, cpta_nonrapp_nc } = scoredC

      // 1. Balance déséquilibrée
      const aBalance = ga('balance')
      const totalBal = balance_bad.reduce((s, r) => s + Math.abs(n(r, 7)), 0)
      sections.push({
        id: 'balance',
        icon: '⚖️',
        title: 'Balance déséquilibrée',
        subtitle: `${balance_bad.length} balance(s) en anomalie · ${eur(totalBal)}`,
        level: balance_bad.length === 0 ? 'ok' : 'bad',
        mainStat: String(balance_bad.length),
        mainStatLabel: 'balance(s) déséquilibrée(s)',
        kvRows: [{ label: 'Écart cumulé', value: eur(totalBal), level: balance_bad.length > 0 ? 'bad' : 'ok' }],
        scoreLines: scoreLines(aBalance),
        penalite: aBalance?.penalite ?? 0,
        penaliteMax: aBalance?.penaliteMax ?? 10,
        nbExclu: aBalance?.nbExclu ?? 0,
        note: sectionNotes['balance'] || '',
        infoOnly: false,
        tableHeaders: ['Libellé', 'Écart'],
        rows: toRows(balance_bad, 'balance', r => v(r, 3) || v(r, 1) || '—', r => n(r, 7)),
      })

      // 2. Fournisseurs débiteurs
      const aFourn = ga('fourndeb')
      const totalFD = fourn_deb.reduce((s, r) => s + n(r, 10), 0)
      sections.push({
        id: 'fourndeb',
        icon: '🔴',
        title: 'Fournisseurs débiteurs',
        subtitle: `${fourn_deb.length} fournisseur(s) · ${eur(totalFD)}`,
        level: anomLevel(aFourn, fourn_deb.length),
        mainStat: String(fourn_deb.length),
        mainStatLabel: 'fournisseur(s) à solde débiteur',
        kvRows: [
          { label: 'Montant total', value: eur(totalFD) },
          { label: 'Ratio / Garantie', value: garantie > 0 ? pct(totalFD / garantie * 100) : '—' },
        ],
        scoreLines: scoreLines(aFourn),
        penalite: aFourn?.penalite ?? 0,
        penaliteMax: aFourn?.penaliteMax ?? 20,
        nbExclu: aFourn?.nbExclu ?? 0,
        note: sectionNotes['fourndeb'] || '',
        infoOnly: false,
        tableHeaders: ['Résidence · Fournisseur', 'Montant', 'Note Gesteam'],
        rows: toRows(fourn_deb, 'fourndeb',
          r => v(r, 1) + ' · ' + (v(r, 7) || '—') + (v(r, 8) ? ' · ' + v(r, 8) : ''),
          r => n(r, 10),
          r => fourn_deb_nc != null ? v(r, fourn_deb_nc) : '',
        ),
      })

      // 3. Comptes attente débiteurs
      const aCAttDeb = ga('cattdeb')
      const totalCAD = att_deb.reduce((s, r) => s + Math.abs(n(r, 9)), 0)
      sections.push({
        id: 'cattdeb',
        icon: '⏳',
        title: "Comptes d'attente débiteurs",
        subtitle: `${att_deb.length} compte(s) · ${eur(totalCAD)}`,
        level: anomLevel(aCAttDeb, att_deb.length),
        mainStat: String(att_deb.length),
        mainStatLabel: 'compte(s) en anomalie',
        kvRows: [
          { label: 'Montant total', value: eur(totalCAD) },
          { label: 'Ratio / Garantie', value: garantie > 0 ? pct(totalCAD / garantie * 100) : '—' },
        ],
        scoreLines: scoreLines(aCAttDeb),
        penalite: aCAttDeb?.penalite ?? 0,
        penaliteMax: aCAttDeb?.penaliteMax ?? 20,
        nbExclu: aCAttDeb?.nbExclu ?? 0,
        note: sectionNotes['cattdeb'] || '',
        infoOnly: false,
        tableHeaders: ['Résidence · Libellé', 'Montant', 'Note Gesteam'],
        rows: toRows(att_deb, 'cattdeb',
          r => v(r, 1) + ' · ' + (v(r, 6) || '—') + (v(r, 5) ? ' · ' + v(r, 5) : ''),
          r => n(r, 9),
          r => att_deb_nc != null ? v(r, att_deb_nc) : '',
        ),
      })

      // 4. Comptes attente créditeurs (info)
      const totalCAC = att_cred.reduce((s, r) => s + Math.abs(n(r, 9)), 0)
      sections.push({
        id: 'cattcred',
        icon: '🟡',
        title: "Comptes d'attente créditeurs",
        subtitle: 'Hors scoring — information uniquement',
        level: att_cred.length === 0 ? 'ok' : 'info',
        mainStat: String(att_cred.length),
        mainStatLabel: 'compte(s) créditeur(s)',
        kvRows: [{ label: 'Montant total', value: eur(totalCAC) }],
        scoreLines: [],
        penalite: 0,
        penaliteMax: 0,
        nbExclu: 0,
        note: sectionNotes['cattcred'] || '',
        infoOnly: true,
        tableHeaders: ['Résidence · Libellé', 'Montant', 'Note Gesteam'],
        rows: toRows(att_cred, 'cattcred',
          r => v(r, 1) + ' · ' + (v(r, 6) || '—') + (v(r, 5) ? ' · ' + v(r, 5) : ''),
          r => n(r, 9),
          r => att_cred_nc != null ? v(r, att_cred_nc) : '',
        ),
      })

      // 5. Copropriétaires sortis débiteurs
      const aVentDeb = ga('ventesdeb')
      const totalVD = ventes_deb.reduce((s, r) => s + n(r, 10), 0)
      sections.push({
        id: 'ventesdeb',
        icon: '🔄',
        title: 'Copropriétaires sortis débiteurs',
        subtitle: `${ventes_deb.length} copropriétaire(s) sorti(s) · ${eur(totalVD)}`,
        level: anomLevel(aVentDeb, ventes_deb.length),
        mainStat: String(ventes_deb.length),
        mainStatLabel: 'copropriétaire(s) sorti(s) à solde débiteur',
        kvRows: [
          { label: 'Montant total', value: eur(totalVD) },
          { label: 'Ratio / Garantie', value: garantie > 0 ? pct(totalVD / garantie * 100) : '—' },
        ],
        scoreLines: scoreLines(aVentDeb),
        penalite: aVentDeb?.penalite ?? 0,
        penaliteMax: aVentDeb?.penaliteMax ?? 20,
        nbExclu: aVentDeb?.nbExclu ?? 0,
        note: sectionNotes['ventesdeb'] || '',
        infoOnly: false,
        tableHeaders: ['Résidence · Copropriétaire', 'Montant', 'Ancienneté'],
        rows: toRows(ventes_deb, 'ventesdeb',
          r => v(r, 1) + ' · ' + (v(r, 7) || '—'),
          r => n(r, 10),
          r => v(r, 9) ? v(r, 9) + ' j' : '',
        ),
      })

      // 6. Copropriétaires sortis créditeurs (info)
      const totalVC = ventes_cred.reduce((s, r) => s + Math.abs(n(r, 10)), 0)
      sections.push({
        id: 'ventescred',
        icon: '🟡',
        title: 'Copropriétaires sortis créditeurs',
        subtitle: 'Hors scoring — information uniquement',
        level: ventes_cred.length === 0 ? 'ok' : 'info',
        mainStat: String(ventes_cred.length),
        mainStatLabel: 'copropriétaire(s) sorti(s) à rembourser',
        kvRows: [{ label: 'Montant total', value: eur(totalVC) }],
        scoreLines: [],
        penalite: 0,
        penaliteMax: 0,
        nbExclu: 0,
        note: sectionNotes['ventescred'] || '',
        infoOnly: true,
        tableHeaders: ['Résidence · Copropriétaire', 'Montant', 'Ancienneté'],
        rows: toRows(ventes_cred, 'ventescred',
          r => v(r, 1) + ' · ' + (v(r, 7) || '—'),
          r => n(r, 10),
          r => v(r, 9) ? v(r, 9) + ' j' : '',
        ),
      })

      // 7. Rapprochements non clôturés (copro)
      sections.push(nonClotSection())

      // 8. Rapprochement Banque 512 (copro: date=15, libellé=19||0, montant=18)
      const aCBQ = ga('bq_nonrapp')
      sections.push({
        id: 'bqrapp',
        icon: '🏦',
        title: 'Rapprochement Banque 512',
        subtitle: "Écritures non rapprochées · pénalité volume",
        level: bq_nonrapp.length === 0 ? 'ok' : bq_nonrapp.length === 1 ? 'warn' : 'bad',
        mainStat: String(bq_nonrapp.length),
        mainStatLabel: 'écriture(s) non rapprochée(s)',
        kvRows: [
          { label: 'Règle : 1 écriture', value: '−10 pts' },
          { label: 'Règle : >1 écriture', value: '−15 pts' },
        ],
        scoreLines: scoreLines(aCBQ),
        penalite: aCBQ?.penalite ?? 0,
        penaliteMax: aCBQ?.penaliteMax ?? 15,
        nbExclu: aCBQ?.nbExclu ?? 0,
        note: sectionNotes['bqrapp'] || '',
        infoOnly: false,
        tableHeaders: ['Résidence · Date · Libellé', 'Montant', 'Ancienneté'],
        rows: toRows(bq_nonrapp, 'bqrapp',
          r => `${v(r, 2)} · ${excelDateFmt(r[15])} · ${v(r, 19) || '—'}`,
          r => n(r, 18),
          r => v(r, 12) ? v(r, 12) + ' j' : '',
        ),
      })

      // 9. Rapprochement Compta (copro: date=10, libellé=14||0, montant=13)
      const aCCPTA = ga('cpta_nonrapp')
      const penCCPTA = aCCPTA?.penalite ?? 0
      sections.push({
        id: 'cptarapp',
        icon: '📒',
        title: 'Rapprochement Compta',
        subtitle: "Écritures non rapprochées",
        level: cpta_nonrapp.length === 0 ? 'ok' : penCCPTA === 0 ? 'ok' : penCCPTA <= 5 ? 'warn' : 'bad',
        mainStat: String(cpta_nonrapp.length),
        mainStatLabel: 'écriture(s) non rapprochée(s)',
        kvRows: [],
        scoreLines: scoreLines(aCCPTA),
        penalite: penCCPTA,
        penaliteMax: aCCPTA?.penaliteMax ?? 15,
        nbExclu: aCCPTA?.nbExclu ?? 0,
        note: sectionNotes['cptarapp'] || '',
        infoOnly: false,
        tableHeaders: ['Résidence · Date · Libellé', 'Montant'],
        rows: toRows(cpta_nonrapp, 'cptarapp',
          r => `${v(r, 1)} · ${excelDateFmt(r[10])} · ${v(r, 14) || '—'}`,
          r => n(r, 13),
        ),
      })
    }

    // ── Factures non réglées +60j (commun aux deux modes) ────────────────────
    {
      const allFact = mode === 'gerance' ? scoredG.factures : scoredC.factures
      const nr30   = mode === 'gerance' ? scoredG.factures_nr30 : scoredC.factures_nr30
      const nr60   = mode === 'gerance' ? scoredG.factures_nr60 : scoredC.factures_nr60
      const iM    = mode === 'gerance' ? 10 : 11  // Montant TTC : gérance col K=10, copro col L=11
      const iAge  = mode === 'gerance' ? 7  : 6   // Ancienneté  : gérance col H=7,  copro col G=6
      const iNote = mode === 'gerance' ? 11 : 10  // Note Gesteam: gérance col L=11, copro col K=10

      const aFact = ga('fact60')
      const nr60Amount = nr60.reduce((s, r) => s + Math.abs(n(r, iM)), 0)
      const total = allFact.length
      const nr30Pct = total > 0 ? pct(nr30.length / total * 100) : '0.0%'
      const nr60Pct = total > 0 ? pct(nr60.length / total * 100) : '0.0%'

      sections.push({
        id: 'fact60',
        icon: '🧾',
        title: 'Factures non réglées +60 jours',
        subtitle: total > 0 ? `${total} facture(s) · ${nr60.length} en retard +60 j` : 'Fichier non chargé',
        level: nr60.length === 0 ? (nr30.length === 0 ? 'ok' : 'warn') : 'bad',
        mainStat: String(nr60.length),
        mainStatLabel: 'facture(s) non réglée(s) à +60 j',
        kvRows: [
          { label: 'Total factures', value: String(total) },
          { label: 'Non réglées +30 j', value: `${nr30.length} (${nr30Pct})`, level: nr30.length > 0 ? 'warn' : 'ok' },
          { label: 'Non réglées +60 j', value: `${nr60.length} (${nr60Pct})`, level: nr60.length > 0 ? 'bad' : 'ok' },
          { label: 'Montant NR +60 j', value: eur(nr60Amount), level: nr60.length > 0 ? 'bad' : 'ok' },
        ],
        scoreLines: scoreLines(aFact),
        penalite: aFact?.penalite ?? 0,
        penaliteMax: aFact?.penaliteMax ?? 0,
        nbExclu: aFact?.nbExclu ?? 0,
        note: sectionNotes['fact60'] || '',
        infoOnly: !aFact || aFact.penaliteMax === 0,
        tableHeaders: mode === 'copro'
          ? ['Résidence · Date · Entreprise · Libellé', 'Montant', 'Ancienneté · Note Gesteam']
          : ['Mandat · Date · Entreprise · Libellé', 'Montant', 'Ancienneté · Note Gesteam'],
        rows: toRows(nr60, 'fact60',
          r => mode === 'copro'
            ? `${v(r, 7) || '—'} · ${excelDateFmt(r[4])} · ${v(r, 8) || '—'} · ${v(r, 9) || '—'}`
            : `${v(r, 4) || '—'} · ${excelDateFmt(r[5])} · ${v(r, 8) || '—'} · ${v(r, 9) || '—'}`,
          r => n(r, iM),
          r => {
            const age = v(r, iAge) ? v(r, iAge) + ' j' : ''
            const note = v(r, iNote)
            return age && note ? `${age} · ${note}` : age || note
          },
        ),
      })
    }

    const factures: PDFFactures | undefined = undefined  // rendered via sections now

    // ── Bilan (copro only) ────────────────────────────────────────────────────

    let bilan: PDFPayload['bilan'] | undefined
    if (mode === 'copro' && scoredC.bilan.length > 0) {
      const bilanRows = scoredC.bilan
      const total = bilanRows.length

      const numVal = (r: ExcelRow, i: number): number =>
        parseFloat(String(r[i] ?? '0')) || 0

      // Recalcule le nb d'anomalies (NaN → 0%) — même logique que l'app
      const nbAnom = (r: ExcelRow): number => {
        const imp = numVal(r, 11)
        const chg = numVal(r, 16)
        const trv = r[18] != null && !isNaN(Number(r[18])) ? numVal(r, 18) : null
        const tre = numVal(r, 25)
        let n = 0
        if (imp > 0.30)                  n++
        if (chg > 1.00)                  n++
        if (trv != null && trv > 1.00)   n++
        if (tre < 1.00)                  n++
        return n
      }

      const makeGroup = (items: ExcelRow[]): PDFBilanGroup['rows'] =>
        items.map(r => {
          const imp = numVal(r, 11)
          const chg = numVal(r, 16)
          const trv = r[18] != null && !isNaN(Number(r[18])) ? numVal(r, 18) : null
          const tre = numVal(r, 25)
          return {
            name: String(r[1] || '—').replace(/^\d+-/, ''),
            lots: v(r, 4),
            impayes: imp > 0 ? pct(imp * 100) : '0%',
            impayesAnomalie: imp > 0.30,
            charges: chg > 0 ? pct(chg * 100) : '0%',
            chargesAnomalie: chg > 1.00,
            travaux: trv != null ? pct(trv * 100) : '—',
            travauxAnomalie: trv != null && trv > 1.00,
            tresorerie: pct(tre * 100),
            tresorerieAnomalie: tre < 1.00,
          }
        })

      const risk4Items = bilanRows.filter(r => nbAnom(r) >= 4)
      const risk3Items = bilanRows.filter(r => nbAnom(r) === 3)
      const risk2Items = bilanRows.filter(r => nbAnom(r) === 2)
      const risk1Items = bilanRows.filter(r => nbAnom(r) === 1)
      const nbRisque = risk4Items.length + risk3Items.length + risk2Items.length

      const groups: PDFBilanGroup[] = []
      if (risk4Items.length > 0) groups.push({ riskLabel: '✗✗✗✗ Risque critique (4 anomalies)', riskColor: '#B01A1A', rows: makeGroup(risk4Items) })
      if (risk3Items.length > 0) groups.push({ riskLabel: '✗✗✗ Risque élevé (3 anomalies)', riskColor: '#C05C1A', rows: makeGroup(risk3Items) })
      if (risk2Items.length > 0) groups.push({ riskLabel: '✗✗ Risque modéré (2 anomalies)', riskColor: '#C8A020', rows: makeGroup(risk2Items) })
      if (risk1Items.length > 0) groups.push({ riskLabel: '✗ Risque faible (1 anomalie)', riskColor: '#1A7A4A', rows: makeGroup(risk1Items) })

      bilan = {
        note: sectionNotes['bilan'] || '',
        total,
        nbRisque,
        groups,
      }
    }

    // ── syntheseRows ─────────────────────────────────────────────────────────

    const syntheseRowsBase = score.anomalies.map(a => ({
      label: a.label,
      type: a.type,
      penalite: a.penalite,
      penaliteMax: a.penaliteMax,
      nb: a.nb,
      montant: a.montant,
      exclu: a.exclu,
    }))
    // Insert nonClot info row before bq_nonrapp
    const bqIdx = score.anomalies.findIndex(a => a.id === 'bq_nonrapp')
    const nonClotSyntheseRow = { label: 'Rapprochements non clôturés', type: 'info', penalite: 0, penaliteMax: 0, nb: bqNonClot.length, montant: null, exclu: false }
    const syntheseRows = bqIdx >= 0
      ? [...syntheseRowsBase.slice(0, bqIdx), nonClotSyntheseRow, ...syntheseRowsBase.slice(bqIdx)]
      : [...syntheseRowsBase, nonClotSyntheseRow]

    // ── Comparison (vs last import) ───────────────────────────────────────────

    const buildComparison = (): PDFComparison | undefined => {
      if (!lastImport || !lastImport.metrics) return undefined
      const rows: PDFComparisonRow[] = score.anomalies
        .filter(a => !a.exclu && a.type !== 'info')
        .map(a => {
          const prev = lastImport.metrics![a.id]
          return {
            id: a.id,
            label: a.label,
            prevNb: prev?.nb ?? null,
            currNb: a.nb,
            prevMontant: prev?.montant ?? null,
            currMontant: a.montant,
          }
        })
      return {
        refDate: lastImport.timestamp,
        refAgence: lastImport.agence,
        prevScore: lastImport.scoreGlobal,
        currScore: score.scoreGlobal,
        rows,
      }
    }

    // ── Payload ───────────────────────────────────────────────────────────────

    return {
      agence,
      mode,
      dateDebut,
      dateFin,
      garantie,
      pointe,
      pointeDate,
      nbMandats,
      nbCopro: mode === 'copro' ? scoredC.bilan.length : undefined,
      score: {
        global: score.scoreGlobal,
        penalite: score.totalPenalite,
        niveauLabel: score.niveau.label,
        niveauColor: score.niveau.color,
        niveauBg: score.niveau.bg,
      },
      syntheseRows,
      sections,
      factures,
      bilan,
      comparison: buildComparison(),
      bqNonClot,
      globalNote: sectionNotes['__global__'] || undefined,
    }

  } catch (err) {
    console.error('buildPDFPayload error', err)
    // Minimal fallback payload
    return {
      agence: params.agence || '—',
      mode,
      dateDebut: params.dateDebut || '',
      dateFin: params.dateFin || '',
      garantie: params.garantie || 0,
      pointe: params.pointe || 0,
      pointeDate: params.pointeDate || '',
      score: { global: 0, penalite: 0, niveauLabel: '—', niveauColor: '#7A7A8C', niveauBg: '#F0F0F0' },
      syntheseRows: [],
      sections: [],
    }
  }
}

// ─── renderReportHTML ─────────────────────────────────────────────────────────
// Pure function — no browser APIs, no React, no DOM.

export function renderReportHTML(payload: PDFPayload, bgCoverBase64 = '', headerBannerBase64 = ''): string {
  const { agence, mode, dateDebut, dateFin, garantie, pointe, pointeDate, nbMandats, nbCopro, score, syntheseRows, sections, bilan, comparison, globalNote } = payload

  const modeLabel = mode === 'gerance' ? 'Gérance' : 'Copropriété'
  const { global: globalScore, penalite, niveauLabel, niveauColor, niveauBg } = score

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Strip any HTML tags from Excel/user content before display.
   *  Handles both complete tags (<span ...>) and incomplete/truncated tags (<span ...) */
  function stripHtml(s: string): string {
    return String(s)
      .replace(/<[^>]*>?/g, '')   // match tags with OR without closing >
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()
  }

  /** HTML-escape after stripping markup — no raw HTML ever reaches the PDF */
  function esc(s: string): string {
    return stripHtml(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  /** Safe percentage display — guards against Infinity, NaN, and absurd values */
  function safePctStr(value: number): string {
    if (!isFinite(value) || isNaN(value)) return 'N/A'
    if (Math.abs(value) > 9999) return value > 0 ? '> 9 999 %' : '< −9 999 %'
    return value.toFixed(1) + ' %'
  }

  function dateFmt(s?: string): string {
    if (!s) return '—'
    try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
    catch { return s }
  }

  function eurFmt(n: number): string {
    if (!isFinite(n) || isNaN(n)) return '—'
    const rounded = Math.round(n)
    const sign = rounded < 0 ? '-' : ''
    const abs = Math.abs(rounded).toString()
    // Manual fr-FR formatting — avoids Intl locale availability issues in server environments
    // Use \u00a0 (non-breaking space) as thousands separator — renders correctly in Chromium/Puppeteer
    const grouped = abs.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')
    return `${sign}${grouped}\u00a0€`
  }

  /** Colored dot (CSS only — no glyph, works with any font) */
  function colorDot(color: string): string {
    return `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0;margin-right:5px;vertical-align:middle"></span>`
  }
  /** Colored dot badge for section icons */
  function sectionDot(emoji: string): string {
    const map: Record<string, string> = {
      '🔄': '#5A7AB0', '💰': '#1A7A4A', '🔴': '#B01A1A', '🟡': '#D09030',
      '⏳': '#7A7A8C', '🏦': '#2A5A9A', '📒': '#3A6A9A', '⚖️': '#5A3A8A',
      '🧾': '#1A7A4A', '📊': '#0B1929', '📝': '#C49A2E',
    }
    const color = map[emoji] ?? '#7A7A8C'
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${color};flex-shrink:0;margin-top:1px"></span>`
  }

  function statusPill(level: string): string {
    const map: Record<string, [string, string, string, string]> = {
      ok:   ['#EAF6EF', '#1A7A4A', '#1A7A4A', 'Conforme'],
      warn: ['#FDF0E6', '#C05C1A', '#C05C1A', 'Attention'],
      bad:  ['#FAEAEA', '#B01A1A', '#B01A1A', 'Anomalie'],
      info: ['#EAF0FA', '#1A3A8A', '#1A3A8A', 'Information'],
    }
    const [bg, color, dotColor, label] = map[level] ?? map.info
    return `<span style="display:inline-flex;align-items:center;padding:3px 12px 3px 8px;border-radius:20px;font-size:8pt;font-weight:700;letter-spacing:0.04em;background:${bg};color:${color};white-space:nowrap">${colorDot(dotColor)}${label}</span>`
  }

  function scoreArc(global: number, color: string): string {
    const r = 38, cx = 48, cy = 48, circ = 2 * Math.PI * r
    const fill = ((circ * Math.min(Math.max(global, 0), 100)) / 100).toFixed(1)
    const gap = (circ - parseFloat(fill)).toFixed(1)
    return `<svg viewBox="0 0 96 96" width="88" height="88">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ECECF2" stroke-width="9"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="9"
        stroke-dasharray="${fill} ${gap}" stroke-linecap="round"
        transform="rotate(-90 ${cx} ${cy})"/>
      <text x="${cx}" y="${cy - 3}" text-anchor="middle" font-size="17" font-weight="800" fill="${color}" font-family="Helvetica Neue,Arial,sans-serif">${global}</text>
      <text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="9" fill="#9A9AB0" font-family="Helvetica Neue,Arial,sans-serif">/100</text>
    </svg>`
  }

  // ── Contextual interpretation (references real metrics) ───────────────────

  function interpretSection(sec: PDFSection): string {
    const nb = parseInt(sec.mainStat) || 0
    const { level, penalite: pen, penaliteMax: max, id, nbExclu } = sec

    // Extract key metric values from kvRows for contextual messaging
    const kvMap: Record<string, string> = {}
    sec.kvRows.forEach(kv => { kvMap[kv.label] = kv.value })
    const montant = kvMap['Montant total'] || ''
    const ratio   = kvMap['Ratio / Garantie'] || ''
    const ancien  = kvMap['Ancienneté maximale'] || ''
    const justifNote = nbExclu > 0 ? ` (dont ${nbExclu} justifiée(s))` : ''

    if (sec.id === 'bq_nonclot') {
      if (parseInt(sec.mainStat) === 0) return 'Aucun compte bancaire ou résidence sans rapprochement clôturé — situation conforme.'
      return `${sec.mainStat} ${mode === 'gerance' ? 'banque(s)' : 'résidence(s)'} avec un rapprochement absent ou en cours — à régulariser pour fiabiliser la trésorerie.`
    }
    if (sec.infoOnly) return 'Poste hors scoring — présenté à titre informatif uniquement.'

    if (level === 'ok' || nb === 0) {
      if (id === 'bqrapp')   return 'Rapprochement bancaire 512 à jour — aucune écriture non rapprochée.'
      if (id === 'cptarapp') return 'Rapprochement comptable conforme — aucune écriture en suspens.'
      if (id === 'quitt')    return `Taux d'encaissement de ${sec.mainStat} — objectif atteint, aucune pénalité appliquée.`
      if (id === 'balance')  return 'Balance comptable équilibrée — aucun écart entre débit et crédit.'
      return 'Aucune anomalie identifiée sur ce poste — en conformité.'
    }

    // Rapprochement banque
    if (id === 'bqrapp') {
      return nb === 1
        ? `1 écriture bancaire non rapprochée${justifNote} — à régulariser avant le prochain arrêté.`
        : `${nb} écritures bancaires non rapprochées${justifNote} — situation à traiter en priorité pour fiabiliser la trésorerie.`
    }

    // Rapprochement compta
    if (id === 'cptarapp') {
      if (nb === 1) return `1 écriture comptable non rapprochée${justifNote} — à régulariser avant le prochain arrêté.`
      return `${nb} écritures comptables non rapprochées${justifNote} — situation à traiter en priorité pour fiabiliser la comptabilité.`
    }

    // Balance
    if (id === 'balance') {
      return `${nb} balance(s) déséquilibrée(s)${montant ? ` pour un écart cumulé de ${montant}` : ''} — anomalie critique : tout déséquilibre de balance traduit une erreur comptable à investiguer immédiatement.`
    }

    // Quittancement
    if (id === 'quitt') {
      const taux = sec.mainStat !== '—' ? ` (${sec.mainStat})` : ''
      if (pen <= 3)  return `Taux d'encaissement${taux} légèrement insuffisant — les loyers non encaissés représentent un écart modéré par rapport aux quittances émises.`
      if (pen <= 7)  return `Taux d'encaissement${taux} en retrait — un volume significatif de loyers quittancés n'a pas encore été encaissé.`
      return `Taux d'encaissement${taux} dégradé — risque de trésorerie important, relances et recouvrements à engager.`
    }

    // Generic scoring sections — reference montant + ratio if available
    const ratioNote = ratio && ratio !== '—' ? ` (${ratio} de la garantie)` : ''
    const montantNote = montant && montant !== '—' ? ` pour un encours total de ${montant}${ratioNote}` : ''
    const ratioNum = max > 0 ? pen / max : 0

    if (ratioNum < 0.35) {
      return `${nb} anomalie(s) identifiée(s)${montantNote}${justifNote} — impact limité sur le score, situation globalement maîtrisée.`
    }
    if (ratioNum < 0.65) {
      return `${nb} anomalie(s) identifiée(s)${montantNote}${justifNote} — impact modéré sur le score (${pen.toFixed(1)} pts). Des actions correctives sont attendues.`
    }
    return `${nb} anomalie(s) identifiée(s)${montantNote}${justifNote} — impact significatif sur le score (${pen.toFixed(1)} / ${max} pts max). Intervention prioritaire requise.`
  }

  // ── Comparison helpers ────────────────────────────────────────────────────

  function compRowForSection(secId: string): PDFComparisonRow | undefined {
    if (!comparison) return undefined
    const idMap: Record<string, string> = {
      quitt: 'quitt', propdeb: 'propdeb', attdeb: 'attdeb',
      bqrapp: 'bq_nonrapp', cptarapp: 'cpta_nonrapp', fact60: 'fact60',
      balance: 'balance', fourndeb: 'fourndeb', cattdeb: 'cattdeb',
      ventesdeb: 'ventesdeb',
    }
    return comparison.rows.find(r => r.id === (idMap[secId] ?? secId))
  }

  // ── KPI strip ─────────────────────────────────────────────────────────────

  function kpiStrip(chips: Array<{ label: string; val: string; color?: string }>): string {
    return `<div style="display:flex;gap:10px;flex-wrap:wrap;margin:16px 0 4px">
      ${chips.map(c => `
        <div style="flex:1;min-width:110px;padding:13px 16px;border:1px solid #E8E4DC;border-radius:8px;background:#FAFAFA">
          <div style="font-size:15pt;font-weight:800;color:${c.color || '#0B1929'};line-height:1.1;word-break:keep-all">${esc(c.val)}</div>
          <div style="font-size:7.5pt;color:#9A9AB0;margin-top:4px;text-transform:uppercase;letter-spacing:0.07em">${esc(c.label)}</div>
        </div>`).join('')}
    </div>`
  }

  // ── Page header banner (inline, bleeds edge-to-edge, pages 2+) ───────────
  function pageHeader(): string {
    return ''
  }

  // ── Anomaly table renderer ────────────────────────────────────────────────
  // headers[0] = name column label
  // headers[1] = amount column label
  // headers[2] = detail column label (optional, only shown when row.detail exists)

  function renderAnomalyTable(rows: PDFTableRow[], headers: string[], showStatus = true): string {
    if (rows.length === 0) return ''
    const hasDetail = rows.some(r => r.detail !== undefined && r.detail !== null && r.detail !== '')
    const nameHeader   = headers[0] || 'Libellé'
    const amountHeader = headers[1] || 'Montant'
    const detailHeader = headers[2] || 'Ancienneté'   // third element = explicit detail label
    const thead = `<tr>
      <th style="text-align:left">${esc(nameHeader)}</th>
      <th style="text-align:right;width:100px">${esc(amountHeader)}</th>
      ${hasDetail ? `<th style="text-align:left">${esc(detailHeader)}</th>` : ''}
      <th style="text-align:left">Note Audit</th>
      ${showStatus ? `<th style="text-align:center;width:95px">Statut</th>` : ''}
    </tr>`
    const tbody = rows.map(r => `
      <tr${r.justified && showStatus ? ' class="row-ok"' : ''}>
        <td style="color:#1A1A2E">${esc(r.name)}</td>
        <td style="text-align:right;font-weight:600;white-space:nowrap;color:#0B1929">${esc(r.amount)}</td>
        ${hasDetail ? `<td style="color:#7A7A8C;font-size:9pt;word-break:break-word">${esc(r.detail || '—')}</td>` : ''}
        <td style="color:#7A7A8C;font-style:italic;font-size:9pt">${esc(r.comment || '—')}</td>
        ${showStatus ? `<td style="text-align:center"><span style="display:inline-flex;align-items:center;padding:2px 8px 2px 5px;border-radius:20px;background:${r.justified ? '#EAF6EF' : '#FAEAEA'};color:${r.justified ? '#1A7A4A' : '#B01A1A'};font-size:8pt;font-weight:700;white-space:nowrap">${colorDot(r.justified ? '#1A7A4A' : '#B01A1A')}${r.justified ? 'Justifie' : 'Injustifie'}</span></td>` : ''}
      </tr>`).join('')
    return `
    <div style="margin-top:22px">
      <div style="font-size:8pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.09em;margin-bottom:8px">Détail des lignes</div>
      <table class="data-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>
    </div>`
  }

  // ── Section card renderer ──────────────────────────────────────────────────

  function renderCard(sec: PDFSection): string {
    const accentColor = sec.level === 'ok' ? '#1A7A4A' : sec.level === 'warn' ? '#D06020' : sec.level === 'bad' ? '#B01A1A' : '#1A3A8A'

    // Impact score label (top-right)
    const impactLabel = sec.penaliteMax > 0 && !sec.infoOnly
      ? `<div style="text-align:right;white-space:nowrap">
          <div style="font-size:14pt;font-weight:800;color:${sec.penalite > 0 ? '#B01A1A' : '#1A7A4A'}">${sec.penalite > 0 ? '−' + sec.penalite.toFixed(1) : '0'} pts</div>
          <div style="font-size:7.5pt;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.05em">sur ${sec.penaliteMax} max</div>
        </div>`
      : ''

    // KPI strip — primary stat + key metrics (skip rule-description kvRows)
    const kpiChips: Array<{ label: string; val: string; color?: string }> = []
    kpiChips.push({ label: sec.mainStatLabel, val: sec.mainStat, color: accentColor })
    sec.kvRows.forEach(kv => {
      if (/^Règle/.test(kv.label)) return
      const c = kv.level === 'bad' ? '#B01A1A' : kv.level === 'warn' ? '#D06020' : kv.level === 'ok' ? '#1A7A4A' : '#0B1929'
      kpiChips.push({ label: kv.label, val: kv.value, color: c })
    })

    // Scoring detail block
    const sdHtml = sec.scoreLines.length > 0
      ? `<div style="margin-top:16px;padding:12px 16px;border-radius:8px;background:#F6F6FB;border:1px solid #E8E8F0">
          <div style="font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Détail du calcul</div>
          ${sec.scoreLines.map(l => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #EAEAF2">
              <span style="font-size:9.5pt;color:#3A3A5A">${esc(l.label)}</span>
              <span style="font-size:8.5pt;color:#7A7A8C;margin:0 12px">${esc(l.detail)}</span>
              <span style="font-size:10pt;font-weight:700;color:#B01A1A">−${l.pts.toFixed(1)}</span>
            </div>`).join('')}
        </div>`
      : ''

    // Auditor note — minimal, editorial style
    const noteHtml = sec.note
      ? `<div style="margin:18px 0 0;padding:11px 0 11px 16px;border-left:3px solid #C49A2E">
          <div style="font-size:7.5pt;font-weight:700;color:#C49A2E;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px">Commentaire de l'auditeur</div>
          <div style="font-size:10pt;color:#1A1A2E;font-style:italic;line-height:1.6">${esc(sec.note)}</div>
        </div>`
      : ''

    const exclHtml = sec.nbExclu > 0
      ? `<div style="display:flex;align-items:center;margin-top:10px;font-size:8.5pt;color:#1A7A4A">${colorDot('#1A7A4A')}${sec.nbExclu} ligne(s) justifiee(s) et exclue(s) du calcul</div>`
      : ''

    const infoOnlyHtml = sec.infoOnly
      ? `<div style="display:flex;align-items:center;margin-top:10px;font-size:8.5pt;color:#1A3A8A;font-style:italic">${colorDot('#1A3A8A')}Ce poste est presente a titre informatif — il n'entre pas dans le calcul du score.</div>`
      : ''

    const tableHtml = sec.rows.length > 0
      ? renderAnomalyTable(sec.rows, sec.tableHeaders, !sec.infoOnly)
      : (parseInt(sec.mainStat) === 0
          ? `<div style="display:flex;align-items:center;margin-top:18px;font-size:9.5pt;color:#1A7A4A">${colorDot('#1A7A4A')}Aucune anomalie a signaler sur ce poste.</div>`
          : '')

    return `
    <h2 class="section-title">Analyse détaillée — ${esc(sec.title)}</h2>
    <div style="border:1px solid #E4E4EC;border-radius:10px;overflow:hidden;page-break-inside:avoid">
      <div style="border-top:3px solid ${accentColor}"></div>
      <div style="display:flex;align-items:flex-start;gap:14px;padding:18px 24px 16px;border-bottom:1px solid #F0F0F6">
        ${sectionDot(sec.icon)}
        <div style="flex:1">
          <div style="font-size:12pt;font-weight:700;color:#0B1929;line-height:1.2">${esc(sec.title)}</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
            ${statusPill(sec.level)}
          </div>
        </div>
        ${impactLabel}
      </div>
      <div style="padding:22px 24px 24px">
        <div style="font-size:9.5pt;color:#5A5A72;font-style:italic;line-height:1.6;margin-bottom:4px">${esc(interpretSection(sec))}</div>
        ${noteHtml}
        ${kpiStrip(kpiChips)}
        ${(() => {
          const cr = compRowForSection(sec.id)
          if (!cr || !comparison) return ''
          const refDate = new Date(comparison.refDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
          const parts: string[] = []
          if (cr.prevNb !== null && cr.currNb !== null && cr.currNb !== cr.prevNb) {
            const d = cr.currNb - cr.prevNb
            const col = d > 0 ? '#B01A1A' : '#1A7A4A'
            parts.push(`Nb&nbsp;: <span style="color:${col};font-weight:600">${cr.prevNb} &gt; ${cr.currNb} (${d > 0 ? '+' : ''}${d})</span>`)
          }
          if (cr.prevMontant !== null && cr.currMontant !== null && cr.currMontant !== cr.prevMontant) {
            const d = cr.currMontant - cr.prevMontant
            const col = d > 0 ? '#B01A1A' : '#1A7A4A'
            parts.push(`Montant&nbsp;: <span style="color:${col};font-weight:600">${eurFmt(cr.prevMontant)} &gt; ${eurFmt(cr.currMontant)}</span>`)
          }
          if (parts.length === 0) return ''
          return `<div style="font-size:8pt;color:#A0A0B8;margin-top:4px;margin-bottom:-4px">vs&nbsp;audit&nbsp;du&nbsp;${esc(refDate)}&nbsp;— ${parts.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}</div>`
        })()}
        ${infoOnlyHtml}
        ${sdHtml}
        ${exclHtml}
        ${tableHtml}
      </div>
    </div>`
  }

  // ── CSS ────────────────────────────────────────────────────────────────────

  const css = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, 'Helvetica Neue', Arial, 'Segoe UI', sans-serif; color: #1A1A2E; font-size: 11pt; background: #fff; line-height: 1.55; }

/* Headings must never break mid-word */
h1, h2, h3, .section-title {
  word-break: keep-all;
  overflow-wrap: normal;
  white-space: normal;
  hyphens: none;
}

.page-break { page-break-before: always; padding: 52px; }
.no-break { page-break-inside: avoid; }
/* Prevent a section title from being orphaned at bottom of page */
.section-title { page-break-after: avoid; }
/* Prevent card header from detaching from card body */
.card-header-block { page-break-after: avoid; }

/* Cover — fixed to exactly 1 page, overflow hidden prevents spill onto page 2 */
.cover { height: 100vh; overflow: hidden; display: flex; flex-direction: column; background: #0B1929; }

/* Data table — long tables repeat header on next page */
.data-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
.data-table thead { display: table-header-group; }   /* repeat on page break */
.data-table thead tr { background: #F3F3F9; }
.data-table th { padding: 9px 12px; font-size: 8pt; font-weight: 700; color: #0B1929; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 2px solid #DCDCEC; word-break: keep-all; white-space: nowrap; }
.data-table td { padding: 9px 12px; border-bottom: 1px solid #F0F0F6; vertical-align: top; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr.row-ok td { background: #F2FAF6; }
.data-table tbody tr { page-break-inside: avoid; }

/* Synthesis table */
.synth-table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 18px 0; }
.synth-table thead { display: table-header-group; }
.synth-table th { background: #0B1929; color: white; padding: 10px 14px; font-size: 8pt; font-weight: 700; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
.synth-table td { padding: 9px 14px; border-bottom: 1px solid #F0F0F6; vertical-align: middle; }
.synth-table tr:nth-child(even) td { background: #FAFAFA; }
.pen { font-weight: 700; text-align: right !important; }
.pen.zero { color: #1A7A4A; }
.pen.neg { color: #B01A1A; }

/* Section title */
.section-title { font-size: 12pt; font-weight: 700; color: #0B1929; text-transform: uppercase; letter-spacing: 0.08em; padding-bottom: 11px; border-bottom: 2px solid #C49A2E; margin-bottom: 28px; }

/* Bilan table */
.bilan-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 6px 0 18px; }
.bilan-table thead { display: table-header-group; }
.bilan-table th { background: #F3F3F9; color: #0B1929; padding: 8px 10px; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 2px solid #DCDCEC; white-space: nowrap; }
.bilan-table td { padding: 8px 10px; border-bottom: 1px solid #F0F0F6; }
.bilan-table tr:last-child td { border-bottom: none; }
.bilan-table tbody tr { page-break-inside: avoid; }
`

  // ── Cover ──────────────────────────────────────────────────────────────────

  const coverBgStyle = bgCoverBase64
    ? `background-image:url('data:image/png;base64,${bgCoverBase64}');background-size:cover;background-position:center;background-repeat:no-repeat`
    : 'background:#0B1929'

  const coverHTML = `
  <div class="cover" style="${coverBgStyle}">
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:52px 64px;background:rgba(15,31,53,0.72)">
      <div style="font-size:9pt;font-weight:700;color:#C49A2E;text-transform:uppercase;letter-spacing:0.2em;margin-bottom:18px">${esc(modeLabel)}</div>
      <div style="font-size:36pt;font-weight:800;color:#FFFFFF;line-height:1.1;margin-bottom:12px">${esc(agence || '—')}</div>
      <div style="font-size:11pt;color:rgba(255,255,255,0.65);margin-bottom:64px">Période : ${dateFmt(dateDebut)} — ${dateFmt(dateFin)}</div>

      <div style="display:flex;align-items:center;gap:40px;padding:32px 36px;border:1px solid rgba(196,154,46,0.4);border-radius:12px;background:rgba(15,31,53,0.65);max-width:520px;page-break-inside:avoid">
        ${scoreArc(globalScore, niveauColor)}
        <div style="flex:1">
          <div style="font-size:28pt;font-weight:800;color:${esc(niveauColor)};line-height:1">${globalScore}<span style="font-size:14pt;font-weight:400;color:rgba(255,255,255,0.45)">/100</span></div>
          <div style="display:inline-block;margin:8px 0 14px;padding:4px 16px;border-radius:20px;background:${esc(niveauBg)};color:${esc(niveauColor)};font-weight:700;font-size:11pt">${esc(niveauLabel)}</div>
          <div style="font-size:9.5pt;color:rgba(255,255,255,0.6);margin-bottom:3px">Pénalité totale : <strong style="color:#E88080">−${penalite.toFixed(1)} pts</strong></div>
          ${garantie > 0 ? `<div style="font-size:9.5pt;color:rgba(255,255,255,0.6);margin-bottom:2px">Garantie financière : <strong style="color:#FFFFFF">${esc(eurFmt(garantie))}</strong></div>` : ''}
          ${pointe > 0 ? `<div style="font-size:9.5pt;color:rgba(255,255,255,0.6);margin-bottom:2px">Pointe : <strong style="color:#FFFFFF">${esc(eurFmt(pointe))}${pointeDate ? ' au ' + dateFmt(pointeDate) : ''}</strong></div>` : ''}
          ${mode === 'gerance' && nbMandats ? `<div style="font-size:9.5pt;color:rgba(255,255,255,0.6)">Mandats : <strong style="color:#FFFFFF">${nbMandats}</strong></div>` : ''}
          ${mode === 'copro' && nbCopro !== undefined ? `<div style="font-size:9.5pt;color:rgba(255,255,255,0.6)">Copropriétés : <strong style="color:#FFFFFF">${nbCopro}</strong></div>` : ''}
        </div>
      </div>
    </div>

  </div>`

  // ── Synthesis ──────────────────────────────────────────────────────────────

  // KPI summary strip at top of synthesis
  const synthKpi = kpiStrip([
    { label: 'Score global', val: `${globalScore} / 100`, color: niveauColor },
    { label: 'Pénalité cumulée', val: `−${penalite.toFixed(1)} pts`, color: penalite > 0 ? '#B01A1A' : '#1A7A4A' },
    ...(garantie > 0 ? [{ label: 'Garantie financière', val: eurFmt(garantie), color: '#0B1929' }] : []),
    ...(pointe > 0 ? [{ label: pointeDate ? `Pointe au ${dateFmt(pointeDate)}` : 'Pointe', val: eurFmt(pointe), color: '#0B1929' }] : []),
  ])

  const synthRows = syntheseRows.map(row => {
    const penStr = row.exclu ? '—' : row.penalite > 0 ? `−${row.penalite.toFixed(1)}` : '0'
    const maxStr = row.penaliteMax > 0 ? `/ ${row.penaliteMax}` : '—'
    const penCls = row.penalite > 0 && !row.exclu ? 'neg' : 'zero'
    const typeLabel = row.exclu ? 'Exclu' : row.type === 'info' ? 'Info' : row.type === 'critique' ? 'Critique' : 'Scoring'
    const statusHtml = row.exclu
      ? `<span style="color:#9A9AB0;font-size:8.5pt">Non score</span>`
      : row.penalite > 0
        ? `<span style="display:inline-flex;align-items:center;padding:2px 9px 2px 6px;border-radius:20px;background:#FAEAEA;color:#B01A1A;font-weight:700;font-size:8pt;white-space:nowrap">${colorDot('#B01A1A')}Anomalie</span>`
        : `<span style="display:inline-flex;align-items:center;padding:2px 9px 2px 6px;border-radius:20px;background:#EAF6EF;color:#1A7A4A;font-weight:700;font-size:8pt;white-space:nowrap">${colorDot('#1A7A4A')}OK</span>`
    const montantStr = row.montant != null ? eurFmt(row.montant) : '—'
    return `<tr>
      <td>${esc(row.label)}${row.exclu ? ' <em style="color:#9A9AB0;font-size:9pt">(exclu)</em>' : ''}</td>
      <td style="text-align:center;font-size:8.5pt;color:#7A7A8C">${esc(typeLabel)}</td>
      <td style="text-align:right">${row.nb != null ? row.nb : '—'}</td>
      <td style="text-align:right;font-size:9pt;color:#1A1A2E">${montantStr}</td>
      <td class="pen ${penCls}">${penStr}</td>
      <td style="text-align:right;color:#9A9AB0;font-size:9pt">${maxStr}</td>
      <td style="text-align:center">${statusHtml}</td>
    </tr>`
  }).join('')

  // ── Comparison encart for synthesis page ──────────────────────────────────

  let synthComparisonBlock = ''
  if (comparison) {
    const refDateFmtSynth = new Date(comparison.refDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const sDelta = comparison.currScore - comparison.prevScore
    const sColor = sDelta > 0 ? '#1A7A4A' : sDelta < 0 ? '#B01A1A' : '#7A7A8C'
    const sBg    = sDelta > 0 ? '#EAF6EF' : sDelta < 0 ? '#FAEAEA' : '#F2F2F2'

    const miniRows = comparison.rows.map(r => {
      const nbD = r.prevNb !== null && r.currNb !== null ? r.currNb - r.prevNb : null
      const mtD = r.prevMontant !== null && r.currMontant !== null ? r.currMontant - r.prevMontant : null
      if (nbD === 0 && (mtD === null || mtD === 0)) return ''
      const nbColor = nbD === null || nbD === 0 ? '#7A7A8C' : nbD < 0 ? '#1A7A4A' : '#B01A1A'
      const mtColor = mtD === null || mtD === 0 ? '#7A7A8C' : mtD < 0 ? '#1A7A4A' : '#B01A1A'
      return `<tr style="border-bottom:1px solid #F0F0F6">
        <td style="padding:7px 12px;font-size:9pt;color:#1A1A2E">${esc(r.label)}</td>
        <td style="padding:7px 12px;text-align:right;font-size:9pt;white-space:nowrap">
          <span style="color:#9A9AB0;text-decoration:line-through;margin-right:4px">${r.prevNb ?? '—'}</span>
          <span style="font-weight:700;color:${nbColor}">${r.currNb ?? '—'}${nbD !== null && nbD !== 0 ? ` <span style="font-size:8pt">(${nbD > 0 ? '+' : ''}${nbD})</span>` : ''}</span>
        </td>
        <td style="padding:7px 12px;text-align:right;font-size:9pt;white-space:nowrap">
          ${r.prevMontant !== null && r.currMontant !== null
            ? `<span style="color:#9A9AB0;text-decoration:line-through;margin-right:4px">${eurFmt(r.prevMontant)}</span>
               <span style="font-weight:700;color:${mtColor}">${eurFmt(r.currMontant)}</span>`
            : '<span style="color:#9A9AB0">—</span>'}
        </td>
      </tr>`
    }).filter(Boolean).join('')

    synthComparisonBlock = `
    <div style="margin-top:28px;border:1.5px solid #DDD8CF;border-radius:10px;overflow:hidden;page-break-inside:avoid">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#F5F3EE;border-bottom:1px solid #DDD8CF">
        <div style="display:flex;align-items:center;gap:8px;font-size:10pt;font-weight:700;color:#0B1929">${sectionDot('🔄')} Évolution vs audit précédent</div>
        <div style="font-size:8.5pt;color:#9A9AB0;font-style:italic">Réf. : ${esc(comparison.refAgence)} — ${esc(refDateFmtSynth)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid #DDD8CF">
        <div>
          <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:0.06em;color:#9A9AB0;font-weight:600;margin-bottom:3px">Score global</div>
          <div style="display:flex;align-items:baseline;gap:8px">
            <span style="font-size:11pt;color:#9A9AB0;text-decoration:line-through">${comparison.prevScore}</span>
            <span style="font-size:9pt;color:#9A9AB0;padding:0 6px">&gt;</span>
            <span style="font-size:15pt;font-weight:800;color:#0B1929">${comparison.currScore}<span style="font-size:9pt;font-weight:400;color:#9A9AB0">/100</span></span>
          </div>
        </div>
        <div style="margin-left:16px;padding:5px 14px;border-radius:20px;background:${sBg};color:${sColor};font-size:10.5pt;font-weight:800;white-space:nowrap">
          ${sDelta >= 0 ? '+' : '-'}${Math.abs(sDelta).toFixed(1)} pts
        </div>
      </div>
      ${miniRows ? `
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#F9F8F5">
            <th style="text-align:left;padding:7px 12px;font-size:8pt;color:#7A7A8C;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Anomalie</th>
            <th style="text-align:right;padding:7px 12px;font-size:8pt;color:#7A7A8C;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Nombre</th>
            <th style="text-align:right;padding:7px 12px;font-size:8pt;color:#7A7A8C;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Montant</th>
          </tr>
        </thead>
        <tbody>${miniRows}</tbody>
      </table>` : `
      <div style="display:flex;align-items:center;padding:12px 16px;font-size:9pt;color:#1A7A4A;font-weight:600;background:#EAF6EF">
        ${colorDot('#1A7A4A')}Aucun ecart significatif par rapport a l'audit de reference.
      </div>`}
    </div>`
  }

  const syntheseHTML = `
  <div class="page-break">
    ${pageHeader()}
    <h1 class="section-title">Synthèse générale</h1>
    ${synthKpi}
    ${globalNote ? `
    <div style="margin-top:18px;padding:14px 18px;background:#FAF8F4;border:1px solid #E8E4DC;border-left:3px solid #C49A2E;border-radius:8px">
      <div style="font-size:9pt;font-weight:700;color:#C49A2E;text-transform:uppercase;letter-spacing:.4px;margin-bottom:7px">Note générale de l'auditeur</div>
      <div style="font-size:10pt;font-weight:700;color:#1A1A2E;line-height:1.6;white-space:pre-wrap">${esc(globalNote)}</div>
    </div>` : ''}
    <table class="synth-table" style="margin-top:24px">
      <thead>
        <tr>
          <th>Poste d'audit</th>
          <th style="width:70px;text-align:center">Type</th>
          <th style="width:50px;text-align:right">Nb</th>
          <th style="width:90px;text-align:right">Montant</th>
          <th style="width:80px;text-align:right">Pénalité</th>
          <th style="width:60px;text-align:right">Max</th>
          <th style="width:90px;text-align:center">Statut</th>
        </tr>
      </thead>
      <tbody>${synthRows}</tbody>
      <tfoot>
        <tr style="background:#0B1929">
          <td colspan="4" style="color:#C49A2E;font-weight:700;padding:10px 14px;font-size:10pt;letter-spacing:0.04em">SCORE GLOBAL</td>
          <td colspan="3" style="color:#C49A2E;font-weight:800;font-size:13pt;text-align:right;padding:10px 14px">${globalScore} / 100 &nbsp;—&nbsp; ${esc(niveauLabel)}</td>
        </tr>
      </tfoot>
    </table>
    ${synthComparisonBlock}
  </div>`

  // ── Detailed sections ──────────────────────────────────────────────────────

  const sectionsHTML = sections.map(sec => `
  <div class="page-break">
    ${pageHeader()}
    ${renderCard(sec)}
  </div>`).join('\n')

  // Factures are now rendered as a section card via renderCard (no separate page)

  // ── Bilan (copro) ──────────────────────────────────────────────────────────

  let bilanHTML = ''
  if (bilan && bilan.total > 0) {
    const bilanLvl = bilan.nbRisque > 0 ? (bilan.groups.some(g => g.riskColor === '#B01A1A') ? 'bad' : 'warn') : 'ok'
    const bilanColor = bilanLvl === 'bad' ? '#B01A1A' : bilanLvl === 'warn' ? '#D06020' : '#1A7A4A'
    const risk4count = bilan.groups.find(g => g.riskColor === '#B01A1A')?.rows.length ?? 0
    const risk3count = bilan.groups.find(g => g.riskColor === '#C05C1A')?.rows.length ?? 0
    const risk2count = bilan.groups.find(g => g.riskColor === '#C8A020')?.rows.length ?? 0
    const risk1count = bilan.groups.find(g => g.riskColor === '#1A7A4A')?.rows.length ?? 0
    const sain = bilan.total - bilan.nbRisque - risk1count
    const bilanInterpret = bilan.nbRisque === 0
      ? `Le portefeuille de ${bilan.total} copropriété(s) ne présente aucune résidence avec plusieurs indicateurs dégradés simultanément — situation globalement saine.`
      : `Sur ${bilan.total} copropriétés analysées, ${bilan.nbRisque} présentent au moins 2 indicateurs dégradés.${risk4count > 0 ? ` ${risk4count} résidence(s) en risque critique (4 anomalies) nécessitent une intervention immédiate.` : ''}${risk3count > 0 ? ` ${risk3count} résidence(s) en risque élevé (3 anomalies).` : ''}${risk2count > 0 ? ` ${risk2count} résidence(s) en risque modéré (2 anomalies).` : ''}`

    const bilanNoteHtml = bilan.note
      ? `<div style="margin:18px 0 0;padding:11px 0 11px 16px;border-left:3px solid #C49A2E">
          <div style="font-size:7.5pt;font-weight:700;color:#C49A2E;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px">Commentaire de l'auditeur</div>
          <div style="font-size:10pt;color:#1A1A2E;font-style:italic;line-height:1.6">${esc(bilan.note)}</div>
        </div>`
      : ''

    const groupsHTML = bilan.groups.map(g => {
      const grpBg = g.riskColor === '#B01A1A' ? '#FEF5F5' : g.riskColor === '#C05C1A' ? '#FEF8F0' : g.riskColor === '#C8A020' ? '#FFFBEC' : '#EAF6EF'
      return `
      <div style="margin-top:20px">
        <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:6px;background:${grpBg};margin-bottom:8px">
          <span style="font-size:10.5pt;font-weight:700;color:${g.riskColor}">${esc(g.riskLabel.replace(/^[✗✓]+\s*/, ''))}</span>
          <span style="font-size:8.5pt;color:#9A9AB0;margin-left:auto">${g.rows.length} résidence(s)</span>
        </div>
        <table class="bilan-table">
          <thead>
            <tr>
              <th style="text-align:left">Résidence</th>
              <th style="text-align:right;width:50px">Lots</th>
              <th style="text-align:right;width:80px">Impayés</th>
              <th style="text-align:right;width:80px">Charges</th>
              <th style="text-align:right;width:80px">Travaux</th>
              <th style="text-align:right;width:80px">Trésorerie</th>
            </tr>
          </thead>
          <tbody>
            ${g.rows.map(r => `
              <tr>
                <td style="color:#1A1A2E">${esc(r.name)}</td>
                <td style="text-align:right;color:#7A7A8C">${esc(r.lots)}</td>
                <td style="text-align:right;font-weight:${r.impayesAnomalie ? '700' : '400'};color:${r.impayesAnomalie ? '#B01A1A' : '#1A1A2E'}">${esc(r.impayes)}</td>
                <td style="text-align:right;font-weight:${r.chargesAnomalie ? '700' : '400'};color:${r.chargesAnomalie ? '#B01A1A' : '#1A1A2E'}">${esc(r.charges)}</td>
                <td style="text-align:right;font-weight:${r.travauxAnomalie ? '700' : '400'};color:${r.travauxAnomalie ? '#B01A1A' : '#1A1A2E'}">${esc(r.travaux)}</td>
                <td style="text-align:right;font-weight:${r.tresorerieAnomalie ? '700' : '400'};color:${r.tresorerieAnomalie ? '#B01A1A' : '#1A1A2E'}">${esc(r.tresorerie)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`
    }).join('')

    bilanHTML = `
    <div class="page-break">
      ${pageHeader()}
      <h1 class="section-title">État financier des copropriétés</h1>
      <div style="border:1px solid #E4E4EC;border-radius:10px;overflow:hidden;page-break-inside:avoid">
        <div style="border-top:3px solid ${bilanColor}"></div>
        <div style="display:flex;align-items:flex-start;gap:14px;padding:16px 20px 14px;border-bottom:1px solid #F0F0F6">
          ${sectionDot('📊')}
          <div style="flex:1">
            <div style="font-size:12pt;font-weight:700;color:#0B1929">État financier des copropriétés</div>
            <div style="margin-top:6px">${statusPill(bilanLvl)}</div>
          </div>
          <div style="text-align:right;white-space:nowrap">
            <div style="font-size:14pt;font-weight:800;color:${bilanColor}">${bilan.nbRisque}</div>
            <div style="font-size:7.5pt;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.05em">à risque</div>
          </div>
        </div>
        <div style="padding:18px 20px 20px">
          <div style="font-size:9.5pt;color:#5A5A72;font-style:italic;line-height:1.6;margin-bottom:4px">${esc(bilanInterpret)}</div>
          ${bilanNoteHtml}
          ${kpiStrip([
            { label: 'Total copropriétés', val: String(bilan.total), color: '#0B1929' },
            { label: 'Risque critique (4 anom.)', val: String(risk4count), color: risk4count > 0 ? '#B01A1A' : '#9A9AB0' },
            { label: 'Risque élevé (3 anom.)', val: String(risk3count), color: risk3count > 0 ? '#C05C1A' : '#9A9AB0' },
            { label: 'Risque modéré (2 anom.)', val: String(risk2count), color: risk2count > 0 ? '#C05C1A' : '#9A9AB0' },
            { label: 'Risque faible (1 anom.)', val: String(risk1count), color: risk1count > 0 ? '#7A7A8C' : '#9A9AB0' },
          ])}
          <div style="margin:16px 0 8px;font-size:8pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.09em">Détail par niveau de risque</div>
          ${groupsHTML}
        </div>
      </div>
    </div>`
  }

  // ── Final HTML ─────────────────────────────────────────────────────────────
  // Note: comparison is embedded in syntheseHTML (synthComparisonBlock) — no separate page

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Rapport Audit — ${esc(agence || '—')}</title>
  <style>${css}</style>
</head>
<body>
  ${coverHTML}
  ${syntheseHTML}
  ${sectionsHTML}
  ${bilanHTML}
</body>
</html>`
}
