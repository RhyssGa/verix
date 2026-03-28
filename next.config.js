/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['puppeteer', 'puppeteer-core'],
  },
}
module.exports = nextConfig
