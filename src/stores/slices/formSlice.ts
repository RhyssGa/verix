import type { StateCreator } from 'zustand'

export interface FormSlice {
  startDate: string
  endDate: string
  guarantee: number
  peak: number
  peakDate: string
  mandateCount: number
  setStartDate: (value: string) => void
  setEndDate: (value: string) => void
  setGuarantee: (value: number) => void
  setPeak: (value: number) => void
  setPeakDate: (value: string) => void
  setMandateCount: (value: number) => void
  resetForm: () => void
}

const initialFormState = {
  startDate: '2025-01-01',
  endDate: new Date().toISOString().slice(0, 10),
  guarantee: 0,
  peak: 0,
  peakDate: '2025-01-01',
  mandateCount: 0,
}

export const createFormSlice: StateCreator<FormSlice, [], [], FormSlice> = (set) => ({
  ...initialFormState,
  setStartDate: (value) => set({ startDate: value }),
  setEndDate: (value) => set({ endDate: value }),
  setGuarantee: (value) => set({ guarantee: value }),
  setPeak: (value) => set({ peak: value }),
  setPeakDate: (value) => set({ peakDate: value }),
  setMandateCount: (value) => set({ mandateCount: value }),
  resetForm: () => set(initialFormState),
})
