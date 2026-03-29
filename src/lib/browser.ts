/**
 * Lance un navigateur Puppeteer compatible prod (Vercel) et dev.
 * - Production : puppeteer-core + @sparticuz/chromium (pas de Chrome installé sur Vercel)
 * - Développement : puppeteer standard (Chrome téléchargé localement)
 */

export async function launchBrowser() {
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteer = (await import('puppeteer-core')).default

    const executablePath = await chromium.executablePath()

    if (!executablePath) {
      throw new Error('[browser] executablePath vide — @sparticuz/chromium n\'a pas pu résoudre le binaire Chromium')
    }

    return puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
      executablePath,
      headless: true,
    })
  }

  const puppeteer = (await import('puppeteer')).default
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
}
