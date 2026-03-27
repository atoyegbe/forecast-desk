import { fetchJson, normalizeText, toNumber } from './shared.js'

const POLYMARKET_DATA_API_BASE =
  process.env.POLYMARKET_DATA_API_BASE ?? 'https://data-api.polymarket.com'

const DEFAULT_BROWSER_USER_AGENT = 'Mozilla/5.0'
const PAGE_LIMIT = 50
const MAX_PAGES = 4

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
