import { create } from 'zustand'
import { createFormSlice, type FormSlice } from './slices/formSlice'
import { createAgencySlice, type AgencySlice } from './slices/agencySlice'
import { createFileSlice, type FileSlice } from './slices/fileSlice'
import { createDataSlice, type DataSlice } from './slices/dataSlice'
import { createAnnotationSlice, type AnnotationSlice } from './slices/annotationSlice'
import { createHistorySlice, type HistorySlice } from './slices/historySlice'
import { createUiSlice, type UiSlice } from './slices/uiSlice'

export type AuditStore = FormSlice &
  AgencySlice &
  FileSlice &
  DataSlice &
  AnnotationSlice &
  HistorySlice &
  UiSlice & {
    mode: 'gerance' | 'copro'
    sessionBatchId: string
    setMode: (mode: 'gerance' | 'copro') => void
    resetAll: () => void
  }

export const useAuditStore = create<AuditStore>()((...args) => {
  const [set, get] = args
  return {
    // Mode
    mode: 'gerance',
    sessionBatchId: crypto.randomUUID(),
    setMode: (mode) => set({ mode }),

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
