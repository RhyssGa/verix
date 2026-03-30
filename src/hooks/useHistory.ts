import { useCallback, useEffect } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { normalizeAgency } from '@/lib/utils/helpers'
import { compressToBase64 } from '@/lib/utils/compress'
import type { ScoreResult, AnomalyMetric, HistorySnapshot, ReportEntry } from '@/types/audit'

export function useHistory() {
  // Load history from Supabase on mount
  useEffect(() => {
    fetch('/api/audits')
      .then((res) => res.json())
      .then((entries: ReportEntry[]) => {
        if (entries.length > 0) useAuditStore.getState().setReportHistory(entries)
      })
      .catch(() => { /* noop — app works without DB */ })
  }, [])

  const saveToHistory = useCallback(
    (score: ScoreResult, notes?: Record<string, string>, agencyOverride?: string) => {
      const state = useAuditStore.getState()
      saveAgencesToHistory(score, notes, [
        agencyOverride || state.selectedAgency || 'Toutes agences',
      ])
    },
    [],
  )

  const saveAgencesToHistory = useCallback(
    async (
      score: ScoreResult,
      notes: Record<string, string> | undefined,
      agencyList: string[],
    ) => {
      const state = useAuditStore.getState()

      const metrics: Record<string, AnomalyMetric> = {}
      for (const anomaly of score.anomalies) {
        metrics[anomaly.id] = {
          nb: anomaly.nb ?? 0,
          montant: anomaly.montant,
          penalite: anomaly.penalite,
        }
      }

      const storedNotes: Record<string, string> = {}
      if (notes) {
        for (const [key, value] of Object.entries(notes)) {
          if (value.trim()) storedNotes[key] = value.trim()
        }
      }

      const batchId = crypto.randomUUID()
      const snapshot: HistorySnapshot = {
        donneesG: state.geranceData,
        donneesC: state.coproData,
        garantie: state.guarantee,
        pointe: state.peak,
        pointeDate: state.peakDate,
        dateDebut: state.startDate,
        dateFin: state.endDate,
        nbMandats: state.mandateCount,
        annots: state.annotations,
        sectionNotes: storedNotes,
        forcedOk: state.forcedOk,
        fileLoaded: state.loadedFiles,
        agences: state.agencies,
        zGerancePointe: Array.from(state.zGerancePeak.entries()),
        zCoproPointe: Array.from(state.zCoproPeak.entries()),
        zGeranceMandats: Array.from(state.zGeranceMandates.entries()),
      }

      const agencyLabel = agencyList.length > 1
        ? agencyList.map((a) => normalizeAgency(a)).join(' + ')
        : normalizeAgency(agencyList[0])

      const entry: ReportEntry = {
        id: crypto.randomUUID(),
        batchId,
        datasetId: batchId,
        timestamp: new Date().toISOString(),
        agence: agencyLabel,
        mode: state.mode,
        scoreGlobal: score.scoreGlobal,
        niveau: score.niveau.label,
        nbAnomalies: score.anomalies.filter((a) => !a.exclu && a.penalite > 0).length,
        totalPenalite: score.totalPenalite,
        status: 'valid',
        metrics,
        hasSnapshot: true,
        ...(Object.keys(storedNotes).length > 0 && { sectionNotes: storedNotes }),
      }

      // Save to Supabase
      try {
        const snapshotCompressed = await compressToBase64(snapshot)
        const res = await fetch('/api/audits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId,
            agence: agencyLabel,
            mode: state.mode,
            scoreGlobal: score.scoreGlobal,
            niveau: score.niveau.label,
            nbAnomalies: entry.nbAnomalies,
            totalPenalite: score.totalPenalite,
            metrics,
            sectionNotes: storedNotes,
            snapshotCompressed,
          }),
        })
        if (res.ok) {
          const { id } = await res.json()
          entry.id = id
        }
      } catch {
        console.warn('Sauvegarde Supabase échouée — données conservées en session uniquement')
      }

      useAuditStore.getState().addHistoryEntries([entry])
    },
    [],
  )

  const restoreFromHistory = useCallback(
    async (entry: ReportEntry) => {
      const state = useAuditStore.getState()
      const store = useAuditStore.getState()

      if (entry.mode !== state.mode) {
        alert(`Ce rapport est en mode ${entry.mode === 'gerance' ? 'Gérance' : 'Copropriété'}. Rendez-vous sur la page correspondante pour le restaurer.`)
        return
      }

      if (!entry.hasSnapshot) {
        store.setSelectedAgency(entry.agence)
        const matchingRaws = state.agencies.filter((a) => normalizeAgency(a) === entry.agence)
        store.setReportAgencies(matchingRaws.length > 0 ? matchingRaws : [entry.agence])
        if (entry.sectionNotes) store.setSectionNotes(entry.sectionNotes)
        store.setShowHistory(false)
        return
      }

      try {
        // Fetch snapshot from Supabase
        const res = await fetch(`/api/audits/${entry.id}`)
        if (!res.ok) {
          alert('Données de restauration introuvables.')
          return
        }
        const dbRecord = await res.json()
        const snapshot: HistorySnapshot = dbRecord.snapshot

        const batchAgencies = entry.agence.split(' + ').map((s) => s.trim())
        const primaryAgency = batchAgencies[0]

        store.setGeranceData(snapshot.donneesG)
        store.setCoproData(snapshot.donneesC)
        store.setGuarantee(snapshot.garantie)
        store.setPeak(snapshot.pointe)
        store.setPeakDate(snapshot.pointeDate)
        store.setStartDate(snapshot.dateDebut)
        store.setEndDate(snapshot.dateFin)
        store.setMandateCount(snapshot.nbMandats)
        store.setAnnotations(snapshot.annots)
        store.setSectionNotes(snapshot.sectionNotes)
        store.setForcedOk(snapshot.forcedOk)

        Object.entries(snapshot.fileLoaded).forEach(([id, name]) => {
          store.setLoadedFile(id, name)
        })

        store.setAgencies(snapshot.agences)
        store.setSelectedAgency(primaryAgency)

        const allMatchingRaws = snapshot.agences.filter((a) =>
          batchAgencies.some((ba) => normalizeAgency(a) === ba),
        )
        store.setReportAgencies(allMatchingRaws.length > 0 ? allMatchingRaws : [primaryAgency])

        const annotsByAgency = { [primaryAgency]: snapshot.annots }
        const notesByAgency = { [primaryAgency]: snapshot.sectionNotes }
        useAuditStore.setState({ annotsByAgency, notesByAgency })

        if (snapshot.zGerancePointe) store.setZGerancePeak(new Map(snapshot.zGerancePointe))
        if (snapshot.zCoproPointe) store.setZCoproPeak(new Map(snapshot.zCoproPointe))
        if (snapshot.zGeranceMandats) store.setZGeranceMandates(new Map(snapshot.zGeranceMandats))

        store.incrementRestoreKey()
        store.setShowHistory(false)
      } catch {
        alert('Erreur lors de la restauration des données.')
      }
    },
    [],
  )

  const deleteHistoryBatch = useCallback(
    async (batchId: string) => {
      // Delete from Supabase
      try {
        await fetch(`/api/audits?batchId=${batchId}`, { method: 'DELETE' })
      } catch {
        console.warn('Suppression Supabase échouée')
      }
      useAuditStore.getState().removeHistoryBatch(batchId)
      useAuditStore.getState().setDeleteConfirm(null)
    },
    [],
  )

  const deleteSelectedHistory = useCallback(async () => {
    const state = useAuditStore.getState()
    const ids = Array.from(state.selectedIds)

    // Find batch IDs to delete from Supabase
    const batchIds = new Set<string>()
    for (const id of ids) {
      const entry = state.reportHistory.find((e) => e.id === id)
      if (entry) batchIds.add(entry.batchId)
    }

    // Delete from Supabase
    for (const batchId of batchIds) {
      try {
        await fetch(`/api/audits?batchId=${batchId}`, { method: 'DELETE' })
      } catch { /* noop */ }
    }

    useAuditStore.getState().removeHistoryEntries(ids)
  }, [])

  return {
    saveToHistory,
    saveAgencesToHistory,
    restoreFromHistory,
    deleteHistoryBatch,
    deleteSelectedHistory,
  }
}
