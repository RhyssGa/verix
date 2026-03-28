'use client'

import { useAuditStore } from '@/stores/useAuditStore'
import { Textarea } from '@/components/ui/textarea'

interface SectionNoteProps {
  sectionId: string
}

export function SectionNote({ sectionId }: SectionNoteProps) {
  const sectionNotes = useAuditStore((s) => s.sectionNotes)
  const saveSectionNote = useAuditStore((s) => s.saveSectionNote)
  const restoreKey = useAuditStore((s) => s.restoreKey)
  const selectedAgency = useAuditStore((s) => s.selectedAgency)

  return (
    <div className="mt-3">
      <div className="text-[11px] text-muted-foreground mb-1 font-medium">
        📝 Note de l&apos;auditeur
      </div>
      <Textarea
        key={`${restoreKey}_${selectedAgency ?? 'none'}_${sectionId}`}
        rows={2}
        placeholder="Commentaire libre sur cette section…"
        defaultValue={sectionNotes[sectionId] || ''}
        onBlur={(e) => saveSectionNote(sectionId, e.target.value)}
        className="text-xs resize-none border-border focus:border-gold"
      />
    </div>
  )
}
