'use client'

import { useAuditStore } from '@/stores/useAuditStore'
import { AgencySelector } from '@/components/audit/AgencySelector'

interface ManualDataFormProps {
  mode: 'gerance' | 'copro'
}

export function ManualDataForm({ mode }: ManualDataFormProps) {
  const startDate = useAuditStore((s) => s.startDate)
  const endDate = useAuditStore((s) => s.endDate)
  const guarantee = useAuditStore((s) => s.guarantee)
  const peak = useAuditStore((s) => s.peak)
  const peakDate = useAuditStore((s) => s.peakDate)
  const mandateCount = useAuditStore((s) => s.mandateCount)
  const setStartDate = useAuditStore((s) => s.setStartDate)
  const setEndDate = useAuditStore((s) => s.setEndDate)
  const setGuarantee = useAuditStore((s) => s.setGuarantee)
  const setPeak = useAuditStore((s) => s.setPeak)
  const setPeakDate = useAuditStore((s) => s.setPeakDate)
  const setMandateCount = useAuditStore((s) => s.setMandateCount)

  return (
    <div className="flex flex-col gap-5">
      {/* Identification */}
      <div>
        <div className="text-[10px] font-semibold tracking-[0.8px] uppercase text-muted-foreground mb-3.5 pb-2 border-b border-border">

        </div>
        <AgencySelector />
        <div className="mt-4 mb-3">
          <label className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-[0.4px]">Début de période</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-[10px] py-2 border border-border rounded-[7px] font-[inherit] text-[13px] text-text bg-cream box-border" />
        </div>
        <div className="mb-3">
          <label className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-[0.4px]">Fin de période</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-[10px] py-2 border border-border rounded-[7px] font-[inherit] text-[13px] text-text bg-cream box-border" />
        </div>
      </div>

      {/* Données manuelles */}
      <div>
        <div className="text-[10px] font-semibold tracking-[0.8px] uppercase text-muted-foreground mb-3.5 pb-2 border-b border-border">
          Informations agences
          <div className="font-normal text-[9px] text-[#AAA] normal-case tracking-normal mt-[3px]">Modifications possibles</div>
        </div>
        <div className="mb-3">
          <label className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-[0.4px]">Garantie financière (€) ✏</label>
          <input type="number" value={guarantee || ''} onChange={(e) => setGuarantee(parseFloat(e.target.value) || 0)}
            placeholder="0" className="w-full px-[10px] py-2 border border-[#E8C840] rounded-[7px] font-[inherit] text-[13px] text-text bg-[#FFFCF0] box-border" />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-[0.4px]">Pointe (€) ✏</label>
            <input type="number" value={peak || ''} onChange={(e) => setPeak(parseFloat(e.target.value) || 0)}
              placeholder="0" className="w-full px-[10px] py-2 border border-[#E8C840] rounded-[7px] font-[inherit] text-[13px] text-text bg-[#FFFCF0] box-border" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-[0.4px]">Date pointe ✏</label>
            <input type="date" value={peakDate} onChange={(e) => setPeakDate(e.target.value)}
              className="w-full px-[10px] py-2 border border-[#E8C840] rounded-[7px] font-[inherit] text-[13px] text-text bg-[#FFFCF0] box-border" />
          </div>
        </div>
        {mode === 'gerance' && (
          <div className="mb-3">
            <label className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-[0.4px]">Nb mandats ✏</label>
            <input type="number" value={mandateCount || ''} onChange={(e) => setMandateCount(parseInt(e.target.value) || 0)}
              placeholder="0" className="w-full px-[10px] py-2 border border-[#E8C840] rounded-[7px] font-[inherit] text-[13px] text-text bg-[#FFFCF0] box-border" />
          </div>
        )}
      </div>
    </div>
  )
}
