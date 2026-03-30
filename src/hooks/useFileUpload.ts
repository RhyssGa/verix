import { useCallback } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import type { GeranceData, CoproData } from '@/types/audit'

export function useFileUpload() {
  const handleFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>, fileId: string) => {
      const file = event.target.files?.[0]
      if (!file) return

      const store = useAuditStore.getState()
      const { mode } = store

      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileId', fileId)
      formData.append('mode', mode)

      store.setFileLoading(fileId, true)
      try {
        const response = await fetch('/api/parse', { method: 'POST', body: formData })

        if (!response.ok) {
          const err = await response.json()
          store.setFileError(fileId, err.error || 'Erreur de parsing')
          return
        }

        const result = await response.json()
        store.clearFileError(fileId)
        store.setFileObject(fileId, file)

        if (result.type === 'z_pointe') {
          const peakMap = new Map(Object.entries(result.peakMap))
          if (mode === 'gerance') {
            store.setZGerancePeak(peakMap as Map<string, { garantie: number; pointe: number }>)
          } else {
            store.setZCoproPeak(peakMap as Map<string, { garantie: number; pointe: number; nbCopro: number }>)
          }
          if (store.agencies.length === 0 && result.agencies) {
            store.setAgencies(result.agencies)
          }
          store.setLoadedFile(fileId, result.fileName)
          return
        }

        if (result.type === 'z_mandats') {
          const mandateMap = new Map<string, number>(Object.entries(result.mandateMap).map(([k, v]) => [k, Number(v)]))
          store.setZGeranceMandates(mandateMap)
          if (mandateMap.size === 1) {
            store.setMandateCount(Array.from(mandateMap.values())[0])
          }
          store.setLoadedFile(fileId, result.fileName)
          return
        }

        // Business files
        if (mode === 'gerance') {
          const merged: GeranceData = { ...useAuditStore.getState().geranceData, ...result.parsedData }
          store.setGeranceData(merged)
        } else {
          const merged: CoproData = { ...useAuditStore.getState().coproData, ...result.parsedData }
          store.setCoproData(merged)
        }

        if (result.agencies && result.agencies.length > 0) {
          const existingAgencies = useAuditStore.getState().agencies
          const allAgencies = Array.from(new Set([...existingAgencies, ...result.agencies])).sort()
          store.setAgencies(allAgencies)
        }

        store.setLoadedFile(fileId, result.fileName)
      } catch {
        store.setFileError(fileId, 'Erreur réseau lors du parsing')
      } finally {
        store.setFileLoading(fileId, false)
      }
    },
    [],
  )

  const downloadFile = useCallback(
    (fileId: string) => {
      const file = useAuditStore.getState().fileObjects[fileId]
      if (!file) return
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.name
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
    [],
  )

  const removeFile = useCallback(
    (fileId: string) => {
      useAuditStore.getState().removeFile(fileId)
    },
    [],
  )

  return { handleFile, downloadFile, removeFile }
}
