import type {
  PulseEvent,
  PulseEventListParams,
  PulseMarket,
  PulsePriceHistory,
  PulsePricePoint,
} from '../contracts/pulse-events.js'
import { buildProviderScopedId } from './provider-ids.js'
import {
  fetchJson,
  formatCategory,
  normalizeText,
  toNumber,
} from './shared.js'
import type { MarketProvider } from './types.js'

const MANIFOLD_API_BASE =
  process.env.MANIFOLD_API_BASE?.trim() ?? 'https://api.manifold.markets/v0'
const MANIFOLD_MARKET_PAGE_LIMIT = 1000
const MANIFOLD_MAX_MARKET_PAGES = Number.parseInt(
  process.env.MANIFOLD_MAX_MARKET_PAGES ?? '10',
  10,
)
const MANIFOLD_PROBABILITY_BATCH_SIZE = 100
const MANIFOLD_DISCOVERY_CACHE_TTL_MS = 60_000
const MANIFOLD_HISTORY_PAGE_LIMIT = 1000
const MANIFOLD_HISTORY_MAX_PAGES = 12
const DAY_MS = 24 * 60 * 60 * 1000

type ManifoldLiteMarket = {
  closeTime?: number | null
  createdTime?: number | null
  creatorAvatarUrl?: string | null
  creatorName?: string | null
  creatorUsername?: string | null
  groupSlugs?: string[] | null
  id: string
  isResolved?: boolean | null
  lastBetTime?: number | null
  lastCommentTime?: number | null
  lastUpdatedTime?: number | null
  mechanism?: string | null
  outcomeType?: string | null
  probability?: number | string | null
  question: string
  resolution?: string | null
  resolutionTime?: number | null
  slug?: string | null
  textDescription?: string | null
  token?: string | null
  totalLiquidity?: number | string | null
  uniqueBettorCount?: number | string | null
  url?: string | null
  volume?: number | string | null
  volume24Hours?: number | string | null
}

type ManifoldProbabilityResponse = Record<
  string,
  {
    prob?: number | string | null
  }
>

type ManifoldProbabilityPointResponse = {
  prob?: number | string | null
}

type ManifoldBet = {
  createdTime: number
  id: string
  probAfter?: number | string | null
  probBefore?: number | string | null
}

type ManifoldDiscoverySnapshot = {
  closed: PulseEvent[]
  fetchedAt: number
  open: PulseEvent[]
}

const MANIFOLD_CATEGORY_ALIASES: Record<string, string> = {
  ai: 'Technology',
  basketball: 'Sports',
  bitcoin: 'Finance',
  business: 'Finance',
  celebrity: 'Culture',
  climate: 'Science',
  cricket: 'Sports',
  crypto: 'Finance',
  economics: 'Finance',
  election: 'Politics',
  elections: 'Politics',
  entertainment: 'Culture',
  finance: 'Finance',
  football: 'Sports',
  gaming: 'Culture',
  geopolitics: 'Politics',
  government: 'Politics',
  health: 'Science',
  machine_learning: 'Technology',
  middle_east: 'Politics',
  movies: 'Culture',
  music: 'Culture',
  nba: 'Sports',
  nfl: 'Sports',
  politics: 'Politics',
  premier_league: 'Sports',
  science: 'Science',
  soccer: 'Sports',
  sport: 'Sports',
  sports: 'Sports',
  stocks: 'Finance',
  tech: 'Technology',
  technology: 'Technology',
  tennis: 'Sports',
  trump: 'Politics',
  tv: 'Culture',
  us_politics: 'Politics',
  wars: 'Politics',
  weather: 'Science',
  world: 'Politics',
}

let discoverySnapshotCache: ManifoldDiscoverySnapshot | null = null
let discoverySnapshotPromise: Promise<ManifoldDiscoverySnapshot> | null = null

function clampProbability(value: number) {
  return Math.max(0, Math.min(1, value))
}

function toOptionalNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function toIsoString(timestamp?: number | string | null) {
  const numericTimestamp = toOptionalNumber(timestamp)

  if (numericTimestamp == null || numericTimestamp <= 0) {
    return null
  }

  return new Date(numericTimestamp).toISOString()
}

function normalizeManifoldStatus(market: ManifoldLiteMarket) {
  if (market.isResolved) {
    return 'closed'
  }

  const closeTime = toOptionalNumber(market.closeTime)

  if (closeTime != null && closeTime <= Date.now()) {
    return 'inactive'
  }

  return 'open'
}

function getManifoldSupportedCurrencies(token?: string | null) {
  const normalizedToken = normalizeText(token).toUpperCase()

  return normalizedToken ? [normalizedToken] : ['MANA']
}

