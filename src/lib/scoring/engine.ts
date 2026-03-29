import type {
  GeranceData,
  CoproData,
  AnomalyResult,
  ScoreResult,
  NiveauScore,
  AnnotationsMap,
  ExcelRow,
} from '@/types/audit'

// ─── BARÈMES ───────────────────────────────────────────────────────────────────
//
// Source : "IDEES AUDIT + CALCUL SCORE.docx"
// Chaque pénalité est un nombre positif (ex: 5 = -5 pts).
// Score final = 100 − somme des pénalités (plancher 0).
//
// Référence montant  → garantie financière de l'agence
// Référence volume   → % du nb de mandats (gérance) ou nb de copros (copro)
// ─────────────────────────────────────────────────────────────────────────────

// Barème montant commun COPRO (max 10) — fourn_deb, att_deb, ventes_deb
// ratio = montantAnomalie / garantie
const BAREME_MONTANT_COPRO: { max: number; pen: number }[] = [
  { max: 0,       pen: 0    },
  { max: 0.0005,  pen: 0.25 }, // ]0 – 0,05%]
  { max: 0.001,   pen: 0.75 }, // ]0,05 – 0,1%]
  { max: 0.002,   pen: 1.50 }, // ]0,1 – 0,2%]
  { max: 0.003,   pen: 2.50 }, // ]0,2 – 0,3%]
  { max: 0.004,   pen: 3.50 }, // ]0,3 – 0,4%]
  { max: 0.005,   pen: 4.50 }, // ]0,4 – 0,5%]
  { max: 0.006,   pen: 5.50 }, // ]0,5 – 0,6%]
  { max: 0.007,   pen: 6.50 }, // ]0,6 – 0,7%]
  { max: 0.01,    pen: 8.50 }, // ]0,7 – 1%]
  { max: Infinity,pen: 10   }, // > 1%
]

// Barème volume COPRO – Fournisseurs débiteurs (max 10) — seuil max > 20%
// ratio = nb fournisseurs en anomalie / nb total copros
const BAREME_VOLUME_COPRO_FOURN: { max: number; pen: number }[] = [
  { max: 0,       pen: 0    },
  { max: 0.01,    pen: 0.50 }, // ]0 – 1%]
  { max: 0.02,    pen: 1.25 }, // ]1 – 2%]
  { max: 0.05,    pen: 2.75 }, // ]2 – 5%]
  { max: 0.08,    pen: 4.25 }, // ]5 – 8%]
  { max: 0.12,    pen: 6.00 }, // ]8 – 12%]
  { max: 0.16,    pen: 7.75 }, // ]12 – 16%]
  { max: 0.20,    pen: 9.25 }, // ]16 – 20%]
  { max: Infinity,pen: 10   }, // > 20%
]

// Barème volume COPRO – Attente deb + Vendeurs deb (max 10) — seuil max > 10%
// ratio = nb immeubles impactés / nb total copros
const BAREME_VOLUME_COPRO_RESTE: { max: number; pen: number }[] = [
  { max: 0,       pen: 0    },
  { max: 0.01,    pen: 0.50 }, // ]0 – 1%]
  { max: 0.02,    pen: 1.50 }, // ]1 – 2%]
  { max: 0.03,    pen: 2.50 }, // ]2 – 3%]
  { max: 0.05,    pen: 4.00 }, // ]3 – 5%]
  { max: 0.07,    pen: 5.50 }, // ]5 – 7%]
  { max: 0.10,    pen: 7.50 }, // ]7 – 10%]
  { max: Infinity,pen: 10   }, // > 10%
]

