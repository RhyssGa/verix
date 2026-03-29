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
          <table className="w-full border-collapse table-fixed">
            {/* En-têtes */}
            <thead>
              <tr className="bg-[#FAF8F4] border-b-2 border-[#E8E4DC]">
                <th className="text-left px-4 py-[10px] text-[11px] font-semibold text-[#7A7A8C] tracking-[0.6px] uppercase w-[36%]">
                  Copropriété
                </th>
                {COLS.map((col) => (
                  <th key={col.key} className="text-center px-2 py-[10px] text-[11px] font-semibold text-[#7A7A8C] tracking-[0.6px] uppercase w-[16%]">
                    <div>{col.label}</div>
                    <div className="text-[9px] font-normal text-[#AAA] mt-px">seuil {col.seuil}</div>
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
                  <tr key={i} className="border-b border-[#F0EDE8]">
                    {/* Nom */}
                    <td className="px-4 py-[10px]">
                      <span className="text-[12px] font-medium text-[#1A1A2E]">
                        {truncate(String(r[1] || '—').replace(/^\d+-/, ''), 40)}
                      </span>
                    </td>

                    {/* Cases % */}
                    {cells.map((cell, j) => {
                      const s = LEVEL_STYLES[cell.level]
                      return (
                        <td key={j} className="p-2 text-center">
                          <div
                            className="inline-flex items-center justify-center rounded-[8px] px-3 py-1.5 text-[13px] font-extrabold min-w-[68px]"
                            style={{
                              background: s.bg,
                              border: `2px solid ${s.border}`,
                              color: s.text,
                              boxShadow: `0 1px 4px ${s.border}33`,
                            }}
                          >
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
