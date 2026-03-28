'use client'

import type { ExcelRow } from '@/types/audit'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SectionNote } from '@/components/shared/SectionNote'
import { truncate } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

interface FinancialStateCardProps {
  bilan: ExcelRow[]
  onOpenGroup?: (title: string, rows: ExcelRow[]) => void
}

function countAnomalies(r: ExcelRow): number {
  const vCop = parseFloat(String(r[11] ?? 0)) || 0
  const vChrg = parseFloat(String(r[16] ?? 0)) || 0
  const vTvx =
    r[18] != null && !isNaN(Number(r[18])) ? (parseFloat(String(r[18])) || 0) : null
  const vBq = parseFloat(String(r[25] ?? 0)) || 0
  let n = 0
  if (vCop > 0.3) n++
  if (vChrg > 1.0) n++
  if (vTvx != null && vTvx > 1.0) n++
  if (vBq < 1.0) n++
  return n
}

interface RiskRowsProps {
  rows: ExcelRow[]
}

function RiskRowHeader() {
  return (
    <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-normal py-0.5 px-1">
      <span className="flex-1">Résidence</span>
      <span className="w-12 text-right">Lots</span>
      {['Impayés', 'Charges', 'Travaux', 'Trésor.'].map((h) => (
        <span key={h} className="w-10 text-center">
          {h}
        </span>
      ))}
    </div>
  )
}

function RiskRows({ rows }: RiskRowsProps) {
  return (
    <>
      {rows.slice(0, 6).map((r, idx) => {
        const vCop = parseFloat(String(r[11] ?? 0)) || 0
        const vChrg = parseFloat(String(r[16] ?? 0)) || 0
        const vTvx =
          r[18] != null && !isNaN(Number(r[18]))
            ? (parseFloat(String(r[18])) || 0)
            : null
        const vBq = parseFloat(String(r[25] ?? 0)) || 0
        const pct = (v: number) => `${(v * 100).toFixed(0)}%`

        return (
          <div key={idx} className="flex items-center gap-1 text-[10px] py-0.5 px-1">
            <span className="flex-1 truncate" title={String(r[1] || '')}>
              {truncate(String(r[1] || '—').replace(/^\d+-/, ''), 28)}
            </span>
            <span className="w-12 text-right text-muted-foreground">{r[4] || '?'} lots</span>
            <span
              className={cn(
                'w-10 text-center font-medium',
                vCop > 0.3 ? 'text-status-red' : 'text-status-green',
              )}
              title="Impayés copropriétaires — seuil 30 %"
            >
              {pct(vCop)}
            </span>
            <span
              className={cn(
                'w-10 text-center font-medium',
                vChrg > 1.0 ? 'text-status-red' : 'text-status-green',
              )}
              title="Charges / Provisions — seuil 100 %"
            >
              {pct(vChrg)}
            </span>
            <span
              className={cn(
                'w-10 text-center font-medium',
                vTvx != null
                  ? vTvx > 1.0
                    ? 'text-status-red'
                    : 'text-status-green'
                  : 'text-muted-foreground',
              )}
              title="Dépassement travaux — seuil 100 %"
            >
              {vTvx != null ? pct(vTvx) : '—'}
            </span>
            <span
              className={cn(
                'w-10 text-center font-medium',
                vBq < 1.0 ? 'text-status-red' : 'text-status-green',
              )}
              title="Trésorerie — seuil 100 %"
            >
              {pct(vBq)}
            </span>
          </div>
        )
      })}
    </>
  )
}

