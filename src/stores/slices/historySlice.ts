import type { StateCreator } from 'zustand'
import type { AuditMode, ReportEntry } from '@/types/audit'

export interface HistorySlice {
  reportHistory: ReportEntry[]
  selectedIds: Set<string>
  agencyFilter: string
  modeFilter: '' | AuditMode
  dateFromFilter: string
  dateToFilter: string
  comparisonRefId: string | null
  comparisonEnabled: boolean
  historyWarning: string | null
  setReportHistory: (entries: ReportEntry[]) => void
  addHistoryEntries: (entries: ReportEntry[]) => void
  removeHistoryEntries: (ids: string[]) => void
  removeHistoryBatch: (batchId: string) => void
  setSelectedIds: (ids: Set<string>) => void
  toggleSelectedId: (id: string) => void
  toggleBatchSelection: (batchId: string, checked: boolean) => void
  toggleAllSelection: (checked: boolean) => void
  setAgencyFilter: (value: string) => void
  setModeFilter: (value: '' | AuditMode) => void
  setDateFromFilter: (value: string) => void
  setDateToFilter: (value: string) => void
  setComparisonRefId: (id: string | null) => void
  setComparisonEnabled: (enabled: boolean) => void
  setHistoryWarning: (warning: string | null) => void
  resetHistory: () => void
}

const initialHistoryState = {
  reportHistory: [] as ReportEntry[],
  selectedIds: new Set<string>(),
  agencyFilter: '',
  modeFilter: '' as '' | AuditMode,
  dateFromFilter: '',
  dateToFilter: '',
  comparisonRefId: null as string | null,
  comparisonEnabled: true,
  historyWarning: null as string | null,
}

export const createHistorySlice: StateCreator<HistorySlice, [], [], HistorySlice> = (set) => ({
  ...initialHistoryState,
  setReportHistory: (entries) => set({ reportHistory: entries }),
  addHistoryEntries: (entries) =>
    set((state) => ({
      reportHistory: [...entries, ...state.reportHistory],
    })),
  removeHistoryEntries: (ids) =>
    set((state) => {
      const idSet = new Set(ids)
      return {
        reportHistory: state.reportHistory.filter((e) => !idSet.has(e.id)),
        selectedIds: new Set<string>(),
      }
    }),
  removeHistoryBatch: (batchId) =>
    set((state) => ({
      reportHistory: state.reportHistory.filter((e) => e.batchId !== batchId),
    })),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  toggleSelectedId: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedIds: next }
    }),
  toggleBatchSelection: (batchId, checked) =>
    set((state) => {
      const next = new Set(state.selectedIds)
      const batchEntries = state.reportHistory.filter((e) => e.batchId === batchId)
      for (const entry of batchEntries) {
        if (checked) next.add(entry.id)
        else next.delete(entry.id)
      }
      return { selectedIds: next }
    }),
  toggleAllSelection: (checked) =>
    set((state) => ({
      selectedIds: checked ? new Set(state.reportHistory.map((e) => e.id)) : new Set<string>(),
    })),
  setAgencyFilter: (value) => set({ agencyFilter: value }),
  setModeFilter: (value) => set({ modeFilter: value }),
  setDateFromFilter: (value) => set({ dateFromFilter: value }),
  setDateToFilter: (value) => set({ dateToFilter: value }),
  setComparisonRefId: (id) => set({ comparisonRefId: id }),
  setComparisonEnabled: (enabled) => set({ comparisonEnabled: enabled }),
  setHistoryWarning: (warning) => set({ historyWarning: warning }),
  resetHistory: () => set(initialHistoryState),
})