// Barème montant GÉRANCE – Prop débiteur actif + Cpte attente (max 8,75)
// ratio = montantAnomalie / garantie
const BAREME_MONTANT_G_ACTIF: { max: number; pen: number }[] = [
  { max: 0,       pen: 0    },
  { max: 0.0005,  pen: 0.22 }, // ]0 – 0,05%]
  { max: 0.001,   pen: 0.66 }, // ]0,05 – 0,1%]
  { max: 0.002,   pen: 1.31 }, // ]0,1 – 0,2%]
  { max: 0.003,   pen: 2.19 }, // ]0,2 – 0,3%]
  { max: 0.004,   pen: 3.06 }, // ]0,3 – 0,4%]
  { max: 0.005,   pen: 3.94 }, // ]0,4 – 0,5%]
  { max: 0.006,   pen: 4.81 }, // ]0,5 – 0,6%]
  { max: 0.007,   pen: 5.69 }, // ]0,6 – 0,7%]
  { max: 0.01,    pen: 7.44 }, // ]0,7 – 1%]
  { max: Infinity,pen: 8.75 }, // > 1%
]

// Barème montant GÉRANCE – Prop débiteur sorti (max 12,5)
const BAREME_MONTANT_G_SORTI: { max: number; pen: number }[] = [
  { max: 0,       pen: 0     },
  { max: 0.0005,  pen: 0.31  }, // ]0 – 0,05%]
  { max: 0.001,   pen: 0.94  }, // ]0,05 – 0,1%]
  { max: 0.002,   pen: 1.88  }, // ]0,1 – 0,2%]
  { max: 0.003,   pen: 3.13  }, // ]0,2 – 0,3%]
  { max: 0.004,   pen: 4.38  }, // ]0,3 – 0,4%]
  { max: 0.005,   pen: 5.63  }, // ]0,4 – 0,5%]
  { max: 0.006,   pen: 6.88  }, // ]0,5 – 0,6%]
  { max: 0.007,   pen: 8.13  }, // ]0,6 – 0,7%]
  { max: 0.01,    pen: 10.63 }, // ]0,7 – 1%]
  { max: Infinity,pen: 12.50 }, // > 1%
]

// Barème volume GÉRANCE – Prop débiteur actif + Cpte attente (max 8,75)
// ratio = nb anomalies / nb mandats total
const BAREME_VOLUME_G_ACTIF: { max: number; pen: number }[] = [
  { max: 0,       pen: 0    },
  { max: 0.01,    pen: 0.3  }, // ]0 – 1%]
  { max: 0.02,    pen: 0.7  }, // ]1 – 2%]
  { max: 0.03,    pen: 1.3  }, // ]2 – 3%]
  { max: 0.05,    pen: 2.4  }, // ]3 – 5%]
  { max: 0.07,    pen: 4.0  }, // ]5 – 7%]
  { max: 0.10,    pen: 6.25 }, // ]7 – 10%]
  { max: Infinity,pen: 8.75 }, // > 10%
]

// Barème volume GÉRANCE – Prop débiteur sorti (max 12,5)
const BAREME_VOLUME_G_SORTI: { max: number; pen: number }[] = [
  { max: 0,       pen: 0     },
  { max: 0.01,    pen: 0.5   }, // ]0 – 1%]
  { max: 0.02,    pen: 1.2   }, // ]1 – 2%]
  { max: 0.03,    pen: 2.2   }, // ]2 – 3%]
  { max: 0.05,    pen: 4.0   }, // ]3 – 5%]
  { max: 0.07,    pen: 6.0   }, // ]5 – 7%]
  { max: 0.10,    pen: 8.75  }, // ]7 – 10%]
  { max: Infinity,pen: 12.50 }, // > 10%
]

// Barème ancienneté – Rapprochements (bq + cpta), commun aux deux modes (max 15)
const BAREME_ANCIENNETE_RAPP: { max: number; pen: number }[] = [
  { max: 30,      pen: 0  }, // < 30j
  { max: 60,      pen: 5  }, // 30 – 60j
  { max: 90,      pen: 10 }, // 60 – 90j
  { max: Infinity,pen: 15 }, // > 90j
]

// Niveaux d'interprétation (inchangés)
const NIVEAUX: NiveauScore[] = [
  { min: 90, label: 'Excellent',    color: '#1A7A4A', bg: '#EAF6EF' },
  { min: 85, label: 'Bien',         color: '#1A7A4A', bg: '#EAF6EF' },
  { min: 80, label: 'Satisfaisant', color: '#1A7A4A', bg: '#EAF6EF' },
  { min: 70, label: 'Attention',    color: '#C8A020', bg: '#FFFBEC' },
  { min: 60, label: 'Vigilance',    color: '#C05C1A', bg: '#FDF0E6' },
  { min: 0,  label: 'Dégradé',      color: '#B01A1A', bg: '#FAEAEA' },
]

