import { useCallback } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'

export function useAnnotations() {
  const toggleInclude = useAuditStore((s) => s.toggleInclude)
  const saveComment = useAuditStore((s) => s.saveComment)
  const saveSectionNote = useAuditStore((s) => s.saveSectionNote)
  const toggleForcedOk = useAuditStore((s) => s.toggleForcedOk)

  return { toggleInclude, saveComment, saveSectionNote, toggleForcedOk }
}
