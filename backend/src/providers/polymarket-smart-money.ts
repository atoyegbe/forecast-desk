import { fetchJson, normalizeText, toNumber } from './shared.js'

const POLYMARKET_DATA_API_BASE =
  process.env.POLYMARKET_DATA_API_BASE ?? 'https://data-api.polymarket.com'

const DEFAULT_BROWSER_USER_AGENT = 'Mozilla/5.0'
const PAGE_LIMIT = 50
const MAX_PAGES = 4
const TRADE_DISCOVERY_PAGE_LIMIT = 500
const TRADE_DISCOVERY_MAX_PAGES = 3

type PolymarketLeaderboardEntry = {
  pnl?: number | string | null
  profileImage?: string | null
  proxyWallet: string
  rank?: number | string | null
  userName?: string | null
  verifiedBadge?: boolean | null
  vol?: number | string | null
  xUsername?: string | null
}

export type PolymarketWalletPosition = {
  asset?: string | null
  avgPrice?: number | string | null
  cashPnl?: number | string | null
  conditionId: string
  curPrice?: number | string | null
  currentValue?: number | string | null
  endDate?: string | null
  eventId?: number | string | null
  eventSlug?: string | null
  icon?: string | null
  initialValue?: number | string | null
  outcome?: string | null
  outcomeIndex?: number | string | null
  percentPnl?: number | string | null
  proxyWallet: string
  realizedPnl?: number | string | null
  size?: number | string | null
  slug?: string | null
  title?: string | null
  totalBought?: number | string | null
}

export type PolymarketWalletClosedPosition = {
  avgPrice?: number | string | null
  conditionId: string
  curPrice?: number | string | null
  endDate?: string | null
  eventId?: number | string | null
  eventSlug?: string | null
  icon?: string | null
  outcome?: string | null
  proxyWallet: string
  realizedPnl?: number | string | null
  timestamp?: number | string | null
  title?: string | null
  totalBought?: number | string | null
}

export type PolymarketWalletActivity = {
  conditionId: string
  eventSlug?: string | null
  icon?: string | null
  name?: string | null
  outcome?: string | null
  price?: number | string | null
  profileImage?: string | null
  profileImageOptimized?: string | null
  proxyWallet: string
  pseudonym?: string | null
  side?: string | null
  slug?: string | null
  timestamp?: number | string | null
  title?: string | null
  transactionHash?: string | null
  type?: string | null
  usdcSize?: number | string | null
}

export type PolymarketTrade = {
  price?: number | string | null
  profileImage?: string | null
  profileImageOptimized?: string | null
  proxyWallet: string
  pseudonym?: string | null
  side?: string | null
  size?: number | string | null
  timestamp?: number | string | null
  type?: string | null
}

export type SmartMoneySeedWallet = {
  address: string
  displayName?: string | null
  profileImageUrl?: string | null
  sourcePnl: number
  sourceRank?: number | null
  sourceVolume: number
  verifiedBadge: boolean
  xUsername?: string | null
}

type DiscoveredWalletStats = {
  address: string
  displayName?: string | null
  lastActivityTimestamp: number
  profileImageUrl?: string | null
  recentTradeCount: number
  recentVolume: number
}

function createDataApiHeaders() {
  return {
    Accept: 'application/json',
    'User-Agent': DEFAULT_BROWSER_USER_AGENT,
  }
}

async function fetchPolymarketDataJson<T>(path: string) {
  return fetchJson<T>(`${POLYMARKET_DATA_API_BASE}${path}`, {
    headers: createDataApiHeaders(),
  })
}

async function paginatePolymarketData<T>(path: string) {
  const items: T[] = []

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const offset = pageIndex * PAGE_LIMIT
    const searchParams = new URLSearchParams({
      limit: String(PAGE_LIMIT),
      offset: String(offset),
    })
    const separator = path.includes('?') ? '&' : '?'
    const batch = await fetchPolymarketDataJson<T[]>(
      `${path}${separator}${searchParams.toString()}`,
    )

    items.push(...batch)

    if (batch.length < PAGE_LIMIT) {
      break
    }
  }

  return items
}

export async function listPolymarketLeaderboardWallets(limit: number) {
  const searchParams = new URLSearchParams({
    category: 'OVERALL',
    limit: String(limit),
    orderBy: 'PNL',
    timePeriod: 'MONTH',
  })
  const entries = await fetchPolymarketDataJson<PolymarketLeaderboardEntry[]>(
    `/v1/leaderboard?${searchParams.toString()}`,
  )

  return entries.map(
    (entry): SmartMoneySeedWallet => ({
      address: normalizeText(entry.proxyWallet).toLowerCase(),
      displayName: normalizeText(entry.userName) || null,
      profileImageUrl: normalizeText(entry.profileImage) || null,
      sourcePnl: toNumber(entry.pnl),
      sourceRank: toNumber(entry.rank) || null,
      sourceVolume: toNumber(entry.vol),
      verifiedBadge: Boolean(entry.verifiedBadge),
      xUsername: normalizeText(entry.xUsername) || null,
    }),
  )
}

