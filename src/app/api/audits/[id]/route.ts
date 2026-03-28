import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const audit = await prisma.audit.findUnique({ where: { id: params.id } })
    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(audit)
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json()
    const audit = await prisma.audit.update({
      where: { id: params.id },
      data: {
        agence: body.agence,
        annotations: body.annotations ?? undefined,
        donneesG: body.donneesG ?? undefined,
        donneesC: body.donneesC ?? undefined,
        scoreGlobal: body.scoreGlobal ?? undefined,
        niveau: body.niveau ?? undefined,
      },
    })
    return NextResponse.json(audit)
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await prisma.audit.delete({ where: { id: params.id } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
