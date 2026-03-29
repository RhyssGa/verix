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

// ── Shared page header/footer ──────────────────────────────────────────────────

function pageHeader(periodLabel: string, modeLabel: string): string {
  return `<div style="background:${NAVY};padding:10px 36px;display:flex;align-items:center;justify-content:space-between">
    <div style="font-size:8.5pt;font-weight:700;color:rgba(255,255,255,0.45)">Century 21 — Groupe Martinot · Reporting groupe</div>
    <div style="font-size:8.5pt;font-weight:700;color:${GOLD}">${esc(periodLabel)} · ${esc(modeLabel)}</div>
  </div>`
}

function pageFooter(exportDate: string, year: number): string {
  return `<div style="padding:10px 36px;border-top:1px solid ${BORDER};display:flex;justify-content:space-between;font-size:7pt;color:#B0B0C4;margin-top:auto">
    <span>Century 21 — Groupe Martinot · Reporting ${year}</span>
    <span>Généré le ${dateFmt(exportDate)}</span>
  </div>`
}

function sectionTitle(title: string, subtitle?: string): string {
  return `<div style="margin-bottom:20px">
    <div style="font-size:15pt;font-weight:800;color:${NAVY};line-height:1.1">${esc(title)}</div>
    ${subtitle ? `<div style="font-size:9pt;color:#9A9AB0;margin-top:4px;font-weight:500">${esc(subtitle)}</div>` : ''}
    <div style="height:2px;background:linear-gradient(90deg,${GOLD},transparent);margin-top:10px;border-radius:2px"></div>
  </div>`
}

// ── Cover page ─────────────────────────────────────────────────────────────────

