/**
 * Générateur de rapport Word — Audit Comptable Century 21
 * Utilise la bibliothèque `docx` v8.
 * Tourne côté client (navigateur) — images chargées via fetch('/report-assets/...')
 */
import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Packer, AlignmentType, BorderStyle, WidthType,
  VerticalAlign, ShadingType, Header, Footer, HeadingLevel,
  convertMillimetersToTwip, HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom, TextWrappingType,
} from 'docx'
import type {
  GeranceData, CoproData, AnnotationsMap, ScoreResult, AnomalyResult, ExcelRow,
} from '@/types/audit'
import { excelDateFmt } from '@/lib/utils/format'

// ─── Constantes visuelles ────────────────────────────────────────────────────

const C = {
  NAVY:   '0F1F35',
  NAVY2:  '1A3252',
  GOLD:   'C49A2E',
  GOLD_L: 'F0D080',
  WHITE:  'FFFFFF',
  RED:    'B01A1A',
  RED_L:  'FAEAEA',
  GREEN:  '1A7A4A',
  GREEN_L:'EAF6EF',
  ORANGE: 'C05C1A',
  MUTED:  '7A7A8C',
  BORDER: 'E8E4DC',
  C21RED: 'C0504D',   // rouge "Rfrenceintense" des modèles C21
  EXCLU:  'EAF6EF',   // fond vert clair pour lignes justifiées
}

const FONT = 'Typold'
const FONT_BODY = 'Calibri'

// Largeur utile de page A4 en DXA (twips) : 210mm - 2×25mm marges = 160mm
const PAGE_WIDTH_DXA = convertMillimetersToTwip(160)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function eur(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function pct(n: number): string {
  return n.toFixed(1).replace('.', ',') + ' %'
}

function trunc(s: string, max = 50): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

function val(r: ExcelRow, i: number): string {
  return String(r[i] ?? '').trim()
}

function numVal(r: ExcelRow, i: number): number {
  return parseFloat(String(r[i] ?? '0')) || 0
}

function isExclu(annots: AnnotationsMap, cId: string, i: number): boolean {
  return annots[`${cId}_${i}`]?.include === false
}

function getComment(annots: AnnotationsMap, cId: string, i: number): string {
  return annots[`${cId}_${i}`]?.comment || ''
}

function noBorder() {
  return { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
}

function thinBorder() {
  return { style: BorderStyle.SINGLE, size: 4, color: C.BORDER }
}

// ─── Builders paragraphes ────────────────────────────────────────────────────

function emptyPara(): Paragraph {
  return new Paragraph({ children: [] })
}

function h1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({
      text, font: 'Barlow', bold: true, color: C.GOLD,
      size: 28,
    })],
    spacing: { before: 400, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.GOLD } },
  })
}

function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, font: FONT, bold: true, color: C.NAVY2, size: 24 })],
    spacing: { before: 300, after: 150 },
  })
}

function h3(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, font: FONT, italics: true, color: C.NAVY2, size: 22 })],
    spacing: { before: 240, after: 100 },
  })
}

function bodyText(text: string, opts?: { bold?: boolean; italic?: boolean; color?: string }): Paragraph {
  return new Paragraph({
    children: [new TextRun({
      text, font: FONT_BODY, size: 20,
      bold: opts?.bold,
      italics: opts?.italic,
      color: opts?.color,
    })],
    spacing: { after: 100 },
  })
}

function listAnomaliesTitle(): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    children: [new TextRun({
      text: 'LISTE DES ANOMALIES',
      font: FONT, bold: true, smallCaps: true,
      color: C.C21RED, underline: {},
      characterSpacing: 50,
      size: 22,
    })],
  })
}

function pageBreak(): Paragraph {
  return new Paragraph({ pageBreakBefore: true, children: [] })
}

// ─── Table d'anomalies ────────────────────────────────────────────────────────

interface ColDef {
  header: string
  width: number // relatif
  getValue: (r: ExcelRow) => string
}

function buildAnomalyTable(
  rows: ExcelRow[],
  cId: string,
  annots: AnnotationsMap,
  cols: ColDef[],
): Table {
  // Calculer les largeurs en DXA proportionnellement
  const totalWeight = cols.reduce((s, c) => s + c.width, 0)
  const commentWeight = 2
  const statutWeight  = 1.5
  const allWeight = totalWeight + commentWeight + statutWeight
  const toDXA = (w: number) => Math.round(PAGE_WIDTH_DXA * w / allWeight)

  const colWidths = [
    ...cols.map(c => toDXA(c.width)),
    toDXA(commentWeight),
    toDXA(statutWeight),
  ]

  // En-tête (fond or Century 21, texte blanc)
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      ...cols.map((c, ci) => new TableCell({
        width: { size: colWidths[ci], type: WidthType.DXA },
        shading: { fill: C.GOLD, type: ShadingType.SOLID },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          children: [new TextRun({ text: c.header, font: FONT, bold: true, color: C.WHITE, size: 18 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 60 },
        })],
      })),
      new TableCell({
        width: { size: colWidths[cols.length], type: WidthType.DXA },
        shading: { fill: C.GOLD, type: ShadingType.SOLID },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          children: [new TextRun({ text: 'Commentaire', font: FONT, bold: true, color: C.WHITE, size: 18 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 60 },
        })],
      }),
      new TableCell({
        width: { size: colWidths[cols.length + 1], type: WidthType.DXA },
        shading: { fill: C.GOLD, type: ShadingType.SOLID },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          children: [new TextRun({ text: 'Statut', font: FONT, bold: true, color: C.WHITE, size: 18 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 60 },
        })],
      }),
    ],
  })

  // Lignes de données
  const dataRows = rows.map((r, i) => {
    const exclu    = isExclu(annots, cId, i)
    const comment  = getComment(annots, cId, i)
    const bg       = exclu ? C.EXCLU : (i % 2 === 0 ? 'FFFFFF' : 'F8F8F8')
    const statutTxt = exclu ? '✓ Justifié' : '✗ Injustifié'
    const statutColor = exclu ? C.GREEN : C.RED

    return new TableRow({
      children: [
        ...cols.map((c, ci) => new TableCell({
          width: { size: colWidths[ci], type: WidthType.DXA },
          shading: { fill: bg, type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            children: [new TextRun({ text: trunc(c.getValue(r), 60), font: FONT_BODY, size: 18, color: C.NAVY })],
            spacing: { before: 50, after: 50 },
          })],
        })),
        new TableCell({
          width: { size: colWidths[cols.length], type: WidthType.DXA },
          shading: { fill: bg, type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            children: [new TextRun({ text: comment, font: FONT_BODY, italics: true, size: 16, color: C.MUTED })],
            spacing: { before: 50, after: 50 },
          })],
        }),
        new TableCell({
          width: { size: colWidths[cols.length + 1], type: WidthType.DXA },
          shading: { fill: bg, type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: statutTxt, font: FONT, bold: exclu, size: 16, color: statutColor })],
            spacing: { before: 50, after: 50 },
          })],
        }),
      ],
    })
  })

  return new Table({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    rows: [headerRow, ...dataRows],
    borders: {
      top:              thinBorder(),
      bottom:           thinBorder(),
      left:             thinBorder(),
      right:            thinBorder(),
      insideHorizontal: thinBorder(),
      insideVertical:   thinBorder(),
    },
  })
}

// ─── Table synthèse score ─────────────────────────────────────────────────────

