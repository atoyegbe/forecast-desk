import type { FastifyPluginAsync } from 'fastify'
import { getSmartMoneyWallet } from '../app/smart-money-service.js'

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatSignedPercent(value: number) {
  const rounded = Math.round(value * 10) / 10

  if (rounded === 0) {
    return '0%'
  }

  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

function formatCompactUsd(value: number) {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`
  }

  return `$${Math.round(value).toLocaleString()}`
}

function buildWalletOgSvg(input: {
  address: string
  displayName: string
  marketCount: number
  rank: number
  roi: string
  score: number
  totalVolume: string
  winRate: string
}) {
  const walletLabel = escapeXml(input.displayName)
  const addressLabel = escapeXml(input.address)
  const roiLabel = escapeXml(input.roi)
  const volumeLabel = escapeXml(input.totalVolume)
  const winRateLabel = escapeXml(input.winRate)
  const rankLabel = escapeXml(`#${input.rank}`)
  const marketCountLabel = escapeXml(String(input.marketCount))

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${walletLabel} wallet profile on Quorum</title>
  <desc id="desc">Public smart money wallet profile with score, rank, ROI, and win rate.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0d0f10"/>
      <stop offset="0.52" stop-color="#101719"/>
      <stop offset="1" stop-color="#0b1220"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" rx="36" fill="url(#bg)"/>
  <rect x="48" y="48" width="1104" height="534" rx="28" fill="#12181a" stroke="#263036" stroke-width="2"/>
  <circle cx="126" cy="110" r="11" fill="#00c58e" fill-opacity="0.18" stroke="#00c58e" stroke-width="2"/>
  <text x="154" y="117" fill="#00c58e" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="24" letter-spacing="5.2">QUORUM</text>
  <text x="78" y="186" fill="#66747d" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20" letter-spacing="4">PUBLIC WALLET PROFILE</text>
  <text x="78" y="266" fill="#E7ECEE" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="56" font-weight="700">${walletLabel}</text>
  <text x="78" y="310" fill="#8A979F" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="24">${addressLabel}</text>

  <g transform="translate(78 372)">
    <rect width="228" height="136" rx="22" fill="#151C1E" stroke="#263036" stroke-width="2"/>
    <text x="28" y="38" fill="#66747d" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18" letter-spacing="3">SCORE</text>
    <text x="28" y="95" fill="#00c58e" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="48" font-weight="700">${input.score}</text>
  </g>

  <g transform="translate(330 372)">
    <rect width="228" height="136" rx="22" fill="#151C1E" stroke="#263036" stroke-width="2"/>
    <text x="28" y="38" fill="#66747d" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18" letter-spacing="3">RANK</text>
    <text x="28" y="95" fill="#E7ECEE" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="48" font-weight="700">${rankLabel}</text>
  </g>

  <g transform="translate(582 372)">
    <rect width="228" height="136" rx="22" fill="#151C1E" stroke="#263036" stroke-width="2"/>
    <text x="28" y="38" fill="#66747d" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18" letter-spacing="3">ROI</text>
    <text x="28" y="95" fill="${input.roi.startsWith('-') ? '#ef4444' : '#00c58e'}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="42" font-weight="700">${roiLabel}</text>
  </g>

  <g transform="translate(834 372)">
    <rect width="228" height="136" rx="22" fill="#151C1E" stroke="#263036" stroke-width="2"/>
    <text x="28" y="38" fill="#66747d" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18" letter-spacing="3">WIN RATE</text>
    <text x="28" y="95" fill="#E7ECEE" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="42" font-weight="700">${winRateLabel}</text>
  </g>

  <text x="78" y="554" fill="#8A979F" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="22">Volume ${volumeLabel} · ${marketCountLabel} markets traded · Public prediction market intelligence</text>
</svg>`
}

export const ogRoute: FastifyPluginAsync = async (app) => {
  app.get<{
    Params: {
      address: string
    }
  }>('/og/wallets/:address.svg', async (request, reply) => {
    try {
      const walletDetail = await getSmartMoneyWallet(request.params.address)
      const walletLabel =
        walletDetail.wallet.displayName || walletDetail.wallet.shortAddress
      const svg = buildWalletOgSvg({
        address: walletDetail.wallet.shortAddress,
        displayName: walletLabel,
        marketCount: walletDetail.wallet.marketCount,
        rank: walletDetail.wallet.rank,
        roi: formatSignedPercent(walletDetail.wallet.roi),
        score: walletDetail.wallet.score,
        totalVolume: formatCompactUsd(walletDetail.wallet.totalVolume),
        winRate: `${Math.round(walletDetail.wallet.winRate * 100)}%`,
      })

      reply.header('cache-control', 'public, max-age=600, stale-while-revalidate=3600')
      reply.type('image/svg+xml')

      return svg
    } catch {
      reply.code(404)
      reply.type('image/svg+xml')

      return `<?xml version="1.0" encoding="UTF-8"?><svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" rx="36" fill="#0d0f10"/><text x="80" y="170" fill="#00c58e" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="24" letter-spacing="4">QUORUM</text><text x="80" y="290" fill="#E7ECEE" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="56" font-weight="700">Wallet profile not found</text><text x="80" y="350" fill="#8A979F" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="24">Public prediction market intelligence</text></svg>`
    }
  })
}