function normalizeManifoldCategory(
  market: Pick<ManifoldLiteMarket, 'groupSlugs' | 'question' | 'slug'>,
) {
  const slugTokens = (market.groupSlugs ?? []).flatMap((slug) =>
    normalizeText(slug)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  )
  const textTokens = [
    normalizeText(market.question),
    normalizeText(market.slug),
  ]
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  const candidates = [...slugTokens, ...textTokens]

  for (const token of candidates) {
    const alias = MANIFOLD_CATEGORY_ALIASES[token]

    if (alias) {
      return alias
    }
  }

  if (/(\bvs\b|\bmatch\b|\bscore\b|\bwin\b|\bgoal\b)/i.test(market.question)) {
    return 'Sports'
  }

  return 'General'
}

function buildManifoldHashtags(groupSlugs?: string[] | null) {
  return (groupSlugs ?? [])
    .map((slug) => formatCategory(slug))
    .filter(Boolean)
    .slice(0, 5)
}

function buildManifoldAdditionalContext(
  market: ManifoldLiteMarket,
  hashtags: string[],
) {
  const details = [
    'Manifold is a play-money forecasting venue, so the price reflects forecaster sentiment rather than deployed capital.',
    hashtags.length ? `Tagged ${hashtags.slice(0, 3).join(', ')} on Manifold.` : null,
    market.uniqueBettorCount
      ? `${Math.round(toNumber(market.uniqueBettorCount))} unique bettors are active on this contract.`
      : null,
  ].filter(Boolean)

  return details.join(' ')
}

function mapManifoldMarket(
  market: Pick<
    ManifoldLiteMarket,
    | 'creatorAvatarUrl'
    | 'id'
    | 'isResolved'
    | 'probability'
    | 'question'
    | 'textDescription'
    | 'totalLiquidity'
    | 'uniqueBettorCount'
    | 'volume'
  >,
  probabilityOverride?: number | null,
): PulseMarket {
  const providerMarketId = market.id
  const rawProbability =
    probabilityOverride ?? toOptionalNumber(market.probability) ?? 0
  const yesPrice = clampProbability(rawProbability)

  return {
    feePercentage: 0,
    id: buildProviderScopedId('manifold', providerMarketId),
    imageUrl: normalizeText(market.creatorAvatarUrl) || null,
    liquidity: toNumber(market.totalLiquidity),
    noOutcome: {
      id: `${providerMarketId}-no`,
      label: 'No',
      price: clampProbability(1 - yesPrice),
    },
    providerMarketId,
    rules: normalizeText(market.textDescription),
    status: market.isResolved ? 'closed' : 'open',
    title: normalizeText(market.question) || providerMarketId,
    totalOrders: Math.round(toNumber(market.uniqueBettorCount)),
    totalVolume: toNumber(market.volume),
    yesOutcome: {
      id: `${providerMarketId}-yes`,
      label: 'Yes',
      price: yesPrice,
    },
  }
}

function mapManifoldEvent(
  market: ManifoldLiteMarket,
  probabilityOverride?: number | null,
): PulseEvent {
  const hashtags = buildManifoldHashtags(market.groupSlugs)
  const pulseMarket = mapManifoldMarket(market, probabilityOverride)
  const createdAt =
    toIsoString(market.createdTime) ??
    toIsoString(market.lastUpdatedTime) ??
    new Date(0).toISOString()
  const closingDate = toIsoString(market.closeTime)
  const resolutionDate =
    toIsoString(market.resolutionTime) ??
    closingDate

  return {
    additionalContext: buildManifoldAdditionalContext(market, hashtags),
    category: normalizeManifoldCategory(market),
    closingDate,
    countryCodes: [],
    createdAt,
    description: normalizeText(market.textDescription),
    engine: 'PLAY_MONEY',
    hashtags,
    id: buildProviderScopedId('manifold', market.id),
    imageUrl: normalizeText(market.creatorAvatarUrl) || null,
    liquidity: toNumber(market.totalLiquidity),
    markets: [pulseMarket],
    provider: 'manifold',
    providerEventId: market.id,
    regions: [],
    resolutionDate,
    resolutionSource: null,
    slug: normalizeText(market.slug) || `manifold-${market.id}`,
    sourceUrl: normalizeText(market.url) || null,
    status: normalizeManifoldStatus(market),
    supportedCurrencies: getManifoldSupportedCurrencies(market.token),
    title: normalizeText(market.question) || market.id,
    totalOrders: Math.round(toNumber(market.uniqueBettorCount)),
    totalVolume: toNumber(market.volume),
    type: 'BINARY',
  } satisfies PulseEvent
}

function isSupportedManifoldMarket(market: ManifoldLiteMarket) {
  return market.outcomeType === 'BINARY' && market.mechanism === 'cpmm-1'
}

function chunkValues<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }

  return chunks
}

