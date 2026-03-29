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
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
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

function quarterLabel(q: Quarter): string {
  const map: Record<Quarter, string> = { 1: 'Q1 — Fin mars', 2: 'Q2 — Fin juin', 3: 'Q3 — Fin septembre', 4: 'Q4 — Fin décembre' }
  return map[q]
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const NAVY = '#0B1929'
const GOLD = '#C49A2E'
const CREAM = '#FAF8F4'
const BORDER = '#E8E4DC'

// ── Section header separator ───────────────────────────────────────────────────

function sectionHeader(title: string): string {
  return `
  <div style="display:flex;align-items:center;gap:12px;margin:28px 0 14px">
    <div style="flex:1;height:1px;background:${BORDER}"></div>
    <div style="font-size:8pt;font-weight:700;color:#B0B0C8;text-transform:uppercase;letter-spacing:0.12em;white-space:nowrap">${esc(title)}</div>
    <div style="flex:1;height:1px;background:${BORDER}"></div>
  </div>`
}

// ── Score table ────────────────────────────────────────────────────────────────

function renderScoreTable(agencies: AgencyRow[]): string {
  if (agencies.length === 0) {
    return `<p style="color:#9A9AB0;font-size:9pt;text-align:center;padding:16px 0">Aucun audit sur cette période.</p>`
  }

  const rows = agencies.map((a, i) => {
    const dg = a.deltaGroupe !== null
      ? `<span style="display:inline-block;padding:1px 8px;border-radius:12px;font-size:8pt;font-weight:700;background:${a.deltaGroupe >= 0 ? '#EAF6EF' : '#FAEAEA'};color:${a.deltaGroupe >= 0 ? '#1A7A4A' : '#B01A1A'}">${deltaFmt(a.deltaGroupe)}</span>`
      : '<span style="color:#B0B0C8">—</span>'
    const dp = a.deltaPrev !== null
      ? `<span style="display:inline-block;padding:1px 8px;border-radius:12px;font-size:8pt;font-weight:700;background:${a.deltaPrev >= 0 ? '#EAF6EF' : '#FAEAEA'};color:${a.deltaPrev >= 0 ? '#1A7A4A' : '#B01A1A'}">${deltaFmt(a.deltaPrev)}</span>`
      : '<span style="color:#B0B0C8">—</span>'

    return `<tr style="background:${i % 2 === 0 ? '#fff' : CREAM}">
      <td style="padding:8px 12px;font-weight:600;color:${NAVY};font-size:9pt">${esc(a.agence)}</td>
      <td style="padding:8px 12px;text-align:center;font-size:14pt;font-weight:800;color:${NAVY}">${a.scoreGlobal.toFixed(1)}</td>
      <td style="padding:8px 12px;text-align:center">
        <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:8pt;font-weight:700;background:${niveauBg(a.niveau)};color:${niveauColor(a.niveau)}">${esc(a.niveau)}</span>
      </td>
      <td style="padding:8px 12px;text-align:center;font-size:9pt;font-weight:600;color:${NAVY}">${a.nbAnomalies}</td>
      <td style="padding:8px 12px;text-align:center">${dg}</td>
      <td style="padding:8px 12px;text-align:center">${dp}</td>
    </tr>`
  }).join('')

  return `
  <table style="width:100%;border-collapse:collapse;font-family:inherit">
    <thead>
      <tr style="background:${CREAM};border-bottom:2px solid ${BORDER}">
        <th style="padding:9px 12px;text-align:left;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Agence</th>
        <th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Score</th>
        <th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Niveau</th>
        <th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Anomalies</th>
        <th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Δ Groupe</th>
        <th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Δ Trim. préc.</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
}

// ── Group avg KPI ──────────────────────────────────────────────────────────────

function renderGroupAvg(groupAvg: number | null, target: number, count: number): string {
  const delta = groupAvg !== null ? Math.round((groupAvg - target) * 10) / 10 : null
  const avgNiveau = groupAvg !== null
    ? (groupAvg >= 90 ? 'Excellent' : groupAvg >= 85 ? 'Bien' : groupAvg >= 80 ? 'Satisfaisant' : groupAvg >= 70 ? 'Attention' : groupAvg >= 60 ? 'Vigilance' : 'Dégradé')
    : null

  const kpi = (val: string, label: string, color: string = NAVY, bg = '#fff') => `
    <div style="padding:16px 20px;border:1px solid ${BORDER};border-radius:10px;background:${bg};flex:1;min-width:120px;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${color};border-radius:10px 10px 0 0;opacity:0.7"></div>
      <div style="font-size:22pt;font-weight:800;color:${color};line-height:1.1;margin-top:4px">${esc(val)}</div>
      <div style="font-size:7.5pt;color:#9A9AB0;margin-top:6px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600">${esc(label)}</div>
    </div>`

  return `
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:4px">
    ${kpi(
      groupAvg !== null ? `${groupAvg.toFixed(1)}/100` : '—',
      `Moyenne groupe (${count} agence${count > 1 ? 's' : ''})`,
      GOLD,
      NAVY,
    ).replace(`color:${GOLD}`, `color:${GOLD}`).replace(`color:#9A9AB0`, 'color:rgba(255,255,255,0.4)').replace(`background:${NAVY}`, `background:${NAVY}`)}
    ${kpi(`${target}/100`, 'Objectif groupe', NAVY)}
    ${delta !== null ? kpi(
      (delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(1),
      'Écart vs objectif',
      delta >= 0 ? '#1A7A4A' : '#B01A1A',
      delta >= 0 ? '#EAF6EF' : '#FAEAEA',
    ) : ''}
    ${avgNiveau ? kpi(avgNiveau, 'Niveau moyen', niveauColor(avgNiveau), niveauBg(avgNiveau)) : ''}
  </div>`
}

// ── Trend table ────────────────────────────────────────────────────────────────

function renderTrendTable(rows: TrendRow[], year: number): string {
  if (rows.length === 0) {
    return `<p style="color:#9A9AB0;font-size:9pt;text-align:center;padding:16px 0">Aucune donnée d'évolution pour ${year}.</p>`
  }

  const qHeaders = ['Q1 — Mars', 'Q2 — Juin', 'Q3 — Sept.', 'Q4 — Déc.']

  const tbody = rows.map((row, i) => {
    const cells = ([1, 2, 3, 4] as const).map((q) => {
      const s = row.scores[q]
      if (s === null) return `<td style="padding:8px 12px;text-align:center;color:#D0D0DC;font-size:9pt">—</td>`
      return `<td style="padding:8px 12px;text-align:center">
        <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:9pt;font-weight:700;background:${niveauBg(s >= 80 ? 'Bien' : s >= 70 ? 'Attention' : s >= 60 ? 'Vigilance' : 'Dégradé')};color:${niveauColor(s >= 80 ? 'Bien' : s >= 70 ? 'Attention' : s >= 60 ? 'Vigilance' : 'Dégradé')}">${s.toFixed(1)}</span>
      </td>`
    }).join('')

    return `<tr style="background:${i % 2 === 0 ? '#fff' : CREAM}">
      <td style="padding:8px 12px;font-weight:600;color:${NAVY};font-size:9pt">${esc(row.agence)}</td>
      ${cells}
    </tr>`
  }).join('')

  return `
  <table style="width:100%;border-collapse:collapse;font-family:inherit">
    <thead>
      <tr style="background:${CREAM};border-bottom:2px solid ${BORDER}">
        <th style="padding:9px 12px;text-align:left;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Agence</th>
        ${qHeaders.map(h => `<th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">${h}</th>`).join('')}
      </tr>
    </thead>
    <tbody>${tbody}</tbody>
  </table>`
}

// ── Anomaly aggregates ─────────────────────────────────────────────────────────

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

function renderAnomalyAggregates(aggs: AnomalyAggregate[]): string {
  if (aggs.length === 0) {
    return `<p style="color:#9A9AB0;font-size:9pt;text-align:center;padding:16px 0">Aucune anomalie sur cette période.</p>`
  }

  const rows = aggs.map((a, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : CREAM}">
      <td style="padding:8px 12px;font-weight:600;color:${NAVY};font-size:9pt">${esc(ANOMALY_LABELS[a.id] ?? a.id)}</td>
      <td style="padding:8px 12px;text-align:center;font-size:9pt;font-weight:700;color:${NAVY}">${a.totalNb}</td>
      <td style="padding:8px 12px;text-align:right;font-size:9pt;font-weight:700;color:${NAVY}">${a.totalMontant > 0 ? eurFmt(a.totalMontant) : '—'}</td>
      <td style="padding:8px 12px;text-align:center;font-size:9pt;font-weight:700;color:${a.totalPenalite > 0 ? '#B01A1A' : '#1A7A4A'}">${a.totalPenalite > 0 ? '−' + a.totalPenalite.toFixed(1) + ' pts' : '0'}</td>
      <td style="padding:8px 12px;text-align:center;font-size:9pt;color:#7A7A8C">${a.agenceCount} agence${a.agenceCount > 1 ? 's' : ''}</td>
    </tr>`).join('')

  return `
  <table style="width:100%;border-collapse:collapse;font-family:inherit">
    <thead>
      <tr style="background:${CREAM};border-bottom:2px solid ${BORDER}">
        <th style="padding:9px 12px;text-align:left;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Type d'anomalie</th>
        <th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Nb total</th>
        <th style="padding:9px 12px;text-align:right;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Montant cumulé</th>
        <th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Pénalité cumulée</th>
        <th style="padding:9px 12px;text-align:center;font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.08em">Agences concernées</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
}

// ── Main render ────────────────────────────────────────────────────────────────

export function renderReportingHTML(payload: ReportingPDFPayload): string {
  const { period, mode, exportDate, groupAvg, target, sections, agencies, trend, anomalyAggregates } = payload
  const modeLabel = mode === 'gerance' ? 'Gérance' : 'Copropriété'

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
    background: ${CREAM};
  }
  @page { size: A4; margin: 0 }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 0;
    background: white;
    page-break-after: always;
  }
  .content { padding: 32px 36px; }
</style>
</head>
<body>

<!-- ══ COVER PAGE ══ -->
<div class="page">
  <!-- Header bar -->
  <div style="background:${NAVY};padding:28px 36px 24px;border-bottom:3px solid ${GOLD}">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:9pt;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px">
          Century 21 — Groupe Martinot
        </div>
        <div style="font-size:26pt;font-weight:900;color:white;letter-spacing:-0.5px;line-height:1.1">
          Reporting <span style="color:${GOLD}">groupe</span>
        </div>
        <div style="font-size:12pt;font-weight:600;color:rgba(255,255,255,0.6);margin-top:6px">
          ${esc(quarterLabel(period.quarter))} ${period.year} · ${esc(modeLabel)}
        </div>
      </div>
      <div style="text-align:right">
        ${groupAvg !== null ? `
        <div style="font-size:42pt;font-weight:900;color:${GOLD};line-height:1">${groupAvg.toFixed(1)}</div>
        <div style="font-size:11pt;color:rgba(255,255,255,0.4);font-weight:600">/100 · Moy. groupe</div>
        ` : `<div style="font-size:16pt;color:rgba(255,255,255,0.3);font-weight:600">Aucun audit</div>`}
      </div>
    </div>
  </div>

  <!-- Meta info -->
  <div class="content">
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:28px">
      ${[
        { label: 'Période', val: `${quarterLabel(period.quarter)} ${period.year}` },
        { label: 'Mode audit', val: modeLabel },
        { label: 'Agences auditées', val: String(agencies.length) },
        { label: 'Date export', val: dateFmt(exportDate) },
      ].map(({ label, val }) => `
        <div style="flex:1;min-width:120px;padding:14px 16px;border:1px solid ${BORDER};border-radius:10px;background:#fff">
          <div style="font-size:7.5pt;color:#9A9AB0;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">${label}</div>
          <div style="font-size:13pt;font-weight:800;color:${NAVY}">${esc(val)}</div>
        </div>`).join('')}
    </div>

    <!-- Sections incluses -->
    <div style="font-size:8pt;color:#9A9AB0;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px">Contenu du rapport</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${sections.scoreTable ? `<span style="padding:4px 12px;border-radius:20px;background:#EEF3FF;color:#2A50C8;font-size:8pt;font-weight:700">Scores par agence</span>` : ''}
      ${sections.groupAvg ? `<span style="padding:4px 12px;border-radius:20px;background:#EEF3FF;color:#2A50C8;font-size:8pt;font-weight:700">Moyenne groupe + objectif</span>` : ''}
      ${sections.trend ? `<span style="padding:4px 12px;border-radius:20px;background:#EEF3FF;color:#2A50C8;font-size:8pt;font-weight:700">Évolution trimestrielle ${period.year}</span>` : ''}
      ${sections.anomalies ? `<span style="padding:4px 12px;border-radius:20px;background:#EEF3FF;color:#2A50C8;font-size:8pt;font-weight:700">Détail anomalies agrégées</span>` : ''}
    </div>
  </div>
</div>

<!-- ══ CONTENT PAGE ══ -->
<div class="page">
  <!-- Thin header -->
  <div style="background:${NAVY};padding:12px 36px;display:flex;align-items:center;justify-content:space-between">
    <div style="font-size:9pt;font-weight:700;color:rgba(255,255,255,0.5)">Century 21 — Reporting groupe</div>
    <div style="font-size:9pt;font-weight:700;color:${GOLD}">${esc(quarterLabel(period.quarter))} ${period.year} · ${esc(modeLabel)}</div>
  </div>

  <div class="content">

    ${sections.groupAvg ? `
    ${sectionHeader('Moyenne groupe & objectif')}
    ${renderGroupAvg(groupAvg, target, agencies.length)}
    ` : ''}

    ${sections.scoreTable ? `
    ${sectionHeader(`Scores par agence — ${agencies.length} agence${agencies.length > 1 ? 's' : ''}`)}
    ${renderScoreTable(agencies)}
    ` : ''}

    ${sections.trend ? `
    ${sectionHeader(`Évolution trimestrielle ${period.year}`)}
    ${renderTrendTable(trend, period.year)}
    ` : ''}

    ${sections.anomalies ? `
    ${sectionHeader('Détail anomalies agrégées')}
    ${renderAnomalyAggregates(anomalyAggregates)}
    ` : ''}

  </div>

  <!-- Footer -->
  <div style="position:fixed;bottom:0;left:0;right:0;padding:10px 36px;border-top:1px solid ${BORDER};display:flex;justify-content:space-between;font-size:7.5pt;color:#9A9AB0;background:white">
    <span>Century 21 — Groupe Martinot · Reporting ${period.year}</span>
    <span>Généré le ${dateFmt(exportDate)}</span>
  </div>
</div>

</body>
</html>`
}