function buildScoreTable(score: ScoreResult, mode: 'gerance' | 'copro'): Table {
  const rows: TableRow[] = []

  const headerRow = (label: string) => new TableRow({
    children: [
      new TableCell({
        columnSpan: 3,
        shading: { fill: C.NAVY2, type: ShadingType.SOLID },
        children: [new Paragraph({
          children: [new TextRun({ text: label, font: FONT, bold: true, color: C.GOLD_L, size: 20 })],
          spacing: { before: 100, after: 100 },
        })],
      })
    ]
  })

  const colHeaderRow = () => new TableRow({
    children: ['Anomalie', 'Pénalité', 'Max'].map((h, i) => new TableCell({
      shading: { fill: C.NAVY, type: ShadingType.SOLID },
      width: { size: i === 0 ? PAGE_WIDTH_DXA * 0.65 : PAGE_WIDTH_DXA * 0.175, type: WidthType.DXA },
      children: [new Paragraph({
        alignment: i > 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text: h, font: FONT, bold: true, color: C.WHITE, size: 18 })],
        spacing: { before: 60, after: 60 },
      })],
    })),
  })

  const anomRow = (a: typeof score.anomalies[0], idx: number) => {
    const bg = a.exclu ? C.EXCLU : idx % 2 === 0 ? 'FFFFFF' : 'F8F8F8'
    const penStr = a.exclu ? '—' : a.penalite > 0 ? `−${a.penalite.toFixed(1)}` : '0'
    const maxStr = a.penaliteMax > 0 ? `/${a.penaliteMax}` : '—'
    const color  = a.penalite > 0 && !a.exclu ? C.RED : a.exclu ? C.MUTED : C.GREEN
    return new TableRow({
      children: [
        new TableCell({
          shading: { fill: bg, type: ShadingType.SOLID },
          children: [new Paragraph({
            children: [new TextRun({
              text: a.label + (a.exclu ? ' (non scoré)' : ''),
              font: FONT_BODY, size: 18, color: a.exclu ? C.MUTED : C.NAVY,
              italics: a.exclu,
            })],
            spacing: { before: 50, after: 50 },
          })],
        }),
        new TableCell({
          shading: { fill: bg, type: ShadingType.SOLID },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: penStr, font: FONT, bold: true, size: 18, color })],
            spacing: { before: 50, after: 50 },
          })],
        }),
        new TableCell({
          shading: { fill: bg, type: ShadingType.SOLID },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: maxStr, font: FONT_BODY, size: 16, color: C.MUTED })],
            spacing: { before: 50, after: 50 },
          })],
        }),
      ]
    })
  }

  rows.push(headerRow(mode === 'gerance' ? 'ANOMALIES GÉRANCE' : 'ANOMALIES COPROPRIÉTÉ'))
  rows.push(colHeaderRow())
  score.anomalies.forEach((a, i) => rows.push(anomRow(a, i)))

  // Total
  rows.push(new TableRow({
    children: [
      new TableCell({
        shading: { fill: C.NAVY, type: ShadingType.SOLID },
        children: [new Paragraph({
          children: [new TextRun({ text: 'SCORE GLOBAL', font: FONT, bold: true, color: C.GOLD_L, size: 20 })],
          spacing: { before: 80, after: 80 },
        })],
      }),
      new TableCell({
        columnSpan: 2,
        shading: { fill: C.NAVY, type: ShadingType.SOLID },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({
            text: `${score.scoreGlobal} / 100 — ${score.niveau.label}`,
            font: FONT, bold: true, color: C.GOLD_L, size: 22,
          })],
          spacing: { before: 80, after: 80 },
        })],
      }),
    ]
  }))

  return new Table({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    rows,
    borders: { top: thinBorder(), bottom: thinBorder(), left: thinBorder(), right: thinBorder(), insideHorizontal: thinBorder(), insideVertical: thinBorder() },
  })
}

// ─── Jauge score ──────────────────────────────────────────────────────────────

function buildScoreGauge(score: ScoreResult): Paragraph[] {
  const s = score.scoreGlobal
  const color = s >= 80 ? C.GREEN : s >= 60 ? C.ORANGE : C.RED
  const bgColor = s >= 80 ? C.GREEN_L : s >= 60 ? 'FDF0E6' : 'FAEAEA'
  const BAR_TOTAL = 30
  const filled = Math.round(s / 100 * BAR_TOTAL)
  const bar = '█'.repeat(filled) + '░'.repeat(BAR_TOTAL - filled)

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 60 },
      children: [new TextRun({ text: bar, font: 'Courier New', bold: true, size: 30, color })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      shading: { fill: bgColor, type: ShadingType.SOLID },
      children: [
        new TextRun({ text: `${s} / 100`, font: FONT, bold: true, size: 30, color }),
        new TextRun({ text: '  —  ', font: FONT, size: 26, color: C.MUTED }),
        new TextRun({ text: score.niveau.label.toUpperCase(), font: FONT, bold: true, size: 26, color }),
      ],
    }),
    emptyPara(),
  ]
}

// ─── Graphique répartition risques (Copro) ────────────────────────────────────

function buildRiskChart(bilan: ExcelRow[]): Paragraph[] {
  const total = bilan.length
  if (total === 0) return []
  const counts = [4, 3, 2, 1, 0].map(n => bilan.filter(r => numVal(r, 7) === n).length)
  const labels  = ['Risque ++++ (4 anomalies)', 'Risque +++ (3 anomalies)', 'Risque ++ (2 anomalies)', 'Risque + (1 anomalie)', 'Aucun risque']
  const colors  = [C.RED, C.ORANGE, C.ORANGE, C.MUTED, C.GREEN]
  const maxCount = Math.max(...counts, 1)
  const BAR_MAX = 24

  const paras: Paragraph[] = [
    bodyText('Répartition des copropriétés par niveau de risque :', { bold: true }),
    emptyPara(),
  ]
  counts.forEach((count, i) => {
    const barLen = Math.round(count / maxCount * BAR_MAX)
    const bar = '█'.repeat(barLen) + '░'.repeat(BAR_MAX - barLen)
    const label = labels[i].padEnd(28)
    paras.push(new Paragraph({
      spacing: { after: 50 },
      children: [
        new TextRun({ text: label, font: 'Courier New', size: 18, color: colors[i] }),
        new TextRun({ text: bar, font: 'Courier New', size: 18, color: colors[i] }),
        new TextRun({ text: `  ${count} / ${total}`, font: 'Courier New', bold: true, size: 18, color: colors[i] }),
      ],
    }))
  })
  paras.push(emptyPara())
  return paras
}

// ─── Card builder (reproduit visuellement les cartes de l'app) ───────────────

type Level = 'ok' | 'warn' | 'bad' | 'info'
interface KVRow  { label: string; value: string; level?: Level }
interface CSLine { label: string; detail: string; pts: number }

function levelCfg(l: Level): { fill: string; text: string; badge: string } {
  switch (l) {
    case 'ok':   return { fill: C.GREEN_L, text: C.GREEN,  badge: '✓  Conforme' }
    case 'warn': return { fill: 'FFF3E0',  text: C.ORANGE, badge: '⚠  Attention' }
    case 'bad':  return { fill: C.RED_L,   text: C.RED,    badge: '✗  Anomalie' }
    case 'info': return { fill: 'EAF0FA',  text: '1A3A8A', badge: 'ℹ  Info' }
  }
}

