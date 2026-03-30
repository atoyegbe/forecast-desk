import type { PageMetadataInput } from '../../lib/page-metadata'
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatSignedPercent,
} from '../../lib/format'
import type { PulseSmartMoneyWalletDetail } from './types'

type WalletSeoOptions = {
  backendOrigin?: string | null
  siteOrigin?: string | null
}

function normalizeOrigin(origin?: string | null) {
  return origin?.trim().replace(/\/$/, '') || ''
}

export function getWalletCanonicalPath(walletAddress: string) {
  return `/smart-money/wallets/${walletAddress.toLowerCase()}`
}

export function getWalletLabel(walletDetail: PulseSmartMoneyWalletDetail | null) {
  if (!walletDetail) {
    return 'Wallet'
  }

  return walletDetail.wallet.displayName || walletDetail.wallet.shortAddress
}

export function buildWalletSummary(walletDetail: PulseSmartMoneyWalletDetail) {
  const walletLabel = getWalletLabel(walletDetail)
  const leadCategories = walletDetail.categoryStats
    .slice(0, 2)
    .map((categoryStat) => categoryStat.category)
  const categorySummary = leadCategories.length
    ? `Best historical categories: ${leadCategories.join(' and ')}.`
    : 'Category performance is still building.'

  return `${walletLabel} is ranked #${walletDetail.wallet.rank} overall with a ${Math.round(walletDetail.wallet.winRate * 100)}% win rate, ${formatSignedPercent(walletDetail.wallet.roi)} ROI, and ${formatCompactNumber(walletDetail.openPositions.length)} open positions. ${categorySummary}`
}

export function buildWalletMetadata(
  walletAddress: string,
  walletDetail: PulseSmartMoneyWalletDetail | null,
  options: WalletSeoOptions = {},
): PageMetadataInput & {
  canonicalUrl?: string
  walletLabel: string
} {
  const canonicalPath = getWalletCanonicalPath(walletAddress)
  const normalizedBackendOrigin = normalizeOrigin(options.backendOrigin)
  const normalizedSiteOrigin = normalizeOrigin(options.siteOrigin)
  const walletLabel = getWalletLabel(walletDetail)
  const canonicalUrl = normalizedSiteOrigin
    ? `${normalizedSiteOrigin}${canonicalPath}`
    : undefined
  const imageUrl = normalizedBackendOrigin
    ? `${normalizedBackendOrigin}/og/wallets/${walletAddress.toLowerCase()}.svg`
    : undefined

  if (!walletDetail) {
    return {
      canonicalPath,
      canonicalUrl,
      description:
        'Track public smart money wallet performance, recent signals, and open positions on Quorum.',
      imageUrl,
      title: 'Wallet Profile | Quorum',
      walletLabel,
    }
  }

  const winRate = Math.round(walletDetail.wallet.winRate * 100)
  const roi = formatSignedPercent(walletDetail.wallet.roi)
  const title = `${walletLabel} Wallet Profile | Quorum`
  const description = `Track ${walletLabel}'s score ${walletDetail.wallet.score}, rank #${walletDetail.wallet.rank}, ${winRate}% win rate, ${roi} ROI, and recent public market signals on Quorum.`

  return {
    canonicalPath,
    canonicalUrl,
    description,
    imageUrl,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      description,
      mainEntity: {
        '@type': 'Thing',
        identifier: walletDetail.wallet.address.toLowerCase(),
        name: walletLabel,
      },
      name: title,
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
    },
    title,
    walletLabel,
  }
}

export function buildWalletPrerenderStats(walletDetail: PulseSmartMoneyWalletDetail) {
  return [
    {
      label: 'Score',
      value: String(walletDetail.wallet.score),
    },
    {
      label: 'Rank',
      value: `#${walletDetail.wallet.rank}`,
    },
    {
      label: 'Win rate',
      value: `${Math.round(walletDetail.wallet.winRate * 100)}%`,
    },
    {
      label: 'ROI',
      value: formatSignedPercent(walletDetail.wallet.roi),
    },
    {
      label: 'Volume',
      value: formatCompactCurrency(walletDetail.wallet.totalVolume, 'USD'),
    },
    {
      label: 'Markets traded',
      value: formatCompactNumber(walletDetail.wallet.marketCount),
    },
  ]
}
