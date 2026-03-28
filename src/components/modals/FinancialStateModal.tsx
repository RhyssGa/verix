'use client'

import { useAuditStore } from '@/stores/useAuditStore'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { truncate } from '@/lib/utils/format'

function getLevel(type: 'impayes' | 'charges' | 'travaux' | 'tresorerie', v: number): 'ok' | 'warn' | 'bad' {
  if (type === 'tresorerie') {
    if (v >= 1.0) return 'ok'
    if (v >= 0.8) return 'warn'
    return 'bad'
  }
  if (type === 'impayes') {
    if (v <= 0.15) return 'ok'
    if (v <= 0.30) return 'warn'
    return 'bad'
  }
  if (v <= 0.70) return 'ok'
  if (v <= 1.00) return 'warn'
  return 'bad'
}

const LEVEL_STYLES = {
  ok:   { bg: '#C8EDD8', border: '#1A7A4A', text: '#0F5530' },
  warn: { bg: '#FCDDB8', border: '#C05C1A', text: '#8A3D0A' },
  bad:  { bg: '#F5BABA', border: '#B01A1A', text: '#7A0A0A' },
  na:   { bg: '#EBEBEB', border: '#C8C8C8', text: '#7A7A8C' },
}

const COLS = [
  { key: 'impayes',    label: 'Impayés',    seuil: '> 30 %',  type: 'impayes'    as const },
  { key: 'charges',    label: 'Charges',    seuil: '> 100 %', type: 'charges'    as const },
  { key: 'travaux',    label: 'Travaux',    seuil: '> 100 %', type: 'travaux'    as const },
  { key: 'tresorerie', label: 'Trésorerie', seuil: '< 100 %', type: 'tresorerie' as const },
]

export function FinancialStateModal() {
  const modal = useAuditStore((s) => s.financialStateModal)
  const close = useAuditStore((s) => s.closeFinancialStateModal)

  if (!modal.open) return null

  return (
    <Dialog open={modal.open} onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border flex-shrink-0">
          <DialogTitle className="text-sm font-semibold">{modal.title}</DialogTitle>
          <p className="text-[11px] text-muted-foreground">{modal.rows.length} copropriété(s)</p>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            {/* En-têtes */}
            <thead>
              <tr style={{ background: '#FAF8F4', borderBottom: '2px solid #E8E4DC' }}>
                <th style={{
                  textAlign: 'left',
                  padding: '10px 16px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#7A7A8C',
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                  width: '36%',
                }}>
                  Copropriété
                </th>
                {COLS.map((col) => (
                  <th key={col.key} style={{
                    textAlign: 'center',
                    padding: '10px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#7A7A8C',
                    letterSpacing: '0.6px',
                    textTransform: 'uppercase',
                    width: '16%',
                  }}>
                    <div>{col.label}</div>
                    <div style={{ fontSize: 9, fontWeight: 400, color: '#AAA', marginTop: 1 }}>seuil {col.seuil}</div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Lignes */}
            <tbody>
              {modal.rows.map((r, i) => {
                const sr = (raw: unknown) => { const v = parseFloat(String(raw ?? '')); return isNaN(v) || v < 0 || v > 50 ? null : v }
                const vCop  = sr(r[11]) ?? 0
                const vChrg = sr(r[16]) ?? 0
                const vTvx  = r[18] != null && !isNaN(Number(r[18])) ? sr(r[18]) : null
                const vBq   = sr(r[25]) ?? 0
                const pct   = (v: number) => `${(v * 100).toFixed(0)} %`

                const cells = [
                  { value: pct(vCop),  level: getLevel('impayes',    vCop) },
                  { value: pct(vChrg), level: getLevel('charges',    vChrg) },
                  { value: vTvx != null ? pct(vTvx) : 'N/A', level: vTvx != null ? getLevel('travaux', vTvx) : 'na' as const },
                  { value: pct(vBq),   level: getLevel('tresorerie', vBq) },
                ]

                return (
                  <tr key={i} style={{ borderBottom: '1px solid #F0EDE8' }}>
                    {/* Nom */}
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#1A1A2E' }}>
                        {truncate(String(r[1] || '—').replace(/^\d+-/, ''), 40)}
                      </span>
                    </td>

                    {/* Cases % */}
                    {cells.map((cell, j) => {
                      const s = LEVEL_STYLES[cell.level]
                      return (
                        <td key={j} style={{ padding: '8px', textAlign: 'center' }}>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: s.bg,
                            border: `2px solid ${s.border}`,
                            borderRadius: 8,
                            padding: '6px 12px',
                            fontSize: 13,
                            fontWeight: 800,
                            color: s.text,
                            minWidth: 68,
                            boxShadow: `0 1px 4px ${s.border}33`,
                          }}>
                            {cell.value}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
