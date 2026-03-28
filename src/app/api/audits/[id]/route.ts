import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/audits/[id] — Récupérer un snapshot complet pour restauration
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const snapshot = await prisma.auditSnapshot.findUnique({ where: { id } })
    if (!snapshot) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(snapshot)
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// DELETE /api/audits/[id] — Supprimer un snapshot
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await prisma.auditSnapshot.delete({ where: { id } })
    return NextResponse.json({ deleted: true })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
