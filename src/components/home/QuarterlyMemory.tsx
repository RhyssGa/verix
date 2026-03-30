'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getQuarter, getPreviousQuarter, type QuarterRef } from '@/lib/reporting/quarters'

interface AgencyStatus {
  agence: string
  status: 'a_faire' | 'import_valide' | 'audit_fait'
  lastImportAt: string | null
  lastAuditAt: string | null
}

interface MemoryResponse {
  year: number
  quarter: number
  mode: string
  agencies: AgencyStatus[]
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch {
    return ''
  }
}

const STATUS_CONFIG = {
  audit_fait:    { label: 'Audit fait',    dot: '#1A7A4A', bg: 'rgba(26,122,74,0.12)',   text: '#1A7A4A' },
  import_valide: { label: 'Import validé', dot: '#C49A2E', bg: 'rgba(196,154,46,0.12)',  text: '#A87E20' },
  a_faire:       { label: 'À faire',       dot: '#7A7A8C', bg: 'rgba(122,122,140,0.10)', text: '#7A7A8C' },
}

function isSameQuarter(a: QuarterRef, b: QuarterRef) {
  return a.year === b.year && a.quarter === b.quarter
}

function prevQuarter(q: QuarterRef): QuarterRef {
  return getPreviousQuarter(q)
}

function nextQuarter(q: QuarterRef): QuarterRef {
  if (q.quarter === 4) return { year: q.year + 1, quarter: 1 }
  return { year: q.year, quarter: (q.quarter + 1) as 1 | 2 | 3 | 4 }
}

export function QuarterlyMemory() {
  const currentQ = useMemo(() => getQuarter(new Date()), [])

  const [activeMode, setActiveMode] = useState<'gerance' | 'copro'>('gerance')
  const [selectedQ, setSelectedQ] = useState<QuarterRef>(currentQ)
  const [data, setData] = useState<MemoryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [filterStatus, setFilterStatus] = useState<keyof typeof STATUS_CONFIG | null>(null)

  const isCurrentQ = isSameQuarter(selectedQ, currentQ)

  const load = useCallback(async (mode: 'gerance' | 'copro', q: QuarterRef) => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/memory?mode=${mode}&year=${q.year}&quarter=${q.quarter}`)
      if (!res.ok) throw new Error()
      const json: MemoryResponse = await res.json()
      setData(json)
    } catch {
      setError(true)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setFilterStatus(null)
    load(activeMode, selectedQ)
  }, [activeMode, selectedQ, load])

  const counts = data ? {
    audit_fait:    data.agencies.filter(a => a.status === 'audit_fait').length,
    import_valide: data.agencies.filter(a => a.status === 'import_valide').length,
    a_faire:       data.agencies.filter(a => a.status === 'a_faire').length,
  } : null

  const visibleAgencies = data
    ? (filterStatus ? data.agencies.filter(a => a.status === filterStatus) : data.agencies)
    : []

  return (
    <div style={{
      width: '100%',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(196,154,46,0.18)',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        {/* Titre + navigation trimestre */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#C49A2E' }}>
            Mémoire trimestrielle
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Flèche précédent */}
            <button
              onClick={() => setSelectedQ(q => prevQuarter(q))}
              style={{
                width: 24, height: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                color: 'rgba(255,255,255,0.6)',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
                flexShrink: 0,
              }}
              title="Trimestre précédent"
            >
              ‹
            </button>

            {/* Label trimestre + badge "Actuel" */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.9)', minWidth: 56, textAlign: 'center' }}>
                Q{selectedQ.quarter} {selectedQ.year}
              </span>
              {isCurrentQ && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  color: '#C49A2E',
                  background: 'rgba(196,154,46,0.15)',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}>
                  En cours
                </span>
              )}
            </div>

            {/* Flèche suivant — désactivé si on est sur le trimestre courant */}
            <button
              onClick={() => setSelectedQ(q => nextQuarter(q))}
              disabled={isCurrentQ}
              style={{
                width: 24, height: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isCurrentQ ? 'transparent' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${isCurrentQ ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 6,
                color: isCurrentQ ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
                fontSize: 11,
                cursor: isCurrentQ ? 'default' : 'pointer',
                fontFamily: 'inherit',
                flexShrink: 0,
              }}
              title={isCurrentQ ? 'Trimestre en cours' : 'Trimestre suivant'}
            >
              ›
            </button>

            {/* Bouton retour au trimestre courant */}
            {!isCurrentQ && (
              <button
                onClick={() => setSelectedQ(currentQ)}
                style={{
                  padding: '2px 8px',
                  background: 'transparent',
                  border: '1px solid rgba(196,154,46,0.4)',
                  borderRadius: 6,
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#C49A2E',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                }}
              >
                Aujourd&apos;hui
              </button>
            )}
          </div>
        </div>

        {/* Toggle Gérance / Copro */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 8,
          padding: 2,
          gap: 2,
        }}>
          {(['gerance', 'copro'] as const).map(m => (
            <button
              key={m}
              onClick={() => setActiveMode(m)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: 'none',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                background: activeMode === m ? 'rgba(196,154,46,0.2)' : 'transparent',
                color: activeMode === m ? '#C49A2E' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.15s',
              }}
            >
              {m === 'gerance' ? 'Gérance' : 'Copro'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary chips — cliquables pour filtrer */}
      {counts && data && data.agencies.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '10px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          {(Object.entries(STATUS_CONFIG) as [keyof typeof STATUS_CONFIG, typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([key, cfg]) => (
            counts[key] > 0 && (
              <button
                key={key}
                onClick={() => setFilterStatus(f => f === key ? null : key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 10px',
                  borderRadius: 20,
                  background: filterStatus === key ? cfg.dot : cfg.bg,
                  fontSize: 11,
                  fontWeight: 600,
                  color: filterStatus === key ? '#fff' : cfg.text,
                  border: filterStatus === key ? `1.5px solid ${cfg.dot}` : '1.5px solid transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: filterStatus === key ? 'rgba(255,255,255,0.7)' : cfg.dot, display: 'inline-block', flexShrink: 0 }} />
                {counts[key]} {cfg.label.toLowerCase()}
              </button>
            )
          ))}
          {filterStatus && (
            <button
              onClick={() => setFilterStatus(null)}
              style={{
                padding: '3px 8px',
                borderRadius: 20,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                fontSize: 10,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ✕ Tout afficher
            </button>
          )}
        </div>
      )}

      {/* Body */}
      <div style={{ maxHeight: 280, overflowY: 'auto', padding: '8px 0' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '24px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ width: 14, height: 14, border: '2px solid rgba(196,154,46,0.3)', borderTopColor: '#C49A2E', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Chargement…</span>
          </div>
        )}
        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            Impossible de charger la mémoire trimestrielle.
          </div>
        )}
        {!loading && !error && data && data.agencies.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            Aucun audit ce trimestre
          </div>
        )}
        {!loading && !error && data && visibleAgencies.map((agency) => {
          const cfg = STATUS_CONFIG[agency.status]
          const dateLabel = agency.status === 'audit_fait'
            ? agency.lastAuditAt ? `Audité le ${formatDate(agency.lastAuditAt)}` : null
            : agency.status === 'import_valide'
            ? agency.lastImportAt ? `Import le ${formatDate(agency.lastImportAt)}` : null
            : null

          return (
            <div key={agency.agence} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {agency.agence}
                </div>
                {dateLabel && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                    {dateLabel}
                  </div>
                )}
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: cfg.text,
                background: cfg.bg,
                padding: '2px 8px',
                borderRadius: 10,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}>
                {cfg.label}
              </span>
            </div>
          )
        })}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
