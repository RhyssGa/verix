'use client'

import { useMemo, useState } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { useScore } from '@/stores/computed'
import { normalizeAgency } from '@/lib/utils/helpers'
import type { ReportEntry } from '@/types/audit'

function findCandidates(
  history: ReportEntry[],
  reportAgencies: string[],
  mode: 'gerance' | 'copro',
): ReportEntry[] {
  const normalizedSet = new Set(reportAgencies.map((a) => normalizeAgency(a)))

  const batchMap = new Map<string, ReportEntry>()
  for (const entry of history) {
    if (!batchMap.has(entry.batchId)) batchMap.set(entry.batchId, entry)
  }

  return Array.from(batchMap.values())
    .filter((e) => {
      if (e.mode !== mode) return false
      const entryAgencies = e.agence.split(' + ').map((s) => normalizeAgency(s.trim()))
      if (entryAgencies.length !== normalizedSet.size) return false
      return entryAgencies.every((a) => normalizedSet.has(a))
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return ts }
}

function fmtScore(s: number) {
  return s % 1 === 0 ? s.toFixed(0) : s.toFixed(1)
}

export function ComparisonPanel() {
  const score = useScore()
  const mode = useAuditStore((s) => s.mode)
  const reportHistory = useAuditStore((s) => s.reportHistory)
  const reportAgencies = useAuditStore((s) => s.reportAgencies)
  const agencies = useAuditStore((s) => s.agencies)
  const comparisonEnabled = useAuditStore((s) => s.comparisonEnabled)
  const setComparisonEnabled = useAuditStore((s) => s.setComparisonEnabled)

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const agencyList = reportAgencies.length > 0 ? reportAgencies : agencies.length === 0 ? [] : []

  const candidates = useMemo(
    () => findCandidates(reportHistory, agencyList, mode),
    [reportHistory, agencyList, mode],
  )

  const prev = useMemo(() => {
    if (candidates.length === 0) return null
    if (selectedId) return candidates.find((c) => c.id === selectedId) ?? candidates[0]
    return candidates[0]
  }, [candidates, selectedId])

  if (!score || candidates.length === 0) return null

  const delta = prev ? score.scoreGlobal - prev.scoreGlobal : 0
  const deltaStr = (delta >= 0 ? '+' : '') + delta.toFixed(1)
  const deltaPositive = delta > 0
  const deltaNeutral = delta === 0
  const deltaColor = deltaPositive ? '#1A7A4A' : deltaNeutral ? '#7A7A8C' : '#B01A1A'
  const deltaBg = deltaPositive ? '#EAF6EF' : deltaNeutral ? '#F2F2F2' : '#FAEAEA'
  const deltaArrow = deltaPositive ? '↑' : deltaNeutral ? '→' : '↓'

  const currentAnomalies = score.anomalies.filter((a) => !a.exclu && a.penalite > 0).length

  const sectionTitle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    color: '#7A7A8C',
    marginBottom: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  }

  return (
    <>
      <div style={sectionTitle}>
        <span>Comparaison audit précédent</span>
        <span style={{ flex: 1, height: 1, background: '#E8E4DC' }} />
      </div>

      <div style={{
        background: '#fff',
        border: '1px solid #E8E4DC',
        borderRadius: 14,
        overflow: 'hidden',
      }}>

        {/* Header : sélecteur + toggle PDF */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #F0EDE8',
          background: '#FAF8F4',
          gap: 12,
        }}>
          {candidates.length > 1 ? (
            <select
              value={selectedId ?? candidates[0]?.id ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{
                fontSize: 11,
                border: '1px solid #E8E4DC',
                borderRadius: 7,
                padding: '5px 8px',
                background: '#fff',
                color: '#1A1A2E',
                fontFamily: 'inherit',
                cursor: 'pointer',
                flex: 1,
                maxWidth: 320,
              }}
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatTs(c.timestamp)} — {fmtScore(c.scoreGlobal)}/100 · {c.niveau}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ fontSize: 11, color: '#7A7A8C' }}>
              Audit du <strong style={{ color: '#1A1A2E' }}>{prev ? formatTs(prev.timestamp) : '—'}</strong>
            </div>
          )}

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: '#7A7A8C',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}>
            <input
              type="checkbox"
              checked={comparisonEnabled}
              onChange={(e) => setComparisonEnabled(e.target.checked)}
              style={{ accentColor: '#0B1929', width: 13, height: 13 }}
            />
            Inclure dans le PDF
          </label>
        </div>

        {/* Corps */}
        {!comparisonEnabled ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            color: '#7A7A8C',
            fontSize: 12,
            gap: 8,
          }}>
            <span style={{ opacity: 0.4 }}>—</span>
            <span>Comparaison non incluse dans le rapport PDF</span>
            <span style={{ opacity: 0.4 }}>—</span>
          </div>
        ) : prev ? (
          <div style={{ padding: '20px 20px 16px' }}>

            {/* Scores : précédent → delta → actuel */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>

              {/* Score précédent */}
              <div style={{
                background: '#FAF8F4',
                border: '1px solid #E8E4DC',
                borderRadius: 10,
                padding: '14px 16px',
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#7A7A8C', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
                  Précédent
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#1A1A2E', lineHeight: 1 }}>
                  {fmtScore(prev.scoreGlobal)}
                  <span style={{ fontSize: 13, fontWeight: 400, color: '#7A7A8C' }}>/100</span>
                </div>
                <div style={{
                  display: 'inline-block',
                  marginTop: 6,
                  padding: '2px 8px',
                  borderRadius: 20,
                  fontSize: 10,
                  fontWeight: 600,
                  background: prev.niveau === 'Excellent' || prev.niveau === 'Bien' || prev.niveau === 'Satisfaisant' ? '#EAF6EF' : prev.niveau === 'Vigilance' ? '#FDF0E6' : '#FAEAEA',
                  color: prev.niveau === 'Excellent' || prev.niveau === 'Bien' || prev.niveau === 'Satisfaisant' ? '#1A7A4A' : prev.niveau === 'Vigilance' ? '#C05C1A' : '#B01A1A',
                }}>
                  {prev.niveau}
                </div>
                <div style={{ fontSize: 10, color: '#7A7A8C', marginTop: 4 }}>{formatTs(prev.timestamp)}</div>
              </div>

              {/* Delta */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: deltaBg,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1.5px solid ${deltaColor}33`,
                }}>
                  <span style={{ fontSize: 14, color: deltaColor }}>{deltaArrow}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: deltaColor, lineHeight: 1 }}>{deltaStr}</span>
                </div>
                <div style={{ fontSize: 9, color: '#7A7A8C', fontWeight: 600, letterSpacing: '0.3px' }}>pts</div>
              </div>

              {/* Score actuel */}
              <div style={{
                background: score.niveau.bg,
                border: `1px solid ${score.niveau.color}33`,
                borderRadius: 10,
                padding: '14px 16px',
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: score.niveau.color, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
                  Actuel
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#1A1A2E', lineHeight: 1 }}>
                  {fmtScore(score.scoreGlobal)}
                  <span style={{ fontSize: 13, fontWeight: 400, color: '#7A7A8C' }}>/100</span>
                </div>
                <div style={{
                  display: 'inline-block',
                  marginTop: 6,
                  padding: '2px 8px',
                  borderRadius: 20,
                  fontSize: 10,
                  fontWeight: 600,
                  background: 'rgba(255,255,255,0.6)',
                  color: score.niveau.color,
                }}>
                  {score.niveau.label}
                </div>
              </div>
            </div>

            {/* Stats bas */}
            {prev.nbAnomalies !== undefined && (
              <div style={{
                marginTop: 14,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}>
                <div style={{
                  background: '#FAF8F4',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 11, color: '#7A7A8C' }}>Anomalies</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E' }}>
                    {prev.nbAnomalies}
                    <span style={{ color: '#7A7A8C', fontWeight: 400, margin: '0 4px' }}>→</span>
                    <span style={{ color: currentAnomalies < prev.nbAnomalies ? '#1A7A4A' : currentAnomalies > prev.nbAnomalies ? '#B01A1A' : '#1A1A2E' }}>
                      {currentAnomalies}
                    </span>
                  </span>
                </div>
                <div style={{
                  background: '#FAF8F4',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 11, color: '#7A7A8C' }}>Pénalités</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E' }}>
                    {prev.totalPenalite.toFixed(1)}
                    <span style={{ color: '#7A7A8C', fontWeight: 400, margin: '0 4px' }}>→</span>
                    <span style={{ color: score.totalPenalite < prev.totalPenalite ? '#1A7A4A' : score.totalPenalite > prev.totalPenalite ? '#B01A1A' : '#1A1A2E' }}>
                      {score.totalPenalite.toFixed(1)}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  )
}
