import type { StateCreator } from 'zustand'
import type { AnnotationsMap } from '@/types/audit'
import { buildAnnotationKey } from '@/lib/utils/helpers'

export interface AnnotationSlice {
  annotations: AnnotationsMap
  forcedOk: Record<string, boolean>
  sectionNotes: Record<string, string>
  annotsByAgency: Record<string, AnnotationsMap>
  notesByAgency: Record<string, Record<string, string>>
  restoreKey: number
  setAnnotations: (annotations: AnnotationsMap) => void
  toggleInclude: (categoryId: string, index: number) => void
  saveComment: (categoryId: string, index: number, comment: string) => void
  setSectionNotes: (notes: Record<string, string>) => void
  saveSectionNote: (sectionId: string, text: string) => void
  setForcedOk: (forcedOk: Record<string, boolean>) => void
  toggleForcedOk: (key: string) => void
  swapAgencyAnnotations: (fromAgency: string | null, toAgency: string | null) => void
  setAnnotsByAgency: (agency: string, annotations: AnnotationsMap, notes: Record<string, string>) => void
  incrementRestoreKey: () => void
  resetAnnotations: () => void
}

const initialAnnotationState = {
  annotations: {} as AnnotationsMap,
  forcedOk: {} as Record<string, boolean>,
  sectionNotes: {} as Record<string, string>,
  annotsByAgency: {} as Record<string, AnnotationsMap>,
  notesByAgency: {} as Record<string, Record<string, string>>,
  restoreKey: 0,
}

export const createAnnotationSlice: StateCreator<AnnotationSlice, [], [], AnnotationSlice> = (set) => ({
  ...initialAnnotationState,
  setAnnotations: (annotations) => set({ annotations }),
  toggleInclude: (categoryId, index) =>
    set((state) => {
      const key = buildAnnotationKey(categoryId, index)
      const current = state.annotations[key] || { comment: '', include: true }
      return {
        annotations: {
          ...state.annotations,
          [key]: { ...current, include: !current.include },
        },
      }
    }),
  saveComment: (categoryId, index, comment) =>
    set((state) => {
      const key = buildAnnotationKey(categoryId, index)
      const current = state.annotations[key] || { comment: '', include: true }
      return {
        annotations: {
          ...state.annotations,
          [key]: { ...current, comment },
        },
      }
    }),
  setSectionNotes: (notes) => set({ sectionNotes: notes }),
  saveSectionNote: (sectionId, text) =>
    set((state) => ({
      sectionNotes: { ...state.sectionNotes, [sectionId]: text },
    })),
  setForcedOk: (forcedOk) => set({ forcedOk }),
  toggleForcedOk: (key) =>
    set((state) => ({
      forcedOk: { ...state.forcedOk, [key]: !state.forcedOk[key] },
    })),
  swapAgencyAnnotations: (fromAgency, toAgency) =>
    set((state) => {
      const nextAnnotsByAgency = { ...state.annotsByAgency }
      const nextNotesByAgency = { ...state.notesByAgency }

      // Save current annotations/notes for the agency we're leaving
      if (fromAgency) {
        nextAnnotsByAgency[fromAgency] = { ...state.annotations }
        nextNotesByAgency[fromAgency] = { ...state.sectionNotes }
      }

      // Load annotations/notes for the agency we're switching to
      const newAnnotations = toAgency ? (nextAnnotsByAgency[toAgency] || {}) : {}
      const newNotes = toAgency ? (nextNotesByAgency[toAgency] || {}) : {}

      return {
        annotsByAgency: nextAnnotsByAgency,
        notesByAgency: nextNotesByAgency,
        annotations: newAnnotations,
        sectionNotes: newNotes,
      }
    }),
  setAnnotsByAgency: (agency, annotations, notes) =>
    set((state) => ({
      annotations,
      sectionNotes: notes,
      annotsByAgency: { ...state.annotsByAgency, [agency]: annotations },
      notesByAgency: { ...state.notesByAgency, [agency]: notes },
      restoreKey: state.restoreKey + 1,
    })),
  incrementRestoreKey: () => set((state) => ({ restoreKey: state.restoreKey + 1 })),
  resetAnnotations: () => set(initialAnnotationState),
})
