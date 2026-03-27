import type {
  PulseEvent,
  PulseEventListParams,
  PulseMarket,
  PulsePriceHistory,
} from '../contracts/pulse-events.js'
import { buildProviderScopedId } from './provider-ids.js'
import {
  fetchJson,
  formatCategory,
  isPresent,
  normalizeText,
  parseJsonArray,
  toNumber,
} from './shared.js'
import type { MarketProvider } from './types.js'

const POLYMARKET_GAMMA_BASE =
  process.env.POLYMARKET_GAMMA_BASE ?? 'https://gamma-api.polymarket.com'
const POLYMARKET_CLOB_BASE =
  process.env.POLYMARKET_CLOB_BASE ?? 'https://clob.polymarket.com'
const POLYMARKET_SOURCE_BASE = 'https://polymarket.com/event'
const POLYMARKET_EVENT_LIMIT = 200

type PolymarketTag = {
  label?: string | null
  name?: string | null
  slug?: string | null
}

type PolymarketMarket = {
  active?: boolean
  closed?: boolean
  clobTokenIds?: string | string[] | null
  description?: string | null
  icon?: string | null
  id: string | number
  image?: string | null
  liquidity?: number | string | null
  outcomePrices?: string | Array<number | string> | null
  outcomes?: string | string[] | null
  question?: string | null
  resolutionSource?: string | null
  slug?: string | null
  volume?: number | string | null
}

type PolymarketEvent = {
  active?: boolean
  archived?: boolean
  category?: string | null
  closed?: boolean
  createdAt?: string | null
  description?: string | null
  endDate?: string | null
  icon?: string | null
  id: string | number
  image?: string | null
  liquidity?: number | string | null
  markets?: PolymarketMarket[]
  slug?: string | null
  startDate?: string | null
  tags?: PolymarketTag[]
  title: string
  volume?: number | string | null
}

type PolymarketPriceHistoryResponse = {
  history?: Array<{
    p: number | string
    t: number
  }>
}

const POLYMARKET_CATEGORY_ALIASES: Record<string, string> = {
  ai: 'Technology',
  business: 'Finance',
  celebrity: 'Culture',
  celebrities: 'Culture',
  culture: 'Culture',
  crypto: 'Finance',
  economy: 'Finance',
  election: 'Politics',
  entertainment: 'Culture',
  finance: 'Finance',
  games: 'Culture',
  gaming: 'Culture',
  geopolitics: 'Politics',
  movies: 'Culture',
  music: 'Culture',
  political: 'Politics',
  politics: 'Politics',
  science: 'Technology',
  social: 'Culture',
  sports: 'Sports',
  sport: 'Sports',
  tech: 'Technology',
  technology: 'Technology',
  world: 'Politics',
}

function getPolymarketTags(event: PolymarketEvent) {
  return (event.tags ?? [])
    .map((tag) => normalizeText(tag.label ?? tag.name ?? tag.slug ?? ''))
    .filter(Boolean)
}

function normalizePolymarketCategory(event: PolymarketEvent) {
  const candidates = [normalizeText(event.category), ...getPolymarketTags(event)]
    .filter(Boolean)

  for (const candidate of candidates) {
    const alias = POLYMARKET_CATEGORY_ALIASES[candidate.toLowerCase()]

    if (alias) {
      return alias
    }
  }

  return candidates[0] ? formatCategory(candidates[0]) : 'General'
}

function getPolymarketStatus(active?: boolean, closed?: boolean) {
  if (closed) {
    return 'closed'
  }

  if (active === false) {
    return 'inactive'
  }

  return 'open'
}

function getPolymarketSourceUrl(slug?: string | null) {
  return slug ? `${POLYMARKET_SOURCE_BASE}/${slug}` : null
}

function getBinaryMarketShape(market: PolymarketMarket) {
  const labels = parseJsonArray<string>(market.outcomes).map((label) =>
    normalizeText(String(label)),
  )
  const prices = parseJsonArray<number | string>(market.outcomePrices).map(toNumber)
  const tokenIds = parseJsonArray<string>(market.clobTokenIds).map((tokenId) =>
    String(tokenId),
  )
  const normalizedLabels = labels.map((label) => label.toLowerCase())
  const yesIndex = normalizedLabels.indexOf('yes')
  const noIndex = normalizedLabels.indexOf('no')

  if (
    yesIndex === -1 ||
    noIndex === -1 ||
    prices.length <= Math.max(yesIndex, noIndex) ||
    tokenIds.length <= Math.max(yesIndex, noIndex)
  ) {
    return null
  }

  return {
    labels,
    noIndex,
    prices,
    tokenIds,
    yesIndex,
  }
}