function buildCard(opts: {
  icon: string; title: string; subtitle: string; level: Level
  mainStat: string; mainStatLabel: string
  kvRows?: KVRow[]
  scoreLines?: CSLine[]; penalty?: number; penaltyMax?: number; nbExclu?: number
  infoOnly?: boolean
}): Table {
  const lc  = levelCfg(opts.level)
  const W1  = Math.round(PAGE_WIDTH_DXA * 0.68)
  const W2  = PAGE_WIDTH_DXA - W1
  const HDR = 'F7F5F1'
  const SBG = 'F0EEE9'
  const WH  = 'FFFFFF'

  function tc(w: number, bg: string, children: Paragraph[], align = AlignmentType.LEFT): TableCell {
    return new TableCell({ width: { size: w, type: WidthType.DXA }, shading: { fill: bg, type: ShadingType.SOLID }, verticalAlign: VerticalAlign.CENTER, children })
  }

  const trows: TableRow[] = []

  // ── Header : icône + titre + sous-titre | badge niveau
  trows.push(new TableRow({ children: [
    tc(W1, HDR, [
      new Paragraph({ spacing: { before: 120, after: 0 }, children: [
        new TextRun({ text: opts.icon + '  ', size: 20 }),
        new TextRun({ text: opts.title, font: FONT, bold: true, size: 22, color: C.NAVY }),
      ]}),
      new Paragraph({ spacing: { before: 0, after: 100 }, children: [
        new TextRun({ text: '      ' + opts.subtitle, font: FONT_BODY, size: 16, color: C.MUTED }),
      ]}),
    ]),
    tc(W2, lc.fill, [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 70, after: 70 }, children: [
        new TextRun({ text: lc.badge, font: FONT, bold: true, size: 17, color: lc.text }),
      ]}),
    ]),
  ]}))

  // ── Statistique principale (grand chiffre)
  const sc = opts.level === 'ok' ? C.GREEN : opts.level === 'warn' ? C.ORANGE : opts.level === 'bad' ? C.RED : C.NAVY
  trows.push(new TableRow({ children: [
    tc(W1, WH, [
      new Paragraph({ spacing: { before: 120, after: 80 }, children: [
        new TextRun({ text: opts.mainStat + '  ', font: FONT, bold: true, size: 52, color: sc }),
        new TextRun({ text: opts.mainStatLabel, font: FONT_BODY, size: 18, color: C.MUTED }),
      ]}),
    ]),
    tc(W2, WH, [new Paragraph({ children: [] })]),
  ]}))

  // ── Lignes clé / valeur
  for (const kv of (opts.kvRows ?? [])) {
    const vc = kv.level ? levelCfg(kv.level).text : C.NAVY
    trows.push(new TableRow({ children: [
      tc(W1, WH, [new Paragraph({ spacing: { before: 55, after: 55 }, children: [
        new TextRun({ text: kv.label, font: FONT_BODY, size: 18, color: C.MUTED }),
      ]})]),
      tc(W2, WH, [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 55, after: 55 }, children: [
        new TextRun({ text: kv.value, font: FONT, bold: true, size: 18, color: vc }),
      ]})]),
    ]}))
  }

  // ── Mention info uniquement
  if (opts.infoOnly) {
    trows.push(new TableRow({ children: [
      tc(W1, 'EAF0FA', [new Paragraph({ spacing: { before: 55, after: 55 }, children: [
        new TextRun({ text: 'ℹ  Information uniquement — hors scoring', font: FONT_BODY, italics: true, size: 16, color: '1A3A8A' }),
      ]})]),
      tc(W2, 'EAF0FA', [new Paragraph({ children: [] })]),
    ]}))
  }

  // ── Détail du score
  const hasScore = (opts.scoreLines && opts.scoreLines.length > 0) || opts.penalty !== undefined
  if (hasScore && !opts.infoOnly) {
    trows.push(new TableRow({ children: [
      tc(W1, SBG, [new Paragraph({ spacing: { before: 60, after: 20 }, children: [
        new TextRun({ text: 'DÉTAIL DU SCORE', font: FONT, bold: true, size: 14, color: C.MUTED }),
      ]})]),
      tc(W2, SBG, [new Paragraph({ children: [] })]),
    ]}))
    for (const sl of (opts.scoreLines ?? [])) {
      const pc = sl.pts > 0 ? C.RED : C.GREEN
      trows.push(new TableRow({ children: [
        tc(W1, SBG, [new Paragraph({ spacing: { before: 30, after: 30 }, children: [
          new TextRun({ text: sl.label, font: FONT_BODY, size: 16, color: C.MUTED }),
          new TextRun({ text: '  ·  ' + sl.detail, font: FONT_BODY, italics: true, size: 16, color: C.MUTED }),
        ]})]),
        tc(W2, SBG, [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 30, after: 30 }, children: [
          new TextRun({ text: sl.pts > 0 ? `−${sl.pts.toFixed(1)} pt` : '0 pt', font: FONT, bold: true, size: 16, color: pc }),
        ]})]),
      ]}))
    }
    if (opts.nbExclu && opts.nbExclu > 0) {
      trows.push(new TableRow({ children: [
        tc(W1, SBG, [new Paragraph({ spacing: { before: 20, after: 20 }, children: [
          new TextRun({ text: `${opts.nbExclu} ligne(s) justifiée(s) exclue(s) du score`, font: FONT_BODY, italics: true, size: 15, color: C.GREEN }),
        ]})]),
        tc(W2, SBG, [new Paragraph({ children: [] })]),
      ]}))
    }
    if (opts.penalty !== undefined && opts.penaltyMax !== undefined) {
      const pc = opts.penalty > 0 ? C.RED : C.GREEN
      trows.push(new TableRow({ children: [
        tc(W1, SBG, [new Paragraph({ spacing: { before: 50, after: 90 }, children: [
          new TextRun({ text: 'Pénalité', font: FONT, bold: true, size: 18, color: C.NAVY }),
        ]})]),
        tc(W2, SBG, [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 50, after: 90 }, children: [
          new TextRun({ text: opts.penalty > 0 ? `−${opts.penalty.toFixed(1)}` : '0', font: FONT, bold: true, size: 20, color: pc }),
          new TextRun({ text: ` / ${opts.penaltyMax} pts`, font: FONT_BODY, size: 15, color: C.MUTED }),
        ]})]),
      ]}))
    }
  }

  return new Table({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    rows: trows,
    borders: {
      top:              thinBorder(),
      bottom:           thinBorder(),
      left:             { style: BorderStyle.SINGLE, size: 20, color: C.GOLD },
      right:            thinBorder(),
      insideHorizontal: thinBorder(),
      insideVertical:   noBorder(),
    },
  })
}

// Helper : convertit un AnomalyResult en lignes de score pour la carte
function anomToCSLines(a: AnomalyResult | undefined): CSLine[] {
  if (!a || a.exclu) return []
  const lines: CSLine[] = []
  if (a.id === 'quitt' && a.ratio != null)
    lines.push({ label: 'Taux encaissement', detail: (a.ratio * 100).toFixed(1) + '%', pts: a.penalite })
  else if (a.id === 'bq_nonrapp') {
    if (a.scoreVolume > 0) lines.push({ label: 'Volume', detail: (a.nb ?? 0) + ' écriture(s)', pts: a.scoreVolume })
  } else if (a.id === 'cpta_nonrapp') {
    if (a.anciennete != null) lines.push({ label: 'Ancienneté max', detail: a.anciennete + ' j', pts: a.scoreAnciennete })
  } else {
    if (a.scoreMontant > 0 && a.ratio != null)
      lines.push({ label: 'Montant', detail: (a.ratio * 100).toFixed(2) + '% garantie', pts: a.scoreMontant })
    if (a.scoreVolume > 0 && a.ratioVolume != null)
      lines.push({ label: 'Volume', detail: (a.ratioVolume * 100).toFixed(1) + '% portefeuille', pts: a.scoreVolume })
  }
  return lines
}

// Helper : niveau de risque pour une anomalie
function anomLevel(a: AnomalyResult | undefined, nb: number): Level {
  if (nb === 0) return 'ok'
  if (!a || a.exclu) return 'info'
  if (a.penalite === 0) return 'warn'
  return a.penalite >= a.penaliteMax * 0.6 ? 'bad' : 'warn'
}

