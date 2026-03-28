import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const audits = await prisma.audit.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        agence: true,
        mode: true,
        dateDebut: true,
        dateFin: true,
        scoreGlobal: true,
        niveau: true,
        createdAt: true,
      },
    })
    return NextResponse.json(audits)
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const audit = await prisma.audit.create({
      data: {
        agence: body.agence,
        mode: body.mode,
        dateDebut: body.dateDebut ? new Date(body.dateDebut) : null,
        dateFin: body.dateFin ? new Date(body.dateFin) : null,
        garantie: body.garantie ?? null,
        pointe: body.pointe ?? null,
        pointeDate: body.pointeDate ? new Date(body.pointeDate) : null,
        donneesG: body.donneesG ?? undefined,
        donneesC: body.donneesC ?? undefined,
        annotations: body.annotations ?? {},
        scoreGlobal: body.scoreGlobal ?? null,
        niveau: body.niveau ?? null,
      },
    })
    return NextResponse.json(audit, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
