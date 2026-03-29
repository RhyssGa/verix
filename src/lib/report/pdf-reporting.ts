/**
 * PDF Reporting groupe — style cohérent avec pdf-v2.ts
 */

import type { AgencyRow, TrendRow, AnomalyAggregate } from '@/lib/reporting/aggregations'
import type { Quarter } from '@/lib/reporting/quarters'

interface PDFSections {
  scoreTable: boolean
  groupAvg: boolean
  trend: boolean
  anomalies: boolean
}

export interface ReportingPDFPayload {
  period: { year: number; quarter: Quarter }
  mode: 'gerance' | 'copro'
  exportDate: string
  groupAvg: number | null
  target: number
  sections: PDFSections
  agencies: AgencyRow[]
  trend: TrendRow[]
  anomalyAggregates: AnomalyAggregate[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function esc(s: string | number | null | undefined): string {
  return String(s ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function dateFmt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return iso }
}

function eurFmt(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '—'
  const rounded = Math.round(n)
  const sign = rounded < 0 ? '-' : ''
  const abs = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')
  return `${sign}${abs}\u00a0€`
}

function deltaFmt(delta: number | null): string {
  if (delta === null) return '—'
  if (delta > 0) return `+${delta.toFixed(1)}`
  if (delta < 0) return `−${Math.abs(delta).toFixed(1)}`
  return '0.0'
}

function niveauColor(niveau: string): string {
  if (['Excellent', 'Bien', 'Satisfaisant'].includes(niveau)) return '#1A7A4A'
  if (niveau === 'Attention') return '#C8A020'
  if (niveau === 'Vigilance') return '#C05C1A'
  return '#B01A1A'
}

function niveauBg(niveau: string): string {
  if (['Excellent', 'Bien', 'Satisfaisant'].includes(niveau)) return '#EAF6EF'
  if (niveau === 'Attention') return '#FFFBEC'
  if (niveau === 'Vigilance') return '#FDF0E6'
  return '#FAEAEA'
}

function scoreToNiveau(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 85) return 'Bien'
  if (score >= 80) return 'Satisfaisant'
  if (score >= 70) return 'Attention'
  if (score >= 60) return 'Vigilance'
  return 'Dégradé'
}

function quarterLabel(q: Quarter): string {
  const map: Record<Quarter, string> = {
    1: 'Q1 — Fin mars', 2: 'Q2 — Fin juin',
    3: 'Q3 — Fin septembre', 4: 'Q4 — Fin décembre',
  }
  return map[q]
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const NAVY = '#0B1929'
const GOLD = '#C49A2E'
const CREAM = '#FAF8F4'
const BORDER = '#E8E4DC'

// ── Shared page chrome ─────────────────────────────────────────────────────────

function pageHeader(periodLabel: string, modeLabel: string): string {
  return `<div style="background:${NAVY};padding:10px 36px;display:flex;align-items:center;justify-content:space-between">
    <div style="font-size:8.5pt;font-weight:700;color:rgba(255,255,255,0.45)">Century 21 — Groupe Martinot · Reporting groupe</div>
    <div style="font-size:8.5pt;font-weight:700;color:${GOLD}">${esc(periodLabel)} · ${esc(modeLabel)}</div>
  </div>`
}

function pageFooter(exportDate: string, year: number): string {
  return `<div style="background:${NAVY};border-top:3px solid ${GOLD};padding:10px 36px;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:7.5pt;font-weight:600;color:rgba(255,255,255,0.5)">Century 21 — Groupe Martinot · Reporting ${year}</span>
    <span style="font-size:7.5pt;color:rgba(255,255,255,0.4)">Généré le ${dateFmt(exportDate)}</span>
  </div>`
}

function sectionTitle(title: string, subtitle?: string): string {
  return `<div style="margin-bottom:22px">
    <div style="font-size:15pt;font-weight:800;color:${NAVY};line-height:1.1">${esc(title)}</div>
    ${subtitle ? `<div style="font-size:9pt;color:#9A9AB0;margin-top:4px;font-weight:500">${esc(subtitle)}</div>` : ''}
    <div style="height:3px;background:linear-gradient(90deg,${GOLD},transparent);margin-top:10px;border-radius:2px"></div>
  </div>`
}

// ── Cover page ─────────────────────────────────────────────────────────────────

function renderCover(payload: ReportingPDFPayload): string {
  const { period, mode, exportDate, groupAvg, agencies, sections } = payload
  const modeLabel = mode === 'gerance' ? 'Gérance' : 'Copropriété'
  const avgNiveau = groupAvg !== null ? scoreToNiveau(groupAvg) : null

  // Score distribution — unique to cover
  const tiers = [
    { label: 'Excellent / Bien / Satisfaisant', color: '#1A7A4A', bg: '#EAF6EF', test: (s: number) => s >= 80 },
    { label: 'Attention (70 – 79)',              color: '#C8A020', bg: '#FFFBEC', test: (s: number) => s >= 70 && s < 80 },
    { label: 'Vigilance (60 – 69)',              color: '#C05C1A', bg: '#FDF0E6', test: (s: number) => s >= 60 && s < 70 },
    { label: 'Dégradé (< 60)',                   color: '#B01A1A', bg: '#FAEAEA', test: (s: number) => s < 60 },
  ]

  const distBars = tiers.map(t => {
    const count = agencies.filter(a => t.test(a.scoreGlobal)).length
    const pct = agencies.length > 0 ? Math.round((count / agencies.length) * 100) : 0
    return `<div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:8pt;font-weight:600;color:${t.color}">${t.label}</span>
        <span style="font-size:8pt;font-weight:800;color:${t.color}">${count} · ${pct}%</span>
      </div>
      <div style="height:8px;background:#F0EDE8;border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${t.color};border-radius:4px;opacity:0.85"></div>
      </div>
    </div>`
  }).join('')

  const tocItems = [
    sections.groupAvg   && 'Moyenne groupe &amp; objectif',
    sections.scoreTable && `Scores par agence (${agencies.length})`,
    sections.trend      && `Évolution trimestrielle ${period.year}`,
    sections.anomalies  && 'Détail anomalies agrégées',
  ].filter(Boolean) as string[]

  const metaCards = [
    { label: 'Période',         val: `${quarterLabel(period.quarter)} ${period.year}` },
    { label: 'Mode audit',      val: modeLabel },
    { label: 'Agences auditées', val: String(agencies.length) },
    { label: 'Date export',     val: dateFmt(exportDate) },
  ]

  return `<div class="page" style="display:flex;flex-direction:column">
  <!-- Cover header -->
  <div style="background:${NAVY};padding:40px 36px 32px;border-bottom:4px solid ${GOLD}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between">
      <div>
        <div style="font-size:8pt;font-weight:700;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.14em;margin-bottom:8px">Century 21 — Groupe Martinot</div>
        <div style="font-size:28pt;font-weight:900;color:white;letter-spacing:-0.5px;line-height:1.05">
          Reporting <span style="color:${GOLD}">groupe</span>
        </div>
        <div style="font-size:12pt;font-weight:600;color:rgba(255,255,255,0.55);margin-top:8px">
          ${esc(quarterLabel(period.quarter))} ${period.year} · ${esc(modeLabel)}
        </div>
      </div>
      <!-- Big score -->
      ${groupAvg !== null ? `
      <div style="text-align:right">
        <div style="font-size:52pt;font-weight:900;color:${GOLD};line-height:1;letter-spacing:-1px">${groupAvg.toFixed(1)}</div>
        <div style="font-size:10pt;color:rgba(255,255,255,0.35);font-weight:600;margin-top:2px">/100 · Moy. groupe</div>
        ${avgNiveau ? `<div style="display:inline-block;padding:3px 14px;border-radius:20px;font-size:9pt;font-weight:800;background:${niveauBg(avgNiveau)};color:${niveauColor(avgNiveau)};margin-top:8px">${avgNiveau}</div>` : ''}
      </div>` : `<div style="font-size:15pt;color:rgba(255,255,255,0.25);font-weight:600;align-self:center">Aucun audit</div>`}
    </div>
  </div>

  <!-- Cover body -->
  <div style="padding:24px 36px;flex:1;display:flex;gap:24px">

    <!-- Left: meta cards + score distribution -->
    <div style="flex:1.6;display:flex;flex-direction:column;gap:20px">

      <!-- Meta cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${metaCards.map(c => `
          <div style="padding:14px 16px;border:1px solid ${BORDER};border-radius:10px;background:#fff">
            <div style="font-size:7.5pt;color:#9A9AB0;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">${c.label}</div>
            <div style="font-size:12pt;font-weight:800;color:${NAVY}">${esc(c.val)}</div>
          </div>`).join('')}
      </div>

      <!-- Score distribution -->
      <div style="padding:18px;border:1px solid ${BORDER};border-radius:10px;background:#fff;flex:1">
        <div style="font-size:8pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:14px">Répartition des niveaux</div>
        ${agencies.length > 0 ? distBars : `<p style="color:#9A9AB0;font-size:9pt;text-align:center;padding:12px 0">Aucun audit sur cette période.</p>`}
      </div>
    </div>

    <!-- Right: TOC -->
    <div style="width:200px;display:flex;flex-direction:column;gap:16px">
      <div style="padding:18px;border:1px solid ${BORDER};border-radius:10px;background:#fff">
        <div style="font-size:8pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:14px">Sections du rapport</div>
        ${tocItems.length > 0
          ? tocItems.map((item, i) => `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;${i > 0 ? `border-top:1px solid ${BORDER};` : ''}">
              <div style="width:6px;height:6px;border-radius:50%;background:${GOLD};flex-shrink:0"></div>
              <span style="font-size:8.5pt;font-weight:600;color:${NAVY}">${item}</span>
            </div>`).join('')
          : `<p style="color:#9A9AB0;font-size:8.5pt">Aucune section sélectionnée.</p>`}
      </div>
    </div>
  </div>

  ${pageFooter(exportDate, period.year)}
</div>`
}

// ── Moyenne groupe page ────────────────────────────────────────────────────────

function renderGroupAvgPage(payload: ReportingPDFPayload): string {
  const { period, mode, exportDate, groupAvg, target, agencies } = payload
  const modeLabel = mode === 'gerance' ? 'Gérance' : 'Copropriété'
  const periodLabel = quarterLabel(period.quarter) + ' ' + period.year
  const delta = groupAvg !== null ? Math.round((groupAvg - target) * 10) / 10 : null
  const avgNiveau = groupAvg !== null ? scoreToNiveau(groupAvg) : null
  const aboveTarget = agencies.filter(a => a.scoreGlobal >= target).length

  const kpi = (val: string, label: string, color: string, bg: string, valColor = color) => `
    <div style="padding:20px 24px;border:1px solid ${BORDER};border-radius:12px;background:${bg};flex:1;min-width:130px;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${color};border-radius:12px 12px 0 0;opacity:0.8"></div>
      <div style="font-size:26pt;font-weight:900;color:${valColor};line-height:1.05;margin-top:4px">${esc(val)}</div>
      <div style="font-size:7.5pt;margin-top:8px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;color:${bg === NAVY ? 'rgba(255,255,255,0.4)' : '#9A9AB0'}">${esc(label)}</div>
    </div>`

  return `<div class="page" style="display:flex;flex-direction:column">
  ${pageHeader(periodLabel, modeLabel)}
  <div style="padding:28px 36px;flex:1">
    ${sectionTitle('Moyenne groupe & objectif', `${agencies.length} agence${agencies.length > 1 ? 's' : ''} · ${periodLabel} · ${modeLabel}`)}

    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px">
      ${kpi(groupAvg !== null ? `${groupAvg.toFixed(1)}/100` : '—', `Moyenne (${agencies.length} agence${agencies.length > 1 ? 's' : ''})`, GOLD, NAVY, GOLD)}
      ${kpi(`${target}/100`, 'Objectif groupe', NAVY, '#fff')}
      ${delta !== null ? kpi(
        (delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(1),
        'Écart vs objectif',
        delta >= 0 ? '#1A7A4A' : '#B01A1A',
        delta >= 0 ? '#EAF6EF' : '#FAEAEA',
      ) : ''}
      ${avgNiveau ? kpi(avgNiveau, 'Niveau moyen', niveauColor(avgNiveau), niveauBg(avgNiveau)) : ''}
    </div>

    <!-- Summary line -->
    ${agencies.length > 0 ? `
    <div style="padding:14px 18px;border:1px solid ${BORDER};border-radius:10px;background:${CREAM};font-size:9.5pt;color:${NAVY}">
      <strong style="color:${aboveTarget > 0 ? '#1A7A4A' : '#B01A1A'}">${aboveTarget} agence${aboveTarget > 1 ? 's' : ''}</strong>
      atteignent ou dépassent l'objectif de <strong>${target}/100</strong>
      ${aboveTarget < agencies.length ? ` · <strong style="color:#B01A1A">${agencies.length - aboveTarget}</strong> en dessous` : ''}.
    </div>` : ''}
  </div>
  ${pageFooter(exportDate, period.year)}
</div>`
}

// ── Scores par agence page ─────────────────────────────────────────────────────

function renderScoreTablePage(payload: ReportingPDFPayload): string {
  const { period, mode, exportDate, agencies, groupAvg, target } = payload
  const modeLabel = mode === 'gerance' ? 'Gérance' : 'Copropriété'
  const periodLabel = quarterLabel(period.quarter) + ' ' + period.year

  const rows = agencies.map((a, i) => {
    const niv = scoreToNiveau(a.scoreGlobal)
    const scorePct = Math.min(100, a.scoreGlobal)
    const targetPct = Math.min(100, target)
    const barColor = a.scoreGlobal >= 80 ? '#1A7A4A' : a.scoreGlobal >= 70 ? '#C8A020' : a.scoreGlobal >= 60 ? '#C05C1A' : '#B01A1A'

    const deltaCell = (d: number | null) => d !== null
      ? `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:8pt;font-weight:700;background:${d >= 0 ? '#EAF6EF' : '#FAEAEA'};color:${d >= 0 ? '#1A7A4A' : '#B01A1A'}">${deltaFmt(d)}</span>`
      : '<span style="color:#C0C0D0">—</span>'

    return `<tr style="background:${i % 2 === 0 ? '#fff' : CREAM};border-bottom:1px solid ${BORDER}">
      <td style="padding:10px 12px;font-weight:700;color:${NAVY};font-size:9.5pt">${esc(a.agence)}</td>
      <td style="padding:10px 12px;text-align:center;font-size:15pt;font-weight:900;color:${NAVY}">${a.scoreGlobal.toFixed(1)}<span style="font-size:8pt;color:#B0B0C4;font-weight:500">/100</span></td>
      <td style="padding:10px 12px;text-align:center">
        <span style="display:inline-block;padding:3px 12px;border-radius:12px;font-size:8.5pt;font-weight:700;background:${niveauBg(niv)};color:${niveauColor(niv)}">${niv}</span>
      </td>
      <td style="padding:10px 12px;text-align:center;font-size:9.5pt;font-weight:700;color:${NAVY}">${a.nbAnomalies}</td>
      <td style="padding:10px 12px;text-align:center">${deltaCell(a.deltaGroupe)}</td>
      <td style="padding:10px 12px;text-align:center">${deltaCell(a.deltaPrev)}</td>
      <td style="padding:10px 20px 10px 12px;min-width:120px">
        <div style="position:relative;height:10px;background:#F0EDE8;border-radius:5px">
          <div style="position:absolute;top:0;left:0;height:100%;width:${scorePct}%;background:${barColor};border-radius:5px"></div>
          <div style="position:absolute;top:-3px;bottom:-3px;width:3px;background:${GOLD};border-radius:2px;left:${targetPct}%;transform:translateX(-50%);box-shadow:0 0 4px rgba(196,154,46,0.5)"></div>
        </div>
      </td>
    </tr>`
  }).join('')

  const avgRow = groupAvg !== null ? `
    <tr style="background:${CREAM};border-top:2px solid ${BORDER}">
      <td style="padding:10px 12px;font-size:8.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.05em">Moyenne groupe</td>
      <td style="padding:10px 12px;text-align:center;font-size:15pt;font-weight:900;color:${GOLD}">${groupAvg.toFixed(1)}<span style="font-size:8pt;color:#B0B0C4;font-weight:500">/100</span></td>
      <td colspan="5"></td>
    </tr>` : ''

  return `<div class="page" style="display:flex;flex-direction:column">
  ${pageHeader(periodLabel, modeLabel)}
  <div style="padding:28px 36px;flex:1">
    ${sectionTitle(`Scores par agence`, `${agencies.length} agence${agencies.length > 1 ? 's' : ''} auditée${agencies.length > 1 ? 's' : ''} · ${periodLabel} · ${modeLabel}`)}
    ${agencies.length === 0
      ? `<p style="color:#9A9AB0;font-size:9pt;text-align:center;padding:32px 0">Aucun audit sur cette période.</p>`
      : `<table style="width:100%;border-collapse:collapse;font-family:inherit">
          <thead>
            <tr style="background:${CREAM};border-bottom:2px solid ${BORDER}">
              <th style="padding:9px 12px;text-align:left;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Agence</th>
              <th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Score</th>
              <th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Niveau</th>
              <th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Anomalies</th>
              <th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Δ Groupe</th>
              <th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Δ Trim. préc.</th>
              <th style="padding:9px 12px;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em;min-width:120px">Jauge</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>${avgRow}</tfoot>
        </table>`}
  </div>
  ${pageFooter(exportDate, period.year)}
</div>`
}

// ── Évolution trimestrielle page ───────────────────────────────────────────────

function renderTrendPage(payload: ReportingPDFPayload): string {
  const { period, mode, exportDate, trend } = payload
  const modeLabel = mode === 'gerance' ? 'Gérance' : 'Copropriété'
  const periodLabel = quarterLabel(period.quarter) + ' ' + period.year
  const year = period.year

  const tbody = trend.map((row, i) => {
    const cells = ([1, 2, 3, 4] as const).map((q) => {
      const s = row.scores[q]
      if (s === null) return `<td style="padding:10px 12px;text-align:center;color:#D0D0DC;font-size:9.5pt">—</td>`
      const niv = scoreToNiveau(s)
      return `<td style="padding:10px 12px;text-align:center">
        <div style="font-size:12pt;font-weight:800;color:${niveauColor(niv)}">${s.toFixed(1)}</div>
        <div style="font-size:7pt;color:${niveauColor(niv)};opacity:0.7;margin-top:1px">${niv}</div>
      </td>`
    }).join('')

    return `<tr style="background:${i % 2 === 0 ? '#fff' : CREAM};border-bottom:1px solid ${BORDER}">
      <td style="padding:10px 12px;font-weight:700;color:${NAVY};font-size:9.5pt">${esc(row.agence)}</td>
      ${cells}
    </tr>`
  }).join('')

  return `<div class="page" style="display:flex;flex-direction:column">
  ${pageHeader(periodLabel, modeLabel)}
  <div style="padding:28px 36px;flex:1">
    ${sectionTitle(`Évolution trimestrielle ${year}`, `${modeLabel} · Scores Q1 à Q4`)}
    ${trend.length === 0
      ? `<p style="color:#9A9AB0;font-size:9pt;text-align:center;padding:32px 0">Aucune donnée d'évolution pour ${year}.</p>`
      : `<table style="width:100%;border-collapse:collapse;font-family:inherit">
          <thead>
            <tr style="background:${CREAM};border-bottom:2px solid ${BORDER}">
              <th style="padding:9px 12px;text-align:left;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Agence</th>
              ${['Q1 — Mars', 'Q2 — Juin', 'Q3 — Sept.', 'Q4 — Déc.'].map(h =>
                `<th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">${h}</th>`
              ).join('')}
            </tr>
          </thead>
          <tbody>${tbody}</tbody>
        </table>`}
  </div>
  ${pageFooter(exportDate, period.year)}
</div>`
}

