'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type {
  AuditMode,
  GeranceData,
  CoproData,
  AnnotationsMap,
  Annotation,
  ExcelRow,
  ScoreResult,
  AnomalyResult,
  FileConfig,
  ReportEntry,
  AnomalyMetric,
  HistorySnapshot,
} from '@/types/audit'
import { computeScoreGerance, computeScoreCopro, scoreLevelText } from '@/lib/scoring/engine'
import { parseGerance, parseGeranceZPointe, parseGeranceZMandats } from '@/lib/parsers/gerance'
import { parseCopro, parseCoproZPointe } from '@/lib/parsers/copro'
import { eur, pct, truncate, excelDateFmt } from '@/lib/utils/format'
import { buildPDFPayload } from '@/lib/report/pdf'
import type { PDFPayload } from '@/lib/report/pdf'

// ─── FILE CONFIGS ──────────────────────────────────────────────────────────────

const FILE_CONFIGS_GERANCE: FileConfig[] = [
  { id: 'z_pointe',      name: 'Garantie / Pointe',    desc: 'Z-GERANCE_POINTE',            icon: '🔐' },
  { id: 'z_mandats',     name: 'Liste mandats',         desc: 'Z-GERANCE_LISTE_MANDATS',     icon: '📋' },
  { id: 'quittancement', name: 'Quittancement / Encaissement', desc: 'Detail_Quitt__Encaissements', icon: '💰' },
  { id: 'prop_deb',      name: 'Propriétaires débiteurs', desc: 'PROPRIETAIRES_DEBITEURS',     icon: '🔴' },
  { id: 'prop_cred',     name: 'Propriétaires créditeurs sortis', desc: 'PROPRIETAIRES_SORTIS_CRED',   icon: '🟡' },
  { id: 'att_deb',       name: 'Attente débiteurs',     desc: 'Cptes_d_attente_deb',         icon: '⏳' },
  { id: 'bq_nonrapp',    name: 'Banque non rapp.',      desc: 'ECR_BANQUES',                 icon: '🏦' },
  { id: 'cpta_nonrapp',  name: 'Compta non rapp.',      desc: 'ECRITURES_COMPTA',            icon: '📒' },
  { id: 'factures',      name: 'Factures',              desc: 'Factures_Global',             icon: '🧾' },
]

const FILE_CONFIGS_COPRO: FileConfig[] = [
  { id: 'z_pointe',      name: 'Garantie / Pointe',      desc: 'Z-COPRO_POINTE',                icon: '🔐' },
  { id: 'balance',       name: 'Balance',                 desc: 'VERIFICATION_BALANCE',          icon: '⚖️' },
  { id: 'fourn_deb',     name: 'Fournisseurs débiteurs',  desc: 'DEBITS_FOURNISSEURS',           icon: '🔴' },
  { id: 'att_deb',       name: 'Attente débiteurs',       desc: 'COMPTES_ATTENTES_DIVERS_DEB',   icon: '⏳' },
  { id: 'att_cred',      name: 'Attente créditeurs',      desc: 'Comptes_attente_divers_Cred',   icon: '🟡' },
  { id: 'ventes',        name: 'Ventes non soldées',      desc: 'VENTES_NON_SOLDEES',            icon: '🔄' },
  { id: 'bq_nonrapp',    name: 'Banque non rapp.',        desc: 'COMPTES_ECRITURES_BANQUES',     icon: '🏦' },
  { id: 'cpta_nonrapp',  name: 'Compta non rapp.',        desc: 'ECRITURES_COMPTA_NON_RAPP',     icon: '📒' },
  { id: 'factures',      name: 'Factures',                desc: 'Factures_Global',               icon: '🧾' },
  { id: 'bilan',         name: 'Bilan / État financier',  desc: 'BILAN_POSITION_MANDATS',        icon: '📊' },
]

// ─── FILE VALIDATION ───────────────────────────────────────────────────────────
// Nombre minimum de colonnes attendu par fichier selon le mode
// cIds correspondant aux catégories "info seulement" — pas de notion justifié/injustifié
const INFO_CIDS = new Set(['propcred', 'cattcred', 'ventescred', 'bq_nonclot'])

const FILE_MIN_COLS: Record<string, Record<string, number>> = {
  gerance: {
    z_pointe: 8, z_mandats: 9, quittancement: 9, factures: 13,
    prop_deb: 11, prop_cred: 7, att_deb: 9, bq_nonrapp: 16, cpta_nonrapp: 15,
  },
  copro: {
    z_pointe: 8, balance: 8, att_deb: 10, att_cred: 10, ventes: 11,
    fourn_deb: 11, factures: 13, bq_nonrapp: 19, cpta_nonrapp: 14, bilan: 26,
  },
}

// ─── INITIAL STATE ─────────────────────────────────────────────────────────────

const EMPTY_GERANCE: GeranceData = {
  quittancement: 0,
  encaissement: 0,
  quittancement_rows: [],
  att_deb: [],
  prop_deb: [],
  prop_deb_sorti: [],
  prop_cred: [],
  bq_nonrapp: [],
  bq_nonclot: [],
  cpta_nonrapp: [],
  factures: [],
  factures_nr30: [],
  factures_nr60: [],
}

const EMPTY_COPRO: CoproData = {
  balance_bad: [],
  att_deb: [],
  att_cred: [],
  ventes_deb: [],
  ventes_cred: [],
  fourn_deb: [],
  bq_nonrapp: [],
  bq_nonclot: [],
  cpta_nonrapp: [],
  factures: [],
  factures_nr30: [],
  factures_nr60: [],
  bilan: [],
}

// ─── MODAL STATE ──────────────────────────────────────────────────────────────

type ColDef = { header: string; fn: (r: ExcelRow, nc: number | null) => string; right?: boolean }

