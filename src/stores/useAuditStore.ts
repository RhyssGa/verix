import { create } from 'zustand'
import { createFormSlice, type FormSlice } from './slices/formSlice'
import { createAgencySlice, type AgencySlice } from './slices/agencySlice'
import { createFileSlice, type FileSlice } from './slices/fileSlice'
import { createDataSlice, type DataSlice } from './slices/dataSlice'
import { createAnnotationSlice, type AnnotationSlice } from './slices/annotationSlice'
import { createHistorySlice, type HistorySlice } from './slices/historySlice'
import { createUiSlice, type UiSlice } from './slices/uiSlice'

type ModeSnapshot = {
  loadedFiles: Record<string, string>
  fileErrors: Record<string, string>
  fileInputKeys: Record<string, number>
  fileObjects: Record<string, File>
  agencies: string[]
  selectedAgency: string | null
  reportAgencies: string[]
  validatedAgencies: Set<string>
  zGerancePeak: Map<string, { garantie: number; pointe: number }>
  zGeranceMandates: Map<string, number>
  zCoproPeak: Map<string, { garantie: number; pointe: number; nbCopro: number }>
  annotations: import('@/types/audit').AnnotationsMap
  forcedOk: Record<string, boolean>
  sectionNotes: Record<string, string>
  annotsByAgency: Record<string, import('@/types/audit').AnnotationsMap>
  notesByAgency: Record<string, Record<string, string>>
  startDate: string
  endDate: string
  guarantee: number
  peak: number
  peakDate: string
  mandateCount: number
  sessionBatchId: string
}

export type AuditStore = FormSlice &
  AgencySlice &
  FileSlice &
  DataSlice &
  AnnotationSlice &
  HistorySlice &
  UiSlice & {
    mode: 'gerance' | 'copro'
    sessionBatchId: string
    modeSnapshots: Partial<Record<'gerance' | 'copro', ModeSnapshot>>
    setMode: (mode: 'gerance' | 'copro') => void
    resetAll: () => void
  }

export const useAuditStore = create<AuditStore>()((...args) => {
  const [set, get] = args
  return {
    // Mode
    mode: 'gerance',
    sessionBatchId: crypto.randomUUID(),
    modeSnapshots: {},
    setMode: (newMode) => {
      const state = get()
      if (state.mode === newMode) return

      // Sauvegarder l'état du mode courant
      const snapshot: ModeSnapshot = {
        loadedFiles: state.loadedFiles,
        fileErrors: state.fileErrors,
        fileInputKeys: state.fileInputKeys,
        fileObjects: state.fileObjects,
        agencies: state.agencies,
        selectedAgency: state.selectedAgency,
        reportAgencies: state.reportAgencies,
        validatedAgencies: state.validatedAgencies,
        zGerancePeak: state.zGerancePeak,
        zGeranceMandates: state.zGeranceMandates,
        zCoproPeak: state.zCoproPeak,
        annotations: state.annotations,
        forcedOk: state.forcedOk,
        sectionNotes: state.sectionNotes,
        annotsByAgency: state.annotsByAgency,
        notesByAgency: state.notesByAgency,
        startDate: state.startDate,
        endDate: state.endDate,
        guarantee: state.guarantee,
        peak: state.peak,
        peakDate: state.peakDate,
        mandateCount: state.mandateCount,
        sessionBatchId: state.sessionBatchId,
      }

      const saved = state.modeSnapshots[newMode]

      set({
        mode: newMode,
        modeSnapshots: { ...state.modeSnapshots, [state.mode]: snapshot },
        // Restaurer l'état du nouveau mode si disponible, sinon état vide
        loadedFiles: saved?.loadedFiles ?? {},
        fileErrors: saved?.fileErrors ?? {},
        fileInputKeys: saved?.fileInputKeys ?? {},
        fileObjects: saved?.fileObjects ?? {},
        agencies: saved?.agencies ?? [],
        selectedAgency: saved?.selectedAgency ?? null,
        reportAgencies: saved?.reportAgencies ?? [],
        validatedAgencies: saved?.validatedAgencies ?? new Set(),
        zGerancePeak: saved?.zGerancePeak ?? new Map(),
        zGeranceMandates: saved?.zGeranceMandates ?? new Map(),
        zCoproPeak: saved?.zCoproPeak ?? new Map(),
        annotations: saved?.annotations ?? {},
        forcedOk: saved?.forcedOk ?? {},
        sectionNotes: saved?.sectionNotes ?? {},
        annotsByAgency: saved?.annotsByAgency ?? {},
        notesByAgency: saved?.notesByAgency ?? {},
        startDate: saved?.startDate ?? '2025-01-01',
        endDate: saved?.endDate ?? new Date().toISOString().slice(0, 10),
        guarantee: saved?.guarantee ?? 0,
        peak: saved?.peak ?? 0,
        peakDate: saved?.peakDate ?? '2025-01-01',
        mandateCount: saved?.mandateCount ?? 0,
        sessionBatchId: saved?.sessionBatchId ?? crypto.randomUUID(),
      })
    },

    // Slices
    ...createFormSlice(...args),
    ...createAgencySlice(...args),
    ...createFileSlice(...args),
    ...createDataSlice(...args),
    ...createAnnotationSlice(...args),
    ...createHistorySlice(...args),
    ...createUiSlice(...args),

    // Global reset
    resetAll: () => {
      const state = get()
      state.resetForm()
      state.resetAgencies()
      state.resetFiles()
      state.resetData()
      state.resetAnnotations()
      state.resetUi()
      set({ sessionBatchId: crypto.randomUUID() })
    },
  }
})