// ─── Helpers divers ───────────────────────────────────────────────────────────

function dateFmt(d?: string): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('fr-FR') } catch { return d }
}

// ─── Charge les assets images depuis /report-assets/ ─────────────────────────

async function loadImages(): Promise<{ header?: ArrayBuffer; footer?: ArrayBuffer; cover?: ArrayBuffer; sceau?: ArrayBuffer }> {
  const safe = async (url: string): Promise<ArrayBuffer | undefined> => {
    try { return await fetch(url).then(r => r.arrayBuffer()) } catch { return undefined }
  }
  const [header, footer, cover, sceau] = await Promise.all([
    safe('/report-assets/header_banner.png'),
    safe('/report-assets/logo_sceau_gold.png'),
    safe('/report-assets/bg_cover.png'),
    safe('/report-assets/logo_sceau_blanc.png'),
  ])
  return { header, footer, cover, sceau }
}

// ─── Page de garde ─────────────────────────────────────────────────────────────

function buildCoverPage(
  mode: 'gerance' | 'copro',
  agence: string,
  dateDebut: string | undefined,
  dateFin: string | undefined,
  score: ScoreResult,
  cover?: ArrayBuffer,
  sceau?: ArrayBuffer,
): Paragraph[] {
  const modeLabel = mode === 'gerance' ? 'GÉRANCE' : 'SYNDIC'
  const paras: Paragraph[] = []

  // Image de fond (flottante, derrière)
  if (cover) {
    paras.push(new Paragraph({
      children: [new ImageRun({
        data: cover,
        transformation: { width: 826, height: 1169 },
        floating: {
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
          behindDocument: true,
          allowOverlap: true,
          wrap: { type: TextWrappingType.NONE },
        },
      } as ConstructorParameters<typeof ImageRun>[0])],
    }))
  }

  // Sceau blanc (flottant, devant, en haut à droite)
  if (sceau) {
    paras.push(new Paragraph({
      children: [new ImageRun({
        data: sceau,
        transformation: { width: 100, height: 108 },
        floating: {
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.RIGHT_MARGIN, offset: 0 },
          verticalPosition: { relative: VerticalPositionRelativeFrom.TOP_MARGIN, offset: 0 },
          behindDocument: false,
          allowOverlap: true,
          wrap: { type: TextWrappingType.NONE },
        },
      } as ConstructorParameters<typeof ImageRun>[0])],
    }))
  }

  // Espacements haut de page (simuler le positionnement vertical centré)
  for (let i = 0; i < 8; i++) paras.push(emptyPara())

  // Titre
  paras.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "RAPPORT D'AUDIT COMPTABLE INTERNE", font: FONT, bold: true, color: C.WHITE, size: 48 })],
    spacing: { after: 200 },
  }))
  paras.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: modeLabel, font: FONT, bold: true, color: C.WHITE, size: 48 })],
    spacing: { after: 400 },
  }))

  // Nom agence
  paras.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: agence || '—', font: FONT, bold: true, color: C.GOLD_L, size: 54 })],
    spacing: { after: 400 },
  }))

  // Période
  paras.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: `Période auditée : ${dateFmt(dateDebut)} – ${dateFmt(dateFin)}`,
      font: FONT, bold: true, color: C.WHITE, size: 32,
    })],
    spacing: { after: 400 },
  }))

  // Score sur la page de garde
  paras.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: `Score : ${score.scoreGlobal} / 100 — ${score.niveau.label}`,
      font: FONT, bold: true, color: C.GOLD_L, size: 36,
    })],
    spacing: { after: 200 },
  }))

  paras.push(pageBreak())
  return paras
}

// ─── Colonnes standard ───────────────────────────────────────────────────────

const COLS = {
  libelleNom: (label = 'Bailleur'): ColDef => ({ header: label, width: 4, getValue: (r) => val(r, 1) || val(r, 0) }),
  montant:     (iM: number, label = 'Montant'): ColDef => ({ header: label, width: 2, getValue: (r) => eur(Math.abs(numVal(r, iM))) }),
  date:        (iD: number, label = 'Date'): ColDef => ({ header: label, width: 2, getValue: (r) => excelDateFmt(r[iD]) }),
  libelle:     (iL1: number, iL2: number, label = 'Libellé'): ColDef => ({ header: label, width: 4, getValue: (r) => val(r, iL1) || val(r, iL2) }),
  custom:      (label: string, w: number, fn: (r: ExcelRow) => string): ColDef => ({ header: label, width: w, getValue: fn }),
}

// ─── Helper : ajoute une carte + liste d'anomalies ────────────────────────────

function cardSection(
  card: Table,
  rows: ExcelRow[],
  cId: string,
  annots: AnnotationsMap,
  cols: ColDef[],
  sectionNotes?: Record<string, string>,
  noteSid?: string,
): (Paragraph | Table)[] {
  const parts: (Paragraph | Table)[] = [card, emptyPara()]
  // Note auditeur placée AVANT la liste des anomalies
  if (sectionNotes && noteSid) parts.push(...sectionNotePara(sectionNotes, noteSid))
  if (rows.length > 0) {
    parts.push(listAnomaliesTitle())
    parts.push(buildAnomalyTable(rows, cId, annots, cols))
  }
  parts.push(emptyPara(), emptyPara())
  return parts
}

// ─── Helper : note de section auditeur ───────────────────────────────────────

function sectionNotePara(notes: Record<string, string> | undefined, sid: string): Paragraph[] {
  const text = notes?.[sid]?.trim()
  if (!text) return []
  return [
    new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [
        new TextRun({ text: '📝 Note de l\'auditeur : ', font: FONT, bold: true, size: 18, color: C.NAVY }),
        new TextRun({ text, font: FONT_BODY, size: 18, italics: true }),
      ],
      shading: { fill: 'F7F5F1', type: ShadingType.SOLID },
    }),
    emptyPara(),
  ]
}

// ─── GÉRANCE — sections détaillées ───────────────────────────────────────────