function renderCover(payload: ReportingPDFPayload): string {
  const { period, mode, exportDate, groupAvg, target, agencies, sections } = payload
  const modeLabel = mode === 'gerance' ? 'Gérance' : 'Copropriété'
  const avgNiveau = groupAvg !== null ? scoreToNiveau(groupAvg) : null
  const delta = groupAvg !== null ? Math.round((groupAvg - target) * 10) / 10 : null

  // Score distribution
  const tiers = [
    { label: 'Excellent / Bien / Satisfaisant', min: 80, color: '#1A7A4A', bg: '#EAF6EF' },
    { label: 'Attention', min: 70, max: 80, color: '#C8A020', bg: '#FFFBEC' },
    { label: 'Vigilance', min: 60, max: 70, color: '#C05C1A', bg: '#FDF0E6' },
    { label: 'Dégradé', max: 60, color: '#B01A1A', bg: '#FAEAEA' },
  ]
  const tierCounts = tiers.map(t => ({
    ...t,
    count: agencies.filter(a => {
      const s = a.scoreGlobal
      const lo = t.min ?? 0
      const hi = t.max ?? 100
      return s >= lo && s < hi
    }).length,
  }))
  // last tier is [0, 60)
  tierCounts[0].count = agencies.filter(a => a.scoreGlobal >= 80).length
  tierCounts[3].count = agencies.filter(a => a.scoreGlobal < 60).length

  const distBars = tierCounts.map(t => {
    const pct = agencies.length > 0 ? Math.round((t.count / agencies.length) * 100) : 0
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:8pt;font-weight:600;color:${t.color}">${t.label}</span>
        <span style="font-size:8pt;font-weight:800;color:${t.color}">${t.count} agence${t.count > 1 ? 's' : ''} · ${pct}%</span>
      </div>
      <div style="height:8px;background:#F0EDE8;border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${t.color};border-radius:4px;opacity:0.85"></div>
      </div>
    </div>`
  }).join('')

  // Compact agency list for cover
  const agencyList = agencies.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;font-family:inherit;margin-top:4px">
      <thead>
        <tr style="background:${CREAM};border-bottom:2px solid ${BORDER}">
          <th style="padding:7px 10px;text-align:left;font-size:7pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Agence</th>
          <th style="padding:7px 10px;text-align:center;font-size:7pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Score</th>
          <th style="padding:7px 10px;text-align:center;font-size:7pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Niveau</th>
          <th style="padding:7px 10px;text-align:center;font-size:7pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Δ Groupe</th>
        </tr>
      </thead>
      <tbody>
        ${agencies.map((a, i) => {
          const niv = scoreToNiveau(a.scoreGlobal)
          const dg = a.deltaGroupe
          return `<tr style="background:${i % 2 === 0 ? '#fff' : CREAM}">
            <td style="padding:6px 10px;font-weight:600;color:${NAVY};font-size:8.5pt">${esc(a.agence)}</td>
            <td style="padding:6px 10px;text-align:center;font-size:11pt;font-weight:800;color:${NAVY}">${a.scoreGlobal.toFixed(1)}</td>
            <td style="padding:6px 10px;text-align:center">
              <span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:7.5pt;font-weight:700;background:${niveauBg(niv)};color:${niveauColor(niv)}">${niv}</span>
            </td>
            <td style="padding:6px 10px;text-align:center">
              ${dg !== null
                ? `<span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:7.5pt;font-weight:700;background:${dg >= 0 ? '#EAF6EF' : '#FAEAEA'};color:${dg >= 0 ? '#1A7A4A' : '#B01A1A'}">${deltaFmt(dg)}</span>`
                : '<span style="color:#C0C0D0;font-size:8pt">—</span>'}
            </td>
          </tr>`
        }).join('')}
      </tbody>
    </table>` : `<p style="color:#9A9AB0;font-size:9pt;text-align:center;padding:16px 0">Aucun audit sur cette période.</p>`

  const tocItems = [
    sections.groupAvg && 'Moyenne groupe &amp; objectif',
    sections.scoreTable && `Scores par agence (${agencies.length})`,
    sections.trend && `Évolution trimestrielle ${period.year}`,
    sections.anomalies && 'Détail anomalies agrégées',
  ].filter(Boolean)

  return `<div class="page" style="display:flex;flex-direction:column">
  <!-- Cover header -->
  <div style="background:${NAVY};padding:40px 36px 32px;border-bottom:4px solid ${GOLD}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between">
      <div>
        <div style="font-size:8pt;font-weight:700;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.14em;margin-bottom:8px">
          Century 21 — Groupe Martinot
        </div>
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

    <!-- KPI strip in header -->
    <div style="display:flex;gap:20px;margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1)">
      <div>
        <div style="font-size:7pt;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;font-weight:600">Objectif groupe</div>
        <div style="font-size:16pt;font-weight:800;color:white;margin-top:2px">${target}/100</div>
      </div>
      <div style="width:1px;background:rgba(255,255,255,0.1)"></div>
      <div>
        <div style="font-size:7pt;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;font-weight:600">Écart vs objectif</div>
        <div style="font-size:16pt;font-weight:800;color:${delta !== null ? (delta >= 0 ? '#4ADA8A' : '#FF7070') : 'rgba(255,255,255,0.3)'};margin-top:2px">
          ${delta !== null ? (delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(1) : '—'}
        </div>
      </div>
      <div style="width:1px;background:rgba(255,255,255,0.1)"></div>
      <div>
        <div style="font-size:7pt;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;font-weight:600">Agences auditées</div>
        <div style="font-size:16pt;font-weight:800;color:white;margin-top:2px">${agencies.length}</div>
      </div>
      <div style="width:1px;background:rgba(255,255,255,0.1)"></div>
      <div>
        <div style="font-size:7pt;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;font-weight:600">Exporté le</div>
        <div style="font-size:16pt;font-weight:800;color:white;margin-top:2px">${dateFmt(exportDate)}</div>
      </div>
    </div>
  </div>

  <!-- Cover body -->
  <div style="padding:24px 36px;flex:1;display:flex;gap:24px">

    <!-- Left: score distribution + agency list -->
    <div style="flex:1.6;display:flex;flex-direction:column;gap:20px">
      <!-- Agency summary table -->
      <div>
        <div style="font-size:8pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Synthèse des agences</div>
        ${agencyList}
      </div>
    </div>

    <!-- Right: distribution + TOC -->
    <div style="width:210px;display:flex;flex-direction:column;gap:20px">

      <!-- Score distribution -->
      <div style="padding:16px;border:1px solid ${BORDER};border-radius:10px;background:#fff">
        <div style="font-size:8pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:14px">Répartition des niveaux</div>
        ${distBars}
      </div>

      <!-- TOC -->
      <div style="padding:16px;border:1px solid ${BORDER};border-radius:10px;background:#fff">
        <div style="font-size:8pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px">Sections du rapport</div>
        ${tocItems.map((item, i) => `
          <div style="display:flex;align-items:center;gap:8px;padding:5px 0;${i > 0 ? `border-top:1px solid ${BORDER};` : ''}">
            <div style="width:6px;height:6px;border-radius:50%;background:${GOLD};flex-shrink:0"></div>
            <span style="font-size:8.5pt;font-weight:600;color:${NAVY}">${item}</span>
          </div>`).join('')}
      </div>
    </div>
  </div>

  ${pageFooter(exportDate, period.year)}
</div>`
}

// ── Score table page ───────────────────────────────────────────────────────────

function renderScoreTablePage(payload: ReportingPDFPayload): string {
  const { period, mode, exportDate, agencies, groupAvg, target } = payload
  const modeLabel = mode === 'gerance' ? 'Gérance' : 'Copropriété'
  const periodLabel = quarterLabel(period.quarter) + ' ' + period.year

  const rows = agencies.map((a, i) => {
    const niv = scoreToNiveau(a.scoreGlobal)
    const dg = a.deltaGroupe
    const dp = a.deltaPrev
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
      <td style="padding:10px 12px;text-align:center">${deltaCell(dg)}</td>
      <td style="padding:10px 12px;text-align:center">${deltaCell(dp)}</td>
      <td style="padding:10px 20px 10px 12px;min-width:120px">
        <div style="position:relative;height:10px;background:#F0EDE8;border-radius:5px;overflow:visible">
          <div style="position:absolute;top:0;left:0;height:100%;width:${scorePct}%;background:${barColor};border-radius:5px;overflow:hidden"></div>
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

// ── Group avg page ─────────────────────────────────────────────────────────────

function renderGroupAvgPage(payload: ReportingPDFPayload): string {
  const { period, mode, exportDate, groupAvg, target, agencies } = payload
  const modeLabel = mode === 'gerance' ? 'Gérance' : 'Copropriété'
  const periodLabel = quarterLabel(period.quarter) + ' ' + period.year
  const delta = groupAvg !== null ? Math.round((groupAvg - target) * 10) / 10 : null
  const avgNiveau = groupAvg !== null ? scoreToNiveau(groupAvg) : null

  const kpi = (val: string, label: string, color: string, bg: string, textColor = color) => `
    <div style="padding:20px 24px;border:1px solid ${BORDER};border-radius:12px;background:${bg};flex:1;min-width:130px;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${color};border-radius:12px 12px 0 0;opacity:0.7"></div>
      <div style="font-size:26pt;font-weight:900;color:${textColor};line-height:1.05;margin-top:4px">${esc(val)}</div>
      <div style="font-size:7.5pt;color:${bg === '#fff' ? '#9A9AB0' : color};margin-top:8px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;opacity:${bg === '#fff' ? 1 : 0.7}">${esc(label)}</div>
    </div>`

  // Score distribution detailed
  const dist = [
    { label: 'Excellent (≥ 90)', min: 90, color: '#1A7A4A', bg: '#EAF6EF' },
    { label: 'Bien (85 – 89)', min: 85, max: 90, color: '#1A7A4A', bg: '#EAF6EF' },
    { label: 'Satisfaisant (80 – 84)', min: 80, max: 85, color: '#1A7A4A', bg: '#EAF6EF' },
    { label: 'Attention (70 – 79)', min: 70, max: 80, color: '#C8A020', bg: '#FFFBEC' },
    { label: 'Vigilance (60 – 69)', min: 60, max: 70, color: '#C05C1A', bg: '#FDF0E6' },
    { label: 'Dégradé (< 60)', max: 60, color: '#B01A1A', bg: '#FAEAEA' },
  ]

  const distRows = dist.map(d => {
    const count = agencies.filter(a => {
      const lo = d.min ?? 0
      const hi = d.max ?? 101
      return a.scoreGlobal >= lo && a.scoreGlobal < hi
    }).length
    const pct = agencies.length > 0 ? Math.round((count / agencies.length) * 100) : 0
    return `<tr style="border-bottom:1px solid ${BORDER}">
      <td style="padding:10px 12px">
        <span style="display:inline-block;padding:2px 12px;border-radius:10px;font-size:8.5pt;font-weight:700;background:${d.bg};color:${d.color}">${d.label}</span>
      </td>
      <td style="padding:10px 12px;text-align:center;font-size:11pt;font-weight:800;color:${NAVY}">${count}</td>
      <td style="padding:10px 20px 10px 12px;width:200px">
        <div style="height:10px;background:#F0EDE8;border-radius:5px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${d.color};border-radius:5px;opacity:0.8"></div>
        </div>
        <div style="font-size:7pt;color:#B0B0C4;margin-top:3px;text-align:right">${pct}%</div>
      </td>
    </tr>`
  }).join('')

  return `<div class="page" style="display:flex;flex-direction:column">
  ${pageHeader(periodLabel, modeLabel)}
  <div style="padding:28px 36px;flex:1">
    ${sectionTitle('Moyenne groupe & objectif', `${agencies.length} agence${agencies.length > 1 ? 's' : ''} · ${periodLabel} · ${modeLabel}`)}

    <!-- KPI cards -->
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px">
      ${groupAvg !== null
        ? kpi(`${groupAvg.toFixed(1)}/100`, `Moyenne groupe · ${agencies.length} agence${agencies.length > 1 ? 's' : ''}`, GOLD, NAVY, GOLD).replace('color:#9A9AB0', 'color:rgba(255,255,255,0.4)')
        : kpi('—', 'Moyenne groupe', GOLD, NAVY, GOLD)}
      ${kpi(`${target}/100`, 'Objectif groupe', NAVY, '#fff')}
      ${delta !== null
        ? kpi((delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(1), 'Écart vs objectif', delta >= 0 ? '#1A7A4A' : '#B01A1A', delta >= 0 ? '#EAF6EF' : '#FAEAEA')
        : ''}
      ${avgNiveau ? kpi(avgNiveau, 'Niveau moyen du groupe', niveauColor(avgNiveau), niveauBg(avgNiveau)) : ''}
    </div>

    <!-- Distribution table -->
    <div style="font-size:8pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px">Répartition détaillée par niveau</div>
    <table style="width:100%;border-collapse:collapse;font-family:inherit;border:1px solid ${BORDER};border-radius:10px;overflow:hidden">
      <thead>
        <tr style="background:${CREAM};border-bottom:2px solid ${BORDER}">
          <th style="padding:9px 12px;text-align:left;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Niveau</th>
          <th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Nb agences</th>
          <th style="padding:9px 20px 9px 12px;text-align:left;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Proportion</th>
        </tr>
      </thead>
      <tbody>${distRows}</tbody>
    </table>
  </div>
  ${pageFooter(exportDate, period.year)}
</div>`
}

// ── Trend page ─────────────────────────────────────────────────────────────────

function renderTrendPage(payload: ReportingPDFPayload): string {
  const { period, mode, exportDate, trend } = payload
  const modeLabel = mode === 'gerance' ? 'Gérance' : 'Copropriété'
  const periodLabel = quarterLabel(period.quarter) + ' ' + period.year
  const year = period.year

  const qHeaders = ['Q1 — Mars', 'Q2 — Juin', 'Q3 — Sept.', 'Q4 — Déc.']

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
              ${qHeaders.map(h => `<th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${tbody}</tbody>
        </table>`}
  </div>
  ${pageFooter(exportDate, period.year)}
</div>`
}

// ── Anomaly aggregates page ────────────────────────────────────────────────────

const ANOMALY_LABELS: Record<string, string> = {
  quitt: 'Quittancement / Encaissement',
  propdeb: 'Propriétaires débiteurs actifs',
  propdbsorti: 'Propriétaires débiteurs sortis',
  attdeb: 'Comptes attente débiteurs',
  bqrapp: 'Rapprochement banque 512',
  cptarapp: 'Rapprochement compta',
  balance: 'Balance déséquilibrée',
  fourndeb: 'Fournisseurs débiteurs',
  cattdeb: 'Comptes attente débiteurs (Copro)',
  ventesdeb: 'Copropriétaires vendeurs débiteurs',
  fact60: 'Factures non réglées +60j',
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
      <td style="padding:10px 12px;text-align:center;font-size:9pt;font-weight:800;color:${a.totalPenalite > 0 ? '#B01A1A' : '#1A7A4A'}">
        ${a.totalPenalite > 0
          ? `<span style="display:inline-block;padding:2px 10px;border-radius:10px;background:#FAEAEA;color:#B01A1A">−${a.totalPenalite.toFixed(1)} pts</span>`
          : '<span style="color:#1A7A4A">0</span>'}
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
    sections.groupAvg ? renderGroupAvgPage(payload) : '',
    sections.scoreTable ? renderScoreTablePage(payload) : '',
    sections.trend ? renderTrendPage(payload) : '',
    sections.anomalies ? renderAnomalyPage(payload) : '',
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
