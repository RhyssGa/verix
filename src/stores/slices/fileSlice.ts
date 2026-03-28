import type { StateCreator } from 'zustand'

export interface FileSlice {
  loadedFiles: Record<string, string>
  fileErrors: Record<string, string>
  fileInputKeys: Record<string, number>
  fileObjects: Record<string, File>
  setLoadedFile: (id: string, name: string) => void
  setFileError: (id: string, error: string) => void
  clearFileError: (id: string) => void
  setFileObject: (id: string, file: File) => void
  removeFile: (id: string) => void
  resetFileInputKey: (id: string) => void
  resetFiles: () => void
}

const initialFileState = {
  loadedFiles: {} as Record<string, string>,
  fileErrors: {} as Record<string, string>,
  fileInputKeys: {} as Record<string, number>,
  fileObjects: {} as Record<string, File>,
}

export const createFileSlice: StateCreator<FileSlice, [], [], FileSlice> = (set) => ({
  ...initialFileState,
  setLoadedFile: (id, name) =>
    set((state) => ({
      loadedFiles: { ...state.loadedFiles, [id]: name },
    })),
  setFileError: (id, error) =>
    set((state) => ({
      fileErrors: { ...state.fileErrors, [id]: error },
    })),
  clearFileError: (id) =>
    set((state) => {
      const next = { ...state.fileErrors }
      delete next[id]
      return { fileErrors: next }
    }),
  setFileObject: (id, file) =>
    set((state) => ({
      fileObjects: { ...state.fileObjects, [id]: file },
    })),
  removeFile: (id) =>
    set((state) => {
      const loadedFiles = { ...state.loadedFiles }
      const fileErrors = { ...state.fileErrors }
      const fileObjects = { ...state.fileObjects }
      delete loadedFiles[id]
      delete fileErrors[id]
      delete fileObjects[id]
      return {
        loadedFiles,
        fileErrors,
        fileObjects,
        fileInputKeys: { ...state.fileInputKeys, [id]: (state.fileInputKeys[id] || 0) + 1 },
      }
    }),
  resetFileInputKey: (id) =>
    set((state) => ({
      fileInputKeys: { ...state.fileInputKeys, [id]: (state.fileInputKeys[id] || 0) + 1 },
    })),
  resetFiles: () => set(initialFileState),
})
