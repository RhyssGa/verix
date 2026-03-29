/**
 * PDF Report V2 — Enhanced visual design
 * Same payload/logic as pdf.ts — only CSS + HTML presentation differs.
 */

import type { PDFPayload, PDFSection, PDFTableRow } from './pdf'

export function renderReportHTMLV2(payload: PDFPayload, bgCoverBase64 = '', _logoBase64 = ''): string {
  const { agence, mode, dateDebut, dateFin, garantie, pointe, pointeDate, nbMandats, nbCopro, score, syntheseRows, sections, bilan, comparison, globalNote } = payload

  const modeLabel = mode === 'gerance' ? 'Gérance' : 'Copropriété'
  const { global: globalScore, penalite, niveauLabel, niveauColor, niveauBg } = score

  // ── Helpers ────────────────────────────────────────────────────────────────

  function stripHtml(s: string): string {
    return String(s).replace(/<[^>]*>?/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
  }

  function esc(s: string): string {
    return stripHtml(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
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
    const grouped = abs.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')
    return `${sign}${grouped}\u00a0€`
  }

  // ── Design tokens ──────────────────────────────────────────────────────────

  const NAVY   = '#0B1929'
  const GOLD   = '#C49A2E'
  const CREAM  = '#FAF8F4'
  const BORDER = '#E8E4DC'

  const STATUS: Record<string, { bg: string; text: string; border: string; label: string; dot: string }> = {
    ok:   { bg: '#EAF6EF', text: '#1A7A4A', border: '#A8D8BC', label: '✓ Conforme',    dot: '#1A7A4A' },
    warn: { bg: '#FEF3E8', text: '#C05C1A', border: '#F5C89A', label: '⚠ Attention',   dot: '#C05C1A' },
    bad:  { bg: '#FAEAEA', text: '#B01A1A', border: '#F5AAAA', label: '✗ Anomalie',    dot: '#B01A1A' },
    info: { bg: '#EEF3FF', text: '#2A50C8', border: '#B0C0F0', label: 'ℹ Information', dot: '#2A50C8' },
  }

  function pill(level: string): string {
    const s = STATUS[level] ?? STATUS.info
    return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 11px 3px 8px;border-radius:20px;font-size:8pt;font-weight:700;letter-spacing:0.03em;background:${s.bg};color:${s.text};border:1px solid ${s.border}"><span style="width:6px;height:6px;border-radius:50%;background:${s.dot};flex-shrink:0"></span>${s.label}</span>`
  }

  function scoreArc(val: number, color: string, size = 88): string {
    const r = 36, cx = 48, cy = 48, circ = 2 * Math.PI * r
    const fill = ((circ * Math.min(Math.max(val, 0), 100)) / 100).toFixed(1)
    const gap  = (circ - parseFloat(fill)).toFixed(1)
    return `<svg viewBox="0 0 96 96" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="8"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="8"
        stroke-dasharray="${fill} ${gap}" stroke-linecap="round"
        transform="rotate(-90 ${cx} ${cy})"/>
      <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="18" font-weight="800" fill="${color}" font-family="Helvetica Neue,Arial,sans-serif">${val}</text>
      <text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="8.5" fill="rgba(255,255,255,0.4)" font-family="Helvetica Neue,Arial,sans-serif">/100</text>
    </svg>`
  }

  function scoreArcLight(val: number, color: string, size = 72): string {
    const r = 30, cx = 40, cy = 40, circ = 2 * Math.PI * r
    const fill = ((circ * Math.min(Math.max(val, 0), 100)) / 100).toFixed(1)
    const gap  = (circ - parseFloat(fill)).toFixed(1)
    return `<svg viewBox="0 0 80 80" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ECECF2" stroke-width="7"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="7"
        stroke-dasharray="${fill} ${gap}" stroke-linecap="round"
        transform="rotate(-90 ${cx} ${cy})"/>
      <text x="${cx}" y="${cy - 1}" text-anchor="middle" font-size="15" font-weight="800" fill="${color}" font-family="Helvetica Neue,Arial,sans-serif">${val}</text>
      <text x="${cx}" y="${cy + 11}" text-anchor="middle" font-size="7.5" fill="#9A9AB0" font-family="Helvetica Neue,Arial,sans-serif">/100</text>
    </svg>`
  }

  // ── Contextual interpretation (same logic as V1) ───────────────────────────

  function interpretSection(sec: PDFSection): string {
    const nb = parseInt(sec.mainStat) || 0
    const { level, penalite: pen, penaliteMax: max, id, nbExclu } = sec
    const kvMap: Record<string, string> = {}
    sec.kvRows.forEach(kv => { kvMap[kv.label] = kv.value })
    const montant = kvMap['Montant total'] || ''
    const ratio   = kvMap['Ratio / Garantie'] || ''
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
    if (id === 'bqrapp') return nb === 1 ? `1 écriture bancaire non rapprochée${justifNote} — à régulariser avant le prochain arrêté.` : `${nb} écritures bancaires non rapprochées${justifNote} — situation à traiter en priorité.`
    if (id === 'cptarapp') return nb === 1 ? `1 écriture comptable non rapprochée${justifNote} — à régulariser avant le prochain arrêté.` : `${nb} écritures comptables non rapprochées${justifNote} — situation à traiter en priorité.`
    if (id === 'balance') return `${nb} balance(s) déséquilibrée(s)${montant ? ` pour un écart cumulé de ${montant}` : ''} — anomalie critique à investiguer immédiatement.`
    if (id === 'quitt') {
      const taux = sec.mainStat !== '—' ? ` (${sec.mainStat})` : ''
      if (pen <= 3)  return `Taux d'encaissement${taux} légèrement insuffisant — écart modéré par rapport aux quittances émises.`
      if (pen <= 7)  return `Taux d'encaissement${taux} en retrait — un volume significatif de loyers quittancés n'a pas encore été encaissé.`
      return `Taux d'encaissement${taux} dégradé — risque de trésorerie important, relances à engager.`
    }
    const ratioNote = ratio && ratio !== '—' ? ` (${ratio} de la garantie)` : ''
    const montantNote = montant && montant !== '—' ? ` pour un encours total de ${montant}${ratioNote}` : ''
    const ratioNum = max > 0 ? pen / max : 0
    if (ratioNum < 0.35) return `${nb} anomalie(s) identifiée(s)${montantNote}${justifNote} — impact limité, situation globalement maîtrisée.`
    if (ratioNum < 0.65) return `${nb} anomalie(s) identifiée(s)${montantNote}${justifNote} — impact modéré (${pen.toFixed(1)} pts). Des actions correctives sont attendues.`
    return `${nb} anomalie(s) identifiée(s)${montantNote}${justifNote} — impact significatif (${pen.toFixed(1)} / ${max} pts max). Intervention prioritaire requise.`
  }

  function compRowForSection(secId: string): ReturnType<NonNullable<typeof comparison>['rows']['find']> {
    if (!comparison) return undefined
    const idMap: Record<string, string> = {
      quitt: 'quitt', propdeb: 'propdeb', attdeb: 'attdeb',
      bqrapp: 'bq_nonrapp', cptarapp: 'cpta_nonrapp', fact60: 'fact60',
      balance: 'balance', fourndeb: 'fourndeb', cattdeb: 'cattdeb', ventesdeb: 'ventesdeb',
    }
    return comparison.rows.find(r => r.id === (idMap[secId] ?? secId))
  }

  // ── KPI chips ─────────────────────────────────────────────────────────────

  function kpiStrip(chips: Array<{ label: string; val: string; color?: string; icon?: string }>): string {
    return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:18px 0 6px">
      ${chips.map(c => `
        <div style="padding:14px 16px;border:1px solid ${BORDER};border-radius:10px;background:#fff;position:relative;overflow:hidden">
          <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${c.color || NAVY};opacity:0.7;border-radius:10px 10px 0 0"></div>
          <div style="font-size:16pt;font-weight:800;color:${c.color || NAVY};line-height:1.1;margin-top:2px;word-break:keep-all">${esc(c.val)}</div>
          <div style="font-size:7.5pt;color:#9A9AB0;margin-top:5px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600">${esc(c.label)}</div>
        </div>`).join('')}
    </div>`
  }

  // ── Anomaly table ─────────────────────────────────────────────────────────

  function renderAnomalyTable(rows: PDFTableRow[], headers: string[], showStatus = true): string {
    if (rows.length === 0) return ''
    const hasDetail = rows.some(r => r.detail !== undefined && r.detail !== null && r.detail !== '')
    const nameH   = headers[0] || 'Libellé'
    const amtH    = headers[1] || 'Montant'
    const detailH = headers[2] || 'Détail'

    const thead = `<tr>
      <th style="text-align:left;border-radius:6px 0 0 0">${esc(nameH)}</th>
      <th style="text-align:right;width:110px">${esc(amtH)}</th>
      ${hasDetail ? `<th style="text-align:left;max-width:160px">${esc(detailH)}</th>` : ''}
      <th style="text-align:left">Note audit</th>
      ${showStatus ? `<th style="text-align:center;width:100px;border-radius:0 6px 0 0">Statut</th>` : ''}
    </tr>`

    const tbody = rows.map((r, i) => `
      <tr style="${r.justified && showStatus ? 'background:#F2FAF6' : (i % 2 === 0 ? 'background:#fff' : 'background:#FAFAFA')}">
        <td style="color:#1A1A2E;font-weight:500">${esc(r.name)}</td>
        <td style="text-align:right;font-weight:700;white-space:nowrap;color:${NAVY};font-variant-numeric:tabular-nums">${esc(r.amount)}</td>
        ${hasDetail ? `<td style="color:#7A7A8C;font-size:8.5pt;word-break:break-word">${esc(r.detail || '—')}</td>` : ''}
        <td style="color:#9A9AB0;font-style:italic;font-size:8.5pt">${esc(r.comment || '—')}</td>
        ${showStatus ? `<td style="text-align:center">
          ${r.justified
            ? `<span style="display:inline-block;padding:2px 9px;border-radius:12px;font-size:7.5pt;font-weight:700;background:#EAF6EF;color:#1A7A4A;border:1px solid #A8D8BC">✓ Justifié</span>`
            : `<span style="display:inline-block;padding:2px 9px;border-radius:12px;font-size:7.5pt;font-weight:700;background:#FAEAEA;color:#B01A1A;border:1px solid #F5AAAA">✗ Injustifié</span>`
          }
        </td>` : ''}
      </tr>`).join('')

    return `
    <div style="margin-top:24px">
      <div style="font-size:7.5pt;font-weight:700;color:#B0B0C8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <span style="flex:1;height:1px;background:#EAEAF0"></span>
        <span>Détail des lignes — ${rows.length} entrée(s)</span>
        <span style="flex:1;height:1px;background:#EAEAF0"></span>
      </div>
      <table class="data-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>
    </div>`
  }

  // ── Section card ──────────────────────────────────────────────────────────

  function renderCard(sec: PDFSection): string {
    const s = STATUS[sec.level] ?? STATUS.info
    const accentColor = s.dot

    const impactLabel = sec.penaliteMax > 0 && !sec.infoOnly
      ? `<div style="display:flex;flex-direction:column;align-items:flex-end;justify-content:center;flex-shrink:0;padding:8px 16px;border-radius:8px;background:${sec.penalite > 0 ? '#FEF0F0' : '#EAF6EF'};border:1px solid ${sec.penalite > 0 ? '#F5AAAA' : '#A8D8BC'}">
          <div style="font-size:17pt;font-weight:800;color:${sec.penalite > 0 ? '#B01A1A' : '#1A7A4A'};line-height:1">${sec.penalite > 0 ? '−' + sec.penalite.toFixed(1) : '0'}<span style="font-size:9pt;font-weight:600"> pts</span></div>
          <div style="font-size:7pt;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.06em;margin-top:3px;white-space:nowrap">/ ${sec.penaliteMax} max</div>
        </div>`
      : ''

    const kpiChips: Array<{ label: string; val: string; color?: string }> = []
    kpiChips.push({ label: sec.mainStatLabel, val: sec.mainStat, color: accentColor })
    sec.kvRows.forEach(kv => {
      if (/^Règle/.test(kv.label)) return
      const c = kv.level === 'bad' ? '#B01A1A' : kv.level === 'warn' ? '#C05C1A' : kv.level === 'ok' ? '#1A7A4A' : NAVY
      kpiChips.push({ label: kv.label, val: kv.value, color: c })
    })

    const sdHtml = sec.scoreLines.length > 0
      ? `<div style="margin-top:16px;padding:14px 16px;border-radius:8px;background:${CREAM};border:1px solid ${BORDER}">
          <div style="font-size:7pt;font-weight:700;color:#B0B0C8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px">Détail du calcul du score</div>
          ${sec.scoreLines.map(l => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #EAEAF0">
              <span style="font-size:9.5pt;color:#3A3A5A">${esc(l.label)}</span>
              <span style="font-size:8.5pt;color:#9A9AB0;margin:0 12px">${esc(l.detail)}</span>
              <span style="font-size:10pt;font-weight:800;color:#B01A1A">−${l.pts.toFixed(1)} pts</span>
            </div>`).join('')}
        </div>`
      : ''

    const noteHtml = sec.note
      ? `<div style="margin:18px 0 0;padding:12px 16px;border-radius:8px;background:#FAF7EE;border:1px solid #E8D89A;border-left:4px solid ${GOLD}">
          <div style="font-size:7.5pt;font-weight:700;color:${GOLD};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">✏ Commentaire de l'auditeur</div>
          <div style="font-size:10pt;color:#1A1A2E;font-style:italic;line-height:1.65">${esc(sec.note)}</div>
        </div>`
      : ''

    const exclHtml = sec.nbExclu > 0
      ? `<div style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;background:#EAF6EF;font-size:8pt;color:#1A7A4A;font-weight:600">
          <span>✓</span> ${sec.nbExclu} ligne(s) justifiée(s) exclue(s) du calcul
        </div>`
      : ''

    const infoOnlyHtml = sec.infoOnly
      ? `<div style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;background:#EEF3FF;font-size:8pt;color:#2A50C8;font-weight:600">
          <span>ℹ</span> Poste présenté à titre informatif — hors calcul du score
        </div>`
      : ''

    const tableHtml = sec.rows.length > 0
      ? renderAnomalyTable(sec.rows, sec.tableHeaders, !sec.infoOnly)
      : (parseInt(sec.mainStat) === 0
          ? `<div style="margin-top:16px;display:flex;align-items:center;gap:8px;padding:12px 16px;border-radius:8px;background:#EAF6EF;border:1px solid #A8D8BC;font-size:9.5pt;color:#1A7A4A;font-weight:600">
              <span style="font-size:13pt">✓</span> Aucune anomalie à signaler sur ce poste.
            </div>`
          : '')

    const compBlock = (() => {
      const cr = compRowForSection(sec.id)
      if (!cr || !comparison) return ''
      const refDate = new Date(comparison.refDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const parts: string[] = []
      if (cr.prevNb !== null && cr.currNb !== null && cr.currNb !== cr.prevNb) {
        const d = cr.currNb - cr.prevNb
        const col = d > 0 ? '#B01A1A' : '#1A7A4A'
        parts.push(`Nb : <span style="color:${col};font-weight:700">${cr.prevNb} → ${cr.currNb} <span style="font-size:7.5pt">(${d > 0 ? '+' : ''}${d})</span></span>`)
      }
      if (cr.prevMontant !== null && cr.currMontant !== null && cr.currMontant !== cr.prevMontant) {
        const d = cr.currMontant - cr.prevMontant
        const col = d > 0 ? '#B01A1A' : '#1A7A4A'
        parts.push(`Montant : <span style="color:${col};font-weight:700">${eurFmt(cr.prevMontant)} → ${eurFmt(cr.currMontant)}</span>`)
      }
      if (parts.length === 0) return ''
      return `<div style="margin-top:8px;padding:6px 12px;border-radius:6px;background:#F5F3EE;font-size:8pt;color:#9A9AB0">
        vs audit du ${esc(refDate)} — ${parts.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}
      </div>`
    })()

    return `
    <h2 class="section-title">${esc(sec.title)}</h2>
    <div class="card" style="border-left:4px solid ${accentColor}">
      <div class="card-header">
        <span style="font-size:20pt;flex-shrink:0;line-height:1">${sec.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12.5pt;font-weight:700;color:${NAVY};line-height:1.2;margin-bottom:6px">${esc(sec.title)}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${pill(sec.level)}
          </div>
        </div>
        ${impactLabel}
      </div>
      <div class="card-body">
        <div style="font-size:9.5pt;color:#6A6A82;font-style:italic;line-height:1.7">${esc(interpretSection(sec))}</div>
        ${compBlock}
        ${noteHtml}
        ${kpiStrip(kpiChips)}
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
body {
  font-family: -apple-system, 'Helvetica Neue', Arial, 'Segoe UI', sans-serif;
  color: #1A1A2E;
  font-size: 10.5pt;
  background: #fff;
  line-height: 1.6;
}

h1, h2, h3, .section-title {
  word-break: keep-all;
  overflow-wrap: normal;
  white-space: normal;
  hyphens: none;
}

/* Cover */
.cover {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: ${NAVY};
  position: relative;
}

/* Content pages */
.page-break {
  page-break-before: always;
  padding: 48px 52px;
}

.no-break { page-break-inside: avoid; }
.section-title {
  font-size: 11pt;
  font-weight: 700;
  color: #B0B0C8;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  padding-bottom: 10px;
  border-bottom: 1px solid #EAEAF0;
  margin-bottom: 22px;
  page-break-after: avoid;
  display: flex;
  align-items: center;
  gap: 10px;
}
.section-title::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 16px;
  background: ${GOLD};
  border-radius: 2px;
  flex-shrink: 0;
}

/* Cards */
.card {
  border: 1px solid ${BORDER};
  border-radius: 12px;
  overflow: hidden;
  page-break-inside: avoid;
  background: #fff;
  box-shadow: 0 2px 8px rgba(11,25,41,0.06);
}
.card-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px 24px 18px;
  border-bottom: 1px solid #F2F2F8;
  background: ${CREAM};
}
.card-body {
  padding: 22px 24px 26px;
}
.card-header-block { page-break-after: avoid; }

/* Synthesis table */
.synth-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9.5pt;
  margin: 20px 0;
  border: 1px solid ${BORDER};
  border-radius: 10px;
  overflow: hidden;
}
.synth-table thead { display: table-header-group; }
.synth-table th {
  background: ${NAVY};
  color: rgba(255,255,255,0.85);
  padding: 10px 14px;
  font-size: 8pt;
  font-weight: 700;
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
}
.synth-table td {
  padding: 10px 14px;
  border-bottom: 1px solid #F2F2F8;
  vertical-align: middle;
}
.synth-table tr:nth-child(even) td { background: #FAFAFA; }
.synth-table tr:last-child td { border-bottom: none; }
.synth-table tfoot td {
  background: ${NAVY};
  color: ${GOLD};
  font-weight: 700;
  padding: 12px 14px;
  font-size: 10.5pt;
  border: none;
}
.pen { font-weight: 700; text-align: right !important; }
.pen.zero { color: #1A7A4A; }
.pen.neg  { color: #B01A1A; }

/* Data table */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9.5pt;
  border: 1px solid ${BORDER};
  border-radius: 8px;
  overflow: hidden;
}
.data-table thead { display: table-header-group; }
.data-table thead tr { background: ${NAVY}; }
.data-table th {
  padding: 9px 14px;
  font-size: 8pt;
  font-weight: 700;
  color: rgba(255,255,255,0.85);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: none;
  word-break: keep-all;
  white-space: nowrap;
}
.data-table td {
  padding: 9px 14px;
  border-bottom: 1px solid #F2F2F8;
  vertical-align: top;
}
.data-table tr:last-child td { border-bottom: none; }
.data-table tbody tr { page-break-inside: avoid; }

/* Bilan table */
.bilan-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9pt;
  margin: 6px 0 18px;
  border: 1px solid ${BORDER};
  border-radius: 8px;
  overflow: hidden;
}
.bilan-table thead { display: table-header-group; }
.bilan-table th {
  background: #F3F3F9;
  color: ${NAVY};
  padding: 8px 11px;
  font-size: 7.5pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 2px solid ${BORDER};
  white-space: nowrap;
}
.bilan-table td { padding: 8px 11px; border-bottom: 1px solid #F2F2F8; }
.bilan-table tr:last-child td { border-bottom: none; }
.bilan-table tbody tr { page-break-inside: avoid; }
`

  // ── Cover ──────────────────────────────────────────────────────────────────

  const coverBgStyle = bgCoverBase64
    ? `background-image:url('data:image/png;base64,${bgCoverBase64}');background-size:cover;background-position:center;background-repeat:no-repeat`
    : `background:${NAVY}`

  const coverHTML = `
  <div class="cover" style="${coverBgStyle}">
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:52px 64px;background:rgba(15,31,53,0.72)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
        <div style="width:3px;height:18px;background:${GOLD};border-radius:2px;flex-shrink:0"></div>
        <div style="font-size:9pt;font-weight:700;color:${GOLD};text-transform:uppercase;letter-spacing:0.2em">${esc(modeLabel)}</div>
      </div>
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

  const synthRows = syntheseRows.map((row, i) => {
    const penStr = row.exclu ? '—' : row.penalite > 0 ? `−${row.penalite.toFixed(1)}` : '0'
    const maxStr = row.penaliteMax > 0 ? `/ ${row.penaliteMax}` : '—'
    const penCls = row.penalite > 0 && !row.exclu ? 'neg' : 'zero'
    const typeLabel = row.exclu ? 'Exclu' : row.type === 'info' ? 'Info' : row.type === 'critique' ? 'Critique' : 'Scoring'
    const typeBg = row.type === 'info' || row.exclu ? '#EEF3FF' : '#F3F3F9'
    const typeColor = row.type === 'info' || row.exclu ? '#2A50C8' : '#7A7A8C'
    const statusHtml = row.exclu
      ? `<span style="display:inline-block;padding:2px 9px;border-radius:12px;font-size:7.5pt;font-weight:600;background:#F3F3F9;color:#9A9AB0">Non scoré</span>`
      : row.penalite > 0
        ? `<span style="display:inline-block;padding:2px 9px;border-radius:12px;font-size:7.5pt;font-weight:700;background:#FAEAEA;color:#B01A1A;border:1px solid #F5AAAA">✗ Anomalie</span>`
        : `<span style="display:inline-block;padding:2px 9px;border-radius:12px;font-size:7.5pt;font-weight:700;background:#EAF6EF;color:#1A7A4A;border:1px solid #A8D8BC">✓ OK</span>`
    const montantStr = row.montant != null ? eurFmt(row.montant) : '—'
    const rowBg = i % 2 === 0 ? '' : 'background:#FAFAFA'
    return `<tr style="${rowBg}">
      <td style="font-weight:500">${esc(row.label)}${row.exclu ? ' <em style="color:#9A9AB0;font-size:8.5pt">(exclu)</em>' : ''}</td>
      <td style="text-align:center"><span style="display:inline-block;padding:2px 9px;border-radius:12px;font-size:7.5pt;font-weight:600;background:${typeBg};color:${typeColor}">${esc(typeLabel)}</span></td>
      <td style="text-align:right;font-variant-numeric:tabular-nums">${row.nb != null ? row.nb : '—'}</td>
      <td style="text-align:right;font-size:9pt;color:#3A3A5A;font-variant-numeric:tabular-nums">${montantStr}</td>
      <td class="pen ${penCls}">${penStr}</td>
      <td style="text-align:right;color:#9A9AB0;font-size:9pt">${maxStr}</td>
      <td style="text-align:center">${statusHtml}</td>
    </tr>`
  }).join('')

  // Comparison block for synthesis
  let synthComparisonBlock = ''
  if (comparison) {
    const refDateFmt = new Date(comparison.refDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const sDelta = comparison.currScore - comparison.prevScore
    const sDeltaStr = (sDelta >= 0 ? '+' : '') + sDelta.toFixed(1)
    const sColor  = sDelta > 0 ? '#1A7A4A' : sDelta < 0 ? '#B01A1A' : '#7A7A8C'
    const sBg     = sDelta > 0 ? '#EAF6EF' : sDelta < 0 ? '#FAEAEA' : '#F2F2F2'
    const sBorder = sDelta > 0 ? '#A8D8BC' : sDelta < 0 ? '#F5AAAA' : '#DCDCEC'
    const sArrow  = sDelta > 0 ? '↑' : sDelta < 0 ? '↓' : '→'

    // Compute prev niveau from score
    const pn = comparison.prevScore >= 90 ? { label: 'Excellent',    color: '#1A7A4A', bg: '#EAF6EF' }
             : comparison.prevScore >= 85 ? { label: 'Bien',         color: '#1A7A4A', bg: '#EAF6EF' }
             : comparison.prevScore >= 80 ? { label: 'Satisfaisant', color: '#1A7A4A', bg: '#EAF6EF' }
             : comparison.prevScore >= 70 ? { label: 'Attention',    color: '#C8A020', bg: '#FFFBEC' }
             : comparison.prevScore >= 60 ? { label: 'Vigilance',    color: '#C05C1A', bg: '#FDF0E6' }
             : { label: 'Dégradé', color: '#B01A1A', bg: '#FAEAEA' }

    // nb anomalies (rows with non-zero counts)
    const prevNbAnom = comparison.rows.filter(r => r.prevNb !== null && r.prevNb > 0).length
    const currNbAnom = comparison.rows.filter(r => r.currNb !== null && r.currNb > 0).length
    const anomDelta  = currNbAnom - prevNbAnom
    const anomColor  = anomDelta < 0 ? '#1A7A4A' : anomDelta > 0 ? '#B01A1A' : '#1A1A2E'

    const miniRows = comparison.rows.map((r, ri) => {
      const nbD = r.prevNb !== null && r.currNb !== null ? r.currNb - r.prevNb : null
      const mtD = r.prevMontant !== null && r.currMontant !== null ? r.currMontant - r.prevMontant : null
      if (nbD === 0 && (mtD === null || mtD === 0)) return ''
      const nbColor = nbD === null || nbD === 0 ? '#7A7A8C' : nbD < 0 ? '#1A7A4A' : '#B01A1A'
      const mtColor = mtD === null || mtD === 0 ? '#7A7A8C' : mtD < 0 ? '#1A7A4A' : '#B01A1A'
      const rowBg = ri % 2 === 0 ? '#fff' : '#FAFAFA'
      return `<tr style="background:${rowBg}">
        <td style="padding:8px 14px;font-size:9pt;color:#1A1A2E;font-weight:500;border-bottom:1px solid #F0EDE8">${esc(r.label)}</td>
        <td style="padding:8px 14px;text-align:right;font-size:9pt;white-space:nowrap;border-bottom:1px solid #F0EDE8">
          <span style="color:#C0C0D0;text-decoration:line-through;margin-right:6px;font-size:8.5pt">${r.prevNb ?? '—'}</span>
          <span style="font-weight:700;color:${nbColor}">${r.currNb ?? '—'}${nbD !== null && nbD !== 0 ? `<span style="font-size:7.5pt;margin-left:3px">(${nbD > 0 ? '+' : ''}${nbD})</span>` : ''}</span>
        </td>
        <td style="padding:8px 14px;text-align:right;font-size:9pt;white-space:nowrap;border-bottom:1px solid #F0EDE8">
          ${r.prevMontant !== null && r.currMontant !== null
            ? `<span style="color:#C0C0D0;text-decoration:line-through;margin-right:6px;font-size:8.5pt">${eurFmt(r.prevMontant)}</span><span style="font-weight:700;color:${mtColor}">${eurFmt(r.currMontant)}</span>`
            : '<span style="color:#C0C0D0">—</span>'}
        </td>
      </tr>`
    }).filter(Boolean).join('')

    synthComparisonBlock = `
    <div style="margin-top:30px;page-break-inside:avoid">

      <!-- Section title -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <span style="font-size:8pt;font-weight:700;color:#B0B0C8;text-transform:uppercase;letter-spacing:0.1em;white-space:nowrap">Comparaison audit précédent</span>
        <span style="flex:1;height:1px;background:#E8E4DC"></span>
      </div>

      <div style="border:1px solid #E8E4DC;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(11,25,41,0.06)">

        <!-- Header bar -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 18px;background:${CREAM};border-bottom:1px solid ${BORDER}">
          <div style="font-size:9pt;font-weight:600;color:${NAVY}">Audit du <strong>${esc(refDateFmt)}</strong></div>
          <div style="font-size:8pt;color:#9A9AB0">${esc(comparison.refAgence)}</div>
        </div>

        <!-- Score 3-column grid -->
        <div style="display:grid;grid-template-columns:1fr 64px 1fr;align-items:center;gap:10px;padding:18px 20px;border-bottom:1px solid #F0EDE8">

          <!-- Précédent -->
          <div style="background:#FAF8F4;border:1px solid #E8E4DC;border-radius:10px;padding:14px 16px">
            <div style="font-size:7.5pt;font-weight:700;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:7px">Précédent</div>
            <div style="font-size:26pt;font-weight:800;color:#1A1A2E;line-height:1;margin-bottom:7px">
              ${comparison.prevScore}<span style="font-size:11pt;font-weight:400;color:#9A9AB0">/100</span>
            </div>
            <div style="display:inline-block;padding:2px 9px;border-radius:20px;font-size:8.5pt;font-weight:600;background:${esc(pn.bg)};color:${esc(pn.color)};margin-bottom:5px">${esc(pn.label)}</div>
            <div style="font-size:8.5pt;color:#9A9AB0">${esc(refDateFmt)}</div>
          </div>

          <!-- Delta circle -->
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px">
            <div style="width:52px;height:52px;border-radius:50%;background:${sBg};border:1.5px solid ${sColor}40;display:flex;flex-direction:column;align-items:center;justify-content:center">
              <span style="font-size:15pt;color:${sColor};line-height:1">${sArrow}</span>
              <span style="font-size:8.5pt;font-weight:800;color:${sColor};line-height:1.1">${sDeltaStr}</span>
            </div>
            <div style="font-size:7.5pt;color:#9A9AB0;font-weight:600;letter-spacing:0.03em">pts</div>
          </div>

          <!-- Actuel -->
          <div style="background:${esc(niveauBg)};border:1px solid ${esc(niveauColor)}33;border-radius:10px;padding:14px 16px">
            <div style="font-size:7.5pt;font-weight:700;color:${esc(niveauColor)};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:7px">Actuel</div>
            <div style="font-size:26pt;font-weight:800;color:#1A1A2E;line-height:1;margin-bottom:7px">
              ${comparison.currScore}<span style="font-size:11pt;font-weight:400;color:#9A9AB0">/100</span>
            </div>
            <div style="display:inline-block;padding:2px 9px;border-radius:20px;font-size:8.5pt;font-weight:600;background:rgba(255,255,255,0.65);color:${esc(niveauColor)}">${esc(niveauLabel)}</div>
          </div>
        </div>

        <!-- Stats row -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px 20px;background:#FAFAF8;border-bottom:1px solid #F0EDE8">
          <div style="background:#fff;border:1px solid #E8E4DC;border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:8.5pt;color:#9A9AB0">Postes en anomalie</span>
            <span style="font-size:9.5pt;font-weight:700;color:#1A1A2E">
              <span style="color:#C0C0D0;font-weight:400">${prevNbAnom}</span>
              <span style="color:#9A9AB0;margin:0 4px">→</span>
              <span style="color:${anomColor}">${currNbAnom}</span>
            </span>
          </div>
          <div style="background:#fff;border:1px solid #E8E4DC;border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:8.5pt;color:#9A9AB0">Score</span>
            <span style="font-size:9.5pt;font-weight:700;color:#1A1A2E">
              <span style="color:#C0C0D0;font-weight:400">${comparison.prevScore}</span>
              <span style="color:#9A9AB0;margin:0 4px">→</span>
              <span style="color:${esc(niveauColor)}">${comparison.currScore}</span>
            </span>
          </div>
        </div>

        <!-- Changes table -->
        ${miniRows ? `
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#F5F4F0">
              <th style="text-align:left;padding:8px 14px;font-size:7.5pt;color:#B0B0C8;font-weight:700;text-transform:uppercase;letter-spacing:0.08em">Poste</th>
              <th style="text-align:right;padding:8px 14px;font-size:7.5pt;color:#B0B0C8;font-weight:700;text-transform:uppercase;letter-spacing:0.08em">Nombre</th>
              <th style="text-align:right;padding:8px 14px;font-size:7.5pt;color:#B0B0C8;font-weight:700;text-transform:uppercase;letter-spacing:0.08em">Montant</th>
            </tr>
          </thead>
          <tbody>${miniRows}</tbody>
        </table>` : `
        <div style="padding:14px 18px;font-size:9pt;color:#1A7A4A;font-weight:600;background:#EAF6EF;display:flex;align-items:center;gap:8px">
          <span>✓</span> Aucun écart significatif par rapport à l'audit de référence.
        </div>`}

      </div>
    </div>`
  }

  const syntheseHTML = `
  <div class="page-break">
    <h1 class="section-title" style="font-size:12pt;color:${NAVY};border-bottom:2px solid ${GOLD};letter-spacing:0.06em">Synthèse générale</h1>

    <!-- Score header card -->
    <div style="display:flex;align-items:center;gap:28px;padding:24px 28px;border:1px solid ${BORDER};border-radius:12px;background:${CREAM};page-break-inside:avoid">
      ${scoreArcLight(globalScore, niveauColor, 80)}
      <div style="flex:1;min-width:0">
        <div style="font-size:7.5pt;font-weight:700;color:#B0B0C8;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:8px">Score global — ${esc(modeLabel)}</div>
        <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px">
          <span style="font-size:26pt;font-weight:800;color:${esc(niveauColor)};line-height:1">${globalScore}</span>
          <span style="font-size:11pt;font-weight:400;color:#9A9AB0">/100</span>
          <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 14px;border-radius:20px;background:${esc(niveauBg)};color:${esc(niveauColor)};font-size:10pt;font-weight:700">${esc(niveauLabel)}</span>
        </div>
      </div>
    </div>

    <!-- KPI chips -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:14px 0 4px">
      <div style="padding:16px 18px;border:1px solid ${BORDER};border-radius:10px;background:#fff;border-top:3px solid ${penalite > 0 ? '#B01A1A' : '#1A7A4A'}">
        <div style="font-size:18pt;font-weight:800;color:${penalite > 0 ? '#B01A1A' : '#1A7A4A'};line-height:1.1">−${penalite.toFixed(1)}<span style="font-size:10pt;font-weight:600"> pts</span></div>
        <div style="font-size:7.5pt;color:#9A9AB0;margin-top:5px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600">Pénalité cumulée</div>
      </div>
      ${garantie > 0 ? `
      <div style="padding:16px 18px;border:1px solid ${BORDER};border-radius:10px;background:#fff;border-top:3px solid ${GOLD}">
        <div style="font-size:18pt;font-weight:800;color:${NAVY};line-height:1.1;word-break:keep-all">${esc(eurFmt(garantie))}</div>
        <div style="font-size:7.5pt;color:#9A9AB0;margin-top:5px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600">Garantie financière</div>
      </div>` : ''}
      ${pointe > 0 ? `
      <div style="padding:16px 18px;border:1px solid ${BORDER};border-radius:10px;background:#fff;border-top:3px solid ${GOLD}">
        <div style="font-size:18pt;font-weight:800;color:${NAVY};line-height:1.1;word-break:keep-all">${esc(eurFmt(pointe))}</div>
        <div style="font-size:7.5pt;color:#9A9AB0;margin-top:5px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600">${pointeDate ? `Pointe au ${dateFmt(pointeDate)}` : 'Pointe'}</div>
      </div>` : ''}
      ${mode === 'gerance' && nbMandats ? `
      <div style="padding:16px 18px;border:1px solid ${BORDER};border-radius:10px;background:#fff;border-top:3px solid ${NAVY}">
        <div style="font-size:18pt;font-weight:800;color:${NAVY};line-height:1.1">${nbMandats}</div>
        <div style="font-size:7.5pt;color:#9A9AB0;margin-top:5px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600">Mandats</div>
      </div>` : ''}
      ${mode === 'copro' && nbCopro !== undefined ? `
      <div style="padding:16px 18px;border:1px solid ${BORDER};border-radius:10px;background:#fff;border-top:3px solid ${NAVY}">
        <div style="font-size:18pt;font-weight:800;color:${NAVY};line-height:1.1">${nbCopro}</div>
        <div style="font-size:7.5pt;color:#9A9AB0;margin-top:5px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600">Copropriétés</div>
      </div>` : ''}
    </div>

    ${globalNote ? `
    <div style="margin-top:16px;padding:14px 18px;background:#FAF7EE;border:1px solid #E8D89A;border-left:4px solid ${GOLD};border-radius:8px">
      <div style="font-size:8pt;font-weight:700;color:${GOLD};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:7px">✏ Note générale de l'auditeur</div>
      <div style="font-size:10pt;color:#1A1A2E;line-height:1.65;white-space:pre-wrap">${esc(globalNote)}</div>
    </div>` : ''}

    <table class="synth-table" style="margin-top:22px">
      <thead>
        <tr>
          <th>Poste d'audit</th>
          <th style="width:75px;text-align:center">Type</th>
          <th style="width:50px;text-align:right">Nb</th>
          <th style="width:95px;text-align:right">Montant</th>
          <th style="width:80px;text-align:right">Pénalité</th>
          <th style="width:60px;text-align:right">Max</th>
          <th style="width:100px;text-align:center">Statut</th>
        </tr>
      </thead>
      <tbody>${synthRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="4" style="color:${GOLD};font-weight:700;font-size:10.5pt;letter-spacing:0.05em">SCORE GLOBAL</td>
          <td colspan="3" style="color:${GOLD};font-weight:800;font-size:13pt;text-align:right">${globalScore} / 100 &nbsp;—&nbsp; ${esc(niveauLabel)}</td>
        </tr>
      </tfoot>
    </table>
    ${synthComparisonBlock}
  </div>`

  // ── Section pages ──────────────────────────────────────────────────────────

  const sectionsHTML = sections.map(sec => `
  <div class="page-break">
    ${renderCard(sec)}
  </div>`).join('\n')

  // ── Bilan ──────────────────────────────────────────────────────────────────

  let bilanHTML = ''
  if (bilan && bilan.total > 0) {
    const bilanLvl = bilan.nbRisque > 0 ? (bilan.groups.some(g => g.riskColor === '#B01A1A') ? 'bad' : 'warn') : 'ok'
    const bilanColor = bilanLvl === 'bad' ? '#B01A1A' : bilanLvl === 'warn' ? '#C05C1A' : '#1A7A4A'
    const risk4count = bilan.groups.find(g => g.riskLabel.startsWith('✗✗✗✗'))?.rows.length ?? 0
    const risk3count = bilan.groups.find(g => g.riskLabel.startsWith('✗✗✗ '))?.rows.length ?? 0
    const risk2count = bilan.groups.find(g => g.riskLabel.startsWith('✗✗ '))?.rows.length ?? 0
    const risk1count = bilan.groups.find(g => g.riskLabel.startsWith('✗ '))?.rows.length ?? 0
    const bilanInterpret = bilan.nbRisque === 0
      ? `Le portefeuille de ${bilan.total} copropriété(s) ne présente aucune résidence avec plusieurs indicateurs dégradés — situation globalement saine.`
      : `Sur ${bilan.total} copropriétés analysées, ${bilan.nbRisque} présentent au moins 2 indicateurs dégradés.${risk4count > 0 ? ` ${risk4count} résidence(s) en risque critique.` : ''}${risk3count > 0 ? ` ${risk3count} en risque élevé.` : ''}${risk2count > 0 ? ` ${risk2count} en risque modéré.` : ''}`

    const bilanNoteHtml = bilan.note
      ? `<div style="margin:16px 0 0;padding:12px 16px;border-radius:8px;background:#FAF7EE;border:1px solid #E8D89A;border-left:4px solid ${GOLD}">
          <div style="font-size:7.5pt;font-weight:700;color:${GOLD};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px">✏ Commentaire de l'auditeur</div>
          <div style="font-size:10pt;color:#1A1A2E;font-style:italic;line-height:1.65">${esc(bilan.note)}</div>
        </div>`
      : ''

    const groupsHTML = bilan.groups.map(g => {
      const grpBg = g.riskColor === '#B01A1A' ? '#FEF5F5' : g.riskColor === '#C05C1A' ? '#FEF9F0' : g.riskColor === '#C8A020' ? '#FFFBEC' : '#EAF6EF'
      const grpBorder = g.riskColor === '#B01A1A' ? '#F5AAAA' : g.riskColor === '#C05C1A' ? '#F5C89A' : g.riskColor === '#C8A020' ? '#E8D89A' : '#A8D8BC'
      return `
      <div style="margin-top:22px">
        <div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:8px;background:${grpBg};margin-bottom:10px;border:1px solid ${grpBorder}">
          <span style="font-size:10.5pt;font-weight:700;color:${g.riskColor}">${esc(g.riskLabel)}</span>
          <span style="font-size:8.5pt;color:#9A9AB0;margin-left:auto">${g.rows.length} résidence(s)</span>
        </div>
        <table class="bilan-table">
          <thead>
            <tr>
              <th style="text-align:left">Résidence</th>
              <th style="text-align:right;width:50px">Lots</th>
              <th style="text-align:right;width:85px">Impayés</th>
              <th style="text-align:right;width:85px">Charges</th>
              <th style="text-align:right;width:85px">Travaux</th>
              <th style="text-align:right;width:85px">Trésorerie</th>
            </tr>
          </thead>
          <tbody>
            ${g.rows.map((r, ri) => `
              <tr style="${ri % 2 !== 0 ? 'background:#FAFAFA' : ''}">
                <td style="color:#1A1A2E;font-weight:500">${esc(r.name)}</td>
                <td style="text-align:right;color:#7A7A8C">${esc(r.lots)}</td>
                <td style="text-align:right">
                  ${r.impayesAnomalie
                    ? `<span style="display:inline-block;padding:2px 8px;border-radius:6px;background:#FAEAEA;color:#B01A1A;font-weight:700;font-size:8.5pt">${esc(r.impayes)}</span>`
                    : `<span style="color:#1A1A2E">${esc(r.impayes)}</span>`}
                </td>
                <td style="text-align:right">
                  ${r.chargesAnomalie
                    ? `<span style="display:inline-block;padding:2px 8px;border-radius:6px;background:#FAEAEA;color:#B01A1A;font-weight:700;font-size:8.5pt">${esc(r.charges)}</span>`
                    : `<span style="color:#1A1A2E">${esc(r.charges)}</span>`}
                </td>
                <td style="text-align:right">
                  ${r.travauxAnomalie
                    ? `<span style="display:inline-block;padding:2px 8px;border-radius:6px;background:#FAEAEA;color:#B01A1A;font-weight:700;font-size:8.5pt">${esc(r.travaux)}</span>`
                    : `<span style="color:${r.travaux === '—' ? '#9A9AB0' : '#1A1A2E'}">${esc(r.travaux)}</span>`}
                </td>
                <td style="text-align:right">
                  ${r.tresorerieAnomalie
                    ? `<span style="display:inline-block;padding:2px 8px;border-radius:6px;background:#FAEAEA;color:#B01A1A;font-weight:700;font-size:8.5pt">${esc(r.tresorerie)}</span>`
                    : `<span style="color:#1A1A2E">${esc(r.tresorerie)}</span>`}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`
    }).join('')

    const sain = bilan.total - bilan.nbRisque - risk1count

    // ── Donut SVG ──────────────────────────────────────────────────────────
    const sainFaible = sain + risk1count
    const donutSegs = [
      { value: risk4count, color: '#B01A1A' },
      { value: risk3count, color: '#C05C1A' },
      { value: risk2count, color: '#C8A020' },
      { value: sainFaible, color: '#1A7A4A' },
    ].filter(s => s.value > 0)

    const donutSize = 140, dcx = 70, dcy = 70, dr = 50, dsw = 22
    let dAngle = -Math.PI / 2
    const donutArcs = bilan.total > 0 ? donutSegs.map(s => {
      const frac = s.value / bilan.total
      const gapRad = bilan.total > 1 && donutSegs.length > 1 ? 0.03 : 0
      const startA = dAngle + gapRad
      const endA   = dAngle + frac * 2 * Math.PI - gapRad
      dAngle += frac * 2 * Math.PI
      const x1 = dcx + dr * Math.cos(startA), y1 = dcy + dr * Math.sin(startA)
      const x2 = dcx + dr * Math.cos(endA),   y2 = dcy + dr * Math.sin(endA)
      const large = (frac * 2 * Math.PI - gapRad * 2) > Math.PI ? 1 : 0
      return `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${dr} ${dr} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${s.color}" stroke-width="${dsw}" stroke-linecap="butt"/>`
    }) : []

    const donutSVG = `<svg width="${donutSize}" height="${donutSize}" viewBox="0 0 ${donutSize} ${donutSize}" style="flex-shrink:0">
      <circle cx="${dcx}" cy="${dcy}" r="${dr}" fill="none" stroke="#ECECF2" stroke-width="${dsw}"/>
      ${donutArcs.join('\n      ')}
      <text x="${dcx}" y="${dcy - 4}" text-anchor="middle" font-size="19" font-weight="800" fill="${NAVY}" font-family="Helvetica Neue,Arial,sans-serif">${bilan.total}</text>
      <text x="${dcx}" y="${dcy + 13}" text-anchor="middle" font-size="8.5" fill="#9A9AB0" font-family="Helvetica Neue,Arial,sans-serif">copros</text>
    </svg>`

    // ── Distribution bars ──────────────────────────────────────────────────
    const distRows = [
      { label: 'Critique (4 anomalies)',  count: risk4count,  color: '#B01A1A' },
      { label: 'Élevé (3 anomalies)',     count: risk3count,  color: '#C05C1A' },
      { label: 'Modéré (2 anomalies)',    count: risk2count,  color: '#C8A020' },
      { label: 'Sain / Faible (0–1)',     count: sainFaible,  color: '#1A7A4A' },
    ]
    const distHTML = distRows.map(d => {
      const pct = bilan.total > 0 ? Math.round(d.count / bilan.total * 100) : 0
      const barW = Math.max(pct, d.count > 0 ? 2 : 0)
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
        <div style="display:flex;align-items:center;gap:7px;width:168px;flex-shrink:0">
          <div style="width:10px;height:10px;border-radius:50%;background:${d.color};flex-shrink:0"></div>
          <span style="font-size:8.5pt;color:#4A4A5A;font-weight:500">${d.label}</span>
        </div>
        <div style="flex:1;height:10px;border-radius:5px;background:#F0F0F6;overflow:hidden">
          <div style="width:${barW}%;height:100%;background:${d.color};border-radius:5px;min-width:${d.count > 0 ? '6px' : '0'}"></div>
        </div>
        <div style="width:36px;text-align:right;flex-shrink:0">
          <span style="font-size:8.5pt;font-weight:700;color:${d.count > 0 ? d.color : '#B0B0C8'}">${pct}%</span>
        </div>
      </div>`
    }).join('')

    bilanHTML = `
    <div class="page-break">
      <h1 class="section-title" style="font-size:12pt;color:${NAVY};border-bottom:2px solid ${GOLD};letter-spacing:0.06em">État financier des copropriétés</h1>
      <div class="card" style="border-left:4px solid ${bilanColor}">
        <div class="card-header">
          <span style="font-size:20pt;flex-shrink:0;line-height:1">📊</span>
          <div style="flex:1">
            <div style="font-size:12.5pt;font-weight:700;color:${NAVY};margin-bottom:6px">État financier des copropriétés</div>
            <div style="display:flex;align-items:center;gap:8px">${pill(bilanLvl)}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;padding:8px 16px;border-radius:8px;background:${bilanLvl === 'ok' ? '#EAF6EF' : '#FAEAEA'};border:1px solid ${bilanLvl === 'ok' ? '#A8D8BC' : '#F5AAAA'}">
            <div style="font-size:17pt;font-weight:800;color:${bilanColor};line-height:1">${bilan.nbRisque}</div>
            <div style="font-size:7pt;color:#9A9AB0;text-transform:uppercase;letter-spacing:0.06em;margin-top:3px">à risque</div>
          </div>
        </div>
        <div class="card-body">
          <div style="font-size:9.5pt;color:#6A6A82;font-style:italic;line-height:1.7;margin-bottom:18px">${esc(bilanInterpret)}</div>
          ${bilanNoteHtml}

          <!-- Donut + distribution -->
          <div style="display:flex;align-items:center;gap:28px;padding:16px 20px;border:1px solid ${BORDER};border-radius:10px;background:${CREAM};margin-top:${bilanNoteHtml ? '16px' : '0'}">
            ${donutSVG}
            <div style="flex:1">
              <div style="font-size:7.5pt;font-weight:700;color:#B0B0C8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px">Répartition des risques</div>
              ${distHTML}
            </div>
          </div>

          <div style="margin:22px 0 8px;font-size:7.5pt;font-weight:700;color:#B0B0C8;text-transform:uppercase;letter-spacing:0.1em">Détail par niveau de risque</div>
          ${groupsHTML}
        </div>
      </div>
    </div>`
  }

  // ── Final HTML ─────────────────────────────────────────────────────────────

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Rapport Audit V2 — ${esc(agence || '—')}</title>
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
