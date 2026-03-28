'use client'

import { useAuditStore } from '@/stores/useAuditStore'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { truncate } from '@/lib/utils/format'

export function FinancialStateModal() {
  const modal = useAuditStore((s) => s.financialStateModal)
  const close = useAuditStore((s) => s.closeFinancialStateModal)

  if (!modal.open) return null

  return (
    <Dialog open={modal.open} onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-border flex-shrink-0">
          <DialogTitle className="text-sm font-semibold">{modal.title}</DialogTitle>
          <p className="text-[11px] text-muted-foreground">{modal.rows.length} copropriété(s)</p>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
          {modal.rows.map((r, i) => {
            const vCop = parseFloat(String(r[11] ?? 0)) || 0
            const vChrg = parseFloat(String(r[16] ?? 0)) || 0
            const vTvx = r[18] != null && !isNaN(Number(r[18])) ? (parseFloat(String(r[18])) || 0) : null
            const vBq = parseFloat(String(r[25] ?? 0)) || 0
            const pct = (v: number) => `${(v * 100).toFixed(0)}%`

            const kpi = (val: string, bad: boolean, label: string, seuil: string, na = false) => (
              <div className={cn(
                'flex flex-col items-center px-3 py-2 rounded-lg flex-1 min-w-[70px]',
                na ? 'bg-border/30' : bad ? 'bg-status-red-bg' : 'bg-status-green-bg',
              )}>
                <span className={cn('text-lg font-bold',
                  na ? 'text-muted-foreground' : bad ? 'text-status-red' : 'text-status-green',
                )}>{val}</span>
                <span className="text-[10px] text-muted-foreground text-center mt-0.5">{label}</span>
                <span className={cn('text-[9px] mt-0.5',
                  na ? 'text-muted-foreground' : bad ? 'text-status-red' : 'text-status-green',
                )}>{na ? 'n/a' : `seuil ${seuil}`}</span>
              </div>
            )

            return (
              <div key={i} className="border border-border rounded-lg p-3">
                <div className="font-semibold text-sm mb-2">
                  {truncate(String(r[1] || '—').replace(/^\d+-/, ''), 40)}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {kpi(pct(vCop), vCop > 0.3, 'Impayés', '30%')}
                  {kpi(pct(vChrg), vChrg > 1.0, 'Charges', '100%')}
                  {kpi(vTvx != null ? pct(vTvx) : '—', vTvx != null && vTvx > 1.0, 'Travaux', '100%', vTvx == null)}
                  {kpi(pct(vBq), vBq < 1.0, 'Trésorerie', '100%')}
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