// ── Anomalies agrégées page ────────────────────────────────────────────────────

const ANOMALY_LABELS: Record<string, string> = {
  quitt:       'Quittancement / Encaissement',
  propdeb:     'Propriétaires débiteurs actifs',
  propdbsorti: 'Propriétaires débiteurs sortis',
  attdeb:      'Comptes attente débiteurs',
  bqrapp:      'Rapprochement banque 512',
  cptarapp:    'Rapprochement compta',
  balance:     'Balance déséquilibrée',
  fourndeb:    'Fournisseurs débiteurs',
  cattdeb:     'Comptes attente débiteurs (Copro)',
  ventesdeb:   'Copropriétaires vendeurs débiteurs',
  fact60:      'Factures non réglées +60j',
}

function renderAnomalyPage(payload: ReportingPDFPayload): string {
  const { period, mode, exportDate, anomalyAggregates } = payload
  const modeLabel = mode === 'gerance' ? 'Gérance' : 'Copropriété'
  const periodLabel = quarterLabel(period.quarter) + ' ' + period.year

  const rows = anomalyAggregates.map((a, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : CREAM};border-bottom:1px solid ${BORDER}">
      <td style="padding:10px 12px;font-weight:600;color:${NAVY};font-size:9.5pt">${esc(ANOMALY_LABELS[a.id] ?? a.id)}</td>
      <td style="padding:10px 12px;text-align:center;font-size:11pt;font-weight:800;color:${NAVY}">${a.totalNb}</td>
      <td style="padding:10px 12px;text-align:right;font-size:9pt;font-weight:700;color:${NAVY}">${a.totalMontant > 0 ? eurFmt(a.totalMontant) : '—'}</td>
      <td style="padding:10px 12px;text-align:center">
        ${a.totalPenalite > 0
          ? `<span style="display:inline-block;padding:2px 10px;border-radius:10px;background:#FAEAEA;color:#B01A1A;font-size:9pt;font-weight:800">−${a.totalPenalite.toFixed(1)} pts</span>`
          : '<span style="color:#1A7A4A;font-size:9pt;font-weight:700">0</span>'}
      </td>
      <td style="padding:10px 12px;text-align:center;font-size:9pt;color:#7A7A8C;font-weight:600">${a.agenceCount} agence${a.agenceCount > 1 ? 's' : ''}</td>
    </tr>`).join('')

  return `<div class="page" style="display:flex;flex-direction:column">
  ${pageHeader(periodLabel, modeLabel)}
  <div style="padding:28px 36px;flex:1">
    ${sectionTitle('Détail des anomalies agrégées', `${modeLabel} · ${periodLabel}`)}
    ${anomalyAggregates.length === 0
      ? `<p style="color:#9A9AB0;font-size:9pt;text-align:center;padding:32px 0">Aucune anomalie sur cette période.</p>`
      : `<table style="width:100%;border-collapse:collapse;font-family:inherit">
          <thead>
            <tr style="background:${CREAM};border-bottom:2px solid ${BORDER}">
              <th style="padding:9px 12px;text-align:left;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Type d'anomalie</th>
              <th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Nb total</th>
              <th style="padding:9px 12px;text-align:right;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Montant cumulé</th>
              <th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Pénalité cumulée</th>
              <th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Agences</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`}
  </div>
  ${pageFooter(exportDate, period.year)}
</div>`
}

// ── Main render ────────────────────────────────────────────────────────────────

export function renderReportingHTML(payload: ReportingPDFPayload): string {
  const { sections } = payload

  const pages = [
    renderCover(payload),
    sections.groupAvg   ? renderGroupAvgPage(payload)    : '',
    sections.scoreTable ? renderScoreTablePage(payload)  : '',
    sections.trend      ? renderTrendPage(payload)       : '',
    sections.anomalies  ? renderAnomalyPage(payload)     : '',
  ].filter(Boolean).join('\n')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body {
    font-family: -apple-system, 'Helvetica Neue', Arial, 'Segoe UI', sans-serif;
    font-size: 10pt;
    color: #1A1A2E;
    background: #F0EDE8;
  }
  @page { size: A4; margin: 0 }
  .page {
    width: 210mm;
    min-height: 297mm;
    background: white;
    page-break-after: always;
  }
  .page:last-child { page-break-after: avoid }
</style>
</head>
<body>
${pages}
</body>
</html>`
}
