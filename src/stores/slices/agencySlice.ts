import type { StateCreator } from 'zustand'

export interface AgencySlice {
  agencies: string[]
  selectedAgency: string | null
  reportAgencies: string[]
  validatedAgencies: Set<string>
  zGerancePeak: Map<string, { garantie: number; pointe: number }>
  zGeranceMandates: Map<string, number>
  zCoproPeak: Map<string, { garantie: number; pointe: number; nbCopro: number }>
  setAgencies: (agencies: string[]) => void
  setSelectedAgency: (agency: string | null) => void
  setReportAgencies: (agencies: string[]) => void
  toggleReportAgency: (agency: string) => void
  setValidatedAgencies: (agencies: Set<string>) => void
  toggleValidation: (agency: string) => void
  setZGerancePeak: (data: Map<string, { garantie: number; pointe: number }>) => void
  setZGeranceMandates: (data: Map<string, number>) => void
  setZCoproPeak: (data: Map<string, { garantie: number; pointe: number; nbCopro: number }>) => void
  resetAgencies: () => void
}

const initialAgencyState = {
  agencies: [] as string[],
  selectedAgency: null as string | null,
  reportAgencies: [] as string[],
  validatedAgencies: new Set<string>(),
  zGerancePeak: new Map<string, { garantie: number; pointe: number }>(),
  zGeranceMandates: new Map<string, number>(),
  zCoproPeak: new Map<string, { garantie: number; pointe: number; nbCopro: number }>(),
}

export const createAgencySlice: StateCreator<AgencySlice, [], [], AgencySlice> = (set) => ({
  ...initialAgencyState,
  setAgencies: (agencies) => set({ agencies }),
  setSelectedAgency: (agency) => set({ selectedAgency: agency }),
  setReportAgencies: (agencies) => set({ reportAgencies: agencies }),
  toggleReportAgency: (agency) =>
    set((state) => {
      const current = [...state.reportAgencies]
      const index = current.indexOf(agency)
      if (index >= 0) {
        current.splice(index, 1)
      } else {
        current.push(agency)
      }
      return { reportAgencies: current }
    }),
  setValidatedAgencies: (agencies) => set({ validatedAgencies: agencies }),
  toggleValidation: (agency) =>
    set((state) => {
      const next = new Set(state.validatedAgencies)
      if (next.has(agency)) {
        next.delete(agency)
      } else {
        next.add(agency)
      }
      return { validatedAgencies: next }
    }),
  setZGerancePeak: (data) => set({ zGerancePeak: data }),
  setZGeranceMandates: (data) => set({ zGeranceMandates: data }),
  setZCoproPeak: (data) => set({ zCoproPeak: data }),
  resetAgencies: () => set(initialAgencyState),
})
