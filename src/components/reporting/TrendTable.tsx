'use client'

import type { TrendRow } from '@/lib/reporting/aggregations'

interface TrendTableProps {
  rows: TrendRow[]
  year: number
}

function scoreColor(score: number | null): string {
  if (score === null) return '#B0B0C8'
  if (score >= 80) return '#1A7A4A'
  if (score >= 70) return '#C8A020'
  if (score >= 60) return '#C05C1A'
  return '#B01A1A'
}

function scoreBg(score: number | null): string {
  if (score === null) return 'transparent'
  if (score >= 80) return '#EAF6EF'
  if (score >= 70) return '#FFFBEC'
  if (score >= 60) return '#FDF0E6'
  return '#FAEAEA'
}

const QUARTER_LABELS = ['Q1 — Mars', 'Q2 — Juin', 'Q3 — Sept.', 'Q4 — Déc.']

export function TrendTable({ rows, year }: TrendTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-[#B0B0C8]">
        <div className="text-[13px]">Aucune donnée pour {year}</div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-[#E8E4DC]">
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-[#7A7A8C] uppercase tracking-[0.6px]">
              Agence
            </th>
            {QUARTER_LABELS.map((label, i) => (
              <th
                key={i}
                className="text-center py-3 px-4 text-[11px] font-semibold text-[#7A7A8C] uppercase tracking-[0.6px]"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={row.agence + ri}
              className="border-b border-[#F0EDE8] hover:bg-[#FAF8F4] transition-colors"
            >
              <td className="py-3 px-4 text-[13px] font-semibold text-[#1A1A2E]">
                {row.agence}
              </td>
              {([1, 2, 3, 4] as const).map((q) => {
                const score = row.scores[q]
                return (
                  <td key={q} className="py-3 px-4 text-center">
                    {score !== null ? (
                      <span
                        className="inline-block px-[10px] py-[3px] rounded-full text-[13px] font-bold"
                        style={{ background: scoreBg(score), color: scoreColor(score) }}
                      >
                        {score.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-[#D0D0DC] text-[13px]">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
