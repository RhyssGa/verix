'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import type { HistorySnapshot } from '@/types/audit'

export interface ImportSessionSummary {
  id: string
  mode: string
  label: string | null
  agences: string[]
  quarterYear: number
  quarter: number
  createdAt: string
  updatedAt: string
}

export function useImportSession() {
  const [isSaving, setIsSaving] = useState(false)

  const mode = useAuditStore((s) => s.mode)
  const importSessionId = useAuditStore((s) => s.importSessionId)
  const importSessions = useAuditStore((s) => s.importSessions)
  const setImportSessionId = useAuditStore((s) => s.setImportSessionId)
  const setImportSessions = useAuditStore((s) => s.setImportSessions)

  // Charge la liste au montage (et quand le mode change)
  useEffect(() => {
    fetch(`/api/import-sessions?mode=${mode}`)
      .then((res) => res.json())
      .then((data: ImportSessionSummary[]) => {
        if (Array.isArray(data)) setImportSessions(data)
      })
      .catch(() => {})
  }, [mode, setImportSessions])

  const refreshSessions = useCallback(async () => {
    const state = useAuditStore.getState()
    try {
      const res = await fetch(`/api/import-sessions?mode=${state.mode}`)
      const data = await res.json()
      if (Array.isArray(data)) state.setImportSessions(data)
    } catch {}
  }, [])

  const saveImportSession = useCallback(async (label?: string): Promise<string | null> => {
    const state = useAuditStore.getState()
    setIsSaving(true)

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
      sectionNotes: state.sectionNotes,
      forcedOk: state.forcedOk,
      fileLoaded: state.loadedFiles,
      agences: state.agencies,
      zGerancePointe: Array.from(state.zGerancePeak.entries()),
      zCoproPointe: Array.from(state.zCoproPeak.entries()),
      zGeranceMandats: Array.from(state.zGeranceMandates.entries()),
    }

    try {
      const res = await fetch('/api/import-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: state.mode, label: label ?? null, snapshot }),
      })
      if (res.ok) {
        const { id } = await res.json()
        state.setImportSessionId(id)
        await refreshSessions()
        return id
      } else {
        const errBody = await res.json().catch(() => ({}))
        console.error('[ImportSession] Save failed', res.status, errBody)
      }
    } catch (err) {
      console.error('[ImportSession] Network error', err)
    } finally {
      setIsSaving(false)
    }
    return null
  }, [refreshSessions])

  const restoreImportSession = useCallback(async (session: ImportSessionSummary) => {
    const state = useAuditStore.getState()

    if (session.mode !== state.mode) {
      alert(`Cet import est en mode ${session.mode === 'gerance' ? 'Gérance' : 'Copropriété'}. Rendez-vous sur la page correspondante pour le restaurer.`)
      return
    }

    try {
      const res = await fetch(`/api/import-sessions/${session.id}`)
      if (!res.ok) { alert('Session introuvable.'); return }
      const data = await res.json()
      const snapshot: HistorySnapshot = data.snapshot
      const store = useAuditStore.getState()

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
      Object.entries(snapshot.fileLoaded).forEach(([id, name]) => store.setLoadedFile(id, name))
      store.setAgencies(snapshot.agences)
      if (snapshot.agences.length > 0) store.setSelectedAgency(snapshot.agences[0])
      if (snapshot.zGerancePointe) store.setZGerancePeak(new Map(snapshot.zGerancePointe))
      if (snapshot.zCoproPointe) store.setZCoproPeak(new Map(snapshot.zCoproPointe))
      if (snapshot.zGeranceMandats) store.setZGeranceMandates(new Map(snapshot.zGeranceMandats))

      store.setImportSessionId(session.id)
      store.incrementRestoreKey()
      store.setShowHistory(false)
    } catch {
      alert("Erreur lors de la restauration de l'import.")
    }
  }, [])

  const deleteImportSession = useCallback(async (id: string) => {
    try {
      await fetch(`/api/import-sessions/${id}`, { method: 'DELETE' })
      const state = useAuditStore.getState()
      state.setImportSessions(state.importSessions.filter((s) => s.id !== id))
      if (state.importSessionId === id) state.setImportSessionId(null)
    } catch {
      console.warn('Suppression import session échouée')
    }
  }, [])

  return {
    importSessions,
    isSaving,
    importSessionId,
    saveImportSession,
    restoreImportSession,
    deleteImportSession,
    refreshSessions,
  }
}
