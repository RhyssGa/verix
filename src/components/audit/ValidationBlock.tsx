'use client'

import { useAuditStore } from '@/stores/useAuditStore'
import { useScore } from '@/stores/computed'
import { normalizeAgency } from '@/lib/utils/helpers'

export function ValidationBlock() {
  const reportAgencies = useAuditStore((s) => s.reportAgencies)
  const validatedAgencies = useAuditStore((s) => s.validatedAgencies)
  const setValidateConfirm = useAuditStore((s) => s.setValidateConfirm)
  const setValidateMultiConfirm = useAuditStore((s) => s.setValidateMultiConfirm)
  const score = useScore()

  if (!score || reportAgencies.length === 0) return null

  // Déduplique par nom normalisé
  const seen = new Set<string>()
  const uniqueAgencies = reportAgencies.filter((a) => {
    const norm = normalizeAgency(a)
    if (seen.has(norm)) return false
    seen.add(norm)
    return true
  })

  const allValidated = uniqueAgencies.every((a) => validatedAgencies.has(normalizeAgency(a)))

  return (
    <div style={{
      marginTop: 0,
      borderRadius: 12,
      border: allValidated ? '1.5px solid #1A7A4A' : '1.5px solid rgba(196,154,46,0.5)',
      background: allValidated ? '#EAF6EF' : '#0B1929',
      padding: '18px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
    }}>
      {/* Icône + texte */}
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: allValidated ? '#1A7A4A' : 'rgba(196,154,46,0.8)',
          marginBottom: 4,
        }}>
          {allValidated ? 'Audit sauvegardé' : 'Clôturer l\'audit'}
        </div>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: allValidated ? '#1A7A4A' : '#FFFFFF',
        }}>
          {allValidated
            ? 'L\'audit a été validé et enregistré dans l\'historique.'
            : 'Validez et sauvegardez cet audit dans l\'historique.'}
        </div>
      </div>

      {/* Boutons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {uniqueAgencies.length === 1 ? (
          <button
            onClick={() => setValidateConfirm(uniqueAgencies[0])}
            style={{
              padding: '10px 22px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.3px',
              background: allValidated
                ? 'transparent'
                : 'linear-gradient(135deg, #C49A2E, #A87E20)',
              color: allValidated ? '#1A7A4A' : '#0B1929',
              border: allValidated ? '1.5px solid #1A7A4A' : 'none',
              boxShadow: allValidated ? 'none' : '0 2px 8px rgba(196,154,46,0.35)',
            } as React.CSSProperties}
          >
            {allValidated ? '↩ Re-valider' : `Valider — ${normalizeAgency(uniqueAgencies[0])}`}
          </button>
        ) : (
          <button
            onClick={() => setValidateMultiConfirm(uniqueAgencies)}
            style={{
              padding: '10px 22px',
              borderRadius: 8,
              border: allValidated ? '1.5px solid #1A7A4A' : 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 700,
              fontSize: 13,
              background: allValidated ? 'transparent' : 'linear-gradient(135deg, #C49A2E, #A87E20)',
              color: allValidated ? '#1A7A4A' : '#0B1929',
              boxShadow: allValidated ? 'none' : '0 2px 8px rgba(196,154,46,0.35)',
            }}
          >
            {allValidated ? `↩ Re-valider ${uniqueAgencies.length} agences` : `Valider ${uniqueAgencies.length} agences`}
          </button>
        )}
      </div>
    </div>
  )
}