function mapPolymarketMarket(market: PolymarketMarket): PulseMarket | null {
  const binaryShape = getBinaryMarketShape(market)

  if (!binaryShape) {
    return null
  }

  const providerMarketId = String(market.id)

  return {
    feePercentage: 0,
    id: buildProviderScopedId('polymarket', providerMarketId),
    imageUrl: market.image ?? market.icon ?? null,
    liquidity: toNumber(market.liquidity),
    noOutcome: {
      id: binaryShape.tokenIds[binaryShape.noIndex] ?? `${providerMarketId}-no`,
      label: binaryShape.labels[binaryShape.noIndex] ?? 'No',
      price: binaryShape.prices[binaryShape.noIndex] ?? 0,
    },
    providerMarketId,
    rules: normalizeText(market.description),
    status: getPolymarketStatus(market.active, market.closed),
    title: normalizeText(market.question) || 'Market',
    totalOrders: 0,
    totalVolume: toNumber(market.volume),
    yesOutcome: {
      id: binaryShape.tokenIds[binaryShape.yesIndex] ?? `${providerMarketId}-yes`,
      label: binaryShape.labels[binaryShape.yesIndex] ?? 'Yes',
      price: binaryShape.prices[binaryShape.yesIndex] ?? 0,
    },
  }
}

function mapPolymarketEvent(event: PolymarketEvent): PulseEvent {
  const openMarkets = (event.markets ?? [])
    .filter((market) => market.active !== false && market.closed !== true)
    .map(mapPolymarketMarket)
    .filter(isPresent)
  const allBinaryMarkets = (event.markets ?? [])
    .map(mapPolymarketMarket)
    .filter(isPresent)
  const markets = (openMarkets.length ? openMarkets : allBinaryMarkets).sort(
    (a, b) => b.totalVolume - a.totalVolume,
  )
  const tags = getPolymarketTags(event)

  return {
    additionalContext: tags.length
      ? `Tagged ${tags.slice(0, 4).join(', ')} on Polymarket.`
      : '',
    category: normalizePolymarketCategory(event),
    closingDate: event.endDate ?? null,
    countryCodes: [],
    createdAt:
      normalizeText(event.createdAt) ||
      normalizeText(event.startDate) ||
      new Date(0).toISOString(),
    description: normalizeText(event.description),
    engine: 'CLOB',
    hashtags: tags,
    id: buildProviderScopedId('polymarket', String(event.id)),
    imageUrl: event.image ?? event.icon ?? null,
    liquidity: toNumber(event.liquidity),
    markets,
    provider: 'polymarket',
    providerEventId: String(event.id),
    regions: [],
    resolutionDate: event.endDate ?? null,
    resolutionSource: null,
    slug: normalizeText(event.slug) || `polymarket-${event.id}`,
    sourceUrl: getPolymarketSourceUrl(event.slug),
    status: getPolymarketStatus(event.active, event.closed),
    supportedCurrencies: ['USDC'],
    title: event.title,
    totalOrders: 0,
    totalVolume: toNumber(event.volume),
    type: 'BINARY',
  }
}

async function listPolymarketEvents(params: PulseEventListParams = {}) {
  const searchParams = new URLSearchParams({
    active: params.status === 'closed' ? 'false' : 'true',
    archived: 'false',
    closed: params.status === 'closed' ? 'true' : 'false',
    limit: String(POLYMARKET_EVENT_LIMIT),
  })
  const payload = await fetchJson<PolymarketEvent[]>(
    `${POLYMARKET_GAMMA_BASE}/events?${searchParams.toString()}`,
  )

  return payload
    .map(mapPolymarketEvent)
    .filter((event) => event.markets.length > 0)
}

async function getPolymarketEvent(eventId: string) {
  const payload = await fetchJson<PolymarketEvent>(
    `${POLYMARKET_GAMMA_BASE}/events/${eventId}`,
  )
  const event = mapPolymarketEvent(payload)

  if (!event.markets.length) {
    throw new Error('Polymarket event has no supported binary markets.')
  }

  return event
}

async function getPolymarketPriceHistory({
  event,
  interval = '1d',
}: {
  event: PulseEvent
  interval?: string
}) {
  const primaryMarket = event.markets[0]

  if (!primaryMarket?.yesOutcome.id) {
    return {
      eventId: event.id,
      eventTitle: event.title,
      marketId: primaryMarket?.id ?? '',
      marketTitle: primaryMarket?.title ?? 'Primary market',
      points: [],
    } satisfies PulsePriceHistory
  }

  const payload = await fetchJson<PolymarketPriceHistoryResponse>(
    `${POLYMARKET_CLOB_BASE}/prices-history?market=${primaryMarket.yesOutcome.id}&interval=${interval}`,
  )
  const points = (payload.history ?? [])
    .map((point) => ({
      price: toNumber(point.p),
      timestamp: point.t * 1000,
    }))
    .sort((a, b) => a.timestamp - b.timestamp)

  return {
    eventId: event.id,
    eventTitle: event.title,
    marketId: primaryMarket.id,
    marketTitle: primaryMarket.title,
    points,
    previousInterval: points[0],
  } satisfies PulsePriceHistory
}

export const polymarketProvider: MarketProvider = {
  getEvent: getPolymarketEvent,
  getPriceHistory: getPolymarketPriceHistory,
  listEvents: listPolymarketEvents,
  name: 'polymarket',
}