// ─── HELPERS ───────────────────────────────────────────────────────────────────

function lookup(bareme: { max: number; pen: number }[], ratio: number): number {
  if (ratio <= 0) return 0
  for (const tier of bareme) {
    if (ratio <= tier.max) return tier.pen
  }
  return bareme[bareme.length - 1].pen
}

/** Convertit une date Excel (serial ou JJ/MM/AAAA) en nombre de jours depuis aujourd'hui */
function daysOld(val: string | number | null | undefined): number {
  if (!val) return 0
  let date: Date
  if (typeof val === 'number') {
    // Excel serial — extract UTC date components to avoid timezone-shift day errors
    const utc = new Date(Math.round((val - 25569) * 86400000))
    date = new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate())
  } else {
    const s = String(val).trim()
    const parts = s.split('/')
    if (parts.length === 3) {
      // Format JJ/MM/AAAA → ISO YYYY-MM-DD
      date = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`)
    } else {
      date = new Date(s)
    }
  }
  if (isNaN(date.getTime())) return 0
  // Compare against local midnight to avoid time-of-day influence on day count
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86_400_000))
}

function maxAge(rows: ExcelRow[], dateCol: number): number {
  return rows.reduce((m, r) => Math.max(m, daysOld(r[dateCol])), 0)
}

/** Read nb jours directly from a numeric column (not computed from a date) */
function maxNbJours(rows: ExcelRow[], col: number): number {
  return rows.reduce((m, r) => Math.max(m, parseFloat(String(r[col] ?? 0)) || 0), 0)
}

function aKey(category: string, index: number): string {
  return `${category}_${index}`
}

function includedRows(items: ExcelRow[], category: string, annots: AnnotationsMap): ExcelRow[] {
  return items.filter((_, i) => {
    const a = annots[aKey(category, i)]
    return !a || a.include !== false
  })
}

/**
 * Pénalité BQ (512) — volume uniquement.
 *   0 écriture → 0
 *   1 écriture → −10
 *   > 1        → −15
 */
function penBqRapp(nb: number): { pen: number; penVolume: number } {
  if (nb === 0) return { pen: 0, penVolume: 0 }
  const penVolume = nb === 1 ? 10 : 15
  return { pen: penVolume, penVolume }
}

/**
 * Pénalité CPTA — ancienneté uniquement.
 *   0 écriture → 0
 *   >= 1       → barème ancienneté (< 30j=0 / 30-60j=−5 / 60-90j=−10 / > 90j=−15)
 */
function penCptaRapp(nb: number, ageMax: number): { pen: number; penAge: number } {
  if (nb === 0) return { pen: 0, penAge: 0 }
  const penAge = lookup(BAREME_ANCIENNETE_RAPP, ageMax)
  return { pen: penAge, penAge }
}

export function calcNiveau(score: number): NiveauScore {
  for (const n of NIVEAUX) {
    if (score >= n.min) return n
  }
  return NIVEAUX[NIVEAUX.length - 1]
}

export function scoreLevelText(niveau: NiveauScore): string {
  switch (niveau.label) {
    case 'Excellent':    return 'Niveau de maîtrise comptable excellent'
    case 'Bien':         return 'Niveau de maîtrise comptable bien maîtrisé'
    case 'Satisfaisant': return 'Niveau de maîtrise comptable satisfaisant'
    case 'Attention':    return 'Des points d\'attention ont été identifiés'
    case 'Vigilance':    return 'Des points de vigilance ont été identifiés'
    default:             return "Des anomalies significatives nécessitent une attention immédiate"
  }
}

// ─── GÉRANCE ──────────────────────────────────────────────────────────────────
//
// Répartition max (total = 100) :
//   Quittancement       →  10
//   Prop débiteur actif →  17,5  (montant 8,75 + volume 8,75)
//   Prop débiteur sorti →  25    (montant 12,5 + volume 12,5)  [futur]
//   Cpte attente deb    →  17,5  (montant 8,75 + volume 8,75)
//   Rapp. 512           →  15
//   Rapp. compta        →  15
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param garantie  Montant de la garantie financière de l'agence
 * @param nbMandats Nombre total de mandats (issu export liste mandats).
 *                  Si 0, la pénalité volume n'est pas calculée.
 */
export function computeScoreGerance(
  data: GeranceData,
  garantie: number,
  annots: AnnotationsMap,
  nbMandats = 0,
): ScoreResult {
  const anomalies: AnomalyResult[] = []

  // ── 1. Quittancement / Encaissement (max 10) ────────────────────────────
  {
    const hasData = data.quittancement > 0
    let pen = 0
    let taux = 1

    if (hasData) {
      taux = data.encaissement / data.quittancement
      const pct = taux * 100
      if      (pct >= 100) pen = 0
      else if (pct >= 99)  pen = 0.5
      else if (pct >= 98)  pen = 1
      else if (pct >= 97)  pen = 1.5
      else if (pct >= 96)  pen = 2
      else if (pct >= 95)  pen = 3
      else if (pct >= 93)  pen = 4
      else if (pct >= 91)  pen = 6
      else if (pct >= 89)  pen = 7.5
      else if (pct >= 87)  pen = 8.5
      else if (pct >= 85)  pen = 9
      else                 pen = 10
    }

    anomalies.push({
      id: 'quitt', label: 'Quittancement / Encaissement',
      type: hasData ? 'scoring' : 'info',
      montant: data.encaissement || null,
      nb: null, nbExclu: 0, anciennete: null,
      scoreMontant: 0, scoreVolume: 0, scoreAnciennete: 0,
      ratio: hasData ? taux : null, ratioVolume: null,
      penalite: pen, penaliteMax: 10,
      noteAnomalie: null, bloquant: false, exclu: !hasData,
    })
  }

  // ── 2. Propriétaires débiteurs actifs (max 17,5) ────────────────────────
  {
    const incl = includedRows(data.prop_deb, 'propdeb', annots)
    const montant = incl.reduce((s, r) => s + Math.abs(parseFloat(String(r[6] ?? 0)) || 0), 0)
    const nb = incl.length
    const nbExclu = data.prop_deb.length - nb
    const ratioM = garantie > 0 ? montant / garantie : 0
    const ratioV = nbMandats > 0 ? nb / nbMandats : 0
    const penM = lookup(BAREME_MONTANT_G_ACTIF, ratioM)
    const penV = nbMandats > 0 ? lookup(BAREME_VOLUME_G_ACTIF, ratioV) : 0

    anomalies.push({
      id: 'propdeb', label: 'Propriétaires débiteurs actifs',
      type: 'scoring',
      montant, nb, nbExclu, anciennete: null,
      scoreMontant: penM, scoreVolume: penV, scoreAnciennete: 0,
      ratio: ratioM, ratioVolume: ratioV,
      penalite: Math.min(penM + penV, 17.5), penaliteMax: 17.5,
      noteAnomalie: null, bloquant: false, exclu: false,
    })
  }

  // ── 2b. Propriétaires débiteurs sortis (max 25) ─────────────────────────────
  {
    const sorti = data.prop_deb_sorti ?? []
    const incl = includedRows(sorti, 'propdbsorti', annots)
    const montant = incl.reduce((s, r) => s + Math.abs(parseFloat(String(r[10] ?? 0)) || 0), 0)
    const nb = incl.length
    const nbExclu = sorti.length - nb
    const ratioM = garantie > 0 ? montant / garantie : 0
    const ratioV = nbMandats > 0 ? nb / nbMandats : 0
    const penM = lookup(BAREME_MONTANT_G_SORTI, ratioM)
    const penV = nbMandats > 0 ? lookup(BAREME_VOLUME_G_SORTI, ratioV) : 0

    anomalies.push({
      id: 'propdbsorti', label: 'Propriétaires débiteurs sortis',
      type: 'scoring',
      montant, nb, nbExclu, anciennete: null,
      scoreMontant: penM, scoreVolume: penV, scoreAnciennete: 0,
      ratio: ratioM, ratioVolume: ratioV,
      penalite: Math.min(penM + penV, 25), penaliteMax: 25,
      noteAnomalie: null, bloquant: false, exclu: false,
    })
  }

  // ── 3. Propriétaires sortis créditeurs — info uniquement ────────────────
  anomalies.push({
    id: 'propcred', label: 'Proprios sortis créditeurs',
    type: 'info',
    montant: null, nb: data.prop_cred.length, nbExclu: 0, anciennete: null,
    scoreMontant: 0, scoreVolume: 0, scoreAnciennete: 0,
    ratio: null, ratioVolume: null,
    penalite: 0, penaliteMax: 0,
    noteAnomalie: null, bloquant: false, exclu: true,
  })

  // ── 4. Comptes attente débiteurs (max 17,5) ──────────────────────────────
  {
    const incl = includedRows(data.att_deb, 'attdeb', annots)
    const montant = incl.reduce((s, r) => s + Math.abs(parseFloat(String(r[8] ?? 0)) || 0), 0)
    const nb = incl.length
    const nbExclu = data.att_deb.length - nb
    const ratioM = garantie > 0 ? montant / garantie : 0
    const ratioV = nbMandats > 0 ? nb / nbMandats : 0
    const penM = lookup(BAREME_MONTANT_G_ACTIF, ratioM)
    const penV = nbMandats > 0 ? lookup(BAREME_VOLUME_G_ACTIF, ratioV) : 0

    anomalies.push({
      id: 'attdeb', label: 'Comptes attente débiteurs',
      type: 'scoring',
      montant, nb, nbExclu, anciennete: null,
      scoreMontant: penM, scoreVolume: penV, scoreAnciennete: 0,
      ratio: ratioM, ratioVolume: ratioV,
      penalite: Math.min(penM + penV, 17.5), penaliteMax: 17.5,
      noteAnomalie: null, bloquant: false, exclu: false,
    })
  }

  // ── 5. Écritures non rapp. 512 (max 15) — volume uniquement ─────────────
  // Date : col[14]  |  Statut filtré au parsing
  {
    const incl = includedRows(data.bq_nonrapp, 'bqrapp', annots)
    const nb = incl.length
    const nbExclu = data.bq_nonrapp.length - nb
    const { pen, penVolume } = penBqRapp(nb)

    anomalies.push({
      id: 'bq_nonrapp', label: 'Écritures non rapp. 512',
      type: 'critique',
      montant: null, nb, nbExclu, anciennete: null,
      scoreMontant: 0, scoreVolume: penVolume, scoreAnciennete: 0,
      ratio: null, ratioVolume: null,
      penalite: pen, penaliteMax: 15,
      noteAnomalie: nb > 0 ? 0 : null,
      bloquant: false, exclu: false,
    })
  }

  // ── 6. Écritures non rapp. compta (max 15) — volume uniquement ──────────
  {
    const incl = includedRows(data.cpta_nonrapp, 'cptarapp', annots)
    const nb = incl.length
    const nbExclu = data.cpta_nonrapp.length - nb
    const { pen, penVolume } = penBqRapp(nb)  // 0→0 / 1→-10 / >1→-15

    anomalies.push({
      id: 'cpta_nonrapp', label: 'Écritures non rapp. compta',
      type: 'critique',
      montant: null, nb, nbExclu, anciennete: null,
      scoreMontant: 0, scoreVolume: penVolume, scoreAnciennete: 0,
      ratio: null, ratioVolume: null,
      penalite: pen, penaliteMax: 15,
      noteAnomalie: nb > 0 ? 0 : null,
      bloquant: false, exclu: false,
    })
  }

  const totalPenalite = anomalies
    .filter(a => !a.exclu)
    .reduce((s, a) => s + (a.penalite || 0), 0)

  const scoreGlobal = Math.max(0, Math.min(100, Math.round((100 - totalPenalite) * 10) / 10))

  return { anomalies, totalPenalite, scoreGlobal, niveau: calcNiveau(scoreGlobal) }
}

// ─── COPROPRIÉTÉ ──────────────────────────────────────────────────────────────
//
// Répartition max (total = 100) :
//   Balance déséquilibrée       →  10   (binaire : si existante → -10)
//   Fournisseurs débiteurs      →  20   (montant 10 + volume 10)
//   Cpte attente débiteurs      →  20   (montant 10 + volume 10)
//   Copro vendeurs débiteurs    →  20   (montant 10 + volume 10)
//   Rapp. 512                   →  15
//   Rapp. compta                →  15
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param garantie  Montant de la garantie financière
 * nbCopro est dérivé automatiquement de data.bilan.length
 */
export function computeScoreCopro(
  data: CoproData,
  garantie: number,
  annots: AnnotationsMap,
): ScoreResult {
  const anomalies: AnomalyResult[] = []
  // Nombre de copros "En gestion" — référentiel pour les ratios de volume
  const nbCopro = data.bilan.length

  // ── 1. Balance déséquilibrée (max 10, binaire) ──────────────────────────
  {
    const incl = includedRows(data.balance_bad, 'balance', annots)
    const nb = incl.length
    const nbExclu = data.balance_bad.length - nb
    const pen = nb > 0 ? 10 : 0

    anomalies.push({
      id: 'balance', label: 'Balance déséquilibrée',
      type: 'critique',
      montant: null, nb, nbExclu, anciennete: null,
      scoreMontant: 0, scoreVolume: 0, scoreAnciennete: 0,
      ratio: null, ratioVolume: null,
      penalite: pen, penaliteMax: 10,
      noteAnomalie: nb > 0 ? 0 : null,
      bloquant: false, exclu: false,
    })
  }

  // ── 2. Fournisseurs débiteurs (max 20) ───────────────────────────────────
  {
    const incl = includedRows(data.fourn_deb, 'fourndeb', annots)
    const montant = incl.reduce((s, r) => s + (parseFloat(String(r[10] ?? 0)) || 0), 0)
    const nb = incl.length
    const nbExclu = data.fourn_deb.length - nb
    const ratioM = garantie > 0 ? montant / garantie : 0
    const ratioV = nbCopro > 0 ? nb / nbCopro : 0
    const penM = lookup(BAREME_MONTANT_COPRO, ratioM)
    const penV = nbCopro > 0 ? lookup(BAREME_VOLUME_COPRO_FOURN, ratioV) : 0

    anomalies.push({
      id: 'fourndeb', label: 'Fournisseurs débiteurs',
      type: 'scoring',
      montant, nb, nbExclu, anciennete: null,
      scoreMontant: penM, scoreVolume: penV, scoreAnciennete: 0,
      ratio: ratioM, ratioVolume: ratioV,
      penalite: Math.min(penM + penV, 20), penaliteMax: 20,
      noteAnomalie: null, bloquant: false, exclu: false,
    })
  }

  // ── 3. Comptes attente débiteurs (max 20) ────────────────────────────────
  {
    const incl = includedRows(data.att_deb, 'cattdeb', annots)
    const montant = incl.reduce((s, r) => s + Math.abs(parseFloat(String(r[9] ?? 0)) || 0), 0)
    const nb = incl.length
    const nbExclu = data.att_deb.length - nb
    const ratioM = garantie > 0 ? montant / garantie : 0
    const ratioV = nbCopro > 0 ? nb / nbCopro : 0
    const penM = lookup(BAREME_MONTANT_COPRO, ratioM)
    const penV = nbCopro > 0 ? lookup(BAREME_VOLUME_COPRO_RESTE, ratioV) : 0

    anomalies.push({
      id: 'cattdeb', label: 'Comptes attente débiteurs',
      type: 'scoring',
      montant, nb, nbExclu, anciennete: null,
      scoreMontant: penM, scoreVolume: penV, scoreAnciennete: 0,
      ratio: ratioM, ratioVolume: ratioV,
      penalite: Math.min(penM + penV, 20), penaliteMax: 20,
      noteAnomalie: null, bloquant: false, exclu: false,
    })
  }

  // ── 4. Comptes attente créditeurs — info uniquement ──────────────────────
  anomalies.push({
    id: 'cattcred', label: 'Comptes attente créditeurs',
    type: 'info',
    montant: null, nb: data.att_cred.length, nbExclu: 0, anciennete: null,
    scoreMontant: 0, scoreVolume: 0, scoreAnciennete: 0,
    ratio: null, ratioVolume: null,
    penalite: 0, penaliteMax: 0,
    noteAnomalie: null, bloquant: false, exclu: true,
  })

  // ── 5. Copropriétaires vendeurs débiteurs (max 20) ───────────────────────
  {
    const incl = includedRows(data.ventes_deb, 'ventesdeb', annots)
    const montant = incl.reduce((s, r) => s + (parseFloat(String(r[10] ?? 0)) || 0), 0)
    const nb = incl.length
    const nbExclu = data.ventes_deb.length - nb
    const ratioM = garantie > 0 ? montant / garantie : 0
    const ratioV = nbCopro > 0 ? nb / nbCopro : 0
    const penM = lookup(BAREME_MONTANT_COPRO, ratioM)
    const penV = nbCopro > 0 ? lookup(BAREME_VOLUME_COPRO_RESTE, ratioV) : 0

    anomalies.push({
      id: 'ventesdeb', label: 'Copropriétaires vendeurs débiteurs',
      type: 'scoring',
      montant, nb, nbExclu, anciennete: null,
      scoreMontant: penM, scoreVolume: penV, scoreAnciennete: 0,
      ratio: ratioM, ratioVolume: ratioV,
      penalite: Math.min(penM + penV, 20), penaliteMax: 20,
      noteAnomalie: null, bloquant: false, exclu: false,
    })
  }

  // ── 6. Copropriétaires vendeurs créditeurs — info uniquement ────────────
  anomalies.push({
    id: 'ventescred', label: 'Copropriétaires vendeurs créditeurs',
    type: 'info',
    montant: null, nb: data.ventes_cred.length, nbExclu: 0, anciennete: null,
    scoreMontant: 0, scoreVolume: 0, scoreAnciennete: 0,
    ratio: null, ratioVolume: null,
    penalite: 0, penaliteMax: 0,
    noteAnomalie: null, bloquant: false, exclu: true,
  })

  // ── 7. Écritures non rapp. 512 (max 15) — volume uniquement ─────────────
  // Date : col[15]
  {
    const incl = includedRows(data.bq_nonrapp, 'bqrapp', annots)
    const nb = incl.length
    const nbExclu = data.bq_nonrapp.length - nb
    const { pen, penVolume } = penBqRapp(nb)

    anomalies.push({
      id: 'bq_nonrapp', label: 'Écritures non rapp. 512',
      type: 'critique',
      montant: null, nb, nbExclu, anciennete: null,
      scoreMontant: 0, scoreVolume: penVolume, scoreAnciennete: 0,
      ratio: null, ratioVolume: null,
      penalite: pen, penaliteMax: 15,
      noteAnomalie: nb > 0 ? 0 : null,
      bloquant: false, exclu: false,
    })
  }

  // ── 8. Écritures non rapp. compta (max 15) — volume uniquement ──────────
  {
    const incl = includedRows(data.cpta_nonrapp, 'cptarapp', annots)
    const nb = incl.length
    const nbExclu = data.cpta_nonrapp.length - nb
    const { pen, penVolume } = penBqRapp(nb)  // 0→0 / 1→-10 / >1→-15

    anomalies.push({
      id: 'cpta_nonrapp', label: 'Écritures non rapp. compta',
      type: 'critique',
      montant: null, nb, nbExclu, anciennete: null,
      scoreMontant: 0, scoreVolume: penVolume, scoreAnciennete: 0,
      ratio: null, ratioVolume: null,
      penalite: pen, penaliteMax: 15,
      noteAnomalie: nb > 0 ? 0 : null,
      bloquant: false, exclu: false,
    })
  }

  const totalPenalite = anomalies
    .filter(a => !a.exclu)
    .reduce((s, a) => s + (a.penalite || 0), 0)

  const scoreGlobal = Math.max(0, Math.min(100, Math.round((100 - totalPenalite) * 10) / 10))

  return { anomalies, totalPenalite, scoreGlobal, niveau: calcNiveau(scoreGlobal) }
}
