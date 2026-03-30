import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { renderReportingHTML, type ReportingPDFPayload } from '@/lib/report/pdf-reporting'

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const payload: ReportingPDFPayload = await req.json()
    const html = renderReportingHTML(payload)

    const modeUpperCase = payload.mode === 'gerance' ? 'GÉRANCE' : 'COPROPRIÉTÉ'
    const reportDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const periodStr = `Q${payload.period.quarter} ${payload.period.year}`

    const footerTemplate = `
      <div style="-webkit-print-color-adjust:exact;color-adjust:exact;width:100%;box-sizing:border-box;padding:0 52px;height:32px;display:flex;justify-content:space-between;align-items:center;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;font-size:7pt;background:#fff;border-top:1px solid #E8E4DC">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-weight:800;color:#C49A2E;letter-spacing:0.08em;font-size:7.5pt">CENTURY 21 · GROUPE MARTINOT</span>
          <span style="color:#DCDCDC">&nbsp;·&nbsp;</span>
          <span style="color:#7A7A8C;letter-spacing:0.03em">REPORTING GROUPE ${modeUpperCase}</span>
          <span style="color:#DCDCDC">&nbsp;·&nbsp;</span>
          <span style="color:#9A9AB0">${periodStr}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="color:#BCBCCC">Généré le ${reportDate}</span>
          <span style="color:#DCDCDC">&nbsp;·&nbsp;</span>
          <span style="font-weight:700;color:#C49A2E;letter-spacing:0.04em"><span class="pageNumber"></span>&thinsp;/&thinsp;<span class="totalPages"></span></span>
        </div>
      </div>`

    const { launchBrowser } = await import('@/lib/browser')
    const browser = await launchBrowser()

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'domcontentloaded' })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate,
      margin: { top: '0', right: '0', bottom: '36px', left: '0' },
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
