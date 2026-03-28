import { NextRequest, NextResponse } from 'next/server'
import { renderReportHTML } from '@/lib/report/pdf'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const maxDuration = 60

async function loadAssetBase64(filename: string): Promise<string> {
  try {
    const buf = await readFile(join(process.cwd(), 'public', 'report-assets', filename))
    return buf.toString('base64')
  } catch {
    return ''
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json()
    const payloads = Array.isArray(raw) ? raw : [raw]
    const firstPayload = payloads[0]

    const [bgCoverBase64, headerBannerBase64] = await Promise.all([
      loadAssetBase64('bg_cover.png'),
      loadAssetBase64('header_banner.png'),
    ])

    let html: string
    if (payloads.length === 1) {
      html = renderReportHTML(firstPayload, bgCoverBase64, headerBannerBase64)
    } else {
      // Multi-agency: render each as full HTML, stitch body content with page breaks
      const fullHtmls = payloads.map(p => renderReportHTML(p, bgCoverBase64, headerBannerBase64))
      const firstDoc = fullHtmls[0]
      const bodyCloseIdx = firstDoc.lastIndexOf('</body>')
      let combined = firstDoc.substring(0, bodyCloseIdx)
      for (let i = 1; i < fullHtmls.length; i++) {
        const h = fullHtmls[i]
        const bodyOpenIdx = h.indexOf('<body>') + 6
        const bodyEnd = h.lastIndexOf('</body>')
        combined += `\n<div style="page-break-before:always">${h.substring(bodyOpenIdx, bodyEnd)}</div>`
      }
      combined += '</body></html>'
      html = combined
    }

    const modeUpperCase = firstPayload.mode === 'gerance' ? 'GÉRANCE' : 'COPROPRIÉTÉ'
    const agenceUpperCase = payloads.length === 1
      ? (firstPayload.agence || '').toUpperCase()
      : payloads.map((p: { agence?: string }) => p.agence || '').filter(Boolean).join(' · ').toUpperCase()
    const reportDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const footerTemplate = `
      <div style="-webkit-print-color-adjust:exact;color-adjust:exact;width:100%;box-sizing:border-box;padding:0 48px;height:32px;display:flex;justify-content:space-between;align-items:center;border-top:1.5px solid #C49A2E;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;font-size:7pt;background:#fff">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-weight:800;color:#C49A2E;letter-spacing:0.08em;font-size:7.5pt">CENTURY 21</span>
          <span style="color:#DCDCDC">&nbsp;·&nbsp;</span>
          <span style="color:#7A7A8C;letter-spacing:0.03em">AUDIT COMPTABLE ${modeUpperCase}</span>
          <span style="color:#DCDCDC">&nbsp;·&nbsp;</span>
          <span style="color:#9A9AB0">${agenceUpperCase}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="color:#BCBCCC">Généré le ${reportDate}</span>
          <span style="color:#DCDCDC">&nbsp;·&nbsp;</span>
          <span style="font-weight:700;color:#C49A2E;letter-spacing:0.04em"><span class="pageNumber"></span>&thinsp;/&thinsp;<span class="totalPages"></span></span>
        </div>
      </div>`

    // Dynamic import to avoid being bundled into the client chunk
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    })
    const page = await browser.newPage()
    page.setDefaultNavigationTimeout(0)
    page.setDefaultTimeout(0)
    await page.setContent(html, { waitUntil: 'domcontentloaded' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate,
      margin: { top: '0', right: '0', bottom: '36px', left: '0' },
    })
    await browser.close()

    const agenceSlug = payloads
      .map((p: { agence?: string }) => (p.agence || 'agence').replace(/[^a-zA-Z0-9]/g, '_'))
      .join('-')
    const modeLabel = firstPayload.mode === 'gerance' ? 'Gerance' : 'Copro'
    const filename = `Rapport_Audit_${modeLabel}_${agenceSlug}.pdf`

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json(
      { error: 'PDF generation failed', detail: String(err) },
      { status: 500 },
    )
  }
}
