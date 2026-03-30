/**
 * PDF Reporting groupe — 2 pages fixes
 * Page 1 : Couverture + Répartition des scores + Tableau des agences (moyennes annuelles)
 * Page 2 : Évolution trimestrielle avec indicateurs de tendance ↑↓→
 */

import type { AgencyRow, TrendRow } from '@/lib/reporting/aggregations'

export interface ReportingPDFPayload {
  period: { year: number }
  mode: 'gerance' | 'copro'
  groupAvg: number | null
  agencies: AgencyRow[]
  trend: TrendRow[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function esc(s: string | number | null | undefined): string {
  return String(s ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function deltaFmt(delta: number | null): string {
  if (delta === null) return '—'
  if (delta > 0) return `+${delta.toFixed(1)}`
  if (delta < 0) return `−${Math.abs(delta).toFixed(1)}`
  return '0.0'
}

function niveauColor(score: number): string {
  if (score >= 80) return '#1A7A4A'
  if (score >= 70) return '#C8A020'
  if (score >= 60) return '#C05C1A'
  return '#B01A1A'
}

function niveauBg(score: number): string {
  if (score >= 80) return '#EAF6EF'
  if (score >= 70) return '#FFFBEC'
  if (score >= 60) return '#FDF0E6'
  return '#FAEAEA'
}

function niveauLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 85) return 'Bien'
  if (score >= 80) return 'Satisfaisant'
  if (score >= 70) return 'Attention'
  if (score >= 60) return 'Vigilance'
  return 'Dégradé'
}

function trendIndicator(current: number | null, prev: number | null): string {
  if (current === null || prev === null) return ''
  const delta = current - prev
  if (delta > 0.5) return `<span style="color:#1A7A4A;font-weight:900;font-size:9pt;margin-left:3px">↑</span>`
  if (delta < -0.5) return `<span style="color:#B01A1A;font-weight:900;font-size:9pt;margin-left:3px">↓</span>`
  return `<span style="color:#9A9AB0;font-weight:700;font-size:9pt;margin-left:3px">→</span>`
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const NAVY = '#0B1929'
const GOLD = '#C49A2E'
const CREAM = '#FAF8F4'
const BORDER = '#E8E4DC'

// ── Page 1 : Couverture + Distribution + Tableau agences ──────────────────────

function renderPage1(payload: ReportingPDFPayload): string {
  const { period, mode, groupAvg, agencies } = payload
  const modeLabel = mode === 'gerance' ? 'Gérance' : 'Copropriété'
  const avgNiveau = groupAvg !== null ? niveauLabel(groupAvg) : null

  // Score distribution — 4 tiers avec plages explicites
  const tiers = [
    { label: '≥ 80 — Satisfaisant / Bien / Excellent', color: '#1A7A4A', bg: '#EAF6EF', test: (s: number) => s >= 80 },
    { label: '70 – 79 — Attention',                    color: '#C8A020', bg: '#FFFBEC', test: (s: number) => s >= 70 && s < 80 },
    { label: '60 – 69 — Vigilance',                    color: '#C05C1A', bg: '#FDF0E6', test: (s: number) => s >= 60 && s < 70 },
    { label: '< 60 — Dégradé',                         color: '#B01A1A', bg: '#FAEAEA', test: (s: number) => s < 60 },
  ]

  const distBars = tiers.map(t => {
    const count = agencies.filter(a => t.test(a.scoreGlobal)).length
    const pct = agencies.length > 0 ? Math.round((count / agencies.length) * 100) : 0
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div style="width:180px;font-size:7.5pt;font-weight:600;color:${t.color};flex-shrink:0">${t.label}</div>
      <div style="flex:1;height:8px;background:#F0EDE8;border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${t.color};border-radius:4px;opacity:0.85"></div>
      </div>
      <div style="width:52px;text-align:right;font-size:8pt;font-weight:800;color:${t.color}">${pct}%</div>
    </div>`
  }).join('')

  // Agency table rows
  const agencyRows = agencies.map((a, i) => {
    const deltaCell = (d: number | null) => d !== null
      ? `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:7.5pt;font-weight:700;background:${d >= 0 ? '#EAF6EF' : '#FAEAEA'};color:${d >= 0 ? '#1A7A4A' : '#B01A1A'}">${deltaFmt(d)}</span>`
      : '<span style="color:#C0C0D0;font-size:8pt">—</span>'

    return `<tr style="background:${i % 2 === 0 ? '#fff' : CREAM};border-bottom:1px solid ${BORDER}">
      <td style="padding:7px 10px;font-weight:700;color:${NAVY};font-size:8.5pt">${esc(a.agence)}</td>
      <td style="padding:7px 10px;text-align:center">
        <span style="font-size:13pt;font-weight:900;color:${niveauColor(a.scoreGlobal)}">${a.scoreGlobal.toFixed(1)}</span>
        <span style="font-size:7pt;color:#B0B0C4;font-weight:500">/100</span>
      </td>
      <td style="padding:7px 10px;text-align:center">
        <span style="display:inline-block;padding:2px 10px;border-radius:10px;font-size:7.5pt;font-weight:700;background:${niveauBg(a.scoreGlobal)};color:${niveauColor(a.scoreGlobal)}">${niveauLabel(a.scoreGlobal)}</span>
      </td>
      <td style="padding:7px 10px;text-align:center">${deltaCell(a.deltaGroupe)}</td>
    </tr>`
  }).join('')

  const avgRow = groupAvg !== null ? `
    <tr style="background:${CREAM};border-top:2px solid ${BORDER}">
      <td style="padding:7px 10px;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.05em">Moyenne groupe</td>
      <td style="padding:7px 10px;text-align:center">
        <span style="font-size:13pt;font-weight:900;color:${GOLD}">${groupAvg.toFixed(1)}</span>
        <span style="font-size:7pt;color:#B0B0C4;font-weight:500">/100</span>
      </td>
      <td colspan="2"></td>
    </tr>` : ''

  return `<div class="page">

  <!-- Couverture header (navy) -->
  <div style="background:${NAVY};padding:28px 52px 24px;border-bottom:4px solid ${GOLD}">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:7.5pt;font-weight:700;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.14em;margin-bottom:6px">Century 21 — Groupe Martinot</div>
        <div style="font-size:22pt;font-weight:900;color:white;letter-spacing:-0.5px;line-height:1.05">
          Reporting <span style="color:${GOLD}">groupe</span>
        </div>
        <div style="font-size:10pt;font-weight:600;color:rgba(255,255,255,0.5);margin-top:5px">
          Année ${period.year} · ${esc(modeLabel)} · ${agencies.length} agence${agencies.length > 1 ? 's' : ''} auditée${agencies.length > 1 ? 's' : ''}
        </div>
      </div>
      ${groupAvg !== null ? `
      <div style="text-align:right">
        <div style="font-size:44pt;font-weight:900;color:${GOLD};line-height:1;letter-spacing:-1px">${groupAvg.toFixed(1)}</div>
        <div style="font-size:8.5pt;color:rgba(255,255,255,0.3);font-weight:600;margin-top:2px">/100 · Moy. annuelle</div>
        ${avgNiveau ? `<div style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:8.5pt;font-weight:800;background:${niveauBg(groupAvg)};color:${niveauColor(groupAvg)};margin-top:6px">${avgNiveau}</div>` : ''}
      </div>` : `<div style="font-size:13pt;color:rgba(255,255,255,0.2);font-weight:600">Aucun audit</div>`}
    </div>
  </div>

  <!-- Corps page 1 -->
  <div style="padding:24px 52px 36px">

    <!-- Répartition des niveaux -->
    <div style="margin-bottom:20px">
      <div style="font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px">Répartition des niveaux — Moyennes annuelles</div>
      ${agencies.length > 0 ? distBars : `<p style="color:#9A9AB0;font-size:9pt">Aucun audit sur cette période.</p>`}
    </div>

    <!-- Tableau des agences -->
    <div style="font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px">
      Scores par agence — Moyennes ${period.year}
    </div>
    ${agencies.length === 0
      ? `<p style="color:#9A9AB0;font-size:9pt;text-align:center;padding:24px 0">Aucun audit sur cette période.</p>`
      : `<table style="width:100%;border-collapse:collapse;font-family:inherit">
          <thead>
            <tr style="background:${CREAM};border-bottom:2px solid ${BORDER}">
              <th style="padding:7px 10px;text-align:left;font-size:7pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Agence</th>
              <th style="padding:7px 10px;text-align:center;font-size:7pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Score moy.</th>
              <th style="padding:7px 10px;text-align:center;font-size:7pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Niveau</th>
              <th style="padding:7px 10px;text-align:center;font-size:7pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Δ Groupe</th>
            </tr>
          </thead>
          <tbody>${agencyRows}</tbody>
          <tfoot>${avgRow}</tfoot>
        </table>`}
  </div>
</div>`
}

// ── Page 2 : Évolution trimestrielle avec indicateurs ↑↓→ ─────────────────────

function renderPage2(payload: ReportingPDFPayload): string {
  const { period, mode, trend } = payload
  const modeLabel = mode === 'gerance' ? 'Gérance' : 'Copropriété'
  const year = period.year

  const tbody = trend.map((row, i) => {
    const cells = ([1, 2, 3, 4] as const).map((q) => {
      const s = row.scores[q]
      const prev = q > 1 ? row.scores[(q - 1) as 1 | 2 | 3] : null
      if (s === null) return `<td style="padding:9px 12px;text-align:center;color:#D0D0DC;font-size:9pt">—</td>`
      return `<td style="padding:9px 12px;text-align:center">
        <div style="display:inline-flex;align-items:center;justify-content:center">
          <span style="font-size:11pt;font-weight:800;color:${niveauColor(s)}">${s.toFixed(1)}</span>
          ${trendIndicator(s, prev)}
        </div>
        <div style="font-size:6.5pt;color:${niveauColor(s)};opacity:0.7;margin-top:1px">${niveauLabel(s)}</div>
      </td>`
    }).join('')

    return `<tr style="background:${i % 2 === 0 ? '#fff' : CREAM};border-bottom:1px solid ${BORDER}">
      <td style="padding:9px 12px;font-weight:700;color:${NAVY};font-size:9pt">${esc(row.agence)}</td>
      ${cells}
    </tr>`
  }).join('')

  return `<div class="page">
  <div style="padding:48px 52px">

    <!-- En-tête section -->
    <div style="margin-bottom:22px">
      <div style="font-size:15pt;font-weight:800;color:${NAVY};line-height:1.1">Évolution trimestrielle ${year}</div>
      <div style="font-size:9pt;color:#9A9AB0;margin-top:4px;font-weight:500">${esc(modeLabel)} · Scores Q1 → Q4 · Indicateurs ↑↓→ vs trimestre précédent</div>
      <div style="height:3px;background:linear-gradient(90deg,${GOLD},transparent);margin-top:10px;border-radius:2px"></div>
    </div>

    <!-- Légende indicateurs -->
    <div style="display:flex;gap:18px;margin-bottom:16px;padding:10px 14px;background:${CREAM};border-radius:8px;border:1px solid ${BORDER}">
      <span style="font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em;align-self:center">Tendance :</span>
      <span style="font-size:8pt;font-weight:600;color:#1A7A4A">↑ Hausse (&gt; +0.5 pt)</span>
      <span style="font-size:8pt;font-weight:600;color:#9A9AB0">→ Stable (±0.5 pt)</span>
      <span style="font-size:8pt;font-weight:600;color:#B01A1A">↓ Baisse (&gt; −0.5 pt)</span>
    </div>

    ${trend.length === 0
      ? `<p style="color:#9A9AB0;font-size:9pt;text-align:center;padding:32px 0">Aucune donnée d'évolution pour ${year}.</p>`
      : `<table style="width:100%;border-collapse:collapse;font-family:inherit">
          <thead>
            <tr style="background:${CREAM};border-bottom:2px solid ${BORDER}">
              <th style="padding:9px 12px;text-align:left;font-size:7pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Agence</th>
              ${['Q1 — Mars', 'Q2 — Juin', 'Q3 — Sept.', 'Q4 — Déc.'].map(h =>
                `<th style="padding:9px 12px;text-align:center;font-size:7pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">${h}</th>`
              ).join('')}
            </tr>
          </thead>
          <tbody>${tbody}</tbody>
        </table>`}
  </div>
</div>`
}

// ── Main render ────────────────────────────────────────────────────────────────

export function renderReportingHTML(payload: ReportingPDFPayload): string {
  const pages = [
    renderPage1(payload),
    renderPage2(payload),
  ].join('\n')

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