async function getManifoldProbabilityMap(marketIds: string[]) {
  const probabilityMap = new Map<string, number>()

  for (const chunk of chunkValues(marketIds, MANIFOLD_PROBABILITY_BATCH_SIZE)) {
    if (chunk.length === 1) {
      const payload = await fetchJson<ManifoldProbabilityPointResponse>(
        `${MANIFOLD_API_BASE}/market/${encodeURIComponent(chunk[0])}/prob`,
      )
      const probability = toOptionalNumber(payload.prob)

      if (probability != null) {
        probabilityMap.set(chunk[0], clampProbability(probability))
      }

      continue
    }

    const searchParams = new URLSearchParams()

    for (const marketId of chunk) {
      searchParams.append('ids', marketId)
    }

    const payload = await fetchJson<ManifoldProbabilityResponse>(
      `${MANIFOLD_API_BASE}/market-probs?${searchParams.toString()}`,
    )

    for (const marketId of chunk) {
      const probability = toOptionalNumber(payload[marketId]?.prob)

      if (probability != null) {
        probabilityMap.set(marketId, clampProbability(probability))
      }
    }
  }

  return probabilityMap
}

async function crawlManifoldMarkets() {
  const markets: ManifoldLiteMarket[] = []
  let beforeTime: number | null = null

  for (let page = 0; page < MANIFOLD_MAX_MARKET_PAGES; page += 1) {
    const searchParams = new URLSearchParams({
      limit: String(MANIFOLD_MARKET_PAGE_LIMIT),
      sort: 'newest',
    })

    if (beforeTime != null) {
      searchParams.set('beforeTime', String(beforeTime))
    }

    const payload = await fetchJson<ManifoldLiteMarket[]>(
      `${MANIFOLD_API_BASE}/search-markets?${searchParams.toString()}`,
    )

    if (!payload.length) {
      break
    }

    markets.push(...payload.filter(isSupportedManifoldMarket))

    const nextBeforeTime = toOptionalNumber(payload[payload.length - 1]?.createdTime)

    if (
      payload.length < MANIFOLD_MARKET_PAGE_LIMIT ||
      nextBeforeTime == null ||
      nextBeforeTime === beforeTime
    ) {
      break
    }

    beforeTime = nextBeforeTime
  }

  const dedupedMarkets = new Map<string, ManifoldLiteMarket>()

  for (const market of markets) {
    dedupedMarkets.set(market.id, market)
  }

  return [...dedupedMarkets.values()]
}

async function fetchDiscoverySnapshot() {
  const rawMarkets = await crawlManifoldMarkets()
  const probabilityMap = await getManifoldProbabilityMap(
    rawMarkets.map((market) => market.id),
  )
  const events = rawMarkets.map((market) =>
    mapManifoldEvent(market, probabilityMap.get(market.id) ?? null),
  )

  return {
    closed: events.filter((event) => event.status === 'closed'),
    fetchedAt: Date.now(),
    open: events.filter((event) => event.status !== 'closed'),
  } satisfies ManifoldDiscoverySnapshot
}

async function getDiscoverySnapshot() {
  if (
    discoverySnapshotCache &&
    Date.now() - discoverySnapshotCache.fetchedAt < MANIFOLD_DISCOVERY_CACHE_TTL_MS
  ) {
    return discoverySnapshotCache
  }

  if (discoverySnapshotPromise) {
    return discoverySnapshotPromise
  }

  discoverySnapshotPromise = fetchDiscoverySnapshot()
    .then((snapshot) => {
      discoverySnapshotCache = snapshot

      return snapshot
    })
    .finally(() => {
      discoverySnapshotPromise = null
    })

  return discoverySnapshotPromise
}

function matchesKeyword(event: PulseEvent, keyword?: string) {
  const query = normalizeText(keyword).toLowerCase()

  if (!query) {
    return true
  }

  return [event.title, event.description, event.additionalContext, ...event.hashtags]
    .join(' ')
    .toLowerCase()
    .includes(query)
}

async function listManifoldEvents(params: PulseEventListParams = {}) {
  const snapshot = await getDiscoverySnapshot()
  const items = params.status === 'closed' ? snapshot.closed : snapshot.open

  return items.filter((event) => {
    if (
      params.category &&
      params.category !== 'All' &&
      event.category !== params.category
    ) {
      return false
    }

    return matchesKeyword(event, params.keyword)
  })
}

async function getManifoldEvent(eventId: string) {
  const payload = await fetchJson<ManifoldLiteMarket>(
    `${MANIFOLD_API_BASE}/market/${encodeURIComponent(eventId)}`,
  )

  if (!isSupportedManifoldMarket(payload)) {
    throw new Error('Manifold market is not a supported binary CPMM market.')
  }

  return mapManifoldEvent(payload, toOptionalNumber(payload.probability))
}

