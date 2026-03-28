import { useCallback } from 'react'
import { useAuditStore } from '@/stores/useAuditStore'
import { FILE_MIN_COLS } from '@/constants/fileConfigs'
import { parseGerance, parseGeranceZPointe, parseGeranceZMandats } from '@/lib/parsers/gerance'
import { parseCopro, parseCoproZPointe } from '@/lib/parsers/copro'
import type { ExcelRow } from '@/types/audit'

function extractAgencies(rows: ExcelRow[], column: number): string[] {
  const agencySet = new Set<string>()
  rows.forEach((row) => {
    const value = String(row[column] ?? '').trim()
    if (value && !value.startsWith('Total') && !value.startsWith('Filtre')) {
      agencySet.add(value)
    }
  })
  return Array.from(agencySet).sort()
}

export function useFileUpload() {
  const handleFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, fileId: string) => {
      const file = event.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (readEvent) => {
        const buffer = readEvent.target?.result as ArrayBuffer
        if (!buffer) return

        const store = useAuditStore.getState()
        const { mode } = store

        // Validate column count
        try {
          const XLSX = require('xlsx') as typeof import('xlsx')
          const workbook = XLSX.read(buffer, { type: 'array' })
          const sheet = workbook.Sheets[workbook.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: null,
          }) as (string | number | null)[][]
          const effectiveColumns = Math.max(0, ...rows.slice(0, 5).map((row) => row.length))
          const minColumns = FILE_MIN_COLS[mode]?.[fileId]
          if (minColumns && effectiveColumns < minColumns) {
            store.setFileError(
              fileId,
              `Fichier incorrect — ${effectiveColumns} colonnes détectées, minimum ${minColumns} attendu`,
            )
            return
          }
        } catch {
          store.setFileError(fileId, 'Impossible de lire le fichier Excel')
          return
        }

        store.clearFileError(fileId)
        store.setFileObject(fileId, file)

        // Z-files: auto-fill sidebar fields
        if (fileId === 'z_pointe') {
          if (mode === 'gerance') {
            const peakMap = parseGeranceZPointe(buffer)
            store.setZGerancePeak(peakMap)
            const keys = Array.from(peakMap.keys()).sort()
            if (store.agencies.length === 0) store.setAgencies(keys)
          } else {
            const peakMap = parseCoproZPointe(buffer)
            store.setZCoproPeak(peakMap)
            const keys = Array.from(peakMap.keys()).sort()
            if (store.agencies.length === 0) store.setAgencies(keys)
          }
          store.setLoadedFile(fileId, file.name)
          return
        }

        if (fileId === 'z_mandats') {
          const mandateMap = parseGeranceZMandats(buffer)
          store.setZGeranceMandates(mandateMap)
          if (mandateMap.size === 1) {
            store.setMandateCount(Array.from(mandateMap.values())[0])
          }
          store.setLoadedFile(fileId, file.name)
          return
        }

        // Business files
        if (mode === 'gerance') {
          const parsed = parseGerance({ [fileId]: buffer })
          const merged = { ...useAuditStore.getState().geranceData, ...parsed }
          store.setGeranceData(merged)

          const agencies = [
            ...extractAgencies(merged.quittancement_rows ?? [], 0),
            ...extractAgencies(merged.prop_deb, 0),
            ...extractAgencies(merged.prop_deb_sorti ?? [], 0),
            ...extractAgencies(merged.att_deb, 0),
            ...extractAgencies(merged.factures, 1),
            ...extractAgencies(merged.bq_nonrapp, 1),
            ...extractAgencies(merged.cpta_nonrapp, 1),
          ]
          store.setAgencies(Array.from(new Set(agencies)).sort())
        } else {
          const parsed = parseCopro({ [fileId]: buffer })
          const merged = { ...useAuditStore.getState().coproData, ...parsed }
          store.setCoproData(merged)

          const agencies = [
            ...extractAgencies(merged.fourn_deb, 0),
            ...extractAgencies(merged.att_deb, 0),
            ...extractAgencies(merged.bilan, 0),
            ...extractAgencies(merged.ventes_deb, 0),
            ...extractAgencies(merged.bq_nonrapp, 1),
            ...extractAgencies(merged.cpta_nonrapp, 0),
          ]
          store.setAgencies(Array.from(new Set(agencies)).sort())
        }
        store.setLoadedFile(fileId, file.name)
      }
      reader.readAsArrayBuffer(file)
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
