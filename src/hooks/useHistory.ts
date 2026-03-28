import { useCallback, useEffect } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { normalizeAgency } from '@/lib/utils/helpers'
import type { ScoreResult, AnomalyMetric, HistorySnapshot, ReportEntry } from '@/types/audit'

export function useHistory() {
  // Load history from localStorage on mount — no full store subscription
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('c21_audit_history') || '[]')
      if (stored.length > 0) useAuditStore.getState().setReportHistory(stored)
    } catch {
      /* noop */
    }
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
    (
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

      const snapKey = `c21_audit_snap_${batchId}`
      const snapData = JSON.stringify(snapshot)

      const tryStore = (): boolean => {
        try {
          localStorage.setItem(snapKey, snapData)
          return true
        } catch {
          return false
        }
      }

      if (!tryStore()) {
        const seenBatches = new Set<string>()
        const oldBatchIds = [...state.reportHistory]
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
          .filter((entry) => {
            if (seenBatches.has(entry.batchId)) return false
            seenBatches.add(entry.batchId)
            return true
          })
          .map((entry) => entry.batchId)

        for (const oldBatch of oldBatchIds) {
          try { localStorage.removeItem(`c21_audit_snap_${oldBatch}`) } catch { /* noop */ }
          const legacyEntry = state.reportHistory.find((e) => e.batchId === oldBatch)
          if (legacyEntry) {
            try { localStorage.removeItem(`c21_audit_snap_${legacyEntry.id}`) } catch { /* noop */ }
          }
          if (tryStore()) break
        }
      }

      const hasSnapshot = localStorage.getItem(snapKey) !== null
      if (!hasSnapshot) {
        alert("⚠️ Stockage navigateur plein : les données complètes n'ont pas pu être sauvegardées. Seul le résumé (score, anomalies) est conservé.")
      }

      const agencyLabel = agencyList.length > 1 ? agencyList.join(' + ') : agencyList[0]
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
        hasSnapshot,
        ...(Object.keys(storedNotes).length > 0 && { sectionNotes: storedNotes }),
      }

      useAuditStore.getState().addHistoryEntries([entry])
    },
    [],
  )

  const restoreFromHistory = useCallback(
    (entry: ReportEntry) => {
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
        const raw =
          localStorage.getItem(`c21_audit_snap_${entry.batchId}`) ??
          localStorage.getItem(`c21_audit_snap_${entry.id}`)
        if (!raw) {
          alert('Données de restauration introuvables (peut-être effacées par le navigateur).')
          return
        }
        const snapshot: HistorySnapshot = JSON.parse(raw)
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
    (batchId: string) => {
      useAuditStore.getState().removeHistoryBatch(batchId)
      useAuditStore.getState().setDeleteConfirm(null)
    },
    [],
  )

  const deleteSelectedHistory = useCallback(() => {
    const state = useAuditStore.getState()
    useAuditStore.getState().removeHistoryEntries(Array.from(state.selectedIds))
  }, [])

  return {
    saveToHistory,
    saveAgencesToHistory,
    restoreFromHistory,
    deleteHistoryBatch,
    deleteSelectedHistory,
  }
}