function buildHistoryWindow(event: PulseEvent, interval: string) {
  const now = Date.now()
  const createdAt = new Date(event.createdAt).getTime()
  const safeCreatedAt = Number.isNaN(createdAt) ? now - 30 * DAY_MS : createdAt

  if (interval === '1d') {
    return Math.max(safeCreatedAt, now - 2 * DAY_MS)
  }

  if (interval === '1w') {
    return Math.max(safeCreatedAt, now - 8 * DAY_MS)
  }

  if (interval === '1m') {
    return Math.max(safeCreatedAt, now - 35 * DAY_MS)
  }

  return safeCreatedAt
}

async function listManifoldBets(contractId: string, startTime: number) {
  const bets: ManifoldBet[] = []
  let beforeId: string | null = null

  for (let page = 0; page < MANIFOLD_HISTORY_MAX_PAGES; page += 1) {
    const searchParams = new URLSearchParams({
      contractId,
      limit: String(MANIFOLD_HISTORY_PAGE_LIMIT),
    })

    if (beforeId) {
      searchParams.set('before', beforeId)
    }

    const payload = await fetchJson<ManifoldBet[]>(
      `${MANIFOLD_API_BASE}/bets?${searchParams.toString()}`,
    )

    if (!payload.length) {
      break
    }

    bets.push(...payload)

    const oldestBet = payload[payload.length - 1]

    if (!oldestBet?.id || oldestBet.createdTime <= startTime) {
      break
    }

    beforeId = oldestBet.id
  }

  return bets
}

function dedupeHistoryPoints(points: PulsePricePoint[]) {
  const dedupedPoints: PulsePricePoint[] = []

  for (const point of points) {
    const previousPoint = dedupedPoints[dedupedPoints.length - 1]

    if (!previousPoint) {
      dedupedPoints.push(point)
      continue
    }

    if (previousPoint.timestamp === point.timestamp) {
      dedupedPoints[dedupedPoints.length - 1] = point
      continue
    }

    if (Math.abs(previousPoint.price - point.price) < 0.000001) {
      continue
    }

    dedupedPoints.push(point)
  }

  return dedupedPoints
}

function buildHistoryPoints(
  bets: ManifoldBet[],
  event: PulseEvent,
  startTime: number,
) {
  const ascendingBets = [...bets]
    .filter((bet) => toOptionalNumber(bet.probAfter) != null)
    .sort((leftBet, rightBet) => leftBet.createdTime - rightBet.createdTime)
  const relevantPoints = ascendingBets
    .filter((bet) => bet.createdTime >= startTime)
    .map((bet) => ({
      price: clampProbability(toNumber(bet.probAfter)),
      timestamp: bet.createdTime,
    }))
  const previousSource = [...ascendingBets]
    .reverse()
    .find(
      (bet) => bet.createdTime < startTime && toOptionalNumber(bet.probAfter) != null,
    )
  const previousInterval = previousSource
    ? {
        price: clampProbability(toNumber(previousSource.probAfter)),
        timestamp: previousSource.createdTime,
      }
    : undefined
  const points = dedupeHistoryPoints(relevantPoints)
  const currentPrice = event.markets[0]?.yesOutcome.price

  if (!points.length && previousInterval) {
    points.push(previousInterval)
  }

  if (!points.length && currentPrice != null) {
    points.push({
      price: currentPrice,
      timestamp: Date.now(),
    })
  }

  const latestPoint = points[points.length - 1]

  if (
    currentPrice != null &&
    (!latestPoint ||
      Math.abs(latestPoint.price - currentPrice) > 0.000001 ||
      Date.now() - latestPoint.timestamp > 30 * 60 * 1000)
  ) {
    points.push({
      price: currentPrice,
      timestamp: Date.now(),
    })
  }

  return {
    points: dedupeHistoryPoints(points),
    previousInterval,
  }
}

async function getManifoldPriceHistory({
  event,
  interval = '1d',
}: {
  event: PulseEvent
  interval?: string
}) {
  const primaryMarket = event.markets[0]

  if (!primaryMarket) {
    return {
      eventId: event.id,
      eventTitle: event.title,
      marketId: '',
      marketTitle: 'Primary market',
      points: [],
    } satisfies PulsePriceHistory
  }

  const startTime = buildHistoryWindow(event, interval)
  const bets = await listManifoldBets(event.providerEventId, startTime)
  const { points, previousInterval } = buildHistoryPoints(bets, event, startTime)

  return {
    eventId: event.id,
    eventTitle: event.title,
    marketId: primaryMarket.id,
    marketTitle: primaryMarket.title,
    points,
    previousInterval,
  } satisfies PulsePriceHistory
}

export const manifoldProvider: MarketProvider = {
  getEvent: getManifoldEvent,
  getPriceHistory: getManifoldPriceHistory,
  listEvents: listManifoldEvents,
  name: 'manifold',
}
