import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { renderReportingHTML, type ReportingPDFPayload } from '@/lib/report/pdf-reporting'

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const payload: ReportingPDFPayload = await req.json()
    const html = renderReportingHTML(payload)

    const { launchBrowser } = await import('@/lib/browser')
    const browser = await launchBrowser()

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'domcontentloaded' })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    await browser.close()

    const { period, mode } = payload
    const filename = `reporting-Q${period.quarter}-${period.year}-${mode}.pdf`

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('POST /api/rapport/reporting error:', error)
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 })
  }
}
