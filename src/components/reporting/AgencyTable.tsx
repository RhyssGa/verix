'use client'

import { formatDelta } from '@/lib/reporting/aggregations'
import type { AgencyRow } from '@/lib/reporting/aggregations'

interface AgencyTableProps {
  rows: AgencyRow[]
  groupAvg: number | null
  target: number
}

function niveauStyle(niveau: string): { color: string; bg: string } {
  if (['Excellent', 'Bien', 'Satisfaisant'].includes(niveau)) return { color: '#1A7A4A', bg: '#EAF6EF' }
  if (niveau === 'Attention') return { color: '#C8A020', bg: '#FFFBEC' }
  if (niveau === 'Vigilance') return { color: '#C05C1A', bg: '#FDF0E6' }
  return { color: '#B01A1A', bg: '#FAEAEA' }
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null)
    return <span className="text-[#B0B0C8] text-[12px]">—</span>
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

function ScoreBar({ score, target }: { score: number; target: number }) {
  const targetPct = Math.min(100, target)
  const barColor = score >= 80 ? '#1A7A4A' : score >= 70 ? '#C8A020' : score >= 60 ? '#C05C1A' : '#B01A1A'
  return (
    <div className="relative w-full flex items-center" style={{ height: '20px' }}>
      {/* Barre de fond + remplissage */}
      <div className="relative w-full h-[8px] bg-[#F0EDE8] rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${score}%`, background: barColor }}
        />
      </div>
      {/* Marqueur objectif — dépasse la barre, doré */}
      <div
        className="absolute rounded-sm"
        style={{
          left: `${targetPct}%`,
          transform: 'translateX(-50%)',
          top: 0,
          bottom: 0,
          width: '3px',
          background: '#C49A2E',
          boxShadow: '0 0 4px rgba(196,154,46,0.6)',
        }}
      />
    </div>
  )
}

export function AgencyTable({ rows, groupAvg, target }: AgencyTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#B0B0C8]">
        <div className="text-[32px] mb-3">📭</div>
        <div className="text-[14px] font-semibold">Aucun audit sur ce trimestre</div>
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
              Score
            </th>
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-[#7A7A8C] uppercase tracking-[0.6px]">
              Niveau
            </th>
            <th className="text-center py-3 px-4 text-[11px] font-semibold text-[#7A7A8C] uppercase tracking-[0.6px]">
              Anomalies
            </th>
            <th className="text-center py-3 px-4 text-[11px] font-semibold text-[#7A7A8C] uppercase tracking-[0.6px]">
              Δ Groupe
            </th>
            <th className="text-center py-3 px-4 text-[11px] font-semibold text-[#7A7A8C] uppercase tracking-[0.6px]">
              Δ Trim. préc.
            </th>
            <th className="py-3 px-4 text-[11px] font-semibold text-[#7A7A8C] uppercase tracking-[0.6px] min-w-[100px]">
              Jauge
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const ns = niveauStyle(row.niveau)
            return (
              <tr
                key={row.agence + i}
                className="border-b border-[#F0EDE8] hover:bg-[#FAF8F4] transition-colors"
              >
                <td className="py-3 px-4 text-[13px] font-semibold text-[#1A1A2E]">
                  {row.agence}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="text-[20px] font-extrabold text-[#0B1929]">
                    {row.scoreGlobal.toFixed(1)}
                  </span>
                  {groupAvg !== null && (
                    <span className="text-[10px] text-[#B0B0C8] ml-1">/100</span>
                  )}
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
                <td className="py-3 px-4 text-center">
                  <DeltaBadge delta={row.deltaPrev} />
                </td>
                <td className="py-3 px-4">
                  <ScoreBar score={row.scoreGlobal} target={target} />
                </td>
              </tr>
            )
          })}
        </tbody>
        {groupAvg !== null && (
          <tfoot>
            <tr className="border-t-2 border-[#E8E4DC] bg-[#FAF8F4]">
              <td className="py-3 px-4 text-[12px] font-bold text-[#7A7A8C] uppercase tracking-[0.5px]">
                Moyenne groupe
              </td>
              <td className="py-3 px-4 text-center">
                <span className="text-[18px] font-extrabold text-[#C49A2E]">{groupAvg.toFixed(1)}</span>
                <span className="text-[10px] text-[#B0B0C8] ml-1">/100</span>
              </td>
              <td colSpan={5} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
