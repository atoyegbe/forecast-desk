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
  isPresent,
  normalizeText,
} from './shared.js'
import type { MarketProvider } from './types.js'

const KALSHI_API_BASE =
  process.env.KALSHI_API_BASE?.trim() ??
  'https://api.elections.kalshi.com/trade-api/v2'
const KALSHI_EVENT_PAGE_LIMIT = 200
const KALSHI_MAX_EVENT_PAGES = 25
const DAY_MS = 24 * 60 * 60 * 1000

type KalshiMarket = {
  close_time?: string | null
  created_time?: string | null
  event_ticker: string
  expiration_time?: string | null
  last_price_dollars?: number | string | null
  liquidity_dollars?: number | string | null
  market_type?: string | null
  no_ask_dollars?: number | string | null
  no_bid_dollars?: number | string | null
  no_sub_title?: string | null
  open_interest_fp?: number | string | null
  open_time?: string | null
  result?: string | null
  rules_primary?: string | null
  rules_secondary?: string | null
  status?: string | null
  subtitle?: string | null
  ticker: string
  title: string
  updated_time?: string | null
  volume_24h_fp?: number | string | null
  volume_fp?: number | string | null
  yes_ask_dollars?: number | string | null
  yes_bid_dollars?: number | string | null
  yes_sub_title?: string | null
}

type KalshiEvent = {
  available_on_brokers?: boolean
  category?: string | null
  event_ticker: string
  last_updated_ts?: string | null
  markets?: KalshiMarket[]
  mutually_exclusive?: boolean
  series_ticker: string
  sub_title?: string | null
  title: string
}

type KalshiEventsResponse = {
  cursor?: string | null
  events?: KalshiEvent[]
}

type KalshiEventDetailResponse = {
  event: KalshiEvent
  markets?: KalshiMarket[]
}

type KalshiCandlestick = {
  end_period_ts: number
  price?: {
    close_dollars?: number | string | null
    mean_dollars?: number | string | null
    previous_dollars?: number | string | null
  }
}

type KalshiEventCandlesticksResponse = {
  market_candlesticks?: KalshiCandlestick[][]
  market_tickers?: string[]
}

