import { NextRequest, NextResponse } from 'next/server'
import { gunzipSync } from 'zlib'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'
import { getQuarter } from '@/lib/reporting/quarters'

// GET /api/import-sessions — Liste des sessions (sans snapshot)
// Query params optionnels : ?mode=gerance&year=2025&quarter=1
export async function GET(req: NextRequest) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError
  try {
    const mode = req.nextUrl.searchParams.get('mode')
    const year = req.nextUrl.searchParams.get('year')
    const quarter = req.nextUrl.searchParams.get('quarter')

    const where: Record<string, unknown> = {}
    if (mode) where.mode = mode
    if (year) where.quarterYear = parseInt(year)
    if (quarter) where.quarter = parseInt(quarter)

    const sessions = await prisma.importSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        mode: true,
        label: true,
        agences: true,
        quarterYear: true,
        quarter: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(sessions)
  } catch (error) {
    console.error('GET /api/import-sessions error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// POST /api/import-sessions — Créer une session d'import
// Body : { mode, label?, snapshot: HistorySnapshot }
export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError
  try {
    const body = await req.json()

    const { mode, label, snapshot: rawSnapshot, snapshotCompressed } = body
    if (!mode || (!rawSnapshot && !snapshotCompressed)) {
      return NextResponse.json({ error: 'mode et snapshot sont requis' }, { status: 400 })
    }

    // Décompresse si le client a envoyé un snapshot compressé en base64 gzip
    let snapshot = rawSnapshot
    if (snapshotCompressed) {
      const binary = Buffer.from(snapshotCompressed, 'base64')
      const decompressed = gunzipSync(binary)
      snapshot = JSON.parse(decompressed.toString('utf8'))
    }

    // Calcule le trimestre courant
    const { year: quarterYear, quarter } = getQuarter(new Date())

    // Extrait les agences du snapshot
    const agences: string[] = Array.isArray(snapshot.agences) ? snapshot.agences : []

    const session = await prisma.importSession.create({
      data: {
        mode,
        label: label ?? null,
        agences,
        quarterYear,
        quarter,
        snapshot,
      },
    })

    return NextResponse.json({ id: session.id }, { status: 201 })
  } catch (error) {
    console.error('POST /api/import-sessions error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
