import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'

// GET /api/import-sessions/[id] — Récupère la session complète avec snapshot
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError
  try {
    const { id } = await params
    const session = await prisma.importSession.findUnique({ where: { id } })
    if (!session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }
    return NextResponse.json(session)
  } catch (error) {
    console.error('GET /api/import-sessions/[id] error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// DELETE /api/import-sessions/[id] — Supprime une session
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError
  try {
    const { id } = await params
    await prisma.importSession.delete({ where: { id } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/import-sessions/[id] error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
