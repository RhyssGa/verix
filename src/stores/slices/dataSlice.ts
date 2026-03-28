import type { StateCreator } from 'zustand'
import type { GeranceData, CoproData } from '@/types/audit'
import { EMPTY_GERANCE, EMPTY_COPRO } from '@/constants/emptyData'

export interface DataSlice {
  geranceData: GeranceData
  coproData: CoproData
  setGeranceData: (data: GeranceData) => void
  setCoproData: (data: CoproData) => void
  mergeGeranceData: (partial: Partial<GeranceData>) => void
  mergeCoproData: (partial: Partial<CoproData>) => void
  resetData: () => void
}

export const createDataSlice: StateCreator<DataSlice, [], [], DataSlice> = (set) => ({
  geranceData: { ...EMPTY_GERANCE },
  coproData: { ...EMPTY_COPRO },
  setGeranceData: (data) => set({ geranceData: data }),
  setCoproData: (data) => set({ coproData: data }),
  mergeGeranceData: (partial) =>
    set((state) => ({
      geranceData: { ...state.geranceData, ...partial },
    })),
  mergeCoproData: (partial) =>
    set((state) => ({
      coproData: { ...state.coproData, ...partial },
    })),
  resetData: () => set({ geranceData: { ...EMPTY_GERANCE }, coproData: { ...EMPTY_COPRO } }),
})