interface ModalState {
  open: boolean
  title: string
  cId: string
  rows: ExcelRow[]
  nameFn: (r: ExcelRow) => string
  valFn: (r: ExcelRow) => number
  valClass: string
  subFn: ((r: ExcelRow) => string) | null
  isBilan?: boolean
  cols?: ColDef[]
  nc?: number | null
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function smartLevel(nb: number, montant: number): 'ok' | 'warn' | 'bad' {
  if (nb === 0) return 'ok'
  let s = 0
  if (montant > 50000) s += 3
  else if (montant > 10000) s += 2
  else if (montant > 2000) s += 1
  if (nb > 10) s += 2
  else if (nb > 3) s += 1
  return s >= 3 ? 'bad' : 'warn'
}

function badgeClass(level: string): string {
  if (level === 'ok') return 'badge-ok'
  if (level === 'warn') return 'badge-warn'
  if (level === 'bad') return 'badge-bad'
  return 'badge-info'
}

function badgeLabel(level: string): string {
  if (level === 'ok') return '✓ OK'
  if (level === 'warn') return '⚠ Attention'
  if (level === 'bad') return '✗ Anomalie'
  return 'ℹ Info'
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function AuditClient({ mode }: { mode: AuditMode }) {
  const router = useRouter()

  // Form fields
  const [dateDebut, setDateDebut] = useState('2025-01-01')
  const [dateFin, setDateFin] = useState(() => new Date().toISOString().slice(0, 10))
  const [garantie, setGarantie] = useState(0)
  const [pointe, setPointe] = useState(0)
  const [pointeDate, setPointeDate] = useState('2025-01-01')
  const [nbMandats, setNbMandats] = useState(0)
  const [agences, setAgences] = useState<string[]>([])
  const [selectedAgence, setSelectedAgence] = useState<string | null>(null)
  const [reportAgences, setReportAgences] = useState<string[]>([])
  const [zGerancePointe, setZGerancePointe] = useState<Map<string, { garantie: number; pointe: number }>>(new Map())
  const [zGeranceMandats, setZGeranceMandats] = useState<Map<string, number>>(new Map())
  const [zCoproPointe, setZCoproPointe] = useState<Map<string, { garantie: number; pointe: number; nbCopro: number }>>(new Map())

  // Data
  const [donneesG, setDonneesG] = useState<GeranceData>({ ...EMPTY_GERANCE })
  const [donneesC, setDonneesC] = useState<CoproData>({ ...EMPTY_COPRO })
  const [fileLoaded, setFileLoaded] = useState<Record<string, string>>({})
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({})
  const [fileKeys, setFileKeys] = useState<Record<string, number>>({})
  const [annots, setAnnots] = useState<AnnotationsMap>({})
  const [forcedOk, setForcedOk] = useState<Record<string, boolean>>({})
  const [bilanModal, setBilanModal] = useState<{ open: boolean; title: string; rows: ExcelRow[] }>({ open: false, title: '', rows: [] })
  const [sectionNotes, setSectionNotes] = useState<Record<string, string>>({})
  const [restoreKey, setRestoreKey] = useState(0)
  const annotsByAgenceRef = useRef<Record<string, AnnotationsMap>>({})
  const notesByAgenceRef = useRef<Record<string, Record<string, string>>>({})
  const [modalSearch, setModalSearch] = useState('')
  const [fileObjects, setFileObjects] = useState<Record<string, File>>({})
  const [reportHistory, setReportHistory] = useState<ReportEntry[]>([])
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('c21_audit_history') || '[]')
      if (stored.length > 0) setReportHistory(stored)
    } catch { /* noop */ }
  }, [])

  const [validatedAgencies, setValidatedAgencies] = useState<Set<string>>(new Set())
  const [showHistory, setShowHistory] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ batchId: string; count: number } | null>(null)
  const [validateConfirm, setValidateConfirm] = useState<string | null>(null)
  const [validateMultiConfirm, setValidateMultiConfirm] = useState<string[] | null>(null)
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set())
  const [historyWarning, setHistoryWarning] = useState<string | null>(null) // kept for compatibility
  const [histFilterAgence, setHistFilterAgence] = useState('')
  const [histFilterMode, setHistFilterMode] = useState<'' | 'gerance' | 'copro'>('')
  const [histFilterDateFrom, setHistFilterDateFrom] = useState('')
  const [histFilterDateTo, setHistFilterDateTo] = useState('')
  const [comparisonRefId, setComparisonRefId] = useState<string | null>(null)
  const [comparisonEnabled, setComparisonEnabled] = useState(true)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [nonClotIncluded, setNonClotIncluded] = useState<Record<string, boolean>>({})
  const [showAllNonClot, setShowAllNonClot] = useState(false)
  const sessionBatchId = useRef(crypto.randomUUID())

  // Modal
  const [modal, setModal] = useState<ModalState>({
    open: false,
    title: '',
    cId: '',
    rows: [],
    nameFn: () => '',
    valFn: () => 0,
    valClass: '',
    subFn: null,
  })

  const fileConfigs = mode === 'gerance' ? FILE_CONFIGS_GERANCE : FILE_CONFIGS_COPRO

  // ── Computed score ──────────────────────────────────────────────────────────

  const hasAnyData = useCallback(() => {
    if (Object.values(forcedOk).some(Boolean)) return true
    if (garantie > 0 || pointe > 0) return true
    if (mode === 'gerance') {
      return (
        donneesG.quittancement > 0 ||
        donneesG.prop_deb.length > 0 ||
        donneesG.factures.length > 0 ||
        donneesG.bq_nonrapp.length > 0 ||
        donneesG.att_deb.length > 0
      )
    }
    return (
      donneesC.balance_bad.length > 0 ||
      donneesC.fourn_deb.length > 0 ||
      donneesC.att_deb.length > 0 ||
      donneesC.ventes_deb.length > 0 ||
      donneesC.ventes_cred.length > 0 ||
      donneesC.factures.length > 0 ||
      donneesC.bq_nonrapp.length > 0 ||
      donneesC.bilan.length > 0
    )
  }, [mode, garantie, pointe, donneesG, donneesC, forcedOk])

  // true when agencies were loaded from Z files (checkbox mode active)
  const agenceSelectMode = agences.length > 0

  /** Filter rows by checked agencies. Returns empty when agencies loaded but none checked. */
  function filterByAgence<T extends ExcelRow>(rows: T[], col: number): T[] {
    if (!agenceSelectMode) return rows          // no Z file: show all (manual mode)
    if (reportAgences.length === 0) return []   // Z loaded but nothing checked: show nothing
    const norms = reportAgences.map(a => normalizeAgence(a))
    return rows.filter(r => norms.includes(normalizeAgence(String(r[col] ?? '').trim())))
  }

  const filteredG: GeranceData = agenceSelectMode && reportAgences.length === 0
    ? { ...EMPTY_GERANCE }
    : reportAgences.length > 0 ? (() => {
    const qRows = filterByAgence(donneesG.quittancement_rows ?? [], 0)
    const q = qRows.reduce((s, r) => s + (r[7] != null && !isNaN(Number(r[7])) ? parseFloat(String(r[7])) : 0), 0)
    const e = qRows.reduce((s, r) => s + (r[8] != null && !isNaN(Number(r[8])) ? parseFloat(String(r[8])) : 0), 0)
    return {
    ...donneesG,
    quittancement_rows: qRows,
    quittancement: q,
    encaissement: e,
    prop_deb: filterByAgence(donneesG.prop_deb, 0),
    prop_deb_sorti: filterByAgence(donneesG.prop_deb_sorti ?? [], 0),
    prop_cred: filterByAgence(donneesG.prop_cred, 0),
    att_deb: filterByAgence(donneesG.att_deb, 0),
    bq_nonrapp: filterByAgence(donneesG.bq_nonrapp, 1),
    bq_nonclot: filterByAgence(donneesG.bq_nonclot ?? [], 1),
    cpta_nonrapp: filterByAgence(donneesG.cpta_nonrapp, 1),
    factures: filterByAgence(donneesG.factures, 1),
    factures_nr30: filterByAgence(donneesG.factures_nr30, 1),
    factures_nr60: filterByAgence(donneesG.factures_nr60, 1),
  }})() : donneesG

  const filteredC: CoproData = agenceSelectMode && reportAgences.length === 0
    ? { ...EMPTY_COPRO }
    : reportAgences.length > 0 ? {
    ...donneesC,
    balance_bad: filterByAgence(donneesC.balance_bad, 0),
    att_deb: filterByAgence(donneesC.att_deb, 0),
    att_cred: filterByAgence(donneesC.att_cred, 0),
    ventes_deb: filterByAgence(donneesC.ventes_deb, 0),
    ventes_cred: filterByAgence(donneesC.ventes_cred, 0),
    fourn_deb: filterByAgence(donneesC.fourn_deb, 0),
    bq_nonrapp: filterByAgence(donneesC.bq_nonrapp, 0),
    bq_nonclot: filterByAgence(donneesC.bq_nonclot ?? [], 0),
    cpta_nonrapp: filterByAgence(donneesC.cpta_nonrapp, 0),
    factures: filterByAgence(donneesC.factures, 1),
    factures_nr30: filterByAgence(donneesC.factures_nr30, 1),
    factures_nr60: filterByAgence(donneesC.factures_nr60, 1),
    bilan: filterByAgence(donneesC.bilan, 0),
  } : donneesC

  // Apply "force 0 anomalie" overrides: if a card is forced OK and no file loaded, zero out its data
  const E: ExcelRow[] = []
  const scoredG: GeranceData = {
    ...filteredG,
    quittancement: (forcedOk['quittancement'] && !fileLoaded['quittancement']) ? 0 : filteredG.quittancement,
    encaissement:  (forcedOk['quittancement'] && !fileLoaded['quittancement']) ? 0 : filteredG.encaissement,
    factures:      (forcedOk['factures']      && !fileLoaded['factures'])      ? E : filteredG.factures,
    factures_nr30: (forcedOk['factures']      && !fileLoaded['factures'])      ? E : filteredG.factures_nr30,
    factures_nr60: (forcedOk['factures']      && !fileLoaded['factures'])      ? E : filteredG.factures_nr60,
    prop_deb:      (forcedOk['prop_deb']      && !fileLoaded['prop_deb'])      ? E : filteredG.prop_deb,
    prop_deb_sorti:(forcedOk['prop_deb']      && !fileLoaded['prop_deb'])      ? E : filteredG.prop_deb_sorti ?? E,
    prop_cred:     (forcedOk['prop_cred']     && !fileLoaded['prop_cred'])     ? E : filteredG.prop_cred,
    att_deb:       (forcedOk['att_deb']       && !fileLoaded['att_deb'])       ? E : filteredG.att_deb,
    bq_nonrapp:    (forcedOk['bq_nonrapp']    && !fileLoaded['bq_nonrapp'])    ? E : filteredG.bq_nonrapp,
    cpta_nonrapp:  (forcedOk['cpta_nonrapp']  && !fileLoaded['cpta_nonrapp'])  ? E : filteredG.cpta_nonrapp,
  }
  const scoredC: CoproData = {
    ...filteredC,
    balance_bad:   (forcedOk['balance']       && !fileLoaded['balance'])       ? E : filteredC.balance_bad,
    att_deb:       (forcedOk['att_deb']       && !fileLoaded['att_deb'])       ? E : filteredC.att_deb,
    att_cred:      (forcedOk['att_cred']      && !fileLoaded['att_cred'])      ? E : filteredC.att_cred,
    ventes_deb:    (forcedOk['ventes']        && !fileLoaded['ventes'])        ? E : filteredC.ventes_deb,
    ventes_cred:   (forcedOk['ventes']        && !fileLoaded['ventes'])        ? E : filteredC.ventes_cred,
    fourn_deb:     (forcedOk['fourn_deb']     && !fileLoaded['fourn_deb'])     ? E : filteredC.fourn_deb,
    factures:      (forcedOk['factures']      && !fileLoaded['factures'])      ? E : filteredC.factures,
    factures_nr30: (forcedOk['factures']      && !fileLoaded['factures'])      ? E : filteredC.factures_nr30,
    factures_nr60: (forcedOk['factures']      && !fileLoaded['factures'])      ? E : filteredC.factures_nr60,
    bq_nonrapp:    (forcedOk['bq_nonrapp']    && !fileLoaded['bq_nonrapp'])    ? E : filteredC.bq_nonrapp,
    cpta_nonrapp:  (forcedOk['cpta_nonrapp']  && !fileLoaded['cpta_nonrapp'])  ? E : filteredC.cpta_nonrapp,
    bilan:         (forcedOk['bilan']         && !fileLoaded['bilan'])         ? E : filteredC.bilan,
  }

  const effectiveGarantie = garantie
  const effectiveNbMandats = nbMandats

  const score: ScoreResult | null = (hasAnyData() && (!agenceSelectMode || reportAgences.length > 0))
    ? mode === 'gerance'
      ? computeScoreGerance(scoredG, garantie, annots, nbMandats)
      : computeScoreCopro(scoredC, garantie, annots)
    : null

  // ── Agency helpers ───────────────────────────────────────────────────────────

  /** Normalize agency name: strips leading "O1-" / "01-" prefix and trailing " – 2" / " - 1" suffix */
  function normalizeAgence(s: string): string {
    return s
      .replace(/^[A-Za-z]?\d+[-\s]+/, '')   // "O1-", "01-", "A2 "
      .replace(/\s*[-–—]\s*\d+\s*$/, '')    // " – 1", " - 2", " — 3"
      .trim()
  }

  // ── File handling ───────────────────────────────────────────────────────────

  function handleFile(event: React.ChangeEvent<HTMLInputElement>, id: string) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer
      if (!buffer) return

      // Validation : vérifier le nombre minimum de colonnes
      // On prend le max sur les 5 premières lignes (les exports Z ont une 1ère ligne vide)
      try {
        const XLSX = (require('xlsx') as typeof import('xlsx'))
        const wb = XLSX.read(buffer, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as (string | number | null)[][]
        const effectiveCols = Math.max(0, ...rows.slice(0, 5).map(r => r.length))
        const minCols = FILE_MIN_COLS[mode]?.[id]
        if (minCols && effectiveCols < minCols) {
          setFileErrors(prev => ({ ...prev, [id]: `Fichier incorrect — ${effectiveCols} colonnes détectées, minimum ${minCols} attendu` }))
          setFileLoaded(prev => { const n = { ...prev }; delete n[id]; return n })
          return
        }
      } catch {
        setFileErrors(prev => ({ ...prev, [id]: 'Impossible de lire le fichier Excel' }))
        return
      }
      // Fichier valide : effacer toute erreur précédente
      setFileErrors(prev => { const n = { ...prev }; delete n[id]; return n })
      setFileObjects(prev => ({ ...prev, [id]: file }))

      // Fichiers spéciaux : auto-remplissage des champs sidebar
      if (id === 'z_pointe') {
        if (mode === 'gerance') {
          const map = parseGeranceZPointe(buffer)
          setZGerancePointe(map)
          const keys = Array.from(map.keys()).sort()
          setAgences(prev => prev.length === 0 ? keys : prev)
        } else {
          const map = parseCoproZPointe(buffer)
          setZCoproPointe(map)
          const keys = Array.from(map.keys()).sort()
          setAgences(prev => prev.length === 0 ? keys : prev)
        }
        setFileLoaded(prev => ({ ...prev, [id]: file.name }))
        return
      }
      if (id === 'z_mandats') {
        const map = parseGeranceZMandats(buffer)
        setZGeranceMandats(map)
        if (map.size === 1) {
          setNbMandats(Array.from(map.values())[0])
        }
        setFileLoaded(prev => ({ ...prev, [id]: file.name }))
        return
      }

      // Fichiers métier normaux
      if (mode === 'gerance') {
        const parsed = parseGerance({ [id]: buffer })
        setDonneesG(prev => {
          const next = { ...prev, ...parsed }
          const agenceSet = new Set<string>()
          const addA = (rows: ExcelRow[], col: number) => rows.forEach(r => { const v = String(r[col] ?? '').trim(); if (v && !v.startsWith('Total') && !v.startsWith('Filtre')) agenceSet.add(v) })
          addA(next.quittancement_rows ?? [], 0)
          addA(next.prop_deb, 0)
          addA(next.prop_deb_sorti ?? [], 0)
          addA(next.att_deb, 0)
          addA(next.factures, 1)
          addA(next.bq_nonrapp, 1)
          addA(next.cpta_nonrapp, 1)
          const sorted = Array.from(agenceSet).sort()
          setAgences(sorted)
          return next
        })
      } else {
        const parsed = parseCopro({ [id]: buffer })
        setDonneesC(prev => {
          const next = { ...prev, ...parsed }
          const agenceSet = new Set<string>()
          const addA = (rows: ExcelRow[], col: number) => rows.forEach(r => { const v = String(r[col] ?? '').trim(); if (v && !v.startsWith('Total') && !v.startsWith('Filtre')) agenceSet.add(v) })
          addA(next.fourn_deb, 0)
          addA(next.att_deb, 0)
          addA(next.bilan, 0)
          addA(next.ventes_deb, 0)
          addA(next.bq_nonrapp, 1)
          addA(next.cpta_nonrapp, 0)
          const sorted = Array.from(agenceSet).sort()
          setAgences(sorted)
          return next
        })
      }
      setFileLoaded(prev => ({ ...prev, [id]: file.name }))
    }
    reader.readAsArrayBuffer(file)
  }

  // ── Annotations ─────────────────────────────────────────────────────────────

  function aKey(cId: string, i: number) {
    return `${cId}_${i}`
  }

  function getAnnot(cId: string, i: number): Annotation {
    return annots[aKey(cId, i)] || { comment: '', include: true }
  }

  function toggleInclude(cId: string, i: number) {
    const k = aKey(cId, i)
    setAnnots(prev => {
      const cur = prev[k] || { comment: '', include: true }
      return { ...prev, [k]: { ...cur, include: !cur.include } }
    })
  }

  function saveComment(cId: string, i: number, value: string) {
    const k = aKey(cId, i)
    setAnnots(prev => {
      const cur = prev[k] || { comment: '', include: true }
      return { ...prev, [k]: { ...cur, comment: value } }
    })
  }

  function saveSectionNote(sid: string, text: string) {
    setSectionNotes(prev => ({ ...prev, [sid]: text.trim() }))
  }

  function renderSectionNote(sid: string) {
    return (
      <div className="section-note-wrap">
        <div className="section-note-label">📝 Note de l&apos;auditeur</div>
        <textarea
          key={`${restoreKey}_${selectedAgence ?? 'none'}_${sid}`}
          className="section-note-input"
          rows={2}
          placeholder="Commentaire libre sur cette section…"
          defaultValue={sectionNotes[sid] || ''}
          onBlur={e => saveSectionNote(sid, e.target.value)}
        />
      </div>
    )
  }

  function renderGlobalNote() {
    return (
      <div className="global-note-block">
        <div className="global-note-block-label">📝 Note générale de l&apos;auditeur</div>
        <textarea
          key={`${restoreKey}_${selectedAgence ?? 'none'}___global__`}
          className="global-note-block-input"
          placeholder="Observations générales sur l'audit, contexte, points d'attention particuliers…"
          defaultValue={sectionNotes['__global__'] || ''}
          onBlur={e => saveSectionNote('__global__', e.target.value)}
        />
      </div>
    )
  }

  // ── File download ─────────────────────────────────────────────────────────────

  function downloadFile(id: string) {
    const file = fileObjects[id]
    if (!file) return
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // ── Summary helpers ──────────────────────────────────────────────────────────

  function nv(row: ExcelRow, idx: number): number {
    const v = row[idx]
    return typeof v === 'number' ? v : parseFloat(String(v ?? '')) || 0
  }

  function filterRows<T extends ExcelRow>(rows: T[], col: number, agence: string): T[] {
    return rows.filter(r => normalizeAgence(String(r[col] ?? '').trim()) === normalizeAgence(agence))
  }

  // ── Agency validation ─────────────────────────────────────────────────────────

  function toggleAgenceValidation(agence: string) {
    if (validatedAgencies.has(agence)) {
      // Un-validate immediately — no confirm needed
      setValidatedAgencies(prev => { const n = new Set(prev); n.delete(agence); return n })
    } else {
      // Validate → show confirmation modal
      setValidateConfirm(agence)
    }
  }

  function confirmAgenceValidation(agence: string) {
    setValidatedAgencies(prev => { const n = new Set(prev); n.add(agence); return n })
    if (score) saveToHistory(score, sectionNotes, agence)
    setValidateConfirm(null)
  }

  function confirmMultiAgenceValidation(norms: string[]) {
    setValidatedAgencies(prev => { const n = new Set(prev); norms.forEach(a => n.add(a)); return n })
    if (score) saveAgencesToHistory(score, sectionNotes, norms)
    setValidateMultiConfirm(null)
  }

  // ── Report history ────────────────────────────────────────────────────────────

  function saveToHistory(s: ScoreResult, notes?: Record<string, string>, agenceOverride?: string) {
    saveAgencesToHistory(s, notes, [agenceOverride || selectedAgence || 'Toutes agences'])
  }

  function saveAgencesToHistory(s: ScoreResult, notes: Record<string, string> | undefined, agenceList: string[]) {
    const metrics: Record<string, AnomalyMetric> = {}
    for (const a of s.anomalies) {
      metrics[a.id] = { nb: a.nb ?? 0, montant: a.montant, penalite: a.penalite }
    }
    const storedNotes: Record<string, string> = {}
    if (notes) {
      for (const [k, v] of Object.entries(notes)) {
        if (v.trim()) storedNotes[k] = v.trim()
      }
    }

    // Un seul snapshot partagé par toutes les agences du batch (clé = batchId)
    const batchId = crypto.randomUUID()
    const snapshot: HistorySnapshot = {
      donneesG, donneesC,
      garantie, pointe, pointeDate, dateDebut, dateFin, nbMandats,
      annots, sectionNotes: storedNotes, forcedOk, fileLoaded,
      agences,
      zGerancePointe: Array.from(zGerancePointe.entries()),
      zCoproPointe: Array.from(zCoproPointe.entries()),
      zGeranceMandats: Array.from(zGeranceMandats.entries()),
    }
    const snapKey = `c21_audit_snap_${batchId}`
    const snapData = JSON.stringify(snapshot)
    let hasSnapshot = false

    const tryStore = (): boolean => {
      try { localStorage.setItem(snapKey, snapData); return true } catch { return false }
    }

    if (!tryStore()) {
      // Stockage plein — purger les plus anciens batchIds distincts puis réessayer
      const seenBatches = new Set<string>()
      const oldBatchIds = [...reportHistory]
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .filter(e => { if (seenBatches.has(e.batchId)) return false; seenBatches.add(e.batchId); return true })
        .map(e => e.batchId)
      for (const oldBatch of oldBatchIds) {
        try { localStorage.removeItem(`c21_audit_snap_${oldBatch}`) } catch {}
        // legacy key fallback
        const legacyEntry = reportHistory.find(e => e.batchId === oldBatch)
        if (legacyEntry) try { localStorage.removeItem(`c21_audit_snap_${legacyEntry.id}`) } catch {}
        if (tryStore()) break
      }
    }

    hasSnapshot = localStorage.getItem(snapKey) !== null
    if (!hasSnapshot) {
      alert('⚠️ Stockage navigateur plein : les données complètes n\'ont pas pu être sauvegardées. Seul le résumé (score, anomalies) est conservé.')
    }

    // Une seule entrée — label combiné si plusieurs agences (ex: "MOISSY + MELUN")
    const agenceLabel = agenceList.length > 1 ? agenceList.join(' + ') : agenceList[0]
    const entry: ReportEntry = {
      id: crypto.randomUUID(),
      batchId,
      datasetId: batchId,
      timestamp: new Date().toISOString(),
      agence: agenceLabel,
      mode,
      scoreGlobal: s.scoreGlobal,
      niveau: s.niveau.label,
      nbAnomalies: s.anomalies.filter(a => !a.exclu && a.penalite > 0).length,
      totalPenalite: s.totalPenalite,
      status: 'valid' as const,
      metrics,
      hasSnapshot,
      ...(Object.keys(storedNotes).length > 0 && { sectionNotes: storedNotes }),
    }

    setReportHistory(prev => {
      const updated = [entry, ...prev]
      try { localStorage.setItem('c21_audit_history', JSON.stringify(updated)) } catch { /* noop */ }
      return updated
    })
  }

  function deleteHistoryBatch(batchId: string) {
    setReportHistory(prev => {
      const toDelete = prev.filter(e => e.batchId === batchId)
      // Supprimer le snapshot du batch (une seule entrée localStorage partagée)
      try { localStorage.removeItem(`c21_audit_snap_${batchId}`) } catch { /* noop */ }
      // Fallback legacy (anciens snapshots indexés par entry.id)
      toDelete.forEach(e => { try { localStorage.removeItem(`c21_audit_snap_${e.id}`) } catch { /* noop */ } })
      const updated = prev.filter(e => e.batchId !== batchId)
      try { localStorage.setItem('c21_audit_history', JSON.stringify(updated)) } catch { /* noop */ }
      return updated
    })
    setDeleteConfirm(null)
  }

  function deleteSelectedHistory(ids: Set<string>) {
    setReportHistory(prev => {
      const toDelete = prev.filter(e => ids.has(e.id))
      // Supprimer les snapshots des batchIds concernés (en évitant les doublons)
      const batchIds = new Set(toDelete.map(e => e.batchId))
      batchIds.forEach(bid => { try { localStorage.removeItem(`c21_audit_snap_${bid}`) } catch { /* noop */ } })
      toDelete.forEach(e => { try { localStorage.removeItem(`c21_audit_snap_${e.id}`) } catch { /* noop */ } })
      const updated = prev.filter(e => !ids.has(e.id))
      try { localStorage.setItem('c21_audit_history', JSON.stringify(updated)) } catch { /* noop */ }
      return updated
    })
    setSelectedHistoryIds(new Set())
  }

  function restoreFromHistory(entry: ReportEntry) {
    if (entry.mode !== mode) {
      alert(`Ce rapport est en mode ${entry.mode === 'gerance' ? 'Gérance' : 'Copropriété'}. Rendez-vous sur la page correspondante pour le restaurer.`)
      return
    }
    if (!entry.hasSnapshot) {
      // Legacy entry — only restore notes and agence
      setSelectedAgence(entry.agence)
      const matchingRawsLegacy = agences.filter(a => normalizeAgence(a) === entry.agence)
      setReportAgences(matchingRawsLegacy.length > 0 ? matchingRawsLegacy : [entry.agence])
      if (entry.sectionNotes) setSectionNotes(entry.sectionNotes)
      setShowHistory(false)
      return
    }
    try {
      // Chercher le snapshot par batchId (nouveau), fallback sur entry.id (legacy)
      const raw = localStorage.getItem(`c21_audit_snap_${entry.batchId}`)
             ?? localStorage.getItem(`c21_audit_snap_${entry.id}`)
      if (!raw) {
        alert('Données de restauration introuvables (peut-être effacées par le navigateur).')
        return
      }
      const snap: HistorySnapshot = JSON.parse(raw)

      // Décomposer le label d'agence (peut être "MOISSY + MELUN" pour un batch multi)
      const batchAgences = entry.agence.split(' + ').map(s => s.trim())
      const primaryAgence = batchAgences[0]

      setDonneesG(snap.donneesG)
      setDonneesC(snap.donneesC)
      setGarantie(snap.garantie)
      setPointe(snap.pointe)
      setPointeDate(snap.pointeDate)
      setDateDebut(snap.dateDebut)
      setDateFin(snap.dateFin)
      setNbMandats(snap.nbMandats)
      setAnnots(snap.annots)
      setSectionNotes(snap.sectionNotes)
      setForcedOk(snap.forcedOk)
      setFileLoaded(snap.fileLoaded)
      setAgences(snap.agences)
      setSelectedAgence(primaryAgence)

      // Restaurer toutes les agences du batch
      const allMatchingRaws = snap.agences.filter(a =>
        batchAgences.some(ba => normalizeAgence(a) === ba)
      )
      setReportAgences(allMatchingRaws.length > 0 ? allMatchingRaws : [primaryAgence])

      // Initialiser les refs annotations/notes par agence
      annotsByAgenceRef.current = { [primaryAgence]: snap.annots }
      notesByAgenceRef.current = { [primaryAgence]: snap.sectionNotes }

      if (snap.zGerancePointe) setZGerancePointe(new Map(snap.zGerancePointe))
      if (snap.zCoproPointe) setZCoproPointe(new Map(snap.zCoproPointe))
      if (snap.zGeranceMandats) setZGeranceMandats(new Map(snap.zGeranceMandats))
      setRestoreKey(k => k + 1)
      setShowHistory(false)
    } catch {
      alert('Erreur lors de la restauration des données.')
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────────────

  function resetAll() {
    setDonneesG({ ...EMPTY_GERANCE })
    setDonneesC({ ...EMPTY_COPRO })
    setFileLoaded({})
    setFileErrors({})
    setFileKeys({})
    setAnnots({})
    setSectionNotes({})
    setForcedOk({})
    annotsByAgenceRef.current = {}
    notesByAgenceRef.current = {}
    setAgences([])
    setSelectedAgence(null)
    setReportAgences([])
    setGarantie(0)
    setPointe(0)
    setNbMandats(0)
    setFileObjects({})
    setValidatedAgencies(new Set())
    setHistoryWarning(null)
  }

  // ── Supprimer un fichier importé ─────────────────────────────────────────────

  function removeFile(id: string) {
    setFileLoaded(prev => { const n = { ...prev }; delete n[id]; return n })
    setFileErrors(prev => { const n = { ...prev }; delete n[id]; return n })
    setFileKeys(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
    setFileObjects(prev => { const n = { ...prev }; delete n[id]; return n })

    if (id === 'z_pointe') {
      if (mode === 'gerance') setZGerancePointe(new Map())
      else setZCoproPointe(new Map())
    } else if (id === 'z_mandats') {
      setZGeranceMandats(new Map())
      setNbMandats(0)
    } else if (mode === 'gerance') {
      const r: Partial<GeranceData> = {}
      if (id === 'quittancement') { r.quittancement = 0; r.encaissement = 0 }
      if (id === 'factures')      { r.factures = []; r.factures_nr30 = []; r.factures_nr60 = [] }
      if (id === 'prop_deb')      { r.prop_deb = []; r.prop_deb_sorti = [] }
      if (id === 'prop_cred')     { r.prop_cred = [] }
      if (id === 'att_deb')       { r.att_deb = [] }
      if (id === 'bq_nonrapp')    { r.bq_nonrapp = [] }
      if (id === 'cpta_nonrapp')  { r.cpta_nonrapp = [] }
      setDonneesG(prev => ({ ...prev, ...r }))
    } else {
      const r: Partial<CoproData> = {}
      if (id === 'balance')      { r.balance_bad = [] }
      if (id === 'att_deb')      { r.att_deb = [] }
      if (id === 'att_cred')     { r.att_cred = [] }
      if (id === 'ventes')       { r.ventes_deb = []; r.ventes_cred = [] }
      if (id === 'fourn_deb')    { r.fourn_deb = [] }
      if (id === 'factures')     { r.factures = []; r.factures_nr30 = []; r.factures_nr60 = [] }
      if (id === 'bq_nonrapp')   { r.bq_nonrapp = [] }
      if (id === 'cpta_nonrapp') { r.cpta_nonrapp = [] }
      if (id === 'bilan')        { r.bilan = [] }
      setDonneesC(prev => ({ ...prev, ...r }))
    }
  }

  // ── Modal helpers ────────────────────────────────────────────────────────────

  function openModal(
    cId: string,
    title: string,
    rows: ExcelRow[],
    nameFn: (r: ExcelRow) => string,
    valFn: (r: ExcelRow) => number,
    valClass: string,
    subFn: ((r: ExcelRow) => string) | null,
    cols?: ColDef[],
    nc?: number | null,
  ) {
    setModal({ open: true, title, cId, rows, nameFn, valFn, valClass, subFn, cols, nc })
    setModalSearch('')
  }

  function closeModal() {
    setModal(prev => ({ ...prev, open: false }))
  }

  // ── Export anomalie → Excel ──────────────────────────────────────────────────

  function exportXlsx(
    filename: string,
    sheetTitle: string,
    cId: string,
    rows: ExcelRow[],
    nameFn: (r: ExcelRow) => string,
    valFn: (r: ExcelRow) => number,
    subFn: ((r: ExcelRow) => string) | null,
    cols?: ColDef[],
    nc?: number | null,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx') as typeof import('xlsx')
    const isInfoExport = INFO_CIDS.has(cId)
    const data = rows.map((r, i) => {
      const ann = getAnnot(cId, i)
      let row: Record<string, string | number>
      if (cols) {
        row = {}
        cols.forEach(c => { row[c.header] = c.fn(r, nc ?? null) })
      } else {
        row = { 'Libellé': nameFn(r), 'Montant': valFn(r) }
        if (subFn) row['Détail'] = subFn(r)
      }
      if (ann.comment) row['Note auditeur'] = ann.comment
      if (!isInfoExport) row['Statut'] = ann.include ? 'Injustifié' : 'Justifié'
      return row
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetTitle.slice(0, 31))
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename + '.xlsx'
    a.click()
  }

  // ── Génération rapport PDF ──────────────────────────────────────────────────

  async function generateRapport() {
    if (!score || pdfGenerating) return
    setPdfGenerating(true)

    // Combined agence label for the report — deduplicate by normalized group name
    const uniqueGroupNames = Array.from(new Set(reportAgences.map(a => normalizeAgence(a)))).filter(Boolean)
    const agenceLabel = uniqueGroupNames.length > 0
      ? uniqueGroupNames.join(' + ')
      : (selectedAgence ? normalizeAgence(selectedAgence) : (reportAgences[0] || ''))

    // Comparer les ensembles d'agences (gère les labels combinés "A + B")
    const pdfCurrentNorms = uniqueGroupNames.sort()
    const pdfAgenceSetsMatch = (entryAgence: string) => {
      const entryNorms = entryAgence.split(' + ').map(s => s.trim()).sort()
      if (entryNorms.length !== pdfCurrentNorms.length) return false
      return entryNorms.every((n, i) => n === pdfCurrentNorms[i])
    }
    const eligible = reportHistory
      .filter(e =>
        (e.status ?? 'valid') === 'valid' &&
        e.batchId !== sessionBatchId.current &&
        e.mode === mode &&
        pdfAgenceSetsMatch(e.agence)
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    const lastImport = comparisonEnabled
      ? (comparisonRefId
          ? (eligible.find(e => e.id === comparisonRefId) ?? eligible[0] ?? null)
          : (eligible[0] ?? null))
      : null

    const payload: PDFPayload = buildPDFPayload(
      mode, scoredG, scoredC, score, annots, sectionNotes,
      { agence: agenceLabel, garantie: effectiveGarantie, pointe, pointeDate, dateDebut, dateFin, nbMandats: effectiveNbMandats },
      lastImport,
    )
    if (payload.bqNonClot) {
      payload.bqNonClot = payload.bqNonClot.filter(item => nonClotIncluded[item.name] !== false)
      // Sync the bq_nonclot section rows with the filtered list
      const nonClotSec = payload.sections?.find(s => s.id === 'bq_nonclot')
      if (nonClotSec) {
        nonClotSec.rows = nonClotSec.rows.filter(r => nonClotIncluded[r.name] !== false)
        const n = nonClotSec.rows.length
        nonClotSec.mainStat = String(n)
        nonClotSec.subtitle = n === 0
          ? 'Aucun rapprochement non clôturé'
          : `${n} compte(s) · absent ou en cours`
      }
    }
    try {
      const res = await fetch('/api/rapport/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const slug = agenceLabel.replace(/[^a-zA-Z0-9]/g, '_') || 'agence'
      a.download = `Rapport_Audit_${mode === 'gerance' ? 'Gerance' : 'Copro'}_${slug}.pdf`
      a.click()
    } catch (err) {
      console.error('Erreur génération rapport', err)
      const detail = err instanceof Error ? err.message : String(err)
      alert(`Erreur lors de la génération du rapport PDF.\n\n${detail}`)
    } finally {
      setPdfGenerating(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  function renderBadge(level: string) {
    return <span className={`rc-badge ${badgeClass(level)}`}>{badgeLabel(level)}</span>
  }

  function renderMiniItem(cId: string, i: number, name: string, val: string, vClass: string, row: ExcelRow) {
    const ann = getAnnot(cId, i)
    const k = aKey(cId, i)
    const excl = !ann.include
    const hasC = !!ann.comment
    const isInfo = INFO_CIDS.has(cId)
    const displayName = (name?.trim() && name !== '—') ? name : `Ligne ${i + 1}`
    return (
      <div key={k} className="mini-item">
        <div className="mini-item-row">
          <span className={`mini-item-name${excl ? ' exclu' : ''}`}>{truncate(displayName, 28)}</span>
          <span className={`mini-item-val ${vClass}${excl ? ' exclu' : ''}`}>{val}</span>
          {!isInfo && (
            <button
              className={`status-badge ${ann.include ? 'status-injustifie' : 'status-justifie'}`}
              onClick={() => toggleInclude(cId, i)}
              title={ann.include ? 'Marquer comme Justifié' : 'Marquer comme Injustifié'}
            >{ann.include ? '✗' : '✓'}</button>
          )}
          <button
            className={`mini-comment-btn${hasC ? ' active' : ''}`}
            onClick={() => {
              const zone = document.getElementById(`cz_${k}`)
              const btn = document.getElementById(`cb_${k}`)
              if (!zone) return
              const open = !zone.classList.contains('open')
              zone.classList.toggle('open', open)
              if (btn) btn.classList.toggle('active', open || hasC)
              if (open) (document.getElementById(`ci_${k}`) as HTMLTextAreaElement)?.focus()
            }}
            id={`cb_${k}`}
            title="Commentaire"
          >
            💬
          </button>
        </div>
        <div className={`mini-comment-zone${hasC ? ' open' : ''}`} id={`cz_${k}`}>
          <textarea
            className="mini-comment-input"
            id={`ci_${k}`}
            rows={1}
            placeholder="Commentaire…"
            defaultValue={ann.comment}
            onBlur={e => saveComment(cId, i, e.target.value)}
          />
        </div>
      </div>
    )
  }

  function renderCardActions(
    nb: number,
    cId: string,
    title: string,
    rows: ExcelRow[],
    nameFn: (r: ExcelRow) => string,
    valFn: (r: ExcelRow) => number,
    valClass: string,
    subFn: ((r: ExcelRow) => string) | null,
    exportFilename: string,
    cols?: ColDef[],
    nc?: number | null,
  ) {
    return (
      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
        <button className="voir-tous-btn" onClick={() => openModal(cId, title, rows, nameFn, valFn, valClass, subFn, cols, nc)}>
          Voir plus ({nb})
        </button>
        <button className="export-btn" onClick={() => exportXlsx(exportFilename, title, cId, rows, nameFn, valFn, subFn, cols, nc)}>
          ↓ Excel
        </button>
      </div>
    )
  }

  // ── Score banner ─────────────────────────────────────────────────────────────

  function renderScoreBanner(sr: ScoreResult) {
    const { scoreGlobal, niveau, anomalies, totalPenalite } = sr
    const circ = 251.3
    const offset = (circ * (1 - scoreGlobal / 100)).toFixed(1)
    const nbActifs = anomalies.filter(a => !a.exclu && a.penalite > 0).length
    const nbCritiques = anomalies.filter(a => a.type === 'critique' && (a.nb ?? 0) > 0).length
    const nbBloquants = anomalies.filter(a => a.bloquant).length
    const nbInfo = anomalies.filter(a => a.exclu).length
    return (
      <div className="score-banner">
        <div className="score-gauge-wrap">
          <svg className="score-gauge-svg" viewBox="0 0 96 96">
            <circle className="score-gauge-bg" cx="48" cy="48" r="40" />
            <circle
              className="score-gauge-fill"
              cx="48" cy="48" r="40"
              stroke={niveau.color}
              strokeDasharray={String(circ)}
              strokeDashoffset={String(offset)}
            />
          </svg>
          <div className="score-gauge-center">
            <span className="score-gauge-val" style={{ color: niveau.color }}>{scoreGlobal}</span>
            <span className="score-gauge-max">/100</span>
          </div>
        </div>
        <div className="score-info">
          <span className="score-level-badge" style={{ background: niveau.bg, color: niveau.color }}>
            {niveau.label}
          </span>
          <div className="score-title">Score d&apos;audit</div>
          <div className="score-sub">{scoreLevelText(niveau)}</div>
          <div className="score-anomaly-pills">
            {nbActifs > 0 && (
              <span className="score-pill score-pill-orange">{nbActifs} anomalie(s) pénalisante(s)</span>
            )}
            {nbCritiques > 0 && (
              <span className="score-pill score-pill-red">{nbCritiques} critique(s)</span>
            )}
            {nbBloquants > 0 && (
              <span className="score-pill score-pill-orange">{nbBloquants} bloquante(s) (ratio &gt;1%)</span>
            )}
            {nbInfo > 0 && (
              <span className="score-pill score-pill-info">{nbInfo} info uniquement</span>
            )}
            {nbActifs === 0 && nbCritiques === 0 && (
              <span className="score-pill score-pill-green">Aucune anomalie pénalisante</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: '110px', flexShrink: 0 }}>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '4px' }}>Pénalité totale</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: totalPenalite > 0 ? 'var(--red)' : 'var(--green)' }}>
            {totalPenalite > 0 ? '−' + totalPenalite.toFixed(1) : '0'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
            {anomalies.filter(a => !a.exclu).length} éléments évalués
          </div>
        </div>
      </div>
    )
  }

  // ── Score detail block ────────────────────────────────────────────────────────

  function renderScoreDetail(anom: AnomalyResult) {
    if (anom.exclu) return null
    const isQuitt = anom.id === 'quitt'
    const isBq   = anom.id === 'bq_nonrapp'
    const isCpta  = anom.id === 'cpta_nonrapp'
    const lines: { label: string; detail: string; pts: number }[] = []

    if (isQuitt && anom.ratio != null) {
      lines.push({ label: 'Taux encaissement', detail: (anom.ratio * 100).toFixed(1) + '%', pts: anom.penalite })
    } else if (isBq) {
      if (anom.scoreVolume > 0)
        lines.push({ label: 'Volume', detail: (anom.nb ?? 0) + ' écriture(s)', pts: anom.scoreVolume })
    } else if (isCpta) {
      if (anom.scoreVolume > 0)
        lines.push({ label: 'Volume', detail: (anom.nb ?? 0) + ' écriture(s)', pts: anom.scoreVolume })
    } else {
      if (anom.scoreMontant > 0 && anom.ratio != null)
        lines.push({ label: 'Montant', detail: (anom.ratio * 100).toFixed(2) + '% de la garantie', pts: anom.scoreMontant })
      if (anom.scoreVolume > 0 && anom.ratioVolume != null)
        lines.push({ label: 'Volume', detail: (anom.ratioVolume * 100).toFixed(1) + '% du portefeuille', pts: anom.scoreVolume })
    }

    if (lines.length === 0 && anom.penalite === 0) return null

    return (
      <div className="sd-compact">
        {lines.map((l, i) => (
          <div key={i} className="sd-line">
            <span className="sd-pts">{l.pts > 0 ? '−' + l.pts.toFixed(1) : '0'}</span>
            <span className="sd-sep">·</span>
            <span className="sd-label">{l.label}</span>
            <span className="sd-detail">{l.detail}</span>
          </div>
        ))}
        {anom.nbExclu > 0 && (
          <div className="sd-line sd-exclu">
            <span className="sd-pts">—</span>
            <span className="sd-sep">·</span>
            <span className="sd-label">{anom.nbExclu} ligne(s) justifiée(s)</span>
          </div>
        )}
        <div className="sd-total">
          <span>Total</span>
          <span style={{ color: anom.penalite > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
            {anom.penalite > 0 ? '−' + anom.penalite.toFixed(1) : '0'} / {anom.penaliteMax} pts
          </span>
        </div>
      </div>
    )
  }


  // ── Carte Garantie ──────────────────────────────────────────────────────────

  function renderCarteGarantie() {
    if (garantie === 0 && pointe === 0) return null
    const noData = garantie === 0 || pointe === 0
    const ok = !noData && garantie > pointe
    const lvl = noData ? 'warn' : ok ? 'ok' : 'bad'
    const ecart = garantie - pointe
    const pDateFmt = pointeDate ? new Date(pointeDate).toLocaleDateString('fr-FR') : '—'
    return (
      <div className="recap-card">
        <div className="rc-header">
          <div className="rc-icon icon-blue">🛡️</div>
          <div>
            <div className="rc-label">Garantie financière</div>
            <div className="rc-sub">Contrôle pointe de garantie</div>
          </div>
          {renderBadge(lvl)}
        </div>
        <div className="rc-body">
          <div className="rc-main-stat">
            <span className={`rc-val ${lvl}`}>{noData ? '—' : ok ? 'Couverte' : 'Dépassée'}</span>
            <span className="rc-val-label">{noData ? 'données incomplètes' : 'garantie vs pointe'}</span>
          </div>
          <div className="rc-divider" />
          <div className="rc-row">
            <span className="rc-row-label">Garantie financière</span>
            <span className="rc-row-val">{eur(garantie, 2)}</span>
          </div>
          <div className="rc-row">
            <span className="rc-row-label">Pointe (au {pDateFmt})</span>
            <span className={`rc-row-val ${lvl}`}>{eur(pointe, 2)}</span>
          </div>
          {!noData && (
            <>
              <div className="rc-divider" />
              <div className="rc-row">
                <span className="rc-row-label">Écart garantie − pointe</span>
                <span className={`rc-row-val ${lvl}`} style={{ fontSize: '15px' }}>
                  {ecart >= 0 ? '+' : ''}{eur(ecart, 2)}
                </span>
              </div>
              <div style={{
                marginTop: '10px', fontSize: '11px', padding: '8px 10px', borderRadius: '7px',
                background: ok ? 'var(--green-bg)' : 'var(--red-bg)',
                color: ok ? 'var(--green)' : 'var(--red)',
              }}>
                {ok
                  ? '✓ La garantie couvre la pointe. Situation conforme.'
                  : '✗ La pointe dépasse la garantie. Risque de non-conformité.'}
              </div>
            </>
          )}
          {noData && (
            <div style={{
              marginTop: '10px', fontSize: '11px', padding: '8px 10px', borderRadius: '7px',
              background: 'var(--orange-bg)', color: 'var(--orange)',
            }}>
              ⚠ Renseignez les deux champs pour le contrôle.
            </div>
          )}
          {renderSectionNote('garantie')}
        </div>
      </div>
    )
  }

  // ── Carte Rapprochements non clôturés ────────────────────────────────────────
  // Info only — pas d'impact sur le score

  function renderCarteNonClot(rows: ExcelRow[]) {
    const nameCol = mode === 'gerance' ? 7 : 2
    const dateCol = mode === 'gerance' ? 10 : 11
    // Deduplicate by name
    const seen = new Map<string, string | number | null>()
    for (const r of rows) {
      const name = String(r[nameCol] ?? '').trim()
      if (!name) continue
      if (!seen.has(name)) {
        const d = r[dateCol]
        seen.set(name, (d != null && String(d).trim() !== '') ? d : null)
      }
    }
    const items = Array.from(seen.entries())
    const MAX_PREVIEW = 4
    const displayItems = showAllNonClot ? items : items.slice(0, MAX_PREVIEW)
    const includedCount = items.filter(([name]) => nonClotIncluded[name] !== false).length

    return (
      <div className="recap-card card-info" data-score-id="bq_nonclot">
        <div className="rc-header">
          <div className="rc-icon icon-info">🔄</div>
          <div>
            <div className="rc-label">Rapprochements non clôturés</div>
            <div className="rc-sub">{mode === 'gerance' ? 'Banques' : 'Résidences'} · absent ou en cours</div>
          </div>
          <span className="rc-badge badge-info">Info</span>
        </div>
        <div className="rc-body">
          <div className="info-notice">ℹ Information uniquement — hors logique d&apos;anomalie et de score.</div>
          <div className="rc-main-stat">
            <span className="rc-val info">{items.length}</span>
            <span className="rc-val-label">{mode === 'gerance' ? 'banque(s)' : 'résidence(s)'} non rapprochée(s)</span>
          </div>
          {items.length > 0 ? (
            <>
              <div className="rc-divider" />
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
                {includedCount}/{items.length} inclus dans le rapport PDF
              </div>
              <div className="mini-list">
                {displayItems.map(([name, rawDate]) => {
                  const dateStr = rawDate != null ? excelDateFmt(rawDate) : 'Aucun rapprochement fait'
                  const included = nonClotIncluded[name] !== false
                  return (
                    <div key={name} className="mini-item">
                      <div className="mini-item-row">
                        <span className={`mini-item-name${!included ? ' exclu' : ''}`}>{truncate(name, 24)}</span>
                        <span className={`mini-item-val info${!included ? ' exclu' : ''}`}>{dateStr}</span>
                        <button
                          className={`status-badge ${included ? 'status-injustifie' : 'status-justifie'}`}
                          onClick={() => setNonClotIncluded(prev => ({ ...prev, [name]: !included }))}
                          title={included ? 'Exclure du rapport PDF' : 'Inclure dans le rapport PDF'}
                        >{included ? '✗' : '✓'}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              {items.length > MAX_PREVIEW && (
                <button
                  className="voir-tous-btn"
                  style={{ marginTop: '6px' }}
                  onClick={() => setShowAllNonClot(v => !v)}
                >
                  {showAllNonClot ? 'Voir moins' : `Voir tous (${items.length})`}
                </button>
              )}
            </>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--info)', paddingTop: '4px' }}>Tous rapprochements clôturés</div>
          )}
          {renderSectionNote('bq_nonclot')}
        </div>
      </div>
    )
  }

  // ── Carte BQ (512) ───────────────────────────────────────────────────────────
  // Pénalité volume uniquement : 1 écriture → −10, >1 → −15

  function renderCarteBQ(bq: ExcelRow[]) {
    const BQ_D = mode === 'gerance' ? 14 : 15
    const BQ_L = mode === 'gerance' ? 7 : 19
    const BQ_M = mode === 'gerance' ? 15 : 18
    const lvl = bq.length === 0 ? 'ok' : bq.length === 1 ? 'warn' : 'bad'
    const anomBq = score?.anomalies.find(a => a.id === 'bq_nonrapp')
    const MAX = 3

    return (
      <div className="recap-card" data-score-id="bq_nonrapp">
        <div className="rc-header">
          <div className="rc-icon icon-blue">🏦</div>
          <div>
            <div className="rc-label">Rapprochement Banque 512</div>
            <div className="rc-sub">Écritures non rapprochées · pénalité volume</div>
          </div>
          {renderBadge(lvl)}
        </div>
        <div className="rc-body">
          <div className="rc-main-stat">
            <span className={`rc-val ${lvl}`}>{bq.length}</span>
            <span className="rc-val-label">écriture(s) non rapp.</span>
          </div>
          {bq.length > 0 ? (
            <>
              <div className="rc-divider" />
              <div className="mini-list">
                {bq.slice(0, MAX).map((r, i) => renderMiniItem('bqrapp', i,
                  truncate(`${excelDateFmt(r[BQ_D])} · ${String(r[BQ_L] || r[0] || '—')}`, 36),
                  eur(Math.abs(parseFloat(String(r[BQ_M] ?? 0)) || 0), 2),
                  'bad', r))}
              </div>
              {renderCardActions(
                bq.length, 'bqrapp', 'Banque non rapprochée', bq,
                r => String(r[BQ_L] || r[0] || '—'),
                r => Math.abs(parseFloat(String(r[BQ_M] ?? 0)) || 0),
                'bad',
                r => [
                  r[BQ_D] ? excelDateFmt(r[BQ_D]) : '',
                  mode === 'copro' && r[2] ? String(r[2]) : '',
                  mode === 'copro' && scoredC.bq_nonrapp_nc != null && r[scoredC.bq_nonrapp_nc] ? `Note : ${String(r[scoredC.bq_nonrapp_nc])}` : '',
                ].filter(Boolean).join(' · '),
                'banque_non_rapp',
              )}
            </>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--green)', paddingTop: '4px' }}>✓ Banque à jour</div>
          )}
          {anomBq && renderScoreDetail(anomBq)}
          {renderSectionNote('bqrapp')}
        </div>
      </div>
    )
  }

  // ── Carte CPTA ───────────────────────────────────────────────────────────────
  function renderCarteCPTA(cpta: ExcelRow[]) {
    const CPTA_D = mode === 'gerance' ? 12 : 10
    const CPTA_L = 14
    const CPTA_M = 13
    const CPTA_LFB = mode === 'gerance' ? 6 : 0
    const CPTA_AGE = mode === 'gerance' ? 15 : 11
    const anomCpta = score?.anomalies.find(a => a.id === 'cpta_nonrapp')
    const pen = anomCpta?.penalite ?? 0
    const lvl = cpta.length === 0 ? 'ok' : pen === 0 ? 'ok' : pen <= 5 ? 'warn' : 'bad'
    const MAX = 3
    const ageMax = cpta.length > 0
      ? Math.max(...cpta.map(r => { const v = parseFloat(String(r[CPTA_AGE] ?? '')); return isNaN(v) ? 0 : v }))
      : null

    return (
      <div className="recap-card" data-score-id="cpta_nonrapp">
        <div className="rc-header">
          <div className="rc-icon icon-blue">📒</div>
          <div>
            <div className="rc-label">Rapprochement Compta</div>
            <div className="rc-sub">Écritures non rapprochées{ageMax != null ? ` · Ancienneté max : ${ageMax} j` : ''}</div>
          </div>
          {renderBadge(lvl)}
        </div>
        <div className="rc-body">
          <div className="rc-main-stat">
            <span className={`rc-val ${lvl}`}>{cpta.length}</span>
            <span className="rc-val-label">écriture(s) non rapp.</span>
          </div>
          {cpta.length > 0 ? (
            <>
              <div className="rc-divider" />
              <div className="mini-list">
                {cpta.slice(0, MAX).map((r, i) => renderMiniItem('cptarapp', i,
                  truncate(`${excelDateFmt(r[CPTA_D])} · ${String(r[CPTA_L] || r[CPTA_LFB] || '—')}`, 36),
                  eur(Math.abs(parseFloat(String(r[CPTA_M] ?? 0)) || 0), 2),
                  'bad', r))}
              </div>
              {renderCardActions(
                cpta.length, 'cptarapp', 'Compta non rapprochée', cpta,
                r => String(r[CPTA_L] || r[CPTA_LFB] || '—'),
                r => Math.abs(parseFloat(String(r[CPTA_M] ?? 0)) || 0),
                'bad',
                r => [
                  r[CPTA_D] ? excelDateFmt(r[CPTA_D]) : '',
                  mode === 'copro' && r[1] ? String(r[1]) : '',
                  mode === 'copro' && r[11] != null ? `${r[11]} j` : (mode === 'gerance' && r[15] != null ? `${r[15]} j` : ''),
                  mode === 'copro' && scoredC.cpta_nonrapp_nc != null && r[scoredC.cpta_nonrapp_nc] ? `Note : ${String(r[scoredC.cpta_nonrapp_nc])}` : '',
                ].filter(Boolean).join(' · '),
                'compta_non_rapp',
              )}
            </>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--green)', paddingTop: '4px' }}>✓ Compta à jour</div>
          )}
          {anomCpta && renderScoreDetail(anomCpta)}
          {renderSectionNote('cptarapp')}
        </div>
      </div>
    )
  }

  // ── Carte Factures ────────────────────────────────────────────────────────────

  function renderCarteFactures(nr30: ExcelRow[], nr60: ExcelRow[], tf: number, iMontant: number) {
    const totalNR60 = nr60.reduce((s, r) => s + (parseFloat(String(r[iMontant] ?? 0)) || 0), 0)
    const p30 = tf > 0 ? nr30.length / tf * 100 : 0
    const p60 = tf > 0 ? nr60.length / tf * 100 : 0
    const lvl = nr30.length === 0 ? 'ok' : smartLevel(nr60.length, Math.abs(totalNR60))
    const stateKey = mode === 'gerance' ? 'SG' : 'SC'
    return (
      <div className="recap-card">
        <div className="rc-header">
          <div className="rc-icon icon-orange">🧾</div>
          <div>
            <div className="rc-label">Délais de règlement</div>
            <div className="rc-sub">
              {tf} factures · réf. {dateFin ? new Date(dateFin).toLocaleDateString('fr-FR') : '—'}
            </div>
          </div>
          {renderBadge(lvl)}
        </div>
        <div className="rc-body">
          <div className="rc-main-stat">
            <span className={`rc-val ${lvl}`}>{nr60.length}</span>
            <span className="rc-val-label">factures non réglées +60j</span>
          </div>
          <div className="rc-divider" />
          <div className="rc-row">
            <span className="rc-row-label">Non réglées à +30j</span>
            <span className={`rc-row-val ${nr30.length > 0 ? 'warn' : 'ok'}`}>{nr30.length} ({pct(p30)})</span>
          </div>
          <div className="rc-row">
            <span className="rc-row-label">Non réglées à +60j</span>
            <span className={`rc-row-val ${nr60.length > 0 ? 'bad' : 'ok'}`}>
              {nr60.length} ({pct(p60)}) · {eur(totalNR60, 2)}
            </span>
          </div>
          {nr60.length > 0 && (
            <>
              <div className="rc-divider" />
              <div className="mini-list">
                {nr60.slice(0, 3).map((r, i) =>
                  renderMiniItem('fact60', i, String(mode === 'gerance' ? (r[4] || '—') : (r[7] || '—')), eur(parseFloat(String(r[iMontant] ?? 0)) || 0, 2), 'bad', r)
                )}
              </div>
              {renderCardActions(
                nr60.length, 'fact60', 'Factures non réglées +60j', nr60,
                r => String(mode === 'gerance' ? (r[4] || '—') : (r[7] || '—')),
                r => parseFloat(String(r[iMontant] ?? 0)) || 0,
                'bad',
                r => mode === 'gerance'
                  ? [r[5] ? excelDateFmt(r[5]) : '', String(r[8]||''), String(r[9]||''), r[7]!=null?`${r[7]} j`:'', String(r[11]||'')].filter(Boolean).join(' · ')
                  : [r[4] ? excelDateFmt(r[4]) : '', String(r[8]||''), String(r[9]||''), r[6]!=null?`${r[6]} j`:'', String(r[10]||'')].filter(Boolean).join(' · '),
                'factures_nr60',
              )}
            </>
          )}
          {renderSectionNote('fact60')}
        </div>
      </div>
    )
  }

  // ── Carte État Financier Copro ────────────────────────────────────────────────

  function renderCarteEtatFinancier(bilan: ExcelRow[]) {
    if (!bilan.length) return (
      <div className="recap-card" style={{ gridColumn: '1 / -1' }}>
        <div className="rc-header">
          <div className="rc-icon icon-orange">📊</div>
          <div>
            <div className="rc-label">État financier des copropriétés</div>
            <div className="rc-sub">Bilan / Position mandats</div>
          </div>
          <span className="rc-badge badge-info">—</span>
        </div>
        <div className="rc-body">
          <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '8px 0' }}>
            Déposez le fichier <strong>Bilan / État financier</strong> pour afficher l&apos;analyse du portefeuille.
          </div>
        </div>
      </div>
    )
    // indices : 11=%cop, 16=%chrg, 18=%tvx, 25=%tréso, 4=nbLots, 1=Residence
    // Recalcule le nb d'anomalies depuis les indicateurs bruts (NaN → 0%)
    const nbAnom = (r: ExcelRow): number => {
      const vCop  = parseFloat(String(r[11] ?? 0)) || 0
      const vChrg = parseFloat(String(r[16] ?? 0)) || 0
      const vTvx  = r[18] != null && !isNaN(Number(r[18])) ? (parseFloat(String(r[18])) || 0) : null
      const vBq   = parseFloat(String(r[25] ?? 0)) || 0
      let n = 0
      if (vCop > 0.30)                 n++
      if (vChrg > 1.00)                n++
      if (vTvx != null && vTvx > 1.00) n++
      if (vBq < 1.00)                  n++
      return n
    }
    const risk4 = bilan.filter(r => nbAnom(r) === 4)
    const risk3 = bilan.filter(r => nbAnom(r) === 3)
    const risk2 = bilan.filter(r => nbAnom(r) === 2)
    const risk1 = bilan.filter(r => nbAnom(r) === 1)
    const risk0 = bilan.filter(r => nbAnom(r) === 0)
    const total = bilan.length
    const nbRisque = risk4.length + risk3.length + risk2.length
    const lvl = risk4.length > 0 ? 'bad' : risk3.length > 0 ? 'warn' : risk2.length > 0 ? 'warn' : 'ok'

    const nCop  = bilan.filter(r => (parseFloat(String(r[11] ?? 0)) || 0) > 0.30).length
    const nChrg = bilan.filter(r => (parseFloat(String(r[16] ?? 0)) || 0) > 1.00).length
    const nTvx  = bilan.filter(r => r[18] != null && !isNaN(Number(r[18])) && (parseFloat(String(r[18])) || 0) > 1.00).length
    const nBq   = bilan.filter(r => (parseFloat(String(r[25] ?? 0)) || 0) < 1.00).length

    const segments = [
      { n: risk0.length, color: '#1A7A4A', label: 'Sain' },
      { n: risk1.length, color: '#4A8A2A', label: '1 anomalie' },
      { n: risk2.length, color: '#C05C1A', label: '2 anomalies' },
      { n: risk3.length, color: '#E07020', label: '3 anomalies' },
      { n: risk4.length, color: '#B01A1A', label: '4 anomalies' },
    ].filter(s => s.n > 0)

    const freqData = [
      { label: 'Impayés copropriétaires', sub: '> 30\u202f% des appels de fonds', n: nCop },
      { label: 'Surcharge des provisions', sub: 'Charges > 100\u202f% des provisions', n: nChrg },
      { label: 'Dépassement travaux', sub: 'Travaux > 100\u202f% des appels', n: nTvx },
      { label: 'Découvert trésorerie', sub: 'Trésorerie < 100\u202f% du fonds permanent', n: nBq },
    ]

    const riskHeader = (
      <div className="risk-header">
        <span className="risk-row-name" style={{ fontSize: '9px', fontWeight: 400 }}>Résidence</span>
        <span className="risk-row-lots" style={{ fontSize: '9px' }}>Lots</span>
        <span className="risk-row-pct">
          {['Impayés', 'Charges', 'Travaux', 'Trésor.'].map(h => (
            <span key={h} style={{ width: '42px', textAlign: 'center', fontSize: '9px', display: 'inline-block' }}>{h}</span>
          ))}
        </span>
      </div>
    )

    function riskRows(arr: ExcelRow[]) {
      return arr.slice(0, 6).map((r, idx) => {
        const vCop  = parseFloat(String(r[11] ?? 0)) || 0
        const vChrg = parseFloat(String(r[16] ?? 0)) || 0
        const vTvx  = r[18] != null && !isNaN(Number(r[18])) ? (parseFloat(String(r[18])) || 0) : null
        const vBq   = parseFloat(String(r[25] ?? 0)) || 0
        return (
          <div key={idx} className="risk-row">
            <span className="risk-row-name">{truncate(String(r[1] || '—').replace(/^\d+-/, ''), 28)}</span>
            <span className="risk-row-lots">{r[4] || '?'} lots</span>
            <span className="risk-row-pct">
              <span className={`risk-pct ${vCop > 0.30 ? 'bad' : 'ok'}`} title="Impayés copropriétaires — seuil 30\u202f%">
                {(vCop * 100).toFixed(0)}%
              </span>
              <span className={`risk-pct ${vChrg > 1.00 ? 'bad' : 'ok'}`} title="Charges / Provisions — seuil 100\u202f%">
                {(vChrg * 100).toFixed(0)}%
              </span>
              <span
                className={`risk-pct ${vTvx != null ? (vTvx > 1.00 ? 'bad' : 'ok') : ''}`}
                title="Dépassement travaux — seuil 100\u202f%"
              >
                {vTvx != null ? (vTvx * 100).toFixed(0) + '%' : '—'}
              </span>
              <span className={`risk-pct ${vBq < 1.00 ? 'bad' : 'ok'}`} title="Trésorerie — seuil 100\u202f%">
                {(vBq * 100).toFixed(0)}%
              </span>
            </span>
          </div>
        )
      })
    }

    return (
      <div className="recap-card" style={{ gridColumn: '1 / -1' }}>
        <div className="rc-header">
          <div className="rc-icon icon-orange">📊</div>
          <div>
            <div className="rc-label">État financier des copropriétés</div>
            <div className="rc-sub">{total} copropriété(s) · {nbRisque} à risque (≥2 anomalies)</div>
          </div>
          {renderBadge(lvl)}
        </div>
        <div className="rc-body">
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '7px' }}>
            Répartition du portefeuille
          </div>
          <div style={{ display: 'flex', height: '20px', borderRadius: '6px', overflow: 'hidden', marginBottom: '7px' }}>
            {segments.map((s, idx) => (
              <div
                key={idx}
                style={{
                  width: `${(s.n / total * 100).toFixed(1)}%`,
                  background: s.color,
                  height: '20px',
                  borderRadius: idx === 0 ? '6px 0 0 6px' : idx === segments.length - 1 ? '0 6px 6px 0' : undefined,
                }}
                title={`${s.label} : ${s.n} (${(s.n / total * 100).toFixed(1)}%)`}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {segments.map((s, idx) => (
              <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                {s.label} : <b>{s.n}</b>
              </span>
            ))}
          </div>
          <div className="rc-divider" />
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '12px 0 10px' }}>
            Fréquence par type d&apos;anomalie
          </div>
          {freqData.map((f, idx) => {
            const fpct = total > 0 ? (f.n / total * 100).toFixed(0) : '0'
            const color = f.n > 0 ? 'var(--red)' : 'var(--green)'
            return (
              <div key={idx} style={{ marginBottom: '9px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>{f.label}</span>
                    <span style={{ fontSize: '10px', color: 'var(--muted)', marginLeft: '6px' }}>{f.sub}</span>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color, flexShrink: 0, marginLeft: '8px' }}>
                    {f.n} / {total}
                  </span>
                </div>
                <div style={{ background: 'var(--border)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ width: `${fpct}%`, background: color, height: '100%', borderRadius: '4px' }} />
                </div>
              </div>
            )
          })}
          {nbRisque > 0 && (
            <>
              <div className="rc-divider" />
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '12px 0 8px' }}>
                Détail — copropriétés à risque (≥2 anomalies)
              </div>
              {risk4.length > 0 && (
                <div className="risk-section">
                  <div className="risk-level-header risk-4">⚠⚠ Risque ++++ — 4 anomalies — {risk4.length} copropriété(s)</div>
                  {riskHeader}
                  {riskRows(risk4)}
                  {risk4.length > 6 && (
                    <div style={{ cursor: 'pointer', color: 'var(--navy2)', fontSize: '11px', marginTop: '4px' }}
                      onClick={() => setBilanModal({ open: true, title: 'Risque ++++ — 4 anomalies', rows: risk4 })}>
                      → Voir les {risk4.length}
                    </div>
                  )}
                </div>
              )}
              {risk3.length > 0 && (
                <div className="risk-section">
                  <div className="risk-level-header risk-3">⚠ Risque +++ — 3 anomalies — {risk3.length} copropriété(s)</div>
                  {riskHeader}
                  {riskRows(risk3)}
                  {risk3.length > 6 && (
                    <div style={{ cursor: 'pointer', color: 'var(--navy2)', fontSize: '11px', marginTop: '4px' }}
                      onClick={() => setBilanModal({ open: true, title: 'Risque +++ — 3 anomalies', rows: risk3 })}>
                      → Voir les {risk3.length}
                    </div>
                  )}
                </div>
              )}
              {risk2.length > 0 && (
                <div className="risk-section">
                  <div className="risk-level-header risk-2">Risque ++ — 2 anomalies — {risk2.length} copropriété(s)</div>
                  {riskHeader}
                  {riskRows(risk2)}
                  {risk2.length > 6 && (
                    <div style={{ cursor: 'pointer', color: 'var(--navy2)', fontSize: '11px', marginTop: '4px' }}
                      onClick={() => setBilanModal({ open: true, title: 'Risque ++ — 2 anomalies', rows: risk2 })}>
                      → Voir les {risk2.length}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {risk1.length > 0 && (
            <div className="risk-section">
              <div className="risk-level-header risk-1">Risque + — 1 anomalie — {risk1.length} copropriété(s)</div>
              {riskHeader}
              {riskRows(risk1)}
              {risk1.length > 6 && (
                <div style={{ cursor: 'pointer', color: 'var(--navy2)', fontSize: '11px', marginTop: '4px' }}
                  onClick={() => setBilanModal({ open: true, title: 'Risque + — 1 anomalie', rows: risk1 })}>
                  → Voir les {risk1.length}
                </div>
              )}
            </div>
          )}
          {nbRisque === 0 && risk1.length === 0 && (
            <div style={{ fontSize: '12px', color: 'var(--green)', paddingTop: '4px' }}>
              ✓ Aucune copropriété avec anomalie
            </div>
          )}
          {renderSectionNote('bilan')}
        </div>
      </div>
    )
  }

  // ── Gérance cards ─────────────────────────────────────────────────────────────

  function renderGerance() {
    const { quittancement: q, encaissement: e, prop_deb, prop_deb_sorti, prop_cred, att_deb, bq_nonrapp, cpta_nonrapp, factures_nr30, factures_nr60, factures } = scoredG
    const propSorti = prop_deb_sorti ?? []
    const ratio = q > 0 ? (e / q * 100) : 0
    const ratioLevel = ratio > 100 ? 'ok' : ratio >= 95 ? 'warn' : 'bad'
    const barColor = ratioLevel === 'ok' ? '#1A7A4A' : ratioLevel === 'warn' ? '#C05C1A' : '#B01A1A'
    const totalPD = prop_deb.reduce((s, r) => s + Math.abs(parseFloat(String(r[6] ?? 0)) || 0), 0)
    const totalPS = propSorti.reduce((s, r) => s + Math.abs(parseFloat(String(r[10] ?? 0)) || 0), 0)
    const totalPC = prop_cred.reduce((s, r) => s + Math.abs(parseFloat(String(r[6] ?? 0)) || 0), 0)
    const totalAD = att_deb.reduce((s, r) => s + Math.abs(parseFloat(String(r[8] ?? 0)) || 0), 0)
    const pdLevel = smartLevel(prop_deb.length, totalPD)
    const psLevel = smartLevel(propSorti.length, totalPS)
    const adLevel = smartLevel(att_deb.length, totalAD)

    const anomAttDeb = score?.anomalies.find(a => a.id === 'attdeb')
    const anomPropDeb = score?.anomalies.find(a => a.id === 'propdeb')
    const anomPropSorti = score?.anomalies.find(a => a.id === 'propdbsorti')

    return (
      <>
        {renderCarteGarantie()}
        {q > 0 && (
          <div className="recap-card" data-score-id="quitt">
            <div className="rc-header">
              <div className="rc-icon icon-blue">💰</div>
              <div>
                <div className="rc-label">Quittancement / Encaissement</div>
                <div className="rc-sub">Ratio de recouvrement</div>
              </div>
              {renderBadge(ratioLevel)}
            </div>
            <div className="rc-body">
              <div className="rc-main-stat">
                <span className={`rc-val ${ratioLevel}`}>{pct(ratio)}</span>
                <span className="rc-val-label">de recouvrement</span>
              </div>
              <div className="ratio-bar-wrap">
                <div className="ratio-bar-track">
                  <div className="ratio-bar-fill" style={{ width: `${Math.min(100, ratio).toFixed(1)}%`, background: barColor }} />
                </div>
                <div className="ratio-bar-labels">
                  <span>0%</span>
                  <span style={{ color: barColor, fontWeight: 600 }}>{pct(ratio)}</span>
                  <span>100%</span>
                </div>
              </div>
              <div className="rc-divider" />
              <div className="rc-row"><span className="rc-row-label">Quittancé</span><span className="rc-row-val">{eur(q, 2)}</span></div>
              <div className="rc-row"><span className="rc-row-label">Encaissé</span><span className="rc-row-val">{eur(e, 2)}</span></div>
              <div className="rc-row">
                <span className="rc-row-label">Écart</span>
                <span className={`rc-row-val ${ratioLevel}`}>{eur(q - e, 2)}</span>
              </div>
              {score && anomAttDeb && renderScoreDetail(score.anomalies.find(a => a.id === 'quitt')!)}
              {renderSectionNote('quitt')}
            </div>
          </div>
        )}

        {/* Propriétaires débiteurs ACTIFS */}
        <div className="recap-card" data-score-id="propdeb">
          <div className="rc-header">
            <div className="rc-icon icon-red">🔴</div>
            <div>
              <div className="rc-label">Propriétaires débiteurs actifs</div>
              <div className="rc-sub">Comptes non soldés — en gestion · max −17,5 pts</div>
            </div>
            {renderBadge(prop_deb.length === 0 ? 'ok' : pdLevel)}
          </div>
          <div className="rc-body">
            <div className="rc-main-stat">
              <span className={`rc-val ${prop_deb.length === 0 ? 'ok' : pdLevel}`}>{prop_deb.length}</span>
              <span className="rc-val-label">propriétaire(s)</span>
            </div>
            <div className="rc-divider" />
            <div className="rc-row">
              <span className="rc-row-label">Total débiteurs</span>
              <span className={`rc-row-val ${prop_deb.length === 0 ? 'ok' : 'bad'}`}>{eur(totalPD, 2)}</span>
            </div>
            {prop_deb.length > 0 ? (
              <>
                <div className="rc-divider" />
                <div className="mini-list">
                  {prop_deb.slice(0, 4).map((r, i) =>
                    renderMiniItem('propdeb', i, String(r[1] || r[0] || '—'), eur(Math.abs(parseFloat(String(r[6] ?? 0)) || 0), 2), 'bad', r)
                  )}
                </div>
                {renderCardActions(
                  prop_deb.length, 'propdeb', 'Propriétaires débiteurs actifs', prop_deb,
                  r => String(r[1] || r[0] || '—'),
                  r => Math.abs(parseFloat(String(r[6] ?? 0)) || 0),
                  'bad', null,
                  'proprietaires_debiteurs',
                )}
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--green)', paddingTop: '4px' }}>✓ Aucun propriétaire débiteur actif</div>
            )}
            {score && anomPropDeb && renderScoreDetail(anomPropDeb)}
            {renderSectionNote('propdeb')}
          </div>
        </div>

        {/* Propriétaires débiteurs SORTIS */}
        <div className="recap-card" data-score-id="propdbsorti">
          <div className="rc-header">
            <div className="rc-icon icon-red">🔴</div>
            <div>
              <div className="rc-label">Propriétaires débiteurs sortis</div>
              <div className="rc-sub">Comptes non soldés — sortis de gestion · max −25 pts</div>
            </div>
            {renderBadge(propSorti.length === 0 ? 'ok' : psLevel)}
          </div>
          <div className="rc-body">
            <div className="rc-main-stat">
              <span className={`rc-val ${propSorti.length === 0 ? 'ok' : psLevel}`}>{propSorti.length}</span>
              <span className="rc-val-label">propriétaire(s)</span>
            </div>
            <div className="rc-divider" />
            <div className="rc-row">
              <span className="rc-row-label">Total débiteurs sortis</span>
              <span className={`rc-row-val ${propSorti.length === 0 ? 'ok' : 'bad'}`}>{eur(totalPS, 2)}</span>
            </div>
            {propSorti.length > 0 ? (
              <>
                <div className="rc-divider" />
                <div className="mini-list">
                  {propSorti.slice(0, 4).map((r, i) =>
                    renderMiniItem('propdbsorti', i, String(r[1] || r[0] || '—'), eur(Math.abs(parseFloat(String(r[10] ?? 0)) || 0), 2), 'bad', r)
                  )}
                </div>
                {renderCardActions(
                  propSorti.length, 'propdbsorti', 'Propriétaires débiteurs sortis', propSorti,
                  r => String(r[1] || r[0] || '—'),
                  r => Math.abs(parseFloat(String(r[10] ?? 0)) || 0),
                  'bad',
                  r => r[2] != null ? ('Date sortie : ' + excelDateFmt(r[2])) : '',
                  'proprietaires_sortis_debiteurs',
                )}
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--green)', paddingTop: '4px' }}>✓ Aucun propriétaire sorti débiteur</div>
            )}
            {score && anomPropSorti && renderScoreDetail(anomPropSorti)}
            {renderSectionNote('propdbsorti')}
          </div>
        </div>

        <div className="recap-card card-info" data-score-id="propcred">
          <div className="rc-header">
            <div className="rc-icon icon-info">ℹ️</div>
            <div>
              <div className="rc-label">Propriétaires créditeurs sortis</div>
              <div className="rc-sub">Remboursements à effectuer</div>
            </div>
            <span className="rc-badge badge-info">Info</span>
          </div>
          <div className="rc-body">
            <div className="info-notice">ℹ Information uniquement — hors logique d&apos;anomalie.</div>
            <div className="rc-main-stat">
              <span className="rc-val info">{prop_cred.length}</span>
              <span className="rc-val-label">compte(s) créditeur(s)</span>
            </div>
            <div className="rc-divider" />
            <div className="rc-row">
              <span className="rc-row-label">Total à rembourser</span>
              <span className="rc-row-val info">{eur(totalPC, 2)}</span>
            </div>
            {prop_cred.length > 0 ? (
              <>
                <div className="rc-divider" />
                <div className="mini-list">
                  {prop_cred.slice(0, 4).map((r, i) =>
                    renderMiniItem('propcred', i, String(r[1] || r[0] || '—'), eur(Math.abs(parseFloat(String(r[6] ?? 0)) || 0), 2), 'info', r)
                  )}
                </div>
                {renderCardActions(
                  prop_cred.length, 'propcred', 'Propriétaires créditeurs sortis', prop_cred,
                  r => String(r[1] || r[0] || '—'),
                  r => Math.abs(parseFloat(String(r[6] ?? 0)) || 0),
                  'info',
                  r => r[2] != null ? ('Date sortie : ' + excelDateFmt(r[2])) : '',
                  'proprietaires_crediteurs',
                )}
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--info)', paddingTop: '4px' }}>Aucun créditeur à signaler</div>
            )}
            {renderSectionNote('propcred')}
          </div>
        </div>

        <div className="recap-card" data-score-id="attdeb">
          <div className="rc-header">
            <div className="rc-icon icon-orange">⏳</div>
            <div>
              <div className="rc-label">Comptes d&apos;attente débiteurs</div>
              <div className="rc-sub">Sauf 475-479-PEC</div>
            </div>
            {renderBadge(att_deb.length === 0 ? 'ok' : adLevel)}
          </div>
          <div className="rc-body">
            <div className="rc-main-stat">
              <span className={`rc-val ${att_deb.length === 0 ? 'ok' : adLevel}`}>{att_deb.length}</span>
              <span className="rc-val-label">compte(s)</span>
            </div>
            <div className="rc-divider" />
            <div className="rc-row">
              <span className="rc-row-label">Montant total</span>
              <span className={`rc-row-val ${att_deb.length === 0 ? 'ok' : 'bad'}`}>{eur(totalAD, 2)}</span>
            </div>
            {att_deb.length > 0 ? (
              <>
                <div className="rc-divider" />
                <div className="mini-list">
                  {att_deb.slice(0, 4).map((r, i) =>
                    renderMiniItem('attdeb', i, String(r[1] || r[3] || '—') + ' · ' + String(r[6] || ''), eur(parseFloat(String(r[8] ?? 0)) || 0, 2), 'bad', r)
                  )}
                </div>
                {renderCardActions(
                  att_deb.length, 'attdeb', 'Comptes attente débiteurs', att_deb,
                  r => String(r[1] || r[3] || '—') + ' · ' + String(r[6] || ''),
                  r => Math.abs(parseFloat(String(r[8] ?? 0)) || 0),
                  'bad', null,
                  'attente_debiteurs_gerance',
                  [
                    { header: 'Mandat', fn: (r) => String(r[3] ?? '') },
                    { header: 'Plan', fn: (r) => String(r[6] ?? '') },
                    { header: 'Libellé', fn: (r) => String(r[1] || '—') },
                    { header: 'Montant', fn: (r) => eur(Math.abs(parseFloat(String(r[8] ?? 0)) || 0), 2) },
                    { header: 'Note Gesteam', fn: (r, nc) => nc != null ? String(r[nc] ?? '') : '' },
                  ],
                  scoredG.att_deb_nc,
                )}
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--green)', paddingTop: '4px' }}>✓ Aucun compte d&apos;attente débiteur</div>
            )}
            {score && anomAttDeb && renderScoreDetail(anomAttDeb)}
            {renderSectionNote('attdeb')}
          </div>
        </div>

        {renderCarteNonClot(scoredG.bq_nonclot ?? [])}
        {renderCarteBQ(bq_nonrapp)}
        {renderCarteCPTA(cpta_nonrapp)}
        {renderCarteFactures(factures_nr30, factures_nr60, factures.length, 10)}
      </>
    )
  }

  // ── Copropriété cards ─────────────────────────────────────────────────────────

  function renderCopro() {
    const { balance_bad, att_deb, att_cred, ventes_deb, ventes_cred, fourn_deb, bq_nonrapp, cpta_nonrapp, factures_nr30, factures_nr60, factures, bilan } = scoredC

    const totalBAL = balance_bad.reduce((s, r) => s + Math.abs(parseFloat(String(r[7] ?? 0)) || 0), 0)
    const balLevel = smartLevel(balance_bad.length, totalBAL)
    const totalFD = fourn_deb.reduce((s, r) => s + (parseFloat(String(r[10] ?? 0)) || 0), 0)
    const fdLevel = smartLevel(fourn_deb.length, totalFD)
    const totalAD = att_deb.reduce((s, r) => s + Math.abs(parseFloat(String(r[9] ?? 0)) || 0), 0)
    const adLevel = smartLevel(att_deb.length, totalAD)
    const totalAC = att_cred.reduce((s, r) => s + Math.abs(parseFloat(String(r[9] ?? 0)) || 0), 0)
    const totalVD = ventes_deb.reduce((s, r) => s + (parseFloat(String(r[10] ?? 0)) || 0), 0)
    const vdLevel = smartLevel(ventes_deb.length, totalVD)
    const totalVC = ventes_cred.reduce((s, r) => s + Math.abs(parseFloat(String(r[10] ?? 0)) || 0), 0)

    const anomBalance = score?.anomalies.find(a => a.id === 'balance')
    const anomFournDeb = score?.anomalies.find(a => a.id === 'fourndeb')
    const anomAttDeb = score?.anomalies.find(a => a.id === 'cattdeb')
    const anomVentesDeb = score?.anomalies.find(a => a.id === 'ventesdeb')

    return (
      <>
        {renderCarteGarantie()}

        <div className="recap-card" data-score-id="balance">
          <div className="rc-header">
            <div className="rc-icon icon-red">⚖️</div>
            <div>
              <div className="rc-label">Balance déséquilibrée</div>
              <div className="rc-sub">Écarts de balance détectés</div>
            </div>
            {renderBadge(balance_bad.length === 0 ? 'ok' : balLevel)}
          </div>
          <div className="rc-body">
            <div className="rc-main-stat">
              <span className={`rc-val ${balance_bad.length === 0 ? 'ok' : balLevel}`}>{balance_bad.length}</span>
              <span className="rc-val-label">balance(s) déséquilibrée(s)</span>
            </div>
            <div className="rc-divider" />
            <div className="rc-row">
              <span className="rc-row-label">Écart cumulé</span>
              <span className={`rc-row-val ${balance_bad.length === 0 ? 'ok' : balLevel}`}>{eur(totalBAL, 2)}</span>
            </div>
            {balance_bad.length > 0 ? (
              <>
                <div className="rc-divider" />
                <div className="mini-list">
                  {balance_bad.slice(0, 4).map((r, i) =>
                    renderMiniItem('balance', i, String(r[3] || r[1] || '—'), eur(Math.abs(parseFloat(String(r[7] ?? 0)) || 0), 2), 'bad', r)
                  )}
                </div>
                {renderCardActions(
                  balance_bad.length, 'balance', 'Balances déséquilibrées', balance_bad,
                  r => String(r[3] || r[1] || '—'),
                  r => Math.abs(parseFloat(String(r[7] ?? 0)) || 0),
                  'bad', null,
                  'balance_desequilibree',
                )}
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--green)', paddingTop: '4px' }}>✓ Aucune balance déséquilibrée</div>
            )}
            {score && anomBalance && renderScoreDetail(anomBalance)}
            {renderSectionNote('balance')}
          </div>
        </div>

        <div className="recap-card" data-score-id="fourndeb">
          <div className="rc-header">
            <div className="rc-icon icon-red">🔴</div>
            <div>
              <div className="rc-label">Fournisseurs débiteurs</div>
              <div className="rc-sub">Comptes fournisseurs à solde débiteur</div>
            </div>
            {renderBadge(fourn_deb.length === 0 ? 'ok' : fdLevel)}
          </div>
          <div className="rc-body">
            <div className="rc-main-stat">
              <span className={`rc-val ${fourn_deb.length === 0 ? 'ok' : fdLevel}`}>{fourn_deb.length}</span>
              <span className="rc-val-label">compte(s)</span>
            </div>
            <div className="rc-divider" />
            <div className="rc-row">
              <span className="rc-row-label">Montant total</span>
              <span className={`rc-row-val ${fourn_deb.length === 0 ? 'ok' : 'bad'}`}>{eur(totalFD, 2)}</span>
            </div>
            {fourn_deb.length > 0 ? (
              <>
                <div className="rc-divider" />
                <div className="mini-list">
                  {fourn_deb.slice(0, 4).map((r, i) =>
                    renderMiniItem('fourndeb', i, String(r[7] || '—') + ' · ' + String(r[8] || ''), eur(parseFloat(String(r[10] ?? 0)) || 0, 2), 'bad', r)
                  )}
                </div>
                {renderCardActions(
                  fourn_deb.length, 'fourndeb', 'Fournisseurs débiteurs', fourn_deb,
                  r => String(r[7] || '—') + ' · ' + String(r[8] || ''),
                  r => parseFloat(String(r[10] ?? 0)) || 0,
                  'bad',
                  r => [
                    String(r[1] || ''),
                    scoredC.fourn_deb_nc != null && r[scoredC.fourn_deb_nc] ? `Note : ${String(r[scoredC.fourn_deb_nc])}` : '',
                  ].filter(Boolean).join(' · '),
                  'fournisseurs_debiteurs',
                )}
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--green)', paddingTop: '4px' }}>✓ Aucun fournisseur débiteur</div>
            )}
            {score && anomFournDeb && renderScoreDetail(anomFournDeb)}
            {renderSectionNote('fourndeb')}
          </div>
        </div>

        <div className="recap-card" data-score-id="cattdeb">
          <div className="rc-header">
            <div className="rc-icon icon-orange">⏳</div>
            <div>
              <div className="rc-label">Comptes d&apos;attente débiteurs</div>
              <div className="rc-sub">46/47/48/49 — solde débiteur</div>
            </div>
            {renderBadge(att_deb.length === 0 ? 'ok' : adLevel)}
          </div>
          <div className="rc-body">
            <div className="rc-main-stat">
              <span className={`rc-val ${att_deb.length === 0 ? 'ok' : adLevel}`}>{att_deb.length}</span>
              <span className="rc-val-label">compte(s)</span>
            </div>
            <div className="rc-divider" />
            <div className="rc-row">
              <span className="rc-row-label">Montant total</span>
              <span className={`rc-row-val ${att_deb.length === 0 ? 'ok' : 'bad'}`}>{eur(totalAD, 2)}</span>
            </div>
            {att_deb.length > 0 ? (
              <>
                <div className="rc-divider" />
                <div className="mini-list">
                  {att_deb.slice(0, 4).map((r, i) =>
                    renderMiniItem('cattdeb', i, String(r[6] || '—') + ' · ' + String(r[5] || ''), eur(Math.abs(parseFloat(String(r[9] ?? 0)) || 0), 2), 'bad', r)
                  )}
                </div>
                {renderCardActions(
                  att_deb.length, 'cattdeb', 'Comptes attente débiteurs', att_deb,
                  r => String(r[6] || '—') + ' · ' + String(r[5] || ''),
                  r => Math.abs(parseFloat(String(r[9] ?? 0)) || 0),
                  'bad',
                  r => [
                    String(r[1] || ''),
                    scoredC.att_deb_nc != null && r[scoredC.att_deb_nc] ? `Note : ${String(r[scoredC.att_deb_nc])}` : '',
                  ].filter(Boolean).join(' · '),
                  'attente_debiteurs_copro',
                )}
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--green)', paddingTop: '4px' }}>✓ Aucun</div>
            )}
            {score && anomAttDeb && renderScoreDetail(anomAttDeb)}
            {renderSectionNote('cattdeb')}
          </div>
        </div>

        <div className="recap-card card-info" data-score-id="cattcred">
          <div className="rc-header">
            <div className="rc-icon icon-info">ℹ️</div>
            <div>
              <div className="rc-label">Comptes d&apos;attente créditeurs</div>
              <div className="rc-sub">46/47/48/49 — info uniquement</div>
            </div>
            <span className="rc-badge badge-info">Info</span>
          </div>
          <div className="rc-body">
            <div className="info-notice">ℹ Information uniquement — hors logique d&apos;anomalie.</div>
            <div className="rc-main-stat">
              <span className="rc-val info">{att_cred.length}</span>
              <span className="rc-val-label">compte(s)</span>
            </div>
            <div className="rc-divider" />
            <div className="rc-row">
              <span className="rc-row-label">Montant total</span>
              <span className="rc-row-val info">{eur(totalAC, 2)}</span>
            </div>
            {att_cred.length > 0 ? (
              <>
                <div className="rc-divider" />
                <div className="mini-list">
                  {att_cred.slice(0, 4).map((r, i) =>
                    renderMiniItem('cattcred', i, String(r[6] || '—') + ' · ' + String(r[5] || ''), eur(Math.abs(parseFloat(String(r[9] ?? 0)) || 0), 2), 'info', r)
                  )}
                </div>
                {renderCardActions(
                  att_cred.length, 'cattcred', 'Comptes attente créditeurs', att_cred,
                  r => String(r[6] || '—') + ' · ' + String(r[5] || ''),
                  r => Math.abs(parseFloat(String(r[9] ?? 0)) || 0),
                  'info',
                  r => [
                    String(r[1] || ''),
                    scoredC.att_cred_nc != null && r[scoredC.att_cred_nc] ? `Note : ${String(r[scoredC.att_cred_nc])}` : '',
                  ].filter(Boolean).join(' · '),
                  'attente_crediteurs_copro',
                )}
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--info)', paddingTop: '4px' }}>Aucun</div>
            )}
            {renderSectionNote('cattcred')}
          </div>
        </div>

        <div className="recap-card" data-score-id="ventesdeb">
          <div className="rc-header">
            <div className="rc-icon icon-red">📤</div>
            <div>
              <div className="rc-label">Copropriétaires sortis débiteurs</div>
              <div className="rc-sub">Ventes non soldées — solde positif</div>
            </div>
            {renderBadge(ventes_deb.length === 0 ? 'ok' : vdLevel)}
          </div>
          <div className="rc-body">
            <div className="rc-main-stat">
              <span className={`rc-val ${ventes_deb.length === 0 ? 'ok' : vdLevel}`}>{ventes_deb.length}</span>
              <span className="rc-val-label">compte(s)</span>
            </div>
            <div className="rc-divider" />
            <div className="rc-row">
              <span className="rc-row-label">Total débiteur</span>
              <span className={`rc-row-val ${ventes_deb.length === 0 ? 'ok' : 'bad'}`}>{eur(totalVD, 2)}</span>
            </div>
            {ventes_deb.length > 0 ? (
              <>
                <div className="rc-divider" />
                <div className="mini-list">
                  {ventes_deb.slice(0, 4).map((r, i) =>
                    renderMiniItem('ventesdeb', i, String(r[1] || '—') + ' · ' + String(r[7] || ''), eur(parseFloat(String(r[10] ?? 0)) || 0, 2), 'bad', r)
                  )}
                </div>
                {renderCardActions(
                  ventes_deb.length, 'ventesdeb', 'Copropriétaires sortis débiteurs', ventes_deb,
                  r => String(r[1] || '—') + ' · ' + String(r[7] || ''),
                  r => parseFloat(String(r[10] ?? 0)) || 0,
                  'bad',
                  r => [
                    r[8] ? `Sortie : ${new Date(String(r[8])).toLocaleDateString('fr-FR')}` : '',
                    r[9] != null ? `${r[9]} j` : '',
                    scoredC.ventes_nc != null && r[scoredC.ventes_nc] ? `Note : ${String(r[scoredC.ventes_nc])}` : '',
                  ].filter(Boolean).join(' · '),
                  'coproprietaires_sortis_debiteurs',
                )}
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--green)', paddingTop: '4px' }}>✓ Aucun</div>
            )}
            {score && anomVentesDeb && renderScoreDetail(anomVentesDeb)}
            {renderSectionNote('ventesdeb')}
          </div>
        </div>

        <div className="recap-card card-info" data-score-id="ventescred">
          <div className="rc-header">
            <div className="rc-icon icon-info">📥</div>
            <div>
              <div className="rc-label">Copropriétaires sortis créditeurs</div>
              <div className="rc-sub">Ventes non soldées — solde négatif · info</div>
            </div>
            <span className="rc-badge badge-info">Info</span>
          </div>
          <div className="rc-body">
            <div className="info-notice">ℹ Remboursements à effectuer — information uniquement.</div>
            <div className="rc-main-stat">
              <span className="rc-val info">{ventes_cred.length}</span>
              <span className="rc-val-label">compte(s)</span>
            </div>
            <div className="rc-divider" />
            <div className="rc-row">
              <span className="rc-row-label">Total à rembourser</span>
              <span className="rc-row-val info">{eur(totalVC, 2)}</span>
            </div>
            {ventes_cred.length > 0 ? (
              <>
                <div className="rc-divider" />
                <div className="mini-list">
                  {ventes_cred.slice(0, 4).map((r, i) =>
                    renderMiniItem('ventescred', i, String(r[1] || '—') + ' · ' + String(r[7] || ''), eur(Math.abs(parseFloat(String(r[10] ?? 0)) || 0), 2), 'info', r)
                  )}
                </div>
                {renderCardActions(
                  ventes_cred.length, 'ventescred', 'Copropriétaires sortis créditeurs', ventes_cred,
                  r => String(r[1] || '—') + ' · ' + String(r[7] || ''),
                  r => Math.abs(parseFloat(String(r[10] ?? 0)) || 0),
                  'info',
                  r => [
                    r[8] ? `Sortie : ${new Date(String(r[8])).toLocaleDateString('fr-FR')}` : '',
                    r[9] != null ? `${r[9]} j` : '',
                    scoredC.ventes_nc != null && r[scoredC.ventes_nc] ? `Note : ${String(r[scoredC.ventes_nc])}` : '',
                  ].filter(Boolean).join(' · '),
                  'coproprietaires_sortis_crediteurs',
                )}
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--info)', paddingTop: '4px' }}>Aucun</div>
            )}
            {renderSectionNote('ventescred')}
          </div>
        </div>

        {renderCarteNonClot(scoredC.bq_nonclot ?? [])}
        {renderCarteBQ(bq_nonrapp)}
        {renderCarteCPTA(cpta_nonrapp)}
        {renderCarteFactures(factures_nr30, factures_nr60, factures.length, 11)}
        {renderCarteEtatFinancier(bilan)}
      </>
    )
  }

  // ── Bilan modal (KPI tiles — read-only) ─────────────────────────────────────

  function renderBilanModal() {
    if (!bilanModal.open) return null
    const { title, rows } = bilanModal
    return (
      <div className="modal-overlay open" onClick={() => setBilanModal(m => ({ ...m, open: false }))}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <div className="modal-title">{title}</div>
              <div className="modal-sub">{rows.length} copropriété(s)</div>
            </div>
            <button className="modal-close" onClick={() => setBilanModal(m => ({ ...m, open: false }))}>✕</button>
          </div>
          <div className="modal-body">
            {rows.map((r, i) => {
              const vCop  = parseFloat(String(r[11] ?? 0))
              const vChrg = parseFloat(String(r[16] ?? 0))
              const vTvx  = r[18] != null && !isNaN(Number(r[18])) ? parseFloat(String(r[18])) : null
              const vBq   = parseFloat(String(r[25] ?? 0))
              const kpi = (val: string, bad: boolean, label: string, seuil: string, na: boolean) => (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '7px 10px', borderRadius: '8px', flex: 1, minWidth: '80px',
                  background: na ? 'var(--cream)' : bad ? 'var(--red-bg)' : 'var(--green-bg)',
                }}>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: na ? 'var(--muted)' : bad ? 'var(--red)' : 'var(--green)' }}>{val}</span>
                  <span style={{ fontSize: '10px', color: 'var(--muted)', textAlign: 'center', marginTop: '2px' }}>{label}</span>
                  <span style={{ fontSize: '9px', color: na ? 'var(--muted)' : bad ? 'var(--red)' : 'var(--green)', marginTop: '2px' }}>
                    {na ? 'n/a' : 'seuil ' + seuil}
                  </span>
                </div>
              )
              return (
                <div key={i} className="modal-row" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ width: '100%', marginBottom: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>{String(r[1] || '—').replace(/^\d+-/, '')}</div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                      {r[0]} · {r[4] || '?'} lots · <b>{r[7]}</b> anomalie(s)
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', width: '100%' }}>
                    {kpi((vCop * 100).toFixed(0) + '%',  vCop > 0.30,           'Impayés coprop.',    '>30\u202f%',    false)}
                    {kpi((vChrg * 100).toFixed(0) + '%', vChrg > 1.00,          'Charges / Prov.',    '>100\u202f%',   false)}
                    {kpi(vTvx != null ? (vTvx * 100).toFixed(0) + '%' : '—', vTvx != null && vTvx > 1.00, 'Dépassem. travaux', '>100\u202f%', vTvx == null)}
                    {kpi((vBq * 100).toFixed(0) + '%',   vBq < -1.00,           'Découvert trésor.',  '<\u2212100\u202f%', false)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Modal render ──────────────────────────────────────────────────────────────

  function renderModal() {
    if (!modal.open) return null
    const { cId, rows, nameFn, valFn, valClass, subFn, title, cols, nc } = modal
    const isInfo = INFO_CIDS.has(cId)
    const includedRows = rows.filter((_, i) => getAnnot(cId, i).include)
    const total = includedRows.reduce((s, r) => s + (valFn(r) || 0), 0)
    const searchTerm = modalSearch.toLowerCase().trim()
    const displayPairs = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r, i: _i }) => {
        if (!searchTerm) return true
        if (cols) return cols.some(c => (c.fn(r, nc ?? null) || '').toLowerCase().includes(searchTerm))
        const n = (nameFn(r) || '').toLowerCase()
        const s = subFn ? (subFn(r) || '').toLowerCase() : ''
        return n.includes(searchTerm) || s.includes(searchTerm)
      })

    return (
      <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <div className="modal-title">{title}</div>
              <div className="modal-sub">
                {searchTerm ? `${displayPairs.length} / ${rows.length} ligne(s)` : `${rows.length} ligne(s)`}
              </div>
            </div>
            <button className="modal-close" onClick={closeModal}>✕</button>
            <input
              type="text"
              className="modal-search"
              placeholder="Filtrer les lignes…"
              value={modalSearch}
              onChange={e => setModalSearch(e.target.value)}
            />
          </div>
          <div className="modal-body">
            {cols ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="modal-multi-table">
                  <thead>
                    <tr>
                      {cols.map((c, ci) => (
                        <th key={ci} style={{ textAlign: c.right ? 'right' : 'left' }}>{c.header}</th>
                      ))}
                      {!isInfo && <th style={{ whiteSpace: 'nowrap' }}>Statut</th>}
                      <th style={{ width: '32px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {displayPairs.reduce((acc, { r, i }) => {
                      const ann = getAnnot(cId, i)
                      const k = aKey(cId, i)
                      const excl = !ann.include
                      const hasC = !!ann.comment
                      acc.push(
                        <tr key={k} style={excl ? { opacity: 0.55 } : undefined}>
                          {cols!.map((c, ci) => (
                            <td key={ci} style={{ textAlign: c.right ? 'right' : 'left', textDecoration: excl ? 'line-through' : undefined }}>
                              {c.fn(r, nc ?? null) || '—'}
                            </td>
                          ))}
                          {!isInfo && (
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div className="status-toggle">
                                <button className={`status-seg${ann.include ? ' seg-injustifie' : ''}`} onClick={() => { if (!ann.include) toggleInclude(cId, i) }}>✗</button>
                                <button className={`status-seg${!ann.include ? ' seg-justifie' : ''}`} onClick={() => { if (ann.include) toggleInclude(cId, i) }}>✓</button>
                              </div>
                            </td>
                          )}
                          <td>
                            <button
                              className={`modal-comment-btn${hasC ? ' active' : ''}`}
                              onClick={() => {
                                const zone = document.getElementById(`mcz_${k}`)
                                const btn = document.getElementById(`mcb_${k}`)
                                if (!zone) return
                                const op = !zone.classList.contains('open')
                                zone.classList.toggle('open', op)
                                if (btn) btn.classList.toggle('active', op || hasC)
                                if (op) (document.getElementById(`mci_${k}`) as HTMLTextAreaElement)?.focus()
                              }}
                              id={`mcb_${k}`}
                              title="Commentaire"
                            >💬</button>
                          </td>
                        </tr>,
                      )
                      acc.push(
                        <tr key={k + '-c'}>
                          <td colSpan={cols!.length + (isInfo ? 1 : 2)} style={{ padding: '0 10px 4px', borderBottom: 'none' }}>
                            <div className={`modal-comment-zone${hasC ? ' open' : ''}`} id={`mcz_${k}`}>
                              <textarea
                                className="modal-comment-input"
                                id={`mci_${k}`}
                                rows={1}
                                placeholder="Commentaire…"
                                defaultValue={ann.comment}
                                onBlur={e => saveComment(cId, i, e.target.value)}
                              />
                            </div>
                          </td>
                        </tr>,
                      )
                      return acc
                    }, [] as JSX.Element[])}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                <div className="modal-col-header">
                  <span className="modal-col-h-name">Libellé</span>
                  <span className="modal-col-h-right">
                    <span className="modal-col-h-val">Montant</span>
                    {!isInfo && <span className="modal-col-h-status">Statut</span>}
                    <span style={{ width: '28px' }} />
                  </span>
                </div>
                {displayPairs.map(({ r, i }) => {
                  const ann = getAnnot(cId, i)
                  const k = aKey(cId, i)
                  const excl = !ann.include
                  const hasC = !!ann.comment
                  const name = nameFn(r)?.trim() || `Ligne ${i + 1}`
                  const rawV = valFn(r)
                  const val = eur(Math.abs(rawV), 2)
                  const sub = subFn ? subFn(r) : ''
                  return (
                    <div key={k} className="modal-row">
                      <div className="modal-row-body">
                        <div className="modal-row-top">
                          <span className={`modal-row-name${excl ? ' exclu' : ''}`}>{name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className={`modal-row-val ${valClass}${excl ? ' exclu' : ''}`}>{val}</span>
                            {!isInfo && (
                              <div className="status-toggle">
                                <button
                                  className={`status-seg${ann.include ? ' seg-injustifie' : ''}`}
                                  onClick={() => { if (!ann.include) toggleInclude(cId, i) }}
                                >✗</button>
                                <button
                                  className={`status-seg${!ann.include ? ' seg-justifie' : ''}`}
                                  onClick={() => { if (ann.include) toggleInclude(cId, i) }}
                                >✓</button>
                              </div>
                            )}
                            <button
                              className={`modal-comment-btn${hasC ? ' active' : ''}`}
                              onClick={() => {
                                const zone = document.getElementById(`mcz_${k}`)
                                const btn = document.getElementById(`mcb_${k}`)
                                if (!zone) return
                                const open = !zone.classList.contains('open')
                                zone.classList.toggle('open', open)
                                if (btn) btn.classList.toggle('active', open || hasC)
                                if (open) (document.getElementById(`mci_${k}`) as HTMLTextAreaElement)?.focus()
                              }}
                              id={`mcb_${k}`}
                              title="Commentaire"
                            >
                              💬
                            </button>
                          </div>
                        </div>
                        {sub && <div className="modal-row-sub">{sub}</div>}
                        <div className={`modal-comment-zone${hasC ? ' open' : ''}`} id={`mcz_${k}`}>
                          <textarea
                            className="modal-comment-input"
                            id={`mci_${k}`}
                            rows={1}
                            placeholder="Commentaire…"
                            defaultValue={ann.comment}
                            onBlur={e => saveComment(cId, i, e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
          <div className="modal-footer">
            {isInfo ? (
              <span style={{ color: 'var(--info)', fontWeight: 600 }}>{rows.length} ligne(s)</span>
            ) : (
              <span>
                <span style={{ color: 'var(--red)', fontWeight: 600 }}>{includedRows.length} injustifiée(s)</span>
                {rows.length - includedRows.length > 0 && (
                  <span style={{ color: 'var(--green)', marginLeft: '8px' }}>· {rows.length - includedRows.length} justifiée(s)</span>
                )}
              </span>
            )}
            {!isInfo && <span>Total injustifié : <strong>{eur(total, 2)}</strong></span>}
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUMMARY MODAL
  // ─────────────────────────────────────────────────────────────────────────────

  function renderSummaryModal() {
    if (!showSummary) return null
    const displayAgences = agences.length > 0 ? agences : (selectedAgence ? [selectedAgence] : ['Toutes agences'])

    const rows = displayAgences.map(agence => {
      const isAll = agence === 'Toutes agences'
      const fr = <T extends ExcelRow>(arr: T[], col: number): T[] =>
        isAll ? arr : filterRows(arr, col, agence)

      if (mode === 'gerance') {
        const pDeb = fr(donneesG.prop_deb, 0)
        const aDeb = fr(donneesG.att_deb, 0)
        const bq   = fr(donneesG.bq_nonrapp, 1)
        const cpta = fr(donneesG.cpta_nonrapp, 1)
        const f60  = fr(donneesG.factures_nr60, 1)
        return {
          'Agence': agence,
          'Proprios déb. (nb)': pDeb.length,
          'Proprios déb. (€)': pDeb.reduce((s, r) => s + nv(r, 6), 0),
          'Att. déb. (nb)': aDeb.length,
          'Att. déb. (€)': aDeb.reduce((s, r) => s + nv(r, 8), 0),
          'BQ non rapp.': bq.length,
          'CPTA non rapp.': cpta.length,
          'Factures +60j (nb)': f60.length,
          'Factures +60j (€)': f60.reduce((s, r) => s + nv(r, 10), 0),
        }
      } else {
        const bal  = fr(donneesC.balance_bad, 0)
        const fDeb = fr(donneesC.fourn_deb, 0)
        const aDeb = fr(donneesC.att_deb, 0)
        const vDeb = fr(donneesC.ventes_deb, 0)
        const bq   = fr(donneesC.bq_nonrapp, 0)
        const cpta = fr(donneesC.cpta_nonrapp, 0)
        const f60  = fr(donneesC.factures_nr60, 1)
        return {
          'Agence': agence,
          'Balance (nb)': bal.length,
          'Fourn. déb. (nb)': fDeb.length,
          'Fourn. déb. (€)': fDeb.reduce((s, r) => s + nv(r, 10), 0),
          'Att. déb. (nb)': aDeb.length,
          'Att. déb. (€)': aDeb.reduce((s, r) => s + nv(r, 9), 0),
          'Ventes déb. (nb)': vDeb.length,
          'Ventes déb. (€)': vDeb.reduce((s, r) => s + nv(r, 10), 0),
          'BQ non rapp.': bq.length,
          'CPTA non rapp.': cpta.length,
          'Factures +60j (nb)': f60.length,
          'Factures +60j (€)': f60.reduce((s, r) => s + nv(r, 11), 0),
        }
      }
    })

    const cols = rows.length > 0 ? Object.keys(rows[0]).filter(k => k !== 'Agence') : []

    function exportSummary() {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const XLSX = require('xlsx') as typeof import('xlsx')
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Synthèse')
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `Synthese_Audit_${mode}.xlsx`
      a.click()
    }

    return (
      <div className="modal-overlay open" onClick={() => setShowSummary(false)}>
        <div className="modal-box summary-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <span className="modal-title">📊 Synthèse — {mode === 'gerance' ? 'Gérance' : 'Copropriété'}</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button className="export-btn" onClick={exportSummary}>↓ Excel</button>
              <button className="modal-close" onClick={() => setShowSummary(false)}>✕</button>
            </div>
          </div>
          <div className="summary-scroll">
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Agence</th>
                  {cols.map(c => <th key={c}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'summary-row-even' : ''}>
                    <td className="summary-agence">{row['Agence']}</td>
                    {cols.map(c => {
                      const v = row[c as keyof typeof row] as number
                      const isAmt = c.endsWith('(€)')
                      const isZero = v === 0
                      return (
                        <td key={c} className={`summary-cell${isZero ? ' summary-zero' : isAmt ? ' summary-amt' : ''}`}>
                          {isAmt ? eur(v) : v}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HISTORY PANEL
  // ─────────────────────────────────────────────────────────────────────────────

  function renderHistoryPanel() {
    if (!showHistory) return null

    function fmtTs(iso: string) {
      const d = new Date(iso)
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }

    // ── Filtering ────────────────────────────────────────────────────────────
    const agenceOptions = Array.from(new Set(reportHistory.map(e => e.agence))).sort()

    const filtered = reportHistory.filter(e => {
      if (histFilterAgence && e.agence !== histFilterAgence) return false
      if (histFilterMode && e.mode !== histFilterMode) return false
      if (histFilterDateFrom) {
        if (new Date(e.timestamp) < new Date(histFilterDateFrom + 'T00:00:00')) return false
      }
      if (histFilterDateTo) {
        if (new Date(e.timestamp) > new Date(histFilterDateTo + 'T23:59:59')) return false
      }
      return true
    })

    const hasFilter = !!(histFilterAgence || histFilterMode || histFilterDateFrom || histFilterDateTo)

    const groups: Record<string, ReportEntry[]> = {}
    for (const e of filtered) {
      if (!groups[e.batchId]) groups[e.batchId] = []
      groups[e.batchId].push(e)
    }
    const sortedBatchIds = Object.keys(groups).sort((a, b) =>
      groups[b][0].timestamp.localeCompare(groups[a][0].timestamp)
    )

    const nbSelected = selectedHistoryIds.size
    const allIds = reportHistory.map(e => e.id)
    const allSelected = allIds.length > 0 && allIds.every(id => selectedHistoryIds.has(id))

    function toggleEntry(id: string) {
      setSelectedHistoryIds(prev => {
        const n = new Set(prev)
        n.has(id) ? n.delete(id) : n.add(id)
        return n
      })
    }

    function toggleBatch(batchId: string, checked: boolean) {
      setSelectedHistoryIds(prev => {
        const n = new Set(prev)
        groups[batchId].forEach(e => checked ? n.add(e.id) : n.delete(e.id))
        return n
      })
    }

    function toggleAll(checked: boolean) {
      setSelectedHistoryIds(checked ? new Set(allIds) : new Set())
    }

    return (
      <div className="modal-overlay open" onClick={() => { setShowHistory(false); setSelectedHistoryIds(new Set()) }}>
        <div className="modal-box history-panel" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                className="history-checkbox"
                checked={allSelected}
                onChange={e => toggleAll(e.target.checked)}
                title="Tout sélectionner"
              />
              <span className="modal-title">📋 Historique des rapports</span>
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 400 }}>
                {filtered.length}/{reportHistory.length} entrée(s)
              </span>
            </div>
            <button className="modal-close" onClick={() => { setShowHistory(false); setSelectedHistoryIds(new Set()) }}>✕</button>
          </div>

          {/* Filters */}
          <div className="history-filters">
            <select
              className="history-filter-select"
              value={histFilterAgence}
              onChange={e => setHistFilterAgence(e.target.value)}
            >
              <option value="">Toutes les agences</option>
              {agenceOptions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select
              className="history-filter-select"
              value={histFilterMode}
              onChange={e => setHistFilterMode(e.target.value as '' | 'gerance' | 'copro')}
            >
              <option value="">Tous les métiers</option>
              <option value="gerance">Gérance</option>
              <option value="copro">Copropriété</option>
            </select>
            <div className="history-filter-daterange">
              <span className="history-filter-datelabel">Du</span>
              <input
                type="date"
                className="history-filter-date"
                value={histFilterDateFrom}
                max={histFilterDateTo || undefined}
                onChange={e => setHistFilterDateFrom(e.target.value)}
              />
              <span className="history-filter-datelabel">au</span>
              <input
                type="date"
                className="history-filter-date"
                value={histFilterDateTo}
                min={histFilterDateFrom || undefined}
                onChange={e => setHistFilterDateTo(e.target.value)}
              />
            </div>
            {hasFilter && (
              <button
                className="history-filter-clear"
                onClick={() => { setHistFilterAgence(''); setHistFilterMode(''); setHistFilterDateFrom(''); setHistFilterDateTo('') }}
              >✕ Effacer</button>
            )}
          </div>

          <div className="history-scroll">
            {sortedBatchIds.length === 0 && (
              <div className="history-empty">
                {hasFilter ? 'Aucun résultat pour ces filtres.' : 'Aucun rapport enregistré pour le moment.\nLes audits sont sauvegardés lors de la validation de chaque agence.'}
              </div>
            )}
            {sortedBatchIds.map(batchId => {
              const entries = groups[batchId]
              const isCurrent = batchId === sessionBatchId.current
              const batchAllSelected = entries.every(e => selectedHistoryIds.has(e.id))
              const batchSomeSelected = entries.some(e => selectedHistoryIds.has(e.id))
              return (
                <div key={batchId} className={`history-batch${isCurrent ? ' current-batch' : ''}`}>
                  <div className="history-batch-header">
                    <input
                      type="checkbox"
                      className="history-checkbox"
                      checked={batchAllSelected}
                      ref={el => { if (el) el.indeterminate = batchSomeSelected && !batchAllSelected }}
                      onChange={e => toggleBatch(batchId, e.target.checked)}
                      title="Sélectionner ce lot"
                    />
                    <span className="history-batch-date">
                      {isCurrent && <span className="history-batch-now">Session en cours · </span>}
                      {fmtTs(entries[0].timestamp)}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '4px' }}>
                      · {entries.length} rapport(s)
                    </span>
                    <button
                      className="history-delete-btn"
                      onClick={() => setDeleteConfirm({ batchId, count: entries.length })}
                      title="Supprimer ce lot"
                    >🗑</button>
                  </div>
                  {entries.map(e => (
                    <div
                      key={e.id}
                      className={`history-entry${selectedHistoryIds.has(e.id) ? ' selected' : ''}`}
                      onClick={() => toggleEntry(e.id)}
                    >
                      <input
                        type="checkbox"
                        className="history-checkbox"
                        checked={selectedHistoryIds.has(e.id)}
                        onChange={() => toggleEntry(e.id)}
                        onClick={ev => ev.stopPropagation()}
                      />
                      <span className="history-entry-date">{fmtTs(e.timestamp)}</span>
                      <span className="history-entry-agence">{e.agence}</span>
                      <span className="history-entry-mode">{e.mode === 'gerance' ? 'Gérance' : 'Copro'}</span>
                      <span className="history-entry-score" style={{ color: e.scoreGlobal >= 80 ? 'var(--green)' : e.scoreGlobal >= 60 ? 'var(--orange)' : 'var(--red)' }}>
                        {e.scoreGlobal}/100
                      </span>
                      <span className="history-entry-niveau">{e.niveau}</span>
                      <span className="history-entry-meta">−{e.totalPenalite.toFixed(1)} pts · {e.nbAnomalies} anom.</span>
                      <button
                        className={`history-restore-btn${e.hasSnapshot ? '' : ' no-snap'}`}
                        onClick={ev => { ev.stopPropagation(); restoreFromHistory(e) }}
                        title={e.hasSnapshot ? 'Restaurer cet import' : 'Données complètes indisponibles — seule l\'agence sera restaurée'}
                      >↩</button>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {nbSelected > 0 && (
            <div className="history-actions-bar">
              <span className="history-actions-count">{nbSelected} sélectionné(s)</span>
              <button
                className="btn-danger"
                style={{ fontSize: '12px', padding: '6px 16px' }}
                onClick={() => deleteSelectedHistory(selectedHistoryIds)}
              >🗑 Supprimer la sélection</button>
              <button
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '6px 14px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '6px' }}
                onClick={() => setSelectedHistoryIds(new Set())}
              >Annuler</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE CONFIRM MODAL
  // ─────────────────────────────────────────────────────────────────────────────

  function renderDeleteConfirmModal() {
    if (!deleteConfirm) return null
    return (
      <div className="modal-overlay open" style={{ zIndex: 3000 }} onClick={() => setDeleteConfirm(null)}>
        <div className="modal-box confirm-modal" onClick={e => e.stopPropagation()}>
          <div className="confirm-icon">🗑</div>
          <div className="confirm-title">Supprimer ce lot ?</div>
          <div className="confirm-text">
            {deleteConfirm.count > 1
              ? `Cette action supprimera les ${deleteConfirm.count} rapports de ce lot.`
              : 'Cette action supprimera ce rapport de l\'historique.'}
            <br />Cette action est irréversible.
          </div>
          <div className="confirm-actions">
            <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>Annuler</button>
            <button className="btn-danger" onClick={() => deleteHistoryBatch(deleteConfirm!.batchId)}>Supprimer</button>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VALIDATE CONFIRM MODAL
  // ─────────────────────────────────────────────────────────────────────────────

  function renderValidateConfirmModal() {
    if (!validateConfirm) return null
    const agence = validateConfirm
    const hasScore = !!score
    return (
      <div className="modal-overlay open" style={{ zIndex: 3000 }} onClick={() => setValidateConfirm(null)}>
        <div className="modal-box confirm-modal" onClick={e => e.stopPropagation()}>
          <div className="confirm-icon">✅</div>
          <div className="confirm-title">Valider l&apos;agence ?</div>
          <div className="confirm-text">
            Vous êtes sur le point de valider <strong>{agence}</strong>.
            {hasScore
              ? <> Les données de cet audit seront <strong>enregistrées dans l&apos;historique</strong> et pourront être restaurées ultérieurement.</>
              : <> Aucun score calculé — l&apos;entrée sera enregistrée sans données (lancez l&apos;analyse d&apos;abord pour un enregistrement complet).</>}
          </div>
          <div className="confirm-actions">
            <button className="btn-secondary" onClick={() => setValidateConfirm(null)}>Annuler</button>
            <button className="btn-primary" onClick={() => confirmAgenceValidation(agence)}>Valider et enregistrer</button>
          </div>
        </div>
      </div>
    )
  }

  function renderValidateMultiConfirmModal() {
    if (!validateMultiConfirm) return null
    const norms = validateMultiConfirm
    const hasScore = !!score
    return (
      <div className="modal-overlay open" style={{ zIndex: 3000 }} onClick={() => setValidateMultiConfirm(null)}>
        <div className="modal-box confirm-modal" onClick={e => e.stopPropagation()}>
          <div className="confirm-icon">✅</div>
          <div className="confirm-title">Valider {norms.length} agences ?</div>
          <div className="confirm-text">
            Vous êtes sur le point de valider <strong>{norms.join(', ')}</strong>.
            {hasScore
              ? <> Un enregistrement commun sera créé dans l&apos;historique pour chaque agence.</>
              : <> Aucun score calculé — lancez l&apos;analyse d&apos;abord pour un enregistrement complet.</>}
          </div>
          <div className="confirm-actions">
            <button className="btn-secondary" onClick={() => setValidateMultiConfirm(null)}>Annuler</button>
            <button className="btn-primary" onClick={() => confirmMultiAgenceValidation(norms)}>Valider et enregistrer</button>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // COMPARISON PANEL
  // ─────────────────────────────────────────────────────────────────────────────

  function renderComparisonPanel() {
    if (!score) return null

    // Ensemble des agences actuellement sélectionnées (normalisées, triées)
    const currentNorms = Array.from(new Set(reportAgences.map(a => normalizeAgence(a)))).sort()
    const currentKey = currentNorms.length > 0 ? currentNorms.join(' + ') : normalizeAgence(selectedAgence || 'Toutes agences')

    const agenceSetsMatch = (entryAgence: string) => {
      const entryNorms = entryAgence.split(' + ').map(s => s.trim()).sort()
      if (entryNorms.length !== currentNorms.length) return false
      return entryNorms.every((n, i) => n === currentNorms[i])
    }

    // All eligible references for this agency + mode, sorted newest first
    const candidates = reportHistory
      .filter(e =>
        (e.status ?? 'valid') === 'valid' &&
        e.batchId !== sessionBatchId.current &&
        e.mode === mode &&
        agenceSetsMatch(e.agence)
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    const fmtDate = (iso: string) =>
      new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const fmtDateTime = (iso: string) => {
      const d = new Date(iso)
      return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    }

    const hasRef = candidates.length > 0

    if (!hasRef) return null

    // Active ref
    const activeId = comparisonRefId && candidates.find(e => e.id === comparisonRefId)
      ? comparisonRefId
      : candidates[0].id
    const ref = candidates.find(e => e.id === activeId)!
    const scoreDelta = score.scoreGlobal - ref.scoreGlobal

    const anomalyRows = score.anomalies.filter(a => !a.exclu && a.type === 'scoring').map(a => {
      const prev = ref.metrics?.[a.id]
      const prevNb      = prev?.nb ?? 0
      const prevMontant = prev?.montant ?? null
      const currNb      = a.nb
      const currMontant = a.montant
      const nbD = currNb !== null ? currNb - prevNb : null
      const mtD = currMontant !== null && prevMontant !== null ? currMontant - prevMontant : null
      if (nbD === 0 && (mtD === null || mtD === 0)) return null

      const nbColor  = nbD === null || nbD === 0 ? 'var(--muted)' : nbD > 0 ? 'var(--red)' : 'var(--green)'
      const mtColor  = mtD === null || mtD === 0 ? 'var(--muted)' : mtD > 0 ? 'var(--red)' : 'var(--green)'
      const nbSign   = nbD !== null && nbD > 0 ? '+' : ''
      const mtSign   = mtD !== null && mtD > 0 ? '+' : ''

      return (
        <tr key={a.id} className="comp-row">
          <td className="comp-label">{a.label}</td>
          <td className="comp-cell-num">
            <div className="comp-curr" style={{ color: nbColor }}>{currNb ?? '—'}</div>
            {nbD !== null && nbD !== 0 && (
              <div className="comp-sub">
                <span className="comp-prev-strike">{prevNb}</span>
                <span className="comp-pill" style={{ background: nbD > 0 ? 'var(--red-bg)' : 'var(--green-bg)', color: nbColor }}>
                  {nbD > 0 ? '↑' : '↓'} {nbSign}{nbD}
                </span>
              </div>
            )}
          </td>
          <td className="comp-cell-num">
            {currMontant !== null && prevMontant !== null ? (
              <>
                <div className="comp-curr" style={{ color: mtColor }}>{eur(currMontant, 0)}</div>
                {mtD !== null && mtD !== 0 && (
                  <div className="comp-sub">
                    <span className="comp-prev-strike">{eur(prevMontant, 0)}</span>
                    <span className="comp-pill" style={{ background: mtD > 0 ? 'var(--red-bg)' : 'var(--green-bg)', color: mtColor }}>
                      {mtD > 0 ? '↑' : '↓'} {mtSign}{eur(Math.abs(mtD), 0)}
                    </span>
                  </div>
                )}
              </>
            ) : <span className="comp-muted">—</span>}
          </td>
        </tr>
      )
    }).filter(Boolean)

    return (
      <div className="comparison-panel">
        <div className="comp-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="comp-title">🔄 Évolution vs audit précédent</span>
          <label className="comp-enable-label">
            <input
              type="checkbox"
              checked={comparisonEnabled}
              onChange={e => setComparisonEnabled(e.target.checked)}
            />
            Inclure dans le rapport
          </label>
        </div>

        {!comparisonEnabled ? (
          <div className="comp-empty" style={{ fontStyle: 'italic' }}>Comparaison désactivée — non incluse dans le PDF.</div>
        ) : (<>

        {/* Ref selector */}
        <div className="comp-ref-bar">
          <span className="comp-ref-label">Comparé à :</span>
          {candidates.length === 1 ? (
            <span className="comp-ref-single">
              <span className="comp-ref-date">{fmtDateTime(ref.timestamp)}</span>
              {ref.agence && <span className="comp-ref-agence">{ref.agence}</span>}
              <span className="comp-ref-score" style={{ color: ref.scoreGlobal >= 80 ? 'var(--green)' : ref.scoreGlobal >= 60 ? 'var(--orange)' : 'var(--red)' }}>
                {ref.scoreGlobal}/100
              </span>
            </span>
          ) : (
            <select
              className="comp-ref-select"
              value={activeId}
              onChange={e => setComparisonRefId(e.target.value)}
            >
              {candidates.map((c, i) => (
                <option key={c.id} value={c.id}>
                  {fmtDateTime(c.timestamp)}{c.agence ? ` — ${c.agence}` : ''} — {c.scoreGlobal}/100{i === 0 ? ' (le plus récent)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Score KPI */}
        <div className="comp-kpi-strip">
          <div className="comp-kpi-block">
            <div className="comp-kpi-label">Score précédent</div>
            <div className="comp-kpi-val muted">{ref.scoreGlobal}<span>/100</span></div>
          </div>
          <div className="comp-kpi-arrow">→</div>
          <div className="comp-kpi-block">
            <div className="comp-kpi-label">Score actuel</div>
            <div className={`comp-kpi-val ${scoreDelta > 0 ? 'good' : scoreDelta < 0 ? 'bad' : 'muted'}`}>{score.scoreGlobal}<span>/100</span></div>
          </div>
          <div className={`comp-kpi-delta ${scoreDelta > 0 ? 'good' : scoreDelta < 0 ? 'bad' : 'neutral'}`}>
            {scoreDelta > 0 ? '↑' : scoreDelta < 0 ? '↓' : '→'} {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(1)} pts
          </div>
        </div>

        {/* Per-anomaly table */}
        {anomalyRows.length === 0 ? (
          <div className="comp-stable">✓ Aucun écart significatif par rapport à l&apos;audit de référence.</div>
        ) : (
          <table className="comp-table">
            <thead>
              <tr>
                <th className="comp-th-label">Anomalie</th>
                <th className="comp-th-right">Nombre</th>
                <th className="comp-th-right">Montant</th>
              </tr>
            </thead>
            <tbody>{anomalyRows}</tbody>
          </table>
        )}
        </>)}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  const modeLabel = mode === 'gerance' ? 'Audit Comptable Gérance' : 'Audit Comptable Copropriété'

  return (
    <>
      {/* TOPBAR */}
      <div className="topbar">
        <div className="logo">21</div>
        <div>
          <div className="topbar-title">{modeLabel}</div>
          <div className="topbar-sub">Importez vos exports · Visualisez · Générez le rapport</div>
        </div>
        <div className="topbar-right">
          <select
            className="topbar-mode-select"
            value={mode}
            onChange={e => router.push(`/audit/${e.target.value}`)}
          >
            <option value="gerance">Gérance</option>
            <option value="copro">Copropriété</option>
          </select>
          <button className="btn-secondary" onClick={resetAll}>↺ Réinitialiser</button>
          {Object.keys(fileLoaded).length > 0 && (
            <button className="btn-secondary" onClick={() => setShowSummary(true)}>📊 Synthèse</button>
          )}
          {reportHistory.length > 0 && (
            <button className="btn-secondary" onClick={() => setShowHistory(true)}>📋 Historique ({reportHistory.length})</button>
          )}
          {score && (
            <>
              <button className="btn-primary btn-rapport" onClick={generateRapport} disabled={pdfGenerating}>
                {pdfGenerating ? '⏳ Génération…' : '📄 Rapport PDF'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* HISTORY WARNING */}
      {historyWarning && (
        <div className="history-warning-bar">
          <span>⚠ {historyWarning}</span>
          <button className="hw-close" onClick={() => setHistoryWarning(null)}>✕</button>
        </div>
      )}

      {/* MAIN LAYOUT */}
      <div className="layout">
        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="sb-block">
            <div className="sb-label">Identification</div>
            <div className="field">
              <label>Agences</label>
              {agences.length > 0 ? ((() => {
                // Group raw agency names by their normalized label
                const agenceGroups = new Map<string, string[]>()
                for (const a of agences) {
                  const norm = normalizeAgence(a)
                  if (!agenceGroups.has(norm)) agenceGroups.set(norm, [])
                  agenceGroups.get(norm)!.push(a)
                }
                const groupKeys = Array.from(agenceGroups.keys()).sort()
                const checkedGroupCount = groupKeys.filter(k => agenceGroups.get(k)!.every(a => reportAgences.includes(a))).length

                const autoFillFromRaws = (raws: string[], fillGarantie = true) => {
                  if (mode === 'gerance') {
                    if (fillGarantie) {
                      let g = 0, p = 0
                      raws.forEach(raw => { const v = zGerancePointe.get(raw); if (v) { g += v.garantie; p = Math.max(p, v.pointe) } })
                      if (g > 0) { setGarantie(Math.round(g)); setPointe(Math.round(p)) }
                    }
                    let nb = 0; raws.forEach(raw => { const n = zGeranceMandats.get(raw); if (n) nb += n })
                    if (nb > 0) setNbMandats(nb)
                  } else {
                    if (fillGarantie) {
                      let g = 0, p = 0
                      raws.forEach(raw => { const v = zCoproPointe.get(raw); if (v) { g += v.garantie; p = Math.max(p, v.pointe) } })
                      if (g > 0) { setGarantie(Math.round(g)); setPointe(Math.round(p)) }
                    }
                  }
                }

                return (
                  <div className="agence-multi-list">
                    <div className="agence-quick-row">
                      <button className="agence-quick-btn" onClick={() => {
                        setReportAgences([...agences])
                        const allRawsTout = groupKeys.flatMap(k => agenceGroups.get(k)!)
                        if (groupKeys.length === 1) autoFillFromRaws(allRawsTout)
                        else { autoFillFromRaws(agenceGroups.get(groupKeys[0])!, true); autoFillFromRaws(allRawsTout, false) }
                      }}>Tout</button>
                      <button className="agence-quick-btn" onClick={() => { setReportAgences([]); setGarantie(0); setPointe(0); if (mode === 'gerance') setNbMandats(0) }}>Aucune</button>
                      <span className="agence-multi-count">{checkedGroupCount}/{groupKeys.length}</span>
                    </div>
                    {groupKeys.map(norm => {
                      const rawNames = agenceGroups.get(norm)!
                      const isChecked = rawNames.every(a => reportAgences.includes(a))
                      const toggle = () => {
                        // Sauvegarde annotations/notes de l'agence courante
                        if (selectedAgence && selectedAgence !== norm) {
                          annotsByAgenceRef.current[selectedAgence] = annots
                          notesByAgenceRef.current[selectedAgence] = sectionNotes
                        }
                        // Charge annotations/notes de la nouvelle agence
                        setAnnots(annotsByAgenceRef.current[norm] ?? {})
                        setSectionNotes(notesByAgenceRef.current[norm] ?? {})
                        const next = isChecked
                          ? reportAgences.filter(x => !rawNames.includes(x))
                          : [...reportAgences.filter(x => !rawNames.includes(x)), ...rawNames]
                        setReportAgences(next)
                        setSelectedAgence(norm)
                        const checkedKeys = groupKeys.filter(k => agenceGroups.get(k)!.every(a => next.includes(a)))
                        if (checkedKeys.length === 1) {
                          autoFillFromRaws(agenceGroups.get(checkedKeys[0])!)
                        } else if (checkedKeys.length > 1) {
                          autoFillFromRaws(agenceGroups.get(checkedKeys[0])!, true)
                          const allRaws = checkedKeys.flatMap(k => agenceGroups.get(k)!)
                          autoFillFromRaws(allRaws, false)
                        } else {
                          setGarantie(0); setPointe(0)
                          if (mode === 'gerance') setNbMandats(0)
                        }
                      }
                      return (
                        <div key={norm} className={`agence-multi-row${isChecked ? ' selected' : ''}`} onClick={toggle}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={toggle}
                            onClick={e => e.stopPropagation()}
                          />
                          <span className="agence-multi-name">{norm}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })()) : (
                <input
                  type="text"
                  value={selectedAgence ?? ''}
                  placeholder="Importez un fichier"
                  onChange={e => setSelectedAgence(e.target.value || null)}
                />
              )}
            </div>
            <div className="field">
              <label>Début de période</label>
              <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
            </div>
            <div className="field">
              <label>Fin de période</label>
              <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} />
            </div>
          </div>
          <div className="sb-block">
            <div className="sb-label">Données manuelles ✏</div>
            <div className="field manual">
              <label>Garantie financière (€)</label>
              <input
                type="number"
                value={garantie || ''}
                step="0.01"
                onChange={e => setGarantie(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="field-row">
              <div className="field manual">
                <label>Pointe (€)</label>
                <input
                  type="number"
                  value={pointe || ''}
                  step="0.01"
                  onChange={e => setPointe(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="field manual">
                <label>Date pointe</label>
                <input type="date" value={pointeDate} onChange={e => setPointeDate(e.target.value)} />
              </div>
            </div>
            {mode === 'gerance' && (
              <div className="field">
                <label>Nb mandats</label>
                <input
                  type="number"
                  value={nbMandats || ''}
                  placeholder="Importez un fichier"
                  onChange={e => setNbMandats(parseInt(e.target.value) || 0)}
                />
              </div>
            )}
            {mode === 'copro' && (
              <div className="field">
                <label>Nb copros</label>
                <input
                  type="number"
                  value={scoredC.bilan.length || ''}
                  placeholder="Importez un fichier"
                  readOnly
                />
              </div>
            )}
          </div>
          <div className="sb-block">
            <div className="sb-label">Fichiers chargés</div>
            <div className="sb-file-list">
              {fileConfigs.map(fc => {
                const isGreen = !!fileLoaded[fc.id] || !!forcedOk[fc.id]
                return (
                  <div key={fc.id} className={`sb-file-item${isGreen ? ' loaded' : ''}`}>
                    <span className={`status-dot ${isGreen ? 'dot-ok' : 'dot-pending'}`} />
                    {fileLoaded[fc.id] ? truncate(fileLoaded[fc.id], 24) : forcedOk[fc.id] ? `${fc.name} ✓` : fc.name}
                  </div>
                )
              })}
            </div>
          </div>
          {agences.length > 0 && (() => {
            const valGroups = new Map<string, string[]>()
            for (const a of agences) {
              const norm = normalizeAgence(a)
              if (!valGroups.has(norm)) valGroups.set(norm, [])
              valGroups.get(norm)!.push(a)
            }
            const valGroupKeys = Array.from(valGroups.keys()).sort()
            const allValidated = valGroupKeys.every(k => validatedAgencies.has(k))
            // Agences actuellement sélectionnées pour l'audit (dans le sélecteur)
            const selectedNorms = Array.from(new Set(reportAgences.map(a => normalizeAgence(a))))
            const multiSelected = selectedNorms.length > 1
            const allSelectedValidated = selectedNorms.every(k => validatedAgencies.has(k))
            return (
              <div className="sb-block">
                <div className="sb-label">Validation agences</div>
                {multiSelected && (
                  <button
                    className={`agency-val-all-btn${allSelectedValidated ? ' validated' : ''}`}
                    onClick={() => {
                      if (allSelectedValidated) {
                        setValidatedAgencies(prev => { const n = new Set(prev); selectedNorms.forEach(a => n.delete(a)); return n })
                      } else {
                        setValidateMultiConfirm(selectedNorms)
                      }
                    }}
                    title={allSelectedValidated ? 'Annuler la validation groupée' : `Valider et enregistrer les ${selectedNorms.length} agences sélectionnées`}
                  >
                    {allSelectedValidated ? '✓' : '○'} Valider {selectedNorms.length} agences ensemble
                  </button>
                )}
                <div className="agency-val-list">
                  {valGroupKeys.map(norm => (
                    <div key={norm} className="agency-val-row">
                      <button
                        className={`agency-val-btn${validatedAgencies.has(norm) ? ' validated' : ''}`}
                        onClick={() => toggleAgenceValidation(norm)}
                        title={validatedAgencies.has(norm) ? 'Annuler la validation' : 'Marquer comme validée'}
                      >
                        {validatedAgencies.has(norm) ? '✓' : '○'}
                      </button>
                      <span className="agency-val-name">{truncate(norm, 22)}</span>
                    </div>
                  ))}
                </div>
                {allValidated && (
                  <div className="agency-val-ok">✓ Toutes les agences validées</div>
                )}
              </div>
            )
          })()}
        </div>

        {/* CONTENT */}
        <div className="content">
          <div className="section-title">Imports Power BI</div>
          <div className="upload-grid">
            {fileConfigs.map(fc => {
              const hasError = !!fileErrors[fc.id]
              const isLoaded = !!fileLoaded[fc.id]
              return (
                <div
                  key={fc.id}
                  className={`drop-card${isLoaded ? ' loaded dc-download' : hasError ? ' dc-error' : (forcedOk[fc.id] ? ' forced-ok' : '')}`}
                  onClick={isLoaded ? () => downloadFile(fc.id) : undefined}
                >
                  {(isLoaded || hasError) && (
                    <button
                      className="dc-remove-btn"
                      title="Supprimer ce fichier"
                      onClick={e => { e.preventDefault(); e.stopPropagation(); removeFile(fc.id) }}
                    >
                      🗑
                    </button>
                  )}
                  {!isLoaded && (
                    <input
                      key={fileKeys[fc.id] ?? 0}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={e => {
                        setForcedOk(prev => ({ ...prev, [fc.id]: false }))
                        handleFile(e, fc.id)
                      }}
                    />
                  )}
                  <span className="dc-icon">{fc.icon}</span>
                  <div className="dc-name">{fc.name}</div>
                  <div className={`dc-status${hasError ? ' dc-status-error' : ''}`}>
                    {isLoaded ? '⬇ Télécharger' : hasError ? '✗ Mauvais fichier' : forcedOk[fc.id] ? '✓ 0 anomalie' : 'Déposer ou cliquer'}
                  </div>
                  {hasError && (
                    <div className="dc-error-msg">{fileErrors[fc.id]}</div>
                  )}
                  {!isLoaded && !hasError && fc.id !== 'z_pointe' && fc.id !== 'z_mandats' && (
                    <label className="dc-force-ok" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!!forcedOk[fc.id]}
                        onChange={e => setForcedOk(prev => ({ ...prev, [fc.id]: e.target.checked }))}
                      />
                      Pas d&apos;anomalie
                    </label>
                  )}
                </div>
              )
            })}
          </div>

          <div className="section-title">Récapitulatif des anomalies</div>

          {score && renderScoreBanner(score)}
          {score && renderGlobalNote()}
          {score && renderComparisonPanel()}
          <div className="recap-grid">
            {mode === 'gerance' ? renderGerance() : renderCopro()}
          </div>
        </div>
      </div>

      {/* MODAL */}
      {renderModal()}
      {renderBilanModal()}
      {renderSummaryModal()}
      {renderHistoryPanel()}
      {renderDeleteConfirmModal()}
      {renderValidateConfirmModal()}
      {renderValidateMultiConfirmModal()}
    </>
  )
}
