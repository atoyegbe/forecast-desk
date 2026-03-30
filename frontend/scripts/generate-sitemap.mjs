import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(scriptDir, '..')
const publicDir = resolve(frontendRoot, 'public')
const siteOrigin = (
  process.env.QUORUM_PUBLIC_SITE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : 'http://localhost:5173')
).replace(/\/$/, '')
const backendApiBase = (
  process.env.QUORUM_PUBLIC_BACKEND_API_BASE ||
  'http://127.0.0.1:8787/api/v1'
).replace(/\/$/, '')

const corePaths = [
  '/',
  '/markets',
  '/divergence',
  '/smart-money',
  '/smart-money/leaderboard',
]

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

async function fetchWalletPaths() {
  try {
    const response = await fetch(`${backendApiBase}/smart-money/wallets?limit=200`)

    if (!response.ok) {
      throw new Error(`wallet fetch failed (${response.status})`)
    }

    const payload = await response.json()
    const items = payload?.data?.items

    if (!Array.isArray(items)) {
      return []
    }

    return items
      .map((wallet) => {
        const address =
          typeof wallet?.address === 'string' ? wallet.address.toLowerCase() : ''

        return address ? `/smart-money/wallets/${address}` : null
      })
      .filter(Boolean)
  } catch (error) {
    console.warn(
      `[generate-sitemap] Falling back to core routes only: ${error instanceof Error ? error.message : 'unknown error'}`,
    )

    return []
  }
}

async function main() {
  await mkdir(publicDir, { recursive: true })
  const walletPaths = await fetchWalletPaths()
  const urls = [...new Set([...corePaths, ...walletPaths])]
  const generatedAt = new Date().toISOString()

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (path) => `  <url>
    <loc>${escapeXml(`${siteOrigin}${path}`)}</loc>
    <lastmod>${generatedAt}</lastmod>
  </url>`,
  )
  .join('\n')}
</urlset>
`

  const robots = `User-agent: *
Allow: /
Disallow: /alerts
Disallow: /unsubscribe

Sitemap: ${siteOrigin}/sitemap.xml
`

  await writeFile(resolve(publicDir, 'sitemap.xml'), sitemap, 'utf8')
  await writeFile(resolve(publicDir, 'robots.txt'), robots, 'utf8')
}

await main()
