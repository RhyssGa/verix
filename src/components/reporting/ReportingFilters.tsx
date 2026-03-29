'use client'

import type { Quarter } from '@/lib/reporting/quarters'

interface ReportingFiltersProps {
  years: number[]
  year: number
  quarter: Quarter
  mode: 'gerance' | 'copro'
  onYearChange: (year: number) => void
  onQuarterChange: (quarter: Quarter) => void
  onModeChange: (mode: 'gerance' | 'copro') => void
}

const selectClass =
  'px-3 py-[7px] text-[13px] border border-[#E8E4DC] rounded-[8px] bg-white text-[#1A1A2E] font-[inherit] cursor-pointer focus:outline-none focus:border-[#C49A2E]'

export function ReportingFilters({
  years,
  year,
  quarter,
  mode,
  onYearChange,
  onQuarterChange,
  onModeChange,
}: ReportingFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold text-[#7A7A8C] uppercase tracking-[0.6px]">
          Année
        </span>
        <select
          className={selectClass}
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
          {years.length === 0 && <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold text-[#7A7A8C] uppercase tracking-[0.6px]">
          Trimestre
        </span>
        <select
          className={selectClass}
          value={quarter}
          onChange={(e) => onQuarterChange(Number(e.target.value) as Quarter)}
        >
          <option value={1}>Q1 — Fin mars</option>
          <option value={2}>Q2 — Fin juin</option>
          <option value={3}>Q3 — Fin septembre</option>
          <option value={4}>Q4 — Fin décembre</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold text-[#7A7A8C] uppercase tracking-[0.6px]">
          Mode
        </span>
        <div className="flex rounded-[8px] border border-[#E8E4DC] overflow-hidden">
          {(['gerance', 'copro'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={[
                'px-3 py-[7px] text-[13px] font-semibold transition-colors',
                mode === m
                  ? 'bg-[#0B1929] text-[#C49A2E]'
                  : 'bg-white text-[#7A7A8C] hover:bg-[#FAF8F4]',
              ].join(' ')}
            >
              {m === 'gerance' ? 'Gérance' : 'Copropriété'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