function getTradeUsdSize(input: Pick<PolymarketTrade, 'price' | 'size'>) {
  const price = toNumber(input.price)
  const shareCount = toNumber(input.size)

  if (price > 0 && price <= 1) {
    return shareCount * price
  }

  return shareCount
}

export async function discoverPolymarketTradeWallets(input: {
  daysBack: number
  limit: number
}) {
  const cutoff = Date.now() - input.daysBack * 24 * 60 * 60 * 1000
  const walletStats = new Map<string, DiscoveredWalletStats>()

  for (let pageIndex = 0; pageIndex < TRADE_DISCOVERY_MAX_PAGES; pageIndex += 1) {
    const searchParams = new URLSearchParams({
      limit: String(TRADE_DISCOVERY_PAGE_LIMIT),
      offset: String(pageIndex * TRADE_DISCOVERY_PAGE_LIMIT),
      side: 'BUY',
    })
    const trades = await fetchPolymarketDataJson<PolymarketTrade[]>(
      `/trades?${searchParams.toString()}`,
    )
    let reachedCutoff = false

    for (const trade of trades) {
      const walletAddress = normalizeText(trade.proxyWallet).toLowerCase()
      const timestamp = toNumber(trade.timestamp) * 1000

      if (!walletAddress || timestamp <= 0) {
        continue
      }

      if (timestamp < cutoff) {
        reachedCutoff = true
        continue
      }

      const currentStats = walletStats.get(walletAddress) ?? {
        address: walletAddress,
        displayName: normalizeText(trade.pseudonym) || null,
        lastActivityTimestamp: timestamp,
        profileImageUrl:
          normalizeText(trade.profileImageOptimized) ||
          normalizeText(trade.profileImage) ||
          null,
        recentTradeCount: 0,
        recentVolume: 0,
      }

      currentStats.lastActivityTimestamp = Math.max(
        currentStats.lastActivityTimestamp,
        timestamp,
      )
      currentStats.recentTradeCount += 1
      currentStats.recentVolume += getTradeUsdSize(trade)

      if (!currentStats.displayName) {
        currentStats.displayName = normalizeText(trade.pseudonym) || null
      }

      if (!currentStats.profileImageUrl) {
        currentStats.profileImageUrl =
          normalizeText(trade.profileImageOptimized) ||
          normalizeText(trade.profileImage) ||
          null
      }

      walletStats.set(walletAddress, currentStats)
    }

    if (trades.length < TRADE_DISCOVERY_PAGE_LIMIT || reachedCutoff) {
      break
    }
  }

  return [...walletStats.values()]
    .sort((leftWallet, rightWallet) => {
      if (rightWallet.recentVolume !== leftWallet.recentVolume) {
        return rightWallet.recentVolume - leftWallet.recentVolume
      }

      if (rightWallet.recentTradeCount !== leftWallet.recentTradeCount) {
        return rightWallet.recentTradeCount - leftWallet.recentTradeCount
      }

      return rightWallet.lastActivityTimestamp - leftWallet.lastActivityTimestamp
    })
    .slice(0, input.limit)
    .map(
      (wallet): SmartMoneySeedWallet => ({
        address: wallet.address,
        displayName: wallet.displayName ?? null,
        profileImageUrl: wallet.profileImageUrl ?? null,
        sourcePnl: 0,
        sourceRank: null,
        sourceVolume: wallet.recentVolume,
        verifiedBadge: false,
        xUsername: null,
      }),
    )
}

export function listPolymarketWalletPositions(walletAddress: string) {
  return paginatePolymarketData<PolymarketWalletPosition>(
    `/positions?user=${encodeURIComponent(walletAddress)}`,
  )
}

export function listPolymarketWalletClosedPositions(walletAddress: string) {
  return paginatePolymarketData<PolymarketWalletClosedPosition>(
    `/closed-positions?user=${encodeURIComponent(walletAddress)}`,
  )
}

export async function listPolymarketWalletActivity(
  walletAddress: string,
  limit = 30,
) {
  const searchParams = new URLSearchParams({
    limit: String(limit),
    user: walletAddress,
  })

  return fetchPolymarketDataJson<PolymarketWalletActivity[]>(
    `/activity?${searchParams.toString()}`,
  )
}
