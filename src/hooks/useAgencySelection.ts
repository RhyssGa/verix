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

      state.swapAgencyAnnotations(normFrom, normTo)
      state.setSelectedAgency(normTo)
      // Les annotations ne sont chargées que via une restauration explicite depuis l'historique
      // (useHistory.restoreFromHistory) — jamais automatiquement au changement d'agence
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
