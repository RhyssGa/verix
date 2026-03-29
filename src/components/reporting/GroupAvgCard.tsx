'use client'

interface GroupAvgCardProps {
  groupAvg: number | null
  target: number
  entryCount: number
  onTargetChange: (value: number) => void
}

function niveauFromScore(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: 'Excellent', color: '#1A7A4A', bg: '#EAF6EF' }
  if (score >= 85) return { label: 'Bien', color: '#2A7A3A', bg: '#EAF6EF' }
  if (score >= 80) return { label: 'Satisfaisant', color: '#4A8A2A', bg: '#EAF6EF' }
  if (score >= 60) return { label: 'Vigilance', color: '#C05C1A', bg: '#FDF0E6' }
  return { label: 'Dégradé', color: '#B01A1A', bg: '#FAEAEA' }
}

export function GroupAvgCard({ groupAvg, target, entryCount, onTargetChange }: GroupAvgCardProps) {
  const niveau = groupAvg !== null ? niveauFromScore(groupAvg) : null
  const deltaTarget = groupAvg !== null ? Math.round((groupAvg - target) * 10) / 10 : null

  return (
    <div className="flex gap-4">
      {/* Moyenne groupe */}
      <div className="flex-1 bg-[#0B1929] rounded-[12px] px-6 py-5 flex flex-col gap-1">
        <div className="text-[11px] font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-[0.7px]">
          Moyenne groupe
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          {groupAvg !== null ? (
            <>
              <span className="text-[36px] font-extrabold text-[#C49A2E] leading-none">
                {groupAvg.toFixed(1)}
              </span>
              <span className="text-[14px] text-[rgba(255,255,255,0.4)] font-semibold">/100</span>
            </>
          ) : (
            <span className="text-[22px] font-bold text-[rgba(255,255,255,0.3)]">—</span>
          )}
        </div>
        {niveau && groupAvg !== null && (
          <div
            className="self-start mt-2 px-3 py-[3px] rounded-full text-[11px] font-bold"
            style={{ background: niveau.bg, color: niveau.color }}
          >
            {niveau.label}
          </div>
        )}
        <div className="text-[11px] text-[rgba(255,255,255,0.3)] mt-2">
          {entryCount} agence{entryCount > 1 ? 's' : ''} auditée{entryCount > 1 ? 's' : ''}
        </div>
      </div>

      {/* Objectif manuel */}
      <div className="flex-1 bg-white border border-[#E8E4DC] rounded-[12px] px-6 py-5 flex flex-col gap-1">
        <div className="text-[11px] font-semibold text-[#7A7A8C] uppercase tracking-[0.7px]">
          Objectif groupe
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <input
            type="number"
            min={0}
            max={100}
            value={target}
            onChange={(e) => {
              const v = Math.min(100, Math.max(0, Number(e.target.value)))
              onTargetChange(v)
            }}
            className="w-20 text-[32px] font-extrabold text-[#0B1929] leading-none bg-transparent border-none outline-none p-0"
          />
          <span className="text-[14px] text-[#7A7A8C] font-semibold">/100</span>
        </div>
        {deltaTarget !== null && (
          <div
            className={[
              'self-start mt-2 px-3 py-[3px] rounded-full text-[11px] font-bold',
              deltaTarget >= 0
                ? 'bg-[#EAF6EF] text-[#1A7A4A]'
                : 'bg-[#FAEAEA] text-[#B01A1A]',
            ].join(' ')}
          >
            {deltaTarget >= 0 ? '+' : '−'}{Math.abs(deltaTarget).toFixed(1)} vs objectif
          </div>
        )}
        <div className="text-[11px] text-[#7A7A8C] mt-2">
          Cible définie manuellement
        </div>
      </div>
    </div>
  )
}
