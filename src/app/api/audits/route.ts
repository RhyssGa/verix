import { NextRequest, NextResponse } from 'next/server'
import { gunzipSync } from 'zlib'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'

// GET /api/audits — Liste historique (sans snapshot complet)
// GET /api/audits?batchId=xxx — Filtrer par batch
export async function GET(req: NextRequest) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError
  try {
    const batchId = req.nextUrl.searchParams.get('batchId')

    const where = batchId ? { batchId } : {}
    const snapshots = await prisma.auditSnapshot.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        batchId: true,
        agence: true,
        mode: true,
        scoreGlobal: true,
        niveau: true,
        nbAnomalies: true,
        totalPenalite: true,
        metrics: true,
        sectionNotes: true,
        createdAt: true,
      },
    })

    // Map to ReportEntry format for client
    const entries = snapshots.map((s) => ({
      id: s.id,
      batchId: s.batchId,
      datasetId: s.batchId,
      timestamp: s.createdAt.toISOString(),
      agence: s.agence,
      mode: s.mode,
      scoreGlobal: s.scoreGlobal,
      niveau: s.niveau,
      nbAnomalies: s.nbAnomalies,
      totalPenalite: s.totalPenalite,
      status: 'valid' as const,
      metrics: s.metrics ?? {},
      hasSnapshot: true,
      ...(s.sectionNotes && Object.keys(s.sectionNotes as object).length > 0
        ? { sectionNotes: s.sectionNotes }
        : {}),
    }))

    return NextResponse.json(entries)
  } catch (error) {
    console.error('GET /api/audits error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// POST /api/audits — Sauvegarder un snapshot
export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError
  try {
    const body = await req.json()

    // Décompresse si le client a envoyé un snapshot compressé en base64 gzip
    let snapshotData = body.snapshot
    if (body.snapshotCompressed) {
      const binary = Buffer.from(body.snapshotCompressed, 'base64')
      const decompressed = gunzipSync(binary)
      snapshotData = JSON.parse(decompressed.toString('utf8'))
    }

    const snapshot = await prisma.auditSnapshot.create({
      data: {
        batchId: body.batchId,
        agence: body.agence,
        mode: body.mode,
        scoreGlobal: body.scoreGlobal,
        niveau: body.niveau,
        nbAnomalies: body.nbAnomalies,
        totalPenalite: body.totalPenalite,
        metrics: body.metrics ?? {},
        sectionNotes: body.sectionNotes ?? {},
        snapshot: snapshotData,
      },
    })

    return NextResponse.json({ id: snapshot.id }, { status: 201 })
  } catch (error) {
    console.error('POST /api/audits error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// DELETE /api/audits?batchId=xxx — Supprimer tout un batch
export async function DELETE(req: NextRequest) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError
  try {
    const batchId = req.nextUrl.searchParams.get('batchId')
    if (!batchId) {
      return NextResponse.json({ error: 'batchId requis' }, { status: 400 })
    }

    await prisma.auditSnapshot.deleteMany({ where: { batchId } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/audits error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
