import type { StateCreator } from 'zustand'
import type { ExcelRow } from '@/types/audit'

type ColDef = {
  header: string
  fn: (row: ExcelRow, noteColumn: number | null) => string
  right?: boolean
}

export interface ModalState {
  open: boolean
  title: string
  categoryId: string
  rows: ExcelRow[]
  nameFn: (row: ExcelRow) => string
  valFn: (row: ExcelRow) => number
  valClass: string
  subFn: ((row: ExcelRow) => string) | null
  isBilan?: boolean
  cols?: ColDef[]
  noteColumn?: number | null
}

export interface UiSlice {
  modal: ModalState
  financialStateModal: { open: boolean; title: string; rows: ExcelRow[] }
  showHistory: boolean
  showSummary: boolean
  deleteConfirm: { batchId: string; count: number } | null
  validateConfirm: string | null
  validateMultiConfirm: string[] | null
  resetConfirm: boolean
  isGeneratingPdf: boolean
  nonClosedIncluded: Record<string, boolean>
  showAllNonClosed: boolean
  modalSearchTerm: string
  importSessionId: string | null
  openModal: (modal: Omit<ModalState, 'open'>) => void
  closeModal: () => void
  openFinancialStateModal: (title: string, rows: ExcelRow[]) => void
  closeFinancialStateModal: () => void
  setShowHistory: (show: boolean) => void
  setShowSummary: (show: boolean) => void
  setDeleteConfirm: (confirm: { batchId: string; count: number } | null) => void
  setValidateConfirm: (agency: string | null) => void
  setValidateMultiConfirm: (agencies: string[] | null) => void
  setResetConfirm: (open: boolean) => void
  setIsGeneratingPdf: (generating: boolean) => void
  toggleNonClosedIncluded: (name: string) => void
  setNonClosedIncluded: (included: Record<string, boolean>) => void
  setShowAllNonClosed: (show: boolean) => void
  setModalSearchTerm: (term: string) => void
  setImportSessionId: (id: string | null) => void
  resetUi: () => void
}

const defaultModal: ModalState = {
  open: false,
  title: '',
  categoryId: '',
  rows: [],
  nameFn: () => '',
  valFn: () => 0,
  valClass: '',
  subFn: null,
}

const initialUiState = {
  modal: { ...defaultModal },
  financialStateModal: { open: false, title: '', rows: [] as ExcelRow[] },
  showHistory: false,
  showSummary: false,
  deleteConfirm: null as { batchId: string; count: number } | null,
  validateConfirm: null as string | null,
  validateMultiConfirm: null as string[] | null,
  resetConfirm: false,
  isGeneratingPdf: false,
  nonClosedIncluded: {} as Record<string, boolean>,
  showAllNonClosed: false,
  modalSearchTerm: '',
  importSessionId: null as string | null,
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  ...initialUiState,
  openModal: (modalData) => set({ modal: { ...modalData, open: true } }),
  closeModal: () => set({ modal: { ...defaultModal }, modalSearchTerm: '' }),
  openFinancialStateModal: (title, rows) =>
    set({ financialStateModal: { open: true, title, rows } }),
  closeFinancialStateModal: () =>
    set({ financialStateModal: { open: false, title: '', rows: [] } }),
  setShowHistory: (show) => set({ showHistory: show }),
  setShowSummary: (show) => set({ showSummary: show }),
  setDeleteConfirm: (confirm) => set({ deleteConfirm: confirm }),
  setValidateConfirm: (agency) => set({ validateConfirm: agency }),
  setValidateMultiConfirm: (agencies) => set({ validateMultiConfirm: agencies }),
  setResetConfirm: (open) => set({ resetConfirm: open }),
  setIsGeneratingPdf: (generating) => set({ isGeneratingPdf: generating }),
  toggleNonClosedIncluded: (name) =>
    set((state) => ({
      nonClosedIncluded: {
        ...state.nonClosedIncluded,
        [name]: !state.nonClosedIncluded[name],
      },
    })),
  setNonClosedIncluded: (included) => set({ nonClosedIncluded: included }),
  setShowAllNonClosed: (show) => set({ showAllNonClosed: show }),
  setModalSearchTerm: (term) => set({ modalSearchTerm: term }),
  setImportSessionId: (id) => set({ importSessionId: id }),
  resetUi: () => set(initialUiState),
})
