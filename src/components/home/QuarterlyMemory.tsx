'use client'

import { useState, useEffect, useCallback } from 'react'

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
  audit_fait:    { label: 'Audit fait',       dot: '#1A7A4A', bg: 'rgba(26,122,74,0.12)',  text: '#1A7A4A' },
  import_valide: { label: 'Import validé',    dot: '#C49A2E', bg: 'rgba(196,154,46,0.12)', text: '#A87E20' },
  a_faire:       { label: 'À faire',          dot: '#7A7A8C', bg: 'rgba(122,122,140,0.10)', text: '#7A7A8C' },
}

export function QuarterlyMemory() {
  const [activeMode, setActiveMode] = useState<'gerance' | 'copro'>('gerance')
  const [data, setData] = useState<MemoryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async (mode: 'gerance' | 'copro') => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/memory?mode=${mode}`)
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
    load(activeMode)
  }, [activeMode, load])

  const counts = data ? {
    audit_fait:    data.agencies.filter(a => a.status === 'audit_fait').length,
    import_valide: data.agencies.filter(a => a.status === 'import_valide').length,
    a_faire:       data.agencies.filter(a => a.status === 'a_faire').length,
  } : null

  return (
    <div style={{
      width: '100%',
      maxWidth: 560,
      margin: '0 auto 48px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(196,154,46,0.18)',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#C49A2E', marginBottom: 3 }}>
            Mémoire trimestrielle
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
            {data ? `Q${data.quarter} ${data.year}` : '—'}
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

      {/* Summary chips */}
      {counts && data && data.agencies.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '10px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          flexWrap: 'wrap',
        }}>
          {(Object.entries(STATUS_CONFIG) as [keyof typeof STATUS_CONFIG, typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([key, cfg]) => (
            counts[key] > 0 && (
              <div key={key} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 10px',
                borderRadius: 20,
                background: cfg.bg,
                fontSize: 11,
                fontWeight: 600,
                color: cfg.text,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
                {counts[key]} {cfg.label.toLowerCase()}
              </div>
            )
          ))}
        </div>
      )}

      {/* Body */}
      <div style={{ maxHeight: 280, overflowY: 'auto', padding: '8px 0' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            Chargement…
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
        {!loading && !error && data && data.agencies.map((agency) => {
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
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: cfg.dot,
                flexShrink: 0,
              }} />
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
    </div>
  )
}
