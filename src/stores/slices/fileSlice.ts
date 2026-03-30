import type { StateCreator } from 'zustand'

export interface FileSlice {
  loadedFiles: Record<string, string>
  fileErrors: Record<string, string>
  fileInputKeys: Record<string, number>
  fileObjects: Record<string, File>
  loadingFiles: Record<string, boolean>
  setLoadedFile: (id: string, name: string) => void
  setFileError: (id: string, error: string) => void
  clearFileError: (id: string) => void
  setFileObject: (id: string, file: File) => void
  setFileLoading: (id: string, loading: boolean) => void
  removeFile: (id: string) => void
  resetFileInputKey: (id: string) => void
  resetFiles: () => void
}

const initialFileState = {
  loadedFiles: {} as Record<string, string>,
  fileErrors: {} as Record<string, string>,
  fileInputKeys: {} as Record<string, number>,
  fileObjects: {} as Record<string, File>,
  loadingFiles: {} as Record<string, boolean>,
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
  setFileLoading: (id, loading) =>
    set((state) => {
      const next = { ...state.loadingFiles }
      if (loading) next[id] = true
      else delete next[id]
      return { loadingFiles: next }
    }),
  removeFile: (id) =>
    set((state) => {
      const loadedFiles = { ...state.loadedFiles }
      const fileErrors = { ...state.fileErrors }
      const fileObjects = { ...state.fileObjects }
      const loadingFiles = { ...state.loadingFiles }
      delete loadedFiles[id]
      delete fileErrors[id]
      delete fileObjects[id]
      delete loadingFiles[id]
      return {
        loadedFiles,
        fileErrors,
        fileObjects,
        loadingFiles,
        fileInputKeys: { ...state.fileInputKeys, [id]: (state.fileInputKeys[id] || 0) + 1 },
      }
    }),
  resetFileInputKey: (id) =>
    set((state) => ({
      fileInputKeys: { ...state.fileInputKeys, [id]: (state.fileInputKeys[id] || 0) + 1 },
    })),
  resetFiles: () => set(initialFileState),
})