const KALSHI_CATEGORY_ALIASES: Record<string, string> = {
  climate_and_weather: 'Science',
  climate_weather: 'Science',
  climate: 'Science',
  companies: 'Finance',
  crypto: 'Finance',
  economics: 'Finance',
  elections: 'Politics',
  entertainment: 'Culture',
  financials: 'Finance',
  finance: 'Finance',
  international: 'Politics',
  politics: 'Politics',
  pop_culture: 'Culture',
  science: 'Science',
  sports: 'Sports',
  technology: 'Technology',
  weather: 'Science',
  world: 'Politics',
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

function clampProbability(value: number) {
  return Math.max(0, Math.min(1, value))
}

function stripMarkdown(value?: string | null) {
  return normalizeText(value).replace(/\*\*/g, '')
}

function normalizeKalshiCategory(value?: string | null) {
  const rawCategory = stripMarkdown(value)

  if (!rawCategory) {
    return 'General'
  }

  const alias =
    KALSHI_CATEGORY_ALIASES[rawCategory.toLowerCase().replace(/[^a-z0-9]+/g, '_')]

  return alias ?? formatCategory(rawCategory)
}

function resolveQuotedPrice(
  bidValue: number | null,
  askValue: number | null,
  fallbackValue: number | null,
) {
  if (askValue != null && bidValue != null) {
    return clampProbability((bidValue + askValue) / 2)
  }

  if (askValue != null) {
    return clampProbability(askValue)
  }

  if (bidValue != null) {
    return clampProbability(bidValue)
  }

  return fallbackValue != null ? clampProbability(fallbackValue) : 0
}

function resolveKalshiPrices(market: KalshiMarket) {
  const lastPrice = toOptionalNumber(market.last_price_dollars)
  const yesBid = toOptionalNumber(market.yes_bid_dollars)
  const yesAsk = toOptionalNumber(market.yes_ask_dollars)
  const noBid = toOptionalNumber(market.no_bid_dollars)
  const noAsk = toOptionalNumber(market.no_ask_dollars)

  const yesPrice = resolveQuotedPrice(yesBid, yesAsk, lastPrice)
  const noFallback = lastPrice != null ? clampProbability(1 - lastPrice) : null
  const noPrice = resolveQuotedPrice(noBid, noAsk, noFallback ?? 1 - yesPrice)

  return {
    noPrice,
    yesPrice,
  }
}

function normalizeKalshiStatus(value?: string | null) {
  const normalizedValue = stripMarkdown(value).toLowerCase()

  if (!normalizedValue) {
    return 'open'
  }

  if (normalizedValue === 'active' || normalizedValue === 'open') {
    return 'open'
  }

  if (normalizedValue === 'initialized' || normalizedValue === 'pending') {
    return 'inactive'
  }

  return 'closed'
}

function normalizeKalshiEventStatus(markets: PulseMarket[]) {
  if (markets.some((market) => market.status === 'open')) {
    return 'open'
  }

  if (markets.some((market) => market.status === 'inactive')) {
    return 'inactive'
  }

  return 'closed'
}

function buildKalshiRules(market: KalshiMarket) {
  const parts = [stripMarkdown(market.rules_primary), stripMarkdown(market.rules_secondary)]
    .filter(Boolean)

  return parts.length ? parts.join('\n\n') : undefined
}

function mapKalshiMarket(market: KalshiMarket): PulseMarket | null {
  if (stripMarkdown(market.market_type).toLowerCase() !== 'binary') {
    return null
  }

  const { noPrice, yesPrice } = resolveKalshiPrices(market)
  const providerMarketId = market.ticker

  return {
    feePercentage: 0,
    id: buildProviderScopedId('kalshi', providerMarketId),
    imageUrl: null,
    liquidity: toOptionalNumber(market.liquidity_dollars) ?? 0,
    noOutcome: {
      id: `${providerMarketId}-no`,
      label: stripMarkdown(market.no_sub_title) || 'No',
      price: noPrice,
    },
    providerMarketId,
    rules: buildKalshiRules(market),
    status: normalizeKalshiStatus(market.status),
    title: stripMarkdown(market.title) || providerMarketId,
    totalOrders: Math.round(toOptionalNumber(market.open_interest_fp) ?? 0),
    totalVolume: toOptionalNumber(market.volume_fp) ?? 0,
    yesOutcome: {
      id: `${providerMarketId}-yes`,
      label: stripMarkdown(market.yes_sub_title) || 'Yes',
      price: yesPrice,
    },
  }
}

function mapKalshiEvent(event: KalshiEvent, nestedMarkets: KalshiMarket[] = []) {
  const markets = nestedMarkets
    .map(mapKalshiMarket)
    .filter(isPresent)
    .sort((leftMarket, rightMarket) => rightMarket.totalVolume - leftMarket.totalVolume)
  const primaryMarket = markets[0]
  const primaryRawMarket = primaryMarket
    ? nestedMarkets.find((market) => market.ticker === primaryMarket.providerMarketId)
    : nestedMarkets[0]
  const closingDate =
    (primaryRawMarket?.close_time ??
    nestedMarkets
      .map((market) => market.close_time)
      .find((value) => Boolean(value))) ?? null
  const resolutionDate =
    (primaryRawMarket?.expiration_time ??
    nestedMarkets
      .map((market) => market.expiration_time)
      .find((value) => Boolean(value))) ?? null
  const createdAt =
    (primaryRawMarket?.created_time ??
    primaryRawMarket?.open_time ??
    nestedMarkets
      .map((market) => market.created_time ?? market.open_time)
      .find((value) => Boolean(value))) ??
    event.last_updated_ts ??
    new Date(0).toISOString()
  const category = normalizeKalshiCategory(event.category)
  const eventTitle = stripMarkdown(event.title) || event.event_ticker

  return {
    additionalContext: [
      'Kalshi is a CFTC-regulated US prediction market exchange.',
      markets.length > 1 ? `${markets.length} markets are grouped under this event.` : null,
      event.available_on_brokers === false ? 'Broker availability is currently disabled.' : null,
    ]
      .filter(Boolean)
      .join(' '),
    category,
    closingDate,
    countryCodes: ['US'],
    createdAt,
    description: stripMarkdown(event.sub_title),
    engine: 'CLOB',
    hashtags: category === 'General' ? [] : [category.toLowerCase()],
    id: buildProviderScopedId('kalshi', event.event_ticker),
    imageUrl: null,
    liquidity: markets.reduce((sum, market) => sum + market.liquidity, 0),
    markets,
    provider: 'kalshi',
    providerEventId: event.event_ticker,
    regions: ['United States'],
    resolutionDate,
    resolutionSource: null,
    slug: event.event_ticker.toLowerCase(),
    sourceUrl: null,
    status: normalizeKalshiEventStatus(markets),
    supportedCurrencies: ['USD'],
    title: eventTitle,
    totalOrders: markets.reduce((sum, market) => sum + market.totalOrders, 0),
    totalVolume: markets.reduce((sum, market) => sum + market.totalVolume, 0),
    type: markets.length > 1 ? 'MULTIPLE_BINARY' : 'BINARY',
  } satisfies PulseEvent
}

function buildKalshiEventsUrl(params: Record<string, string>) {
  const searchParams = new URLSearchParams(params)

  return `${KALSHI_API_BASE}/events?${searchParams.toString()}`
}

async function listKalshiEvents(params: PulseEventListParams = {}) {
  const status = params.status === 'closed' ? 'closed' : 'open'
  const events: PulseEvent[] = []
  let cursor: string | null | undefined

  for (let page = 0; page < KALSHI_MAX_EVENT_PAGES; page += 1) {
    const payload = await fetchJson<KalshiEventsResponse>(
      buildKalshiEventsUrl({
        ...(cursor ? { cursor } : {}),
        limit: String(KALSHI_EVENT_PAGE_LIMIT),
        status,
        with_nested_markets: 'true',
      }),
    )
    const mappedEvents = (payload.events ?? [])
      .map((event) => mapKalshiEvent(event, event.markets ?? []))
      .filter((event) => event.markets.length > 0)

    events.push(...mappedEvents)

    if (!payload.cursor || !(payload.events ?? []).length) {
      break
    }

    cursor = payload.cursor
  }

  return events
}

async function getKalshiEvent(eventId: string) {
  const payload = await fetchJson<KalshiEventDetailResponse>(
    `${KALSHI_API_BASE}/events/${encodeURIComponent(eventId)}`,
  )
  const event = mapKalshiEvent(payload.event, payload.markets ?? [])

  if (!event.markets.length) {
    throw new Error('Kalshi event has no supported binary markets.')
  }

  return event
}

function getKalshiSeriesTicker(event: PulseEvent) {
  const [seriesTicker] = event.providerEventId.split('-')

  return seriesTicker || event.providerEventId
}

function buildKalshiHistoryWindow(event: PulseEvent, interval: string) {
  const now = Date.now()
  const createdAt = new Date(event.createdAt).getTime()
  const safeCreatedAt = Number.isNaN(createdAt) ? now - 30 * DAY_MS : createdAt

  if (interval === '1d') {
    return {
      endTs: now,
      periodInterval: 60,
      startTs: Math.max(safeCreatedAt, now - 2 * DAY_MS),
    }
  }

  if (interval === '1w') {
    return {
      endTs: now,
      periodInterval: 60,
      startTs: Math.max(safeCreatedAt, now - 8 * DAY_MS),
    }
  }

  if (interval === '1m') {
    return {
      endTs: now,
      periodInterval: 60,
      startTs: Math.max(safeCreatedAt, now - 35 * DAY_MS),
    }
  }

  return {
    endTs: now,
    periodInterval: now - safeCreatedAt <= 45 * DAY_MS ? 60 : 1440,
    startTs: safeCreatedAt,
  }
}

function resolveCandlestickPrice(
  point: KalshiCandlestick,
  previousPrice: number | null,
) {
  const closePrice = toOptionalNumber(point.price?.close_dollars)

  if (closePrice != null) {
    return clampProbability(closePrice)
  }

  const meanPrice = toOptionalNumber(point.price?.mean_dollars)

  if (meanPrice != null) {
    return clampProbability(meanPrice)
  }

  const previousDollars = toOptionalNumber(point.price?.previous_dollars)

  if (previousDollars != null) {
    return clampProbability(previousDollars)
  }

  return previousPrice
}

function buildKalshiHistoryPoints(points: KalshiCandlestick[]) {
  const historyPoints: PulsePricePoint[] = []
  let previousPrice: number | null = null

  for (const point of points) {
    const resolvedPrice = resolveCandlestickPrice(point, previousPrice)

    if (resolvedPrice == null) {
      continue
    }

    previousPrice = resolvedPrice
    historyPoints.push({
      price: resolvedPrice,
      timestamp: point.end_period_ts * 1000,
    })
  }

  return historyPoints
}

async function getKalshiPriceHistory({
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

  const { endTs, periodInterval, startTs } = buildKalshiHistoryWindow(event, interval)
  const searchParams = new URLSearchParams({
    end_ts: String(Math.ceil(endTs / 1000)),
    period_interval: String(periodInterval),
    start_ts: String(Math.floor(startTs / 1000)),
  })
  const payload = await fetchJson<KalshiEventCandlesticksResponse>(
    `${KALSHI_API_BASE}/series/${encodeURIComponent(getKalshiSeriesTicker(event))}/events/${encodeURIComponent(event.providerEventId)}/candlesticks?${searchParams.toString()}`,
  )
  const marketIndex =
    payload.market_tickers?.findIndex(
      (marketTicker) => marketTicker === primaryMarket.providerMarketId,
    ) ?? -1
  const rawPoints =
    marketIndex >= 0
      ? payload.market_candlesticks?.[marketIndex] ?? []
      : payload.market_candlesticks?.[0] ?? []
  const points = buildKalshiHistoryPoints(rawPoints)

  return {
    eventId: event.id,
    eventTitle: event.title,
    marketId: primaryMarket.id,
    marketTitle: primaryMarket.title,
    points,
    previousInterval: points[0],
  } satisfies PulsePriceHistory
}

export const kalshiProvider: MarketProvider = {
  getEvent: getKalshiEvent,
  getPriceHistory: getKalshiPriceHistory,
  listEvents: listKalshiEvents,
  name: 'kalshi',
}
