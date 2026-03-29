'use client'

export interface PDFSections {
  scoreTable: boolean
  groupAvg: boolean
  trend: boolean
  anomalies: boolean
}

interface PDFOptionsProps {
  sections: PDFSections
  onChange: (sections: PDFSections) => void
  onExport: () => void
  loading: boolean
  disabled: boolean
}

const OPTIONS: Array<{ key: keyof PDFSections; label: string; description: string }> = [
  { key: 'scoreTable', label: 'Tableau des scores', description: 'Score, niveau, Δ groupe et Δ trim. précédent par agence' },
  { key: 'groupAvg', label: 'Moyenne groupe + objectif', description: 'Recap des KPIs groupe et comparaison à l\'objectif' },
  { key: 'trend', label: 'Évolution trimestrielle', description: 'Scores Q1→Q4 pour chaque agence' },
  { key: 'anomalies', label: 'Détail anomalies agrégées', description: 'Cumul nb / montant / pénalité par type d\'anomalie' },
]

export function PDFOptions({ sections, onChange, onExport, loading, disabled }: PDFOptionsProps) {
  function toggle(key: keyof PDFSections) {
    onChange({ ...sections, [key]: !sections[key] })
  }

  const anySelected = Object.values(sections).some(Boolean)

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      {OPTIONS.map(({ key, label, description }) => (
        <label
          key={key}
          className="flex items-center gap-2 cursor-pointer group"
          title={description}
        >
          <div
            className={[
              'w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition-colors shrink-0',
              sections[key]
                ? 'bg-[#C49A2E] border-[#C49A2E]'
                : 'bg-white border-[#D0CCC8] group-hover:border-[#C49A2E]',
            ].join(' ')}
            onClick={() => toggle(key)}
          >
            {sections[key] && (
              <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span className="text-[13px] font-medium text-[#1A1A2E]">{label}</span>
        </label>
      ))}

      <button
        onClick={onExport}
        disabled={loading || disabled || !anySelected}
        className={[
          'ml-auto flex items-center gap-2 px-5 py-[9px] rounded-[9px] text-[13px] font-bold transition-all',
          loading || disabled || !anySelected
            ? 'bg-[#E8E4DC] text-[#B0B0C8] cursor-not-allowed'
            : 'bg-[#0B1929] text-[#C49A2E] hover:bg-[#1A3252] cursor-pointer',
        ].join(' ')}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-[#C49A2E]/30 border-t-[#C49A2E] rounded-full animate-spin" />
            Génération…
          </>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M2 11.5V13H13V11.5M7.5 2V10M7.5 10L4.5 7M7.5 10L10.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Exporter PDF
          </>
        )}
      </button>
    </div>
  )
}
