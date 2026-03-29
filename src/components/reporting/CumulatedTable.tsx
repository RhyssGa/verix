'use client'

import { formatDelta } from '@/lib/reporting/aggregations'
import type { CumulatedRow } from '@/lib/reporting/aggregations'

interface CumulatedTableProps {
  rows: CumulatedRow[]
  groupAvg: number | null
}

const QUARTER_LABELS: Record<number, string> = {
  1: 'Q1 — Mars',
  2: 'Q2 — Juin',
  3: 'Q3 — Sept.',
  4: 'Q4 — Déc.',
}

function niveauStyle(niveau: string): { color: string; bg: string } {
  if (['Excellent', 'Bien', 'Satisfaisant'].includes(niveau)) return { color: '#1A7A4A', bg: '#EAF6EF' }
  if (niveau === 'Vigilance') return { color: '#C05C1A', bg: '#FDF0E6' }
  return { color: '#B01A1A', bg: '#FAEAEA' }
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-[#B0B0C8] text-[12px]">—</span>
  const positive = delta >= 0
  return (
    <span
      className={[
        'inline-block px-[8px] py-[2px] rounded-full text-[11px] font-bold',
        positive ? 'bg-[#EAF6EF] text-[#1A7A4A]' : 'bg-[#FAEAEA] text-[#B01A1A]',
      ].join(' ')}
    >
      {formatDelta(delta)}
    </span>
  )
}

export function CumulatedTable({ rows, groupAvg }: CumulatedTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#B0B0C8]">
        <div className="text-[32px] mb-3">📭</div>
        <div className="text-[14px] font-semibold">Aucun audit disponible</div>
        <div className="text-[12px] mt-1">Modifie les filtres pour voir des résultats</div>
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
            <th className="text-center py-3 px-4 text-[11px] font-semibold text-[#7A7A8C] uppercase tracking-[0.6px]">
              Période
            </th>
            <th className="text-center py-3 px-4 text-[11px] font-semibold text-[#7A7A8C] uppercase tracking-[0.6px]">
              Score
            </th>
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-[#7A7A8C] uppercase tracking-[0.6px]">
              Niveau
            </th>
            <th className="text-center py-3 px-4 text-[11px] font-semibold text-[#7A7A8C] uppercase tracking-[0.6px]">
              Anomalies
            </th>
            <th className="text-center py-3 px-4 text-[11px] font-semibold text-[#7A7A8C] uppercase tracking-[0.6px]">
              Δ Moyenne
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const ns = niveauStyle(row.niveau)
            const periodLabel = `${QUARTER_LABELS[row.quarter]} ${row.year}`
            return (
              <tr
                key={`${row.agence}-${row.year}-${row.quarter}`}
                className={[
                  'border-b border-[#F0EDE8] hover:bg-[#FAF8F4] transition-colors',
                  i > 0 && rows[i - 1].year !== row.year ? 'border-t-2 border-t-[#E8E4DC]' : '',
                ].join(' ')}
              >
                <td className="py-3 px-4 text-[13px] font-semibold text-[#1A1A2E]">
                  {row.agence}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-block px-[10px] py-[3px] rounded-full text-[11px] font-bold bg-[#F0EDE8] text-[#7A7A8C]">
                    {periodLabel}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="text-[20px] font-extrabold text-[#0B1929]">
                    {row.scoreGlobal.toFixed(1)}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span
                    className="inline-block px-[10px] py-[3px] rounded-full text-[11px] font-bold"
                    style={{ background: ns.bg, color: ns.color }}
                  >
                    {row.niveau}
                  </span>
                </td>
                <td className="py-3 px-4 text-center text-[13px] font-semibold text-[#1A1A2E]">
                  {row.nbAnomalies}
                </td>
                <td className="py-3 px-4 text-center">
                  <DeltaBadge delta={row.deltaGroupe} />
                </td>
              </tr>
            )
          })}
        </tbody>
        {groupAvg !== null && (
          <tfoot>
            <tr className="border-t-2 border-[#E8E4DC] bg-[#FAF8F4]">
              <td className="py-3 px-4 text-[12px] font-bold text-[#7A7A8C] uppercase tracking-[0.5px]">
                Moyenne cumulée
              </td>
              <td className="py-3 px-4 text-center text-[11px] text-[#B0B0C8]">
                {rows.length} audit{rows.length > 1 ? 's' : ''}
              </td>
              <td className="py-3 px-4 text-center text-[18px] font-extrabold text-[#C49A2E]">
                {groupAvg.toFixed(1)}
              </td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
