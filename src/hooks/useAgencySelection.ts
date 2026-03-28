import { useCallback } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { normalizeAgency } from '@/lib/utils/helpers'

export function useAgencySelection() {
  const autoFillFromSelection = useCallback(
    (selectedAgencies: string[]) => {
      const state = useAuditStore.getState()
      const { mode } = state

      if (selectedAgencies.length === 0) return

      if (mode === 'gerance') {
        const firstAgency = selectedAgencies[0]
        const peakData = state.zGerancePeak.get(firstAgency)
        if (peakData) {
          state.setGuarantee(peakData.garantie)
          state.setPeak(peakData.pointe)
        }
        let totalMandates = 0
        for (const agency of selectedAgencies) {
          const mandates = state.zGeranceMandates.get(agency)
          if (mandates) totalMandates += mandates
        }
        if (totalMandates > 0) state.setMandateCount(totalMandates)
      } else {
        const firstAgency = selectedAgencies[0]
        const peakData = state.zCoproPeak.get(firstAgency)
        if (peakData) {
          state.setGuarantee(peakData.garantie)
          state.setPeak(peakData.pointe)
          state.setMandateCount(peakData.nbCopro)
        }
      }
    },
    [],
  )

  const toggleAgencyValidation = useCallback(
    (agency: string) => {
      const state = useAuditStore.getState()
      if (state.validatedAgencies.has(agency)) {
        state.toggleValidation(agency)
      } else {
        state.setValidateConfirm(agency)
      }
    },
    [],
  )

  const handleAgencyChange = useCallback(
    (agency: string | null) => {
      const state = useAuditStore.getState()
      // Normalise les clés pour cohérence avec les sauvegardes
      const normTo = agency ? normalizeAgency(agency) : null
      const normFrom = state.selectedAgency ? normalizeAgency(state.selectedAgency) : null
      const alreadyHasCached = normTo !== null && normTo in state.annotsByAgency

      state.swapAgencyAnnotations(normFrom, normTo)
      state.setSelectedAgency(normTo)

      // Si aucune annotation en cache, chercher dans l'historique
      if (normTo && !alreadyHasCached) {
        const currentState = useAuditStore.getState()
        const match = currentState.reportHistory
          .filter((e) => e.mode === currentState.mode)
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
          .find((e) =>
            e.agence.split(' + ').some((s) => normalizeAgency(s.trim()) === normTo),
          )

        if (match?.hasSnapshot) {
          fetch(`/api/audits/${match.id}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((dbRecord) => {
              if (!dbRecord?.snapshot) return
              const annots = dbRecord.snapshot.annots || {}
              const snNotes = dbRecord.snapshot.sectionNotes || {}
              useAuditStore.getState().setAnnotsByAgency(normTo, annots, snNotes)
            })
            .catch(() => {})
        }
      }
    },
    [],
  )

  return {
    autoFillFromSelection,
    toggleAgencyValidation,
    handleAgencyChange,
    normalizeAgency,
  }
}
