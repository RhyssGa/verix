import { NextRequest, NextResponse } from 'next/server'
import { FILE_MIN_COLS } from '@/constants/fileConfigs'
import { parseGerance, parseGeranceZPointe, parseGeranceZMandats } from '@/lib/parsers/gerance'
import { parseCopro, parseCoproZPointe } from '@/lib/parsers/copro'
import type { ExcelRow } from '@/types/audit'
import * as XLSX from 'xlsx'

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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const fileId = formData.get('fileId') as string | null
    const mode = formData.get('mode') as string | null

    if (!file || !fileId || !mode) {
      return NextResponse.json(
        { error: 'Paramètres manquants : file, fileId et mode sont requis' },
        { status: 400 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()

    // Validate column count
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as (string | number | null)[][]
    const effectiveColumns = Math.max(0, ...rawRows.slice(0, 5).map((row) => row.length))
    const minColumns = FILE_MIN_COLS[mode]?.[fileId]
    if (minColumns && effectiveColumns < minColumns) {
      return NextResponse.json(
        { error: `Fichier incorrect — ${effectiveColumns} colonnes détectées, minimum ${minColumns} attendu` },
        { status: 400 },
      )
    }

    // Z-files: parse and return maps
    if (fileId === 'z_pointe') {
      if (mode === 'gerance') {
        const peakMap = parseGeranceZPointe(arrayBuffer)
        const entries = Array.from(peakMap.entries()).map(([k, v]) => [k, v] as const)
        return NextResponse.json({
          type: 'z_pointe',
          mode: 'gerance',
          peakMap: Object.fromEntries(entries),
          agencies: Array.from(peakMap.keys()).sort(),
          fileName: file.name,
        })
      } else {
        const peakMap = parseCoproZPointe(arrayBuffer)
        const entries = Array.from(peakMap.entries()).map(([k, v]) => [k, v] as const)
        return NextResponse.json({
          type: 'z_pointe',
          mode: 'copro',
          peakMap: Object.fromEntries(entries),
          agencies: Array.from(peakMap.keys()).sort(),
          fileName: file.name,
        })
      }
    }

    if (fileId === 'z_mandats') {
      const mandateMap = parseGeranceZMandats(arrayBuffer)
      return NextResponse.json({
        type: 'z_mandats',
        mandateMap: Object.fromEntries(mandateMap.entries()),
        fileName: file.name,
      })
    }

    // Business files: parse and extract agencies
    if (mode === 'gerance') {
      const parsed = parseGerance({ [fileId]: arrayBuffer })
      const agencies = [
        ...extractAgencies((parsed.quittancement_rows ?? []) as ExcelRow[], 0),
        ...extractAgencies((parsed.prop_deb ?? []) as ExcelRow[], 0),
        ...extractAgencies((parsed.prop_deb_sorti ?? []) as ExcelRow[], 0),
        ...extractAgencies((parsed.att_deb ?? []) as ExcelRow[], 0),
        ...extractAgencies((parsed.factures ?? []) as ExcelRow[], 1),
        ...extractAgencies((parsed.bq_nonrapp ?? []) as ExcelRow[], 1),
        ...extractAgencies((parsed.cpta_nonrapp ?? []) as ExcelRow[], 1),
      ]
      return NextResponse.json({
        type: 'data',
        mode: 'gerance',
        parsedData: parsed,
        agencies: Array.from(new Set(agencies)).sort(),
        fileName: file.name,
      })
    } else {
      const parsed = parseCopro({ [fileId]: arrayBuffer })
      const agencies = [
        ...extractAgencies((parsed.fourn_deb ?? []) as ExcelRow[], 0),
        ...extractAgencies((parsed.att_deb ?? []) as ExcelRow[], 0),
        ...extractAgencies((parsed.bilan ?? []) as ExcelRow[], 0),
        ...extractAgencies((parsed.ventes_deb ?? []) as ExcelRow[], 0),
        ...extractAgencies((parsed.bq_nonrapp ?? []) as ExcelRow[], 1),
        ...extractAgencies((parsed.cpta_nonrapp ?? []) as ExcelRow[], 0),
      ]
      return NextResponse.json({
        type: 'data',
        mode: 'copro',
        parsedData: parsed,
        agencies: Array.from(new Set(agencies)).sort(),
        fileName: file.name,
      })
    }
  } catch (error) {
    console.error('Parse error:', error)
    return NextResponse.json(
      { error: 'Impossible de lire le fichier Excel' },
      { status: 500 },
    )
  }
}