function geranceSections(
  data: GeranceData,
  annots: AnnotationsMap,
  score: ScoreResult,
  garantie: number,
  pointe: number,
  dateFin?: string,
  sectionNotes?: Record<string, string>,
): (Paragraph | Table)[] {
  const parts: (Paragraph | Table)[] = []
  const ga = (id: string) => score.anomalies.find(a => a.id === id)

  parts.push(h1('ANALYSE DÉTAILLÉE PAR CATÉGORIE'))

  // ── Garantie / Pointe
  {
    const ok = garantie > pointe && garantie > 0 && pointe > 0
    const noData = garantie === 0 || pointe === 0
    const lvl: Level = noData ? 'warn' : ok ? 'ok' : 'bad'
    const ecart = garantie - pointe
    parts.push(buildCard({
      icon: '🛡️', title: 'Garantie financière', subtitle: 'Contrôle pointe de trésorerie',
      level: lvl, mainStat: noData ? '—' : ok ? 'Couverte' : 'Dépassée',
      mainStatLabel: noData ? 'données incomplètes' : 'garantie vs pointe',
      kvRows: [
        { label: 'Garantie financière', value: eur(garantie) },
        { label: 'Pointe de trésorerie', value: eur(pointe), level: lvl },
        ...(noData ? [] : [{ label: 'Écart', value: (ecart >= 0 ? '+' : '') + eur(ecart), level: lvl } as KVRow]),
      ],
    }))
    parts.push(...sectionNotePara(sectionNotes, 'garantie'))
    parts.push(emptyPara(), emptyPara())
  }

  // ── Quittancement / Encaissement
  {
    const q = data.quittancement, e = data.encaissement
    const taux = q > 0 ? e / q : 0
    const lvlQ: Level = q === 0 ? 'info' : taux >= 1.0 ? 'ok' : taux >= 0.95 ? 'warn' : 'bad'
    const anomQ = ga('quitt')
    parts.push(buildCard({
      icon: '💰', title: 'Quittancement / Encaissement', subtitle: 'Taux de recouvrement des loyers',
      level: lvlQ, mainStat: q > 0 ? pct(taux * 100) : '—', mainStatLabel: 'taux de recouvrement',
      kvRows: [
        { label: 'Quittancé', value: eur(q) },
        { label: 'Encaissé', value: eur(e), level: lvlQ },
        { label: 'Écart non encaissé', value: eur(Math.abs(q - e)), level: q > e ? 'warn' : 'ok' },
      ],
      scoreLines: anomToCSLines(anomQ),
      penalty: anomQ?.penalite, penaltyMax: anomQ?.penaliteMax,
    }))
    parts.push(...sectionNotePara(sectionNotes, 'quitt'))
    parts.push(emptyPara(), emptyPara())
  }

  // ── Comptes d'attente débiteurs
  {
    const rows = data.att_deb
    const total = rows.reduce((s, r) => s + Math.abs(numVal(r, 8)), 0)
    const anomA = ga('attdeb')
    const lvl = anomLevel(anomA, rows.length)
    parts.push(...cardSection(
      buildCard({
        icon: '⏳', title: 'Comptes d\'attente débiteurs', subtitle: `${rows.length} compte(s) · ${eur(total)}`,
        level: lvl, mainStat: String(rows.length), mainStatLabel: 'compte(s) en anomalie',
        kvRows: [
          { label: 'Montant total', value: eur(total), level: rows.length > 0 ? lvl : 'ok' },
          { label: 'Ratio / Garantie', value: garantie > 0 ? pct(total / garantie * 100) : '—' },
        ],
        scoreLines: anomToCSLines(anomA), penalty: anomA?.penalite, penaltyMax: anomA?.penaliteMax, nbExclu: anomA?.nbExclu,
      }),
      rows, 'attdeb', annots,
      [COLS.custom('Libellé', 4, r => (val(r, 1) || val(r, 3) || '—') + (val(r, 6) ? ' · ' + val(r, 6) : '')), COLS.montant(8)],
      sectionNotes, 'attdeb',
    ))
  }

  // ── Propriétaires débiteurs actifs
  {
    const rows = data.prop_deb
    const total = rows.reduce((s, r) => s + Math.abs(numVal(r, 6)), 0)
    const anomP = ga('propdeb')
    const lvl = anomLevel(anomP, rows.length)
    parts.push(...cardSection(
      buildCard({
        icon: '🔴', title: 'Propriétaires débiteurs actifs', subtitle: `${rows.length} propriétaire(s) · ${eur(total)}`,
        level: lvl, mainStat: String(rows.length), mainStatLabel: 'propriétaire(s) débiteur(s)',
        kvRows: [
          { label: 'Montant total', value: eur(total), level: rows.length > 0 ? lvl : 'ok' },
          { label: 'Ratio / Garantie', value: garantie > 0 ? pct(total / garantie * 100) : '—' },
        ],
        scoreLines: anomToCSLines(anomP), penalty: anomP?.penalite, penaltyMax: anomP?.penaliteMax, nbExclu: anomP?.nbExclu,
      }),
      rows, 'propdeb', annots,
      [COLS.libelleNom('Bailleur'), COLS.montant(6)],
      sectionNotes, 'propdeb',
    ))
  }

  // ── Propriétaires débiteurs sortis
  {
    const rows = data.prop_deb_sorti ?? []
    const total = rows.reduce((s, r) => s + Math.abs(numVal(r, 10)), 0)
    const anomPS = ga('propdbsorti')
    const lvl = anomLevel(anomPS, rows.length)
    parts.push(...cardSection(
      buildCard({
        icon: '🔴', title: 'Propriétaires débiteurs sortis', subtitle: `${rows.length} propriétaire(s) sorti(s) · ${eur(total)}`,
        level: lvl, mainStat: String(rows.length), mainStatLabel: 'propriétaire(s) sorti(s) débiteur(s)',
        kvRows: [
          { label: 'Montant total', value: eur(total), level: rows.length > 0 ? lvl : 'ok' },
          { label: 'Ratio / Garantie', value: garantie > 0 ? pct(total / garantie * 100) : '—' },
        ],
        scoreLines: anomToCSLines(anomPS), penalty: anomPS?.penalite, penaltyMax: anomPS?.penaliteMax, nbExclu: anomPS?.nbExclu,
      }),
      rows, 'propdbsorti', annots,
      [COLS.libelleNom('Bailleur'), COLS.montant(10)],
      sectionNotes, 'propdbsorti',
    ))
  }

  // ── Propriétaires sortis créditeurs (info)
  {
    const rows = data.prop_cred
    const total = rows.reduce((s, r) => s + Math.abs(numVal(r, 6)), 0)
    parts.push(...cardSection(
      buildCard({
        icon: '🟡', title: 'Propriétaires sortis créditeurs', subtitle: 'Hors scoring — information uniquement',
        level: rows.length === 0 ? 'ok' : 'info', mainStat: String(rows.length), mainStatLabel: 'propriétaire(s) à rembourser',
        kvRows: [{ label: 'Montant total', value: eur(total) }], infoOnly: true,
      }),
      rows, 'propcred', annots,
      [COLS.libelleNom('Bailleur'), COLS.montant(6)],
    ))
  }

  // ── Rapprochements
  parts.push(h1('RAPPROCHEMENTS'))
  parts.push(emptyPara())

  // BQ non rapp.
  {
    const rows = data.bq_nonrapp
    const anomBQ = ga('bq_nonrapp')
    const lvl: Level = rows.length === 0 ? 'ok' : rows.length === 1 ? 'warn' : 'bad'
    parts.push(...cardSection(
      buildCard({
        icon: '🏦', title: 'Rapprochement Banque 512', subtitle: 'Écritures non rapprochées · pénalité volume',
        level: lvl, mainStat: String(rows.length), mainStatLabel: 'écriture(s) non rapprochée(s)',
        kvRows: [
          { label: 'Règle : 1 écriture', value: '−10 pts' },
          { label: 'Règle : >1 écriture', value: '−15 pts' },
        ],
        scoreLines: anomToCSLines(anomBQ), penalty: anomBQ?.penalite, penaltyMax: anomBQ?.penaliteMax,
      }),
      rows, 'bqrapp', annots,
      [COLS.date(14, 'Date'), COLS.libelle(7, 0, 'Libellé'), COLS.montant(15)],
      sectionNotes, 'bqrapp',
    ))
  }

  // CPTA non rapp.
  {
    const rows = data.cpta_nonrapp
    const anomCPTA = ga('cpta_nonrapp')
    const pen = anomCPTA?.penalite ?? 0
    const lvl: Level = rows.length === 0 ? 'ok' : pen === 0 ? 'ok' : pen <= 5 ? 'warn' : 'bad'
    parts.push(...cardSection(
      buildCard({
        icon: '📒', title: 'Rapprochement Compta', subtitle: 'Écritures non rapprochées · pénalité ancienneté',
        level: lvl, mainStat: String(rows.length), mainStatLabel: 'écriture(s) non rapprochée(s)',
        kvRows: [
          { label: 'Ancienneté maximale', value: anomCPTA?.anciennete != null ? anomCPTA.anciennete + ' jours' : '—', level: pen > 0 ? lvl : undefined },
          { label: 'Règle : >90 j', value: '−15 pts' },
        ],
        scoreLines: anomToCSLines(anomCPTA), penalty: anomCPTA?.penalite, penaltyMax: anomCPTA?.penaliteMax,
      }),
      rows, 'cptarapp', annots,
      [COLS.date(12, 'Date'), COLS.libelle(14, 6, 'Libellé'), COLS.montant(13)],
      sectionNotes, 'cptarapp',
    ))
  }

  return parts
}

