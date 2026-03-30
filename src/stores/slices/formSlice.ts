import type { StateCreator } from 'zustand'

function getCurrentQuarterDates(): { startDate: string; endDate: string } {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const year = now.getFullYear()

  let q: number
  let qYear = year
  if (month === 1 && day <= 29) {
    q = 4; qYear = year - 1
  } else if (month < 4 || (month === 4 && day <= 29)) {
    q = 1
  } else if (month < 7 || (month === 7 && day <= 29)) {
    q = 2
  } else if (month < 10 || (month === 10 && day <= 29)) {
    q = 3
  } else {
    q = 4
  }

  const starts = ['01-01', '04-01', '07-01', '10-01']
  const ends   = ['03-31', '06-30', '09-30', '12-31']
  return {
    startDate: `${qYear}-${starts[q - 1]}`,
    endDate:   `${qYear}-${ends[q - 1]}`,
  }
}

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

const { startDate: defaultStartDate, endDate: defaultEndDate } = getCurrentQuarterDates()

const initialFormState = {
  startDate: defaultStartDate,
  endDate: defaultEndDate,
  guarantee: 0,
  peak: 0,
  peakDate: defaultStartDate,
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
