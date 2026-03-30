/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['puppeteer', 'puppeteer-core', '@sparticuz/chromium'],

  // Inclure les fichiers binaires brotli de Chromium dans le bundle Vercel
  outputFileTracingIncludes: {
    '/api/rapport/pdf': ['./node_modules/@sparticuz/chromium/bin/**/*'],
    '/api/rapport/pdf-v2': ['./node_modules/@sparticuz/chromium/bin/**/*'],
    '/api/rapport/reporting': ['./node_modules/@sparticuz/chromium/bin/**/*'],
  },
}

module.exports = nextConfig