// ─── COPRO — sections détaillées ─────────────────────────────────────────────

function coproSections(
  data: CoproData,
  annots: AnnotationsMap,
  score: ScoreResult,
  garantie: number,
  dateFin?: string,
  sectionNotes?: Record<string, string>,
): (Paragraph | Table)[] {
  const parts: (Paragraph | Table)[] = []
  const nbCopro = data.bilan.length
  const ga = (id: string) => score.anomalies.find(a => a.id === id)

  parts.push(h1('ANALYSE DÉTAILLÉE PAR CATÉGORIE'))

  // ── Balance
  {
    const rows = data.balance_bad
    const total = rows.reduce((s, r) => s + Math.abs(numVal(r, 7)), 0)
    const anomB = ga('balance')
    const lvl: Level = rows.length === 0 ? 'ok' : 'bad'
    parts.push(...cardSection(
      buildCard({
        icon: '⚖️', title: 'Balance déséquilibrée', subtitle: `${rows.length} balance(s) en anomalie · ${eur(total)}`,
        level: lvl, mainStat: String(rows.length), mainStatLabel: 'balance(s) déséquilibrée(s)',
        kvRows: [{ label: 'Écart cumulé', value: eur(total), level: rows.length > 0 ? 'bad' : 'ok' }],
        scoreLines: anomToCSLines(anomB), penalty: anomB?.penalite, penaltyMax: anomB?.penaliteMax,
      }),
      rows, 'balance', annots,
      [COLS.custom('Libellé', 4, r => val(r, 3) || val(r, 1) || '—'), COLS.montant(7, 'Écart')],
      sectionNotes, 'balance',
    ))
  }

  // ── Fournisseurs débiteurs
  {
    const rows = data.fourn_deb
    const total = rows.reduce((s, r) => s + numVal(r, 10), 0)
    const anomF = ga('fourndeb')
    const lvl = anomLevel(anomF, rows.length)
    parts.push(...cardSection(
      buildCard({
        icon: '🔴', title: 'Fournisseurs débiteurs', subtitle: `${rows.length} fournisseur(s) · ${eur(total)}`,
        level: lvl, mainStat: String(rows.length), mainStatLabel: 'fournisseur(s) à solde débiteur',
        kvRows: [
          { label: 'Montant total', value: eur(total), level: rows.length > 0 ? lvl : 'ok' },
          { label: 'Part du portefeuille', value: nbCopro > 0 ? pct(rows.length / nbCopro * 100) : '—' },
          { label: 'Ratio / Garantie', value: garantie > 0 ? pct(total / garantie * 100) : '—' },
        ],
        scoreLines: anomToCSLines(anomF), penalty: anomF?.penalite, penaltyMax: anomF?.penaliteMax, nbExclu: anomF?.nbExclu,
      }),
      rows, 'fourndeb', annots,
      [COLS.custom('Libellé', 4, r => (val(r, 8) || '—') + (val(r, 1) ? ' · ' + val(r, 1) : '')), COLS.montant(10), COLS.custom('Détail', 2, r => val(r, 11))],
      sectionNotes, 'fourndeb',
    ))
  }

  // ── Comptes attente débiteurs
  {
    const rows = data.att_deb
    const total = rows.reduce((s, r) => s + Math.abs(numVal(r, 9)), 0)
    const anomA = ga('cattdeb')
    const lvl = anomLevel(anomA, rows.length)
    parts.push(...cardSection(
      buildCard({
        icon: '⏳', title: 'Comptes d\'attente débiteurs', subtitle: `${rows.length} compte(s) · ${eur(total)}`,
        level: lvl, mainStat: String(rows.length), mainStatLabel: 'compte(s) en anomalie',
        kvRows: [
          { label: 'Montant total', value: eur(total), level: rows.length > 0 ? lvl : 'ok' },
          { label: 'Ratio / Garantie', value: garantie > 0 ? pct(total / garantie * 100) : '—' },
        ],
        scoreLines: anomToCSLines(anomA), penalty: anomA?.penalite, penaltyMax: anomA?.penaliteMax, nbExclu: anomA?.nbExclu,
      }),
      rows, 'cattdeb', annots,
      [COLS.custom('Libellé', 4, r => (val(r, 1) || '—') + (val(r, 6) ? ' · ' + val(r, 6) : '')), COLS.montant(9), COLS.custom('Détail', 2, r => val(r, 10))],
      sectionNotes, 'cattdeb',
    ))
  }

  // ── Comptes attente créditeurs (info)
  {
    const rows = data.att_cred
    const total = rows.reduce((s, r) => s + Math.abs(numVal(r, 9)), 0)
    parts.push(...cardSection(
      buildCard({
        icon: '🟡', title: 'Comptes d\'attente créditeurs', subtitle: 'Hors scoring — information uniquement',
        level: rows.length === 0 ? 'ok' : 'info', mainStat: String(rows.length), mainStatLabel: 'compte(s) créditeur(s)',
        kvRows: [{ label: 'Montant total', value: eur(total) }], infoOnly: true,
      }),
      rows, 'cattcred', annots,
      [COLS.custom('Libellé', 4, r => (val(r, 1) || '—') + (val(r, 6) ? ' · ' + val(r, 6) : '')), COLS.montant(9)],
    ))
  }

  // ── Copropriétaires sortis débiteurs
  {
    const rows = data.ventes_deb
    const total = rows.reduce((s, r) => s + numVal(r, 10), 0)
    const anomV = ga('ventesdeb')
    const lvl = anomLevel(anomV, rows.length)
    parts.push(...cardSection(
      buildCard({
        icon: '🔄', title: 'Copropriétaires sortis débiteurs', subtitle: `${rows.length} copropriétaire(s) sorti(s) · ${eur(total)}`,
        level: lvl, mainStat: String(rows.length), mainStatLabel: 'copropriétaire(s) sorti(s) à solde débiteur',
        kvRows: [
          { label: 'Montant total', value: eur(total), level: rows.length > 0 ? lvl : 'ok' },
          { label: 'Ratio / Garantie', value: garantie > 0 ? pct(total / garantie * 100) : '—' },
        ],
        scoreLines: anomToCSLines(anomV), penalty: anomV?.penalite, penaltyMax: anomV?.penaliteMax, nbExclu: anomV?.nbExclu,
      }),
      rows, 'ventesdeb', annots,
      [COLS.custom('Libellé', 4, r => (val(r, 7) || '—') + (val(r, 1) ? ' · ' + val(r, 1) : '')), COLS.montant(10), COLS.custom('Ancienneté', 2, r => val(r, 9) ? val(r, 9) + ' j' : '—')],
      sectionNotes, 'ventesdeb',
    ))
  }

  // ── Copropriétaires sortis créditeurs (info)
  {
    const rows = data.ventes_cred
    const total = rows.reduce((s, r) => s + Math.abs(numVal(r, 10)), 0)
    parts.push(...cardSection(
      buildCard({
        icon: '🟡', title: 'Copropriétaires sortis créditeurs', subtitle: 'Hors scoring — information uniquement',
        level: rows.length === 0 ? 'ok' : 'info', mainStat: String(rows.length), mainStatLabel: 'copropriétaire(s) sorti(s) à rembourser',
        kvRows: [{ label: 'Montant total', value: eur(total) }], infoOnly: true,
      }),
      rows, 'ventescred', annots,
      [COLS.custom('Libellé', 4, r => (val(r, 7) || '—') + (val(r, 1) ? ' · ' + val(r, 1) : '')), COLS.montant(10)],
    ))
  }

  // ── Rapprochements
  parts.push(h1('RAPPROCHEMENTS'))

  {
    const rows = data.bq_nonrapp
    const anomBQ = ga('bq_nonrapp')
    const lvl: Level = rows.length === 0 ? 'ok' : rows.length === 1 ? 'warn' : 'bad'
    parts.push(...cardSection(
      buildCard({
        icon: '🏦', title: 'Rapprochement Banque 512', subtitle: 'Écritures non rapprochées · pénalité volume',
        level: lvl, mainStat: String(rows.length), mainStatLabel: 'écriture(s) non rapprochée(s)',
        kvRows: [{ label: 'Règle : 1 écriture', value: '−10 pts' }, { label: 'Règle : >1 écriture', value: '−15 pts' }],
        scoreLines: anomToCSLines(anomBQ), penalty: anomBQ?.penalite, penaltyMax: anomBQ?.penaliteMax,
      }),
      rows, 'bqrapp', annots,
      [COLS.date(15, 'Date'), COLS.libelle(19, 0, 'Libellé'), COLS.montant(18)],
      sectionNotes, 'bqrapp',
    ))
  }

  {
    const rows = data.cpta_nonrapp
    const anomCPTA = ga('cpta_nonrapp')
    const pen = anomCPTA?.penalite ?? 0
    const lvl: Level = rows.length === 0 ? 'ok' : pen === 0 ? 'ok' : pen <= 5 ? 'warn' : 'bad'
    parts.push(...cardSection(
      buildCard({
        icon: '📒', title: 'Rapprochement Compta', subtitle: 'Écritures non rapprochées · pénalité ancienneté',
        level: lvl, mainStat: String(rows.length), mainStatLabel: 'écriture(s) non rapprochée(s)',
        kvRows: [
          { label: 'Ancienneté maximale', value: anomCPTA?.anciennete != null ? anomCPTA.anciennete + ' jours' : '—', level: pen > 0 ? lvl : undefined },
          { label: 'Règle : >90 j', value: '−15 pts' },
        ],
        scoreLines: anomToCSLines(anomCPTA), penalty: anomCPTA?.penalite, penaltyMax: anomCPTA?.penaliteMax,
      }),
      rows, 'cptarapp', annots,
      [COLS.date(10, 'Date'), COLS.libelle(14, 0, 'Libellé'), COLS.montant(13)],
      sectionNotes, 'cptarapp',
    ))
  }

  // ── État financier
  if (data.bilan.length > 0) {
    parts.push(h1('ÉTAT FINANCIER DES COPROPRIÉTÉS'))
    const risk4 = data.bilan.filter(r => numVal(r, 7) >= 4)
    const risk3 = data.bilan.filter(r => numVal(r, 7) === 3)
    const risk2 = data.bilan.filter(r => numVal(r, 7) === 2)
    const risk1 = data.bilan.filter(r => numVal(r, 7) === 1)
    const nbRisque = risk4.length + risk3.length + risk2.length
    const lvlEF: Level = risk4.length > 0 ? 'bad' : nbRisque > 0 ? 'warn' : 'ok'

    parts.push(buildCard({
      icon: '📊', title: 'État financier des copropriétés', subtitle: `${data.bilan.length} copropriété(s) · ${nbRisque} à risque (≥2 anomalies)`,
      level: lvlEF, mainStat: String(nbRisque), mainStatLabel: 'copropriété(s) avec ≥2 anomalies',
      kvRows: [
        { label: 'Risque ++++ (4 anomalies)', value: String(risk4.length), level: risk4.length > 0 ? 'bad' : 'ok' },
        { label: 'Risque +++ (3 anomalies)',  value: String(risk3.length), level: risk3.length > 0 ? 'warn' : 'ok' },
        { label: 'Risque ++ (2 anomalies)',   value: String(risk2.length), level: risk2.length > 0 ? 'warn' : 'ok' },
        { label: 'Risque + (1 anomalie)',     value: String(risk1.length) },
        { label: 'Saines (0 anomalie)',       value: String(data.bilan.filter(r => !r[7] || numVal(r, 7) === 0).length), level: 'ok' },
      ],
    }))
    parts.push(emptyPara())
    parts.push(...sectionNotePara(sectionNotes, 'bilan'))

    parts.push(...buildRiskChart(data.bilan))

    const bilanCols: ColDef[] = [
      COLS.custom('Résidence', 3, r => String(r[1] || '—').replace(/^\d+-/, '')),
      COLS.custom('Lots', 1, r => val(r, 4)),
      COLS.custom('Impayés %', 1.5, r => { const v = numVal(r, 11); return v > 0 ? pct(v * 100) : '—' }),
      COLS.custom('Charges %', 1.5, r => { const v = numVal(r, 16); return v > 0 ? pct(v * 100) : '—' }),
      COLS.custom('Travaux %', 1.5, r => { const v = numVal(r, 18); return v !== 0 ? pct(v * 100) : '—' }),
      COLS.custom('Trésor. %', 1.5, r => { const v = numVal(r, 25); return v !== 0 ? pct(v * 100) : '—' }),
    ]
    if (risk4.length > 0) { parts.push(bodyText(`Risque ++++ — ${risk4.length} copropriété(s) :`, { bold: true, color: C.RED })); parts.push(buildAnomalyTable(risk4, 'bilan_r4', annots, bilanCols)); parts.push(emptyPara()) }
    if (risk3.length > 0) { parts.push(bodyText(`Risque +++ — ${risk3.length} copropriété(s) :`, { bold: true, color: C.ORANGE })); parts.push(buildAnomalyTable(risk3, 'bilan_r3', annots, bilanCols)); parts.push(emptyPara()) }
    if (risk2.length > 0) { parts.push(bodyText(`Risque ++ — ${risk2.length} copropriété(s) :`, { bold: true, color: C.ORANGE })); parts.push(buildAnomalyTable(risk2, 'bilan_r2', annots, bilanCols)); parts.push(emptyPara()) }
    if (risk1.length > 0) { parts.push(bodyText(`Risque + — ${risk1.length} copropriété(s) :`, { bold: true })); parts.push(buildAnomalyTable(risk1, 'bilan_r1', annots, bilanCols)); parts.push(emptyPara()) }
  }

  return parts
}

