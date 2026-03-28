export type AuditMode = 'gerance' | 'copro'

export type AnomalyLevel = 'ok' | 'warn' | 'bad'
export type AnomalyType = 'scoring' | 'info' | 'critique'

// Annotation par ligne
export interface Annotation {
  comment: string
  include: boolean
}
export type AnnotationsMap = Record<string, Annotation>

// Generic Excel row (tableau de valeurs brutes)
export type ExcelRow = (string | number | null)[]

// État des données Gérance
export interface GeranceData {
  quittancement: number
  encaissement: number
  quittancement_rows: ExcelRow[]   // lignes brutes pour filtrage par agence (col[0]=agence, col[7]=quitt, col[8]=encaiss)
  att_deb: ExcelRow[]
  prop_deb: ExcelRow[]
  prop_cred: ExcelRow[]
  prop_deb_sorti: ExcelRow[]
  prop_deb_sorti_nc?: number | null
  bq_nonrapp: ExcelRow[]
  bq_nonclot?: ExcelRow[]
  cpta_nonrapp: ExcelRow[]
  factures: ExcelRow[]
  factures_nr30: ExcelRow[]
  factures_nr60: ExcelRow[]
  // colonnes noteCol (indices de la colonne "Nota bene" dans chaque fichier)
  att_deb_nc?: number | null
  prop_deb_nc?: number | null
  prop_cred_nc?: number | null
  bq_nonrapp_nc?: number | null
  cpta_nonrapp_nc?: number | null
  factures_nc?: number | null
}

// État des données Copropriété
export interface CoproData {
  balance_bad: ExcelRow[]
  att_deb: ExcelRow[]
  att_cred: ExcelRow[]
  ventes_deb: ExcelRow[]
  ventes_cred: ExcelRow[]
  fourn_deb: ExcelRow[]
  bq_nonrapp: ExcelRow[]
  bq_nonclot?: ExcelRow[]
  cpta_nonrapp: ExcelRow[]
  factures: ExcelRow[]
  factures_nr30: ExcelRow[]
  factures_nr60: ExcelRow[]
  bilan: ExcelRow[]
  // colonnes noteCol
  balance_nc?: number | null
  att_deb_nc?: number | null
  att_cred_nc?: number | null
  ventes_nc?: number | null
  fourn_deb_nc?: number | null
  bq_nonrapp_nc?: number | null
  cpta_nonrapp_nc?: number | null
  factures_nc?: number | null
}

// Résultat de scoring
export interface ScoreResult {
  anomalies: AnomalyResult[]
  totalPenalite: number
  scoreGlobal: number
  niveau: NiveauScore
}

export interface AnomalyResult {
  id: string
  label: string
  type: AnomalyType
  montant: number | null
  nb: number | null
  nbExclu: number
  anciennete: number | null
  scoreMontant: number
  scoreVolume: number
  scoreAnciennete: number
  /** ratio montant / garantie (en décimal, ex: 0.005 = 0,5%) */
  ratio: number | null
  /** ratio volume / nb référentiel (en décimal, ex: 0.03 = 3%) */
  ratioVolume: number | null
  penalite: number
  penaliteMax: number
  noteAnomalie: number | null
  bloquant: boolean
  exclu: boolean
}

export interface NiveauScore {
  min: number
  label: string
  color: string
  bg: string
}

// Session d'audit (en mémoire ou depuis la DB)
export interface AuditSession {
  id?: string
  agence: string
  mode: AuditMode
  dateDebut: string
  dateFin: string
  garantie: number
  pointe: number
  pointeDate: string
  /** Nombre de mandats (gérance) — issu de l'export liste mandats */
  nbMandats: number
  donneesG?: GeranceData
  donneesC?: CoproData
  annotations: AnnotationsMap
  score?: ScoreResult
}

// Config d'un fichier à importer
export interface FileConfig {
  id: string
  name: string
  desc: string
  icon: string
}

export interface AnomalyMetric {
  nb: number
  montant: number | null
  penalite: number
}

export interface ReportEntry {
  id: string
  batchId: string
  datasetId?: string
  timestamp: string  // ISO
  agence: string
  mode: AuditMode
  scoreGlobal: number
  niveau: string
  nbAnomalies: number
  totalPenalite: number
  status?: 'valid' | 'deleted'
  metrics?: Record<string, AnomalyMetric>
  /** Free-text auditor notes per section. Key = sectionKey, value = content. Empty strings excluded. */
  sectionNotes?: Record<string, string>
  /** Whether a full data snapshot is stored in localStorage for this entry */
  hasSnapshot?: boolean
}

/** Full data snapshot stored per history entry to allow session restoration */
export interface HistorySnapshot {
  donneesG: GeranceData
  donneesC: CoproData
  garantie: number
  pointe: number
  pointeDate: string
  dateDebut: string
  dateFin: string
  nbMandats: number
  annots: AnnotationsMap
  sectionNotes: Record<string, string>
  forcedOk: Record<string, boolean>
  fileLoaded: Record<string, string>
  agences: string[]
  zGerancePointe: [string, { garantie: number; pointe: number }][]
  zCoproPointe: [string, { garantie: number; pointe: number; nbCopro: number }][]
  zGeranceMandats: [string, number][]
}