export function FinancialStateCard({ bilan, onOpenGroup }: FinancialStateCardProps) {
  if (!bilan.length) {
    return (
      <Card className="shadow-card col-span-full">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg bg-status-orange-bg">
              📊
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">État financier des copropriétés</div>
              <div className="text-[11px] text-muted-foreground">Bilan / Position mandats</div>
            </div>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-border text-muted-foreground border border-border">
              —
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-xs text-muted-foreground py-2">
            Déposez le fichier <strong>Bilan / État financier</strong> pour afficher
            l&apos;analyse du portefeuille.
          </div>
        </CardContent>
      </Card>
    )
  }

  const risk4 = bilan.filter((r) => countAnomalies(r) === 4)
  const risk3 = bilan.filter((r) => countAnomalies(r) === 3)
  const risk2 = bilan.filter((r) => countAnomalies(r) === 2)
  const risk1 = bilan.filter((r) => countAnomalies(r) === 1)
  const risk0 = bilan.filter((r) => countAnomalies(r) === 0)
  const total = bilan.length
  const nbRisque = risk4.length + risk3.length + risk2.length

  const nCop = bilan.filter((r) => (parseFloat(String(r[11] ?? 0)) || 0) > 0.3).length
  const nChrg = bilan.filter((r) => (parseFloat(String(r[16] ?? 0)) || 0) > 1.0).length
  const nTvx = bilan.filter(
    (r) =>
      r[18] != null && !isNaN(Number(r[18])) && (parseFloat(String(r[18])) || 0) > 1.0,
  ).length
  const nBq = bilan.filter((r) => (parseFloat(String(r[25] ?? 0)) || 0) < 1.0).length

  const level =
    risk4.length > 0 ? 'bad' : risk3.length > 0 ? 'warn' : risk2.length > 0 ? 'warn' : 'ok'

  const segments = [
    { n: risk0.length, color: '#1A7A4A', label: 'Sain' },
    { n: risk1.length, color: '#4A8A2A', label: '1 anomalie' },
    { n: risk2.length, color: '#C05C1A', label: '2 anomalies' },
    { n: risk3.length, color: '#E07020', label: '3 anomalies' },
    { n: risk4.length, color: '#B01A1A', label: '4 anomalies' },
  ].filter((s) => s.n > 0)

  const freqData = [
    { label: 'Impayés copropriétaires', sub: '> 30\u202f% des appels de fonds', n: nCop },
    { label: 'Surcharge des provisions', sub: 'Charges > 100\u202f% des provisions', n: nChrg },
    { label: 'Dépassement travaux', sub: 'Travaux > 100\u202f% des appels', n: nTvx },
    {
      label: 'Découvert trésorerie',
      sub: 'Trésorerie < 100\u202f% du fonds permanent',
      n: nBq,
    },
  ]

  const riskGroups = [
    {
      rows: risk4,
      label: '⚠⚠ Risque ++++ — 4 anomalies',
      colorClass: 'text-status-red bg-status-red-bg border-status-red/20',
    },
    {
      rows: risk3,
      label: '⚠ Risque +++ — 3 anomalies',
      colorClass: 'text-status-orange bg-status-orange-bg border-status-orange/20',
    },
    {
      rows: risk2,
      label: 'Risque ++ — 2 anomalies',
      colorClass: 'text-status-orange bg-status-orange-bg border-status-orange/20',
    },
  ].filter((g) => g.rows.length > 0)

  return (
    <Card className="shadow-card col-span-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg bg-status-orange-bg">
            📊
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">État financier des copropriétés</div>
            <div className="text-[11px] text-muted-foreground">
              {total} copropriété(s) · {nbRisque} à risque (≥2 anomalies)
            </div>
          </div>
          <StatusBadge level={level} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Portfolio distribution label */}
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
          Répartition du portefeuille
        </div>

        {/* Bar chart */}
        <div className="h-5 rounded-md overflow-hidden flex mb-2">
          {segments.map((s, idx) => (
            <div
              key={idx}
              style={{
                width: `${((s.n / total) * 100).toFixed(1)}%`,
                background: s.color,
              }}
              title={`${s.label} : ${s.n} (${((s.n / total) * 100).toFixed(1)}%)`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mb-4">
          {segments.map((s, idx) => (
            <span key={idx} className="flex items-center gap-1 text-[10px]">
              <span
                className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0"
                style={{ background: s.color }}
              />
              {s.label} : <b>{s.n}</b>
            </span>
          ))}
        </div>

        <div className="border-t border-border my-3" />

        {/* Frequency by anomaly type */}
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-3">
          Fréquence par type d&apos;anomalie
        </div>
        {freqData.map((f, idx) => {
          const fpct = total > 0 ? (f.n / total) * 100 : 0
          const color = f.n > 0 ? '#B01A1A' : '#1A7A4A'
          return (
            <div key={idx} className="mb-2.5">
              <div className="flex justify-between items-baseline mb-0.5">
                <div>
                  <span className="text-[11px] font-semibold">{f.label}</span>
                  <span className="text-[10px] text-muted-foreground ml-1.5">{f.sub}</span>
                </div>
                <span
                  className="text-xs font-bold flex-shrink-0 ml-2"
                  style={{ color }}
                >
                  {f.n} / {total}
                </span>
              </div>
              <div className="bg-border rounded h-2 overflow-hidden">
                <div
                  className="h-full rounded transition-all"
                  style={{ width: `${fpct.toFixed(0)}%`, background: color }}
                />
              </div>
            </div>
          )
        })}

        {/* Risk groups (≥2 anomalies) */}
        {nbRisque > 0 && (
          <>
            <div className="border-t border-border my-3" />
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
              Détail — copropriétés à risque (≥2 anomalies)
            </div>
            {riskGroups.map((g) => (
              <div key={g.label} className="mb-3">
                <div
                  className={cn(
                    'text-[11px] font-semibold px-2 py-1 rounded mb-1 border',
                    g.colorClass,
                  )}
                >
                  {g.label} — {g.rows.length} copropriété(s)
                </div>
                <RiskRowHeader />
                <RiskRows rows={g.rows} />
                {g.rows.length > 6 && onOpenGroup && (
                  <button
                    className="text-[11px] text-navy-light mt-1 hover:underline"
                    onClick={() => onOpenGroup(g.label, g.rows)}
                  >
                    → Voir les {g.rows.length}
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {/* Risk +1 (informational) */}
        {risk1.length > 0 && (
          <div className="mb-3">
            <div className="text-[11px] font-semibold px-2 py-1 rounded mb-1 border bg-status-green-bg text-status-green border-status-green/20">
              Risque + — 1 anomalie — {risk1.length} copropriété(s)
            </div>
            <RiskRowHeader />
            <RiskRows rows={risk1} />
            {risk1.length > 6 && onOpenGroup && (
              <button
                className="text-[11px] text-navy-light mt-1 hover:underline"
                onClick={() => onOpenGroup('Risque + — 1 anomalie', risk1)}
              >
                → Voir les {risk1.length}
              </button>
            )}
          </div>
        )}

        {nbRisque === 0 && risk1.length === 0 && (
          <div className="text-xs text-status-green pt-1">
            ✓ Aucune copropriété avec anomalie
          </div>
        )}

        <SectionNote sectionId="bilan" />
      </CardContent>
    </Card>
  )
}