// ─── Section délais de règlement (factures) ──────────────────────────────────

function facturesSection(
  nr60: ExcelRow[],
  allFactures: ExcelRow[],
  nr30: ExcelRow[],
  iMontant: number,
  annots: AnnotationsMap,
  dateFin?: string,
  sectionNotes?: Record<string, string>,
): (Paragraph | Table)[] {
  const parts: (Paragraph | Table)[] = []
  const total60 = nr60.reduce((s, r) => s + numVal(r, iMontant), 0)
  const pctV30  = allFactures.length > 0 ? nr30.length / allFactures.length * 100 : 0
  const pctV60  = allFactures.length > 0 ? nr60.length / allFactures.length * 100 : 0
  const lvl: Level = nr60.length === 0 ? (nr30.length === 0 ? 'ok' : 'warn') : 'bad'

  parts.push(h1('ANALYSE DES DÉLAIS DE RÈGLEMENT'))
  parts.push(buildCard({
    icon: '🧾', title: 'Délais de règlement', subtitle: `${allFactures.length} factures saisies`,
    level: lvl, mainStat: String(nr60.length), mainStatLabel: 'factures non réglées à +60 jours',
    kvRows: [
      { label: 'Non réglées à +30 j', value: `${nr30.length}  (${pct(pctV30)})`, level: nr30.length > 0 ? 'warn' : 'ok' },
      { label: 'Non réglées à +60 j', value: `${nr60.length}  (${pct(pctV60)})`, level: nr60.length > 0 ? 'bad'  : 'ok' },
      { label: 'Montant total NR+60j', value: eur(total60), level: nr60.length > 0 ? 'bad' : 'ok' },
    ],
  }))
  parts.push(emptyPara())
  parts.push(...sectionNotePara(sectionNotes, 'fact60'))

  if (nr60.length > 0) {
    parts.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `LISTE DES FACTURES NON RÉGLÉES À +60 JOURS (${nr60.length})`, font: FONT, bold: true, smallCaps: true, color: C.C21RED, underline: {}, characterSpacing: 50, size: 22 })],
      spacing: { before: 200, after: 200 },
    }))
    parts.push(buildAnomalyTable(nr60, 'fact60', annots, [
      COLS.custom('Libellé', 4, r => val(r, 8) || val(r, 4) || val(r, 7) || '—'),
      COLS.custom('Ancienneté', 1.5, r => val(r, iMontant === 10 ? 7 : 6) ? `${val(r, iMontant === 10 ? 7 : 6)} j` : '—'),
      COLS.montant(iMontant),
    ]))
  } else {
    parts.push(bodyText('✓ Aucune facture non réglée à +60 jours.', { color: C.GREEN }))
  }

  parts.push(emptyPara())
  return parts
}

