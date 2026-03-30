import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import {
  dirname,
  resolve,
} from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildWalletMetadata,
  buildWalletPrerenderStats,
  buildWalletSummary,
  getWalletLabel,
} from '../src/features/smart-money/seo.ts'
import {
  serializePrerenderedWalletPayload,
  type QuorumPrerenderedWalletPayload,
} from '../src/features/smart-money/prerender.ts'
import {
  formatDate,
  formatSignedProbabilityChange,
  formatSignedPercent,
  formatTimeAgo,
} from '../src/lib/format.ts'
import type {
  PulseSmartMoneyWallet,
  PulseSmartMoneyWalletDetail,
} from '../src/features/smart-money/types.ts'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(scriptDir, '..')
const distDir = resolve(frontendRoot, 'dist')
const routeOutputDir = resolve(distDir, 'smart-money', 'wallets')
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
const backendOrigin = backendApiBase.replace(/\/api\/v1$/, '')
const walletLimit = Math.max(
  1,
  Number.parseInt(process.env.QUORUM_PRERENDER_WALLET_LIMIT || '50', 10) || 50,
)

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeAttribute(value: string) {
  return escapeHtml(value)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeJsonForScript(value: string) {
  return value
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
}

function upsertMetaTag(
  html: string,
  input: {
    attr: 'name' | 'property'
    content: string
    key: string
  },
) {
  const replacement = `<meta ${input.attr}="${input.key}" content="${escapeAttribute(input.content)}" />`
  const pattern = new RegExp(
    `<meta[^>]+${input.attr}=["']${escapeRegExp(input.key)}["'][^>]*>`,
    'i',
  )

  if (pattern.test(html)) {
    return html.replace(pattern, replacement)
  }

  return html.replace('</head>', `  ${replacement}\n</head>`)
}

function upsertCanonicalLink(html: string, href: string) {
  const replacement = `<link rel="canonical" href="${escapeAttribute(href)}" />`
  const pattern = /<link[^>]+rel=["']canonical["'][^>]*>/i

  if (pattern.test(html)) {
    return html.replace(pattern, replacement)
  }

  return html.replace('</head>', `  ${replacement}\n</head>`)
}

function upsertJsonLd(html: string, jsonLd: Record<string, unknown> | null | undefined) {
  const pattern =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*data-quorum-jsonld=["']page["'][^>]*>[\s\S]*?<\/script>/i
  const withoutExisting = html.replace(pattern, '')

  if (!jsonLd) {
    return withoutExisting
  }

  const script = `  <script type="application/ld+json" data-quorum-jsonld="page">${escapeJsonForScript(JSON.stringify(jsonLd))}</script>\n`

  return withoutExisting.replace('</head>', `${script}</head>`)
}

function buildEventHref(signal: PulseSmartMoneyWalletDetail['recentSignals'][number]) {
  if (!signal.eventId) {
    return null
  }

  return `${siteOrigin}/events/${encodeURIComponent(signal.eventId)}/${encodeURIComponent(signal.eventSlug)}`
}

function renderSignalItems(detail: PulseSmartMoneyWalletDetail) {
  const signals = detail.recentSignals.slice(0, 3)

  if (!signals.length) {
    return '<p style="margin:16px 0 0;color:#8a9399;font-size:14px;line-height:1.6;">Recent signal context is still building for this wallet.</p>'
  }

  return `<ul style="margin:16px 0 0;padding:0;list-style:none;">${signals
    .map((signal) => {
      const eventHref = buildEventHref(signal)
      const signalTitle = escapeHtml(signal.marketTitle)
      const detailLine = `${signal.outcome} @ ${(signal.entryPrice * 100).toFixed(signal.entryPrice < 0.1 ? 1 : 0)}% · ${formatSignedProbabilityChange(signal.priceDelta)}`

      return `<li style="padding:14px 0;border-top:1px solid #1f2528;">
        <div style="font-size:15px;font-weight:600;line-height:1.45;color:#e8eaeb;">${eventHref ? `<a href="${escapeAttribute(eventHref)}" style="color:#e8eaeb;text-decoration:none;">${signalTitle}</a>` : signalTitle}</div>
        <div style="margin-top:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.6;color:#8a9399;">${escapeHtml(detailLine)} · ${escapeHtml(formatTimeAgo(signal.signalAt))}</div>
      </li>`
    })
    .join('')}</ul>`
}

function renderWalletSnapshot(
  detail: PulseSmartMoneyWalletDetail,
  walletPath: string,
) {
  const walletLabel = getWalletLabel(detail)
  const summary = buildWalletSummary(detail)
  const statMarkup = buildWalletPrerenderStats(detail)
    .map(
      (stat) => `<div style="border:1px solid #1f2528;border-radius:12px;background:#12181a;padding:14px 16px;">
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#66747d;">${escapeHtml(stat.label)}</div>
        <div style="margin-top:8px;font-size:22px;font-weight:600;line-height:1.2;color:#e8eaeb;">${escapeHtml(stat.value)}</div>
      </div>`,
    )
    .join('')

  return `<main data-quorum-prerender="wallet" style="min-height:100vh;background:#0d0f10;color:#e8eaeb;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:960px;margin:0 auto;padding:48px 24px 72px;">
      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#66747d;">Public wallet profile</div>
      <h1 style="margin:16px 0 0;font-size:44px;line-height:1.1;font-weight:700;color:#e8eaeb;">${escapeHtml(walletLabel)}</h1>
      <p style="margin:10px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;line-height:1.6;color:#8a9399;">${escapeHtml(detail.wallet.shortAddress)} · Active ${escapeHtml(formatTimeAgo(detail.wallet.lastActiveAt || detail.wallet.freshness?.syncedAt || null))}</p>
      <p style="max-width:760px;margin:18px 0 0;font-size:16px;line-height:1.7;color:#c7d0d5;">${escapeHtml(summary)}</p>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:28px;">
        ${statMarkup}
      </div>

      <section style="margin-top:36px;">
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#66747d;">Recent signals</div>
        ${renderSignalItems(detail)}
      </section>

      <div style="margin-top:28px;">
        <a href="${escapeAttribute(`${siteOrigin}${walletPath}`)}" style="display:inline-flex;align-items:center;border:1px solid #00c58e;border-radius:999px;padding:10px 16px;font-size:14px;font-weight:600;color:#00c58e;text-decoration:none;">Open live wallet page on Quorum</a>
      </div>
    </div>
  </main>`
}

function injectWalletHtml(
  templateHtml: string,
  input: {
    bodyHtml: string
    canonicalUrl: string
    description: string
    imageUrl?: string
    jsonLd?: Record<string, unknown> | null
    payload: QuorumPrerenderedWalletPayload
    title: string
  },
) {
  let html = templateHtml

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(input.title)}</title>`)
  html = upsertMetaTag(html, {
    attr: 'name',
    content: input.description,
    key: 'description',
  })
  html = upsertMetaTag(html, {
    attr: 'property',
    content: input.title,
    key: 'og:title',
  })
  html = upsertMetaTag(html, {
    attr: 'property',
    content: input.description,
    key: 'og:description',
  })
  html = upsertMetaTag(html, {
    attr: 'property',
    content: input.canonicalUrl,
    key: 'og:url',
  })
  html = upsertMetaTag(html, {
    attr: 'property',
    content: 'profile',
    key: 'og:type',
  })
  html = upsertMetaTag(html, {
    attr: 'name',
    content: input.title,
    key: 'twitter:title',
  })
  html = upsertMetaTag(html, {
    attr: 'name',
    content: input.description,
    key: 'twitter:description',
  })
  html = upsertMetaTag(html, {
    attr: 'name',
    content: input.imageUrl ? 'summary_large_image' : 'summary',
    key: 'twitter:card',
  })

  if (input.imageUrl) {
    html = upsertMetaTag(html, {
      attr: 'property',
      content: input.imageUrl,
      key: 'og:image',
    })
    html = upsertMetaTag(html, {
      attr: 'name',
      content: input.imageUrl,
      key: 'twitter:image',
    })
  }

  html = upsertCanonicalLink(html, input.canonicalUrl)
  html = upsertJsonLd(html, input.jsonLd)

  const prerenderScript = `<script>window.__QUORUM_PRERENDERED_WALLET__=${serializePrerenderedWalletPayload(input.payload)}</script>`

  return html.replace(
    '<div id="root"></div>',
    `<div id="root">${input.bodyHtml}</div>\n    ${prerenderScript}`,
  )
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`request failed (${response.status}) for ${url}`)
  }

  return response.json() as Promise<{ data: T }>
}

async function listWallets() {
  const payload = await fetchJson<{ items: PulseSmartMoneyWallet[] }>(
    `${backendApiBase}/smart-money/wallets?limit=${walletLimit}`,
  )

  return Array.isArray(payload.data.items) ? payload.data.items : []
}

async function getWalletDetail(address: string) {
  const payload = await fetchJson<PulseSmartMoneyWalletDetail>(
    `${backendApiBase}/smart-money/wallets/${encodeURIComponent(address.toLowerCase())}`,
  )

  return payload.data
}

async function prerenderWalletPages() {
  const templateHtml = await readFile(resolve(distDir, 'index.html'), 'utf8')
  let wallets: PulseSmartMoneyWallet[] = []

  try {
    wallets = await listWallets()
  } catch (error) {
    console.warn(
      `[prerender-wallet-pages] Skipping wallet prerender: ${error instanceof Error ? error.message : 'unknown error'}`,
    )
    return
  }

  await rm(routeOutputDir, {
    force: true,
    recursive: true,
  })

  let renderedCount = 0

  for (const wallet of wallets) {
    try {
      const detail = await getWalletDetail(wallet.address)
      const metadata = buildWalletMetadata(wallet.address, detail, {
        backendOrigin,
        siteOrigin,
      })
      const routeDir = resolve(routeOutputDir, wallet.address.toLowerCase())
      const routeHtml = injectWalletHtml(templateHtml, {
        bodyHtml: renderWalletSnapshot(detail, metadata.canonicalPath || '/smart-money'),
        canonicalUrl: metadata.canonicalUrl || `${siteOrigin}${metadata.canonicalPath || '/smart-money'}`,
        description: metadata.description || 'Public wallet profile on Quorum.',
        imageUrl: metadata.imageUrl,
        jsonLd: metadata.jsonLd,
        payload: {
          address: wallet.address.toLowerCase(),
          data: detail,
          generatedAt: new Date().toISOString(),
        },
        title: metadata.title,
      })

      await mkdir(routeDir, { recursive: true })
      await writeFile(resolve(routeDir, 'index.html'), routeHtml, 'utf8')
      renderedCount += 1
    } catch (error) {
      console.warn(
        `[prerender-wallet-pages] Skipping ${wallet.address}: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
    }
  }

  console.log(
    `[prerender-wallet-pages] Rendered ${renderedCount} wallet page${renderedCount === 1 ? '' : 's'}.`,
  )
}

await prerenderWalletPages()
