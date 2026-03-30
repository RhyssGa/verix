import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-guard'
import { getQuarter, getPreviousQuarter } from '@/lib/reporting/quarters'
import { normalizeAgency } from '@/lib/utils/helpers'

export interface AgencyStatus {
  agence: string
  status: 'a_faire' | 'import_valide' | 'audit_fait'
  lastImportAt: string | null
  lastAuditAt: string | null
}

// GET /api/memory — Vue mémoire trimestrielle
// Query params : ?mode=gerance (obligatoire), ?year=2025&quarter=1 (optionnels — défaut = trimestre courant)
export async function GET(req: NextRequest) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError
  try {
    const mode = req.nextUrl.searchParams.get('mode')
    if (!mode) {
      return NextResponse.json({ error: 'mode est requis' }, { status: 400 })
    }

    // Trimestre cible (défaut = courant)
    const yearParam = req.nextUrl.searchParams.get('year')
    const quarterParam = req.nextUrl.searchParams.get('quarter')
    const now = new Date()
    const currentQ = getQuarter(now)
    const targetYear = yearParam ? parseInt(yearParam) : currentQ.year
    const targetQuarter = quarterParam ? parseInt(quarterParam) : currentQ.quarter

    // Trimestre précédent (pour liste des agences "à faire")
    const prevQ = getPreviousQuarter({ year: targetYear, quarter: targetQuarter as 1 | 2 | 3 | 4 })

    // Bornes de dates du trimestre cible
    const [startDate, endDate] = getQuarterBounds(targetYear, targetQuarter)
    const [prevStart, prevEnd] = getQuarterBounds(prevQ.year, prevQ.quarter)

    // 1. AuditSnapshot du trimestre cible → statut "audit_fait"
    const auditsDone = await prisma.auditSnapshot.findMany({
      where: {
        mode,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { agence: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    // 2. ImportSession du trimestre cible → statut "import_valide"
    const imports = await prisma.importSession.findMany({
      where: { mode, quarterYear: targetYear, quarter: targetQuarter },
      select: { agences: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    // 3. AuditSnapshot du trimestre précédent → agences "à faire"
    const prevAudits = await prisma.auditSnapshot.findMany({
      where: {
        mode,
        createdAt: { gte: prevStart, lte: prevEnd },
      },
      select: { agence: true },
    })

    // Construction de la map agence → statut
    const statusMap = new Map<string, AgencyStatus>()

    // Agences du trimestre précédent → "à faire" par défaut
    for (const a of prevAudits) {
      for (const part of a.agence.split(' + ').map(s => s.trim()).filter(Boolean)) {
        const norm = normalizeAgency(part)
        if (!statusMap.has(norm)) {
          statusMap.set(norm, { agence: norm, status: 'a_faire', lastImportAt: null, lastAuditAt: null })
        }
      }
    }

    // Agences dans les imports → "import_valide"
    for (const imp of imports) {
      const agences = Array.isArray(imp.agences) ? imp.agences as string[] : []
      for (const raw of agences) {
        const norm = normalizeAgency(raw)
        const existing = statusMap.get(norm)
        const importAt = imp.createdAt.toISOString()
        if (!existing || existing.status === 'a_faire') {
          statusMap.set(norm, {
            agence: norm,
            status: 'import_valide',
            lastImportAt: existing?.lastImportAt
              ? (existing.lastImportAt > importAt ? existing.lastImportAt : importAt)
              : importAt,
            lastAuditAt: existing?.lastAuditAt ?? null,
          })
        } else if (existing.status === 'import_valide') {
          // Garde le plus récent import
          if (!existing.lastImportAt || importAt > existing.lastImportAt) {
            existing.lastImportAt = importAt
          }
        }
      }
    }

    // Agences dans les audits validés → "audit_fait" (écrase tout)
    for (const a of auditsDone) {
      const auditAt = a.createdAt.toISOString()
      for (const part of a.agence.split(' + ').map(s => s.trim()).filter(Boolean)) {
        const norm = normalizeAgency(part)
        const existing = statusMap.get(norm)
        statusMap.set(norm, {
          agence: norm,
          status: 'audit_fait',
          lastImportAt: existing?.lastImportAt ?? null,
          lastAuditAt: existing?.lastAuditAt
            ? (existing.lastAuditAt > auditAt ? existing.lastAuditAt : auditAt)
            : auditAt,
        })
      }
    }

    // Trier : audit_fait > import_valide > a_faire, puis alphabétique
    const ORDER = { audit_fait: 0, import_valide: 1, a_faire: 2 }
    const result = Array.from(statusMap.values()).sort((a, b) => {
      const diff = ORDER[a.status] - ORDER[b.status]
      if (diff !== 0) return diff
      return a.agence.localeCompare(b.agence, 'fr')
    })

    return NextResponse.json({
      year: targetYear,
      quarter: targetQuarter,
      mode,
      agencies: result,
    })
  } catch (error) {
    console.error('GET /api/memory error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// Calcule les bornes UTC d'un trimestre (identique à la logique de quarters.ts)
function getQuarterBounds(year: number, quarter: number): [Date, Date] {
  // Q1 : jan 30 → avr 29
  // Q2 : avr 30 → jul 29
  // Q3 : jul 30 → oct 29
  // Q4 : oct 30 → jan 29 (année+1)
  const starts: [number, number][] = [
    [1, 30], [4, 30], [7, 30], [10, 30],
  ]
  const ends: [number, number][] = [
    [4, 29], [7, 29], [10, 29], [1, 29],
  ]
  const [sm, sd] = starts[quarter - 1]
  const [em, ed] = ends[quarter - 1]
  const endYear = quarter === 4 ? year + 1 : year

  const start = new Date(`${year}-${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}T00:00:00.000Z`)
  const end = new Date(`${endYear}-${String(em).padStart(2, '0')}-${String(ed).padStart(2, '0')}T23:59:59.999Z`)
  return [start, end]
}