// ─── Fonctions publiques ──────────────────────────────────────────────────────

export interface RapportParams {
  agence:    string
  garantie:   number
  pointe:     number
  pointeDate?: string
  nbMandats?: number
  dateDebut?: string
  dateFin?:   string
  annots:    AnnotationsMap
  score:     ScoreResult
  sectionNotes?: Record<string, string>
}

export async function generateRapportGerance(
  data: GeranceData,
  params: RapportParams,
): Promise<Blob> {
  const { agence, garantie, pointe, pointeDate, dateFin, dateDebut, annots, score, sectionNotes } = params
  const imgs = await loadImages()

  // ── Header
  const headerChildren: (Paragraph | Table)[] = []
  if (imgs.header) {
    headerChildren.push(new Paragraph({
      children: [new ImageRun({ data: imgs.header, transformation: { width: 600, height: 60 } })],
    }))
  } else {
    headerChildren.push(new Paragraph({
      children: [new TextRun({ text: 'CENTURY 21 — Audit Comptable', font: FONT, bold: true, color: C.NAVY, size: 18 })],
      alignment: AlignmentType.RIGHT,
    }))
  }

  // ── Footer
  const footerChildren: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        ...(imgs.footer ? [new ImageRun({ data: imgs.footer, transformation: { width: 32, height: 29 } })] : []),
        new TextRun({ text: `  ${agence || ''}`, font: FONT_BODY, size: 16, color: C.MUTED }),
      ],
    })
  ]

  // ── Score section
  const scoreSectionContent: (Paragraph | Table)[] = [
    h1('SYNTHÈSE DE L\'AUDIT'),
    emptyPara(),
    bodyText(`Agence : ${agence || '—'}`, { bold: true }),
    bodyText(`Période auditée : ${dateFmt(dateDebut)} – ${dateFmt(dateFin)}`),
    bodyText(`Garantie financière : ${eur(garantie)}  ·  Pointe : ${eur(pointe)}  ·  Date de la pointe : ${dateFmt(pointeDate || dateFin)}`),
    params.nbMandats ? bodyText(`Nombre de mandats : ${params.nbMandats}`) : emptyPara(),
    emptyPara(),
    buildScoreTable(score, 'gerance'),
    ...buildScoreGauge(score),
    pageBreak(),
  ]

  // ── Anomalies
  const anomaliesContent = geranceSections(data, annots, score, garantie, pointe, dateFin, sectionNotes)

  // ── Factures
  const factContent = facturesSection(
    data.factures_nr60, data.factures, data.factures_nr30, 10, annots, dateFin, sectionNotes,
  )

  const allContent: (Paragraph | Table)[] = [
    ...buildCoverPage('gerance', agence, dateDebut, dateFin, score, imgs.cover, imgs.sceau),
    ...scoreSectionContent,
    ...anomaliesContent,
    emptyPara(),
    ...factContent,
  ]

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
          margin: {
            top:    convertMillimetersToTwip(25),
            bottom: convertMillimetersToTwip(25),
            left:   convertMillimetersToTwip(25),
            right:  convertMillimetersToTwip(25),
          },
        },
      },
      headers: { default: new Header({ children: headerChildren }) },
      footers: { default: new Footer({ children: footerChildren }) },
      children: allContent,
    }],
  })

  return Packer.toBlob(doc)
}

export async function generateRapportCopro(
  data: CoproData,
  params: RapportParams,
): Promise<Blob> {
  const { agence, garantie, pointe, pointeDate, dateFin, dateDebut, annots, score, sectionNotes } = params
  const imgs = await loadImages()

  const headerChildren: (Paragraph | Table)[] = imgs.header
    ? [new Paragraph({ children: [new ImageRun({ data: imgs.header, transformation: { width: 600, height: 60 } })] })]
    : [new Paragraph({ children: [new TextRun({ text: 'CENTURY 21 — Audit Comptable', font: FONT, bold: true, color: C.NAVY, size: 18 })], alignment: AlignmentType.RIGHT })]

  const footerChildren: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        ...(imgs.footer ? [new ImageRun({ data: imgs.footer, transformation: { width: 32, height: 29 } })] : []),
        new TextRun({ text: `  ${agence || ''}`, font: FONT_BODY, size: 16, color: C.MUTED }),
      ],
    })
  ]

  const nbCopro = data.bilan.length
  const scoreSectionContent: (Paragraph | Table)[] = [
    h1('SYNTHÈSE DE L\'AUDIT'),
    emptyPara(),
    bodyText(`Agence : ${agence || '—'}`, { bold: true }),
    bodyText(`Période auditée : ${dateFmt(dateDebut)} – ${dateFmt(dateFin)}`),
    bodyText(`Garantie financière : ${eur(garantie)}  ·  Pointe : ${eur(pointe)}  ·  Date de la pointe : ${dateFmt(pointeDate || dateFin)}`),
    nbCopro > 0 ? bodyText(`Nombre de copropriétés en gestion : ${nbCopro}`) : emptyPara(),
    emptyPara(),
    buildScoreTable(score, 'copro'),
    ...buildScoreGauge(score),
    pageBreak(),
  ]

  const anomaliesContent = coproSections(data, annots, score, garantie, dateFin, sectionNotes)
  const factContent = facturesSection(
    data.factures_nr60, data.factures, data.factures_nr30, 11, annots, dateFin, sectionNotes,
  )

  const allContent: (Paragraph | Table)[] = [
    ...buildCoverPage('copro', agence, dateDebut, dateFin, score, imgs.cover, imgs.sceau),
    ...scoreSectionContent,
    ...anomaliesContent,
    emptyPara(),
    ...factContent,
  ]

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
          margin: {
            top:    convertMillimetersToTwip(25),
            bottom: convertMillimetersToTwip(25),
            left:   convertMillimetersToTwip(25),
            right:  convertMillimetersToTwip(25),
          },
        },
      },
      headers: { default: new Header({ children: headerChildren }) },
      footers: { default: new Footer({ children: footerChildren }) },
      children: allContent,
    }],
  })

  return Packer.toBlob(doc)
}
