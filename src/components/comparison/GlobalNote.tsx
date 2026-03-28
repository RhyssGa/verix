'use client'

import { useAuditStore } from '@/stores/useAuditStore'

export function GlobalNote() {
  const sectionNotes = useAuditStore((s) => s.sectionNotes)
  const setSectionNote = useAuditStore((s) => s.saveSectionNote)
  const restoreKey = useAuditStore((s) => s.restoreKey)

  const value = sectionNotes['__global__'] ?? ''

  return (
    <div
      className="rounded-xl p-4 bg-white"
      style={{ borderLeft: '3px solid #C49A2E' }}
    >
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Note générale de l&apos;auditeur
      </div>
      <textarea
        key={`global-note-${restoreKey}`}
        className="w-full text-xs border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-gold bg-cream/50"
        rows={3}
        placeholder="Note générale visible dans le rapport PDF…"
        defaultValue={value}
        onBlur={(e) => setSectionNote('__global__', e.target.value)}
      />
    </div>
  )
}
