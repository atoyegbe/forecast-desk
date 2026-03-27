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
  normalizeText,
} from './shared.js'
import type { MarketProvider } from './types.js'

const BAYSE_API_BASE = process.env.BAYSE_API_BASE ?? 'https://relay.bayse.markets'

type BayseMarket = {
  feePercentage?: number
  id: string
  imageUrl?: string | null
  outcome1Id: string
  outcome1Label: string
  outcome1Price: number
  outcome2Id: string
  outcome2Label: string
  outcome2Price: number
  rules?: string
  status?: string
  title: string
  totalOrders?: number
}

type BayseEvent = {
  additionalContext?: string
  category?: string
  countryCodes?: string[] | null
  createdAt: string
  description?: string
  engine?: string
  hashtags?: string[]
  id: string
  imageUrl?: string | null
  liquidity?: number
  markets: BayseMarket[]
  regions?: Array<{ name: string }>
  resolutionDate?: string | null
  closingDate?: string | null
  resolutionSource?: string | null
  slug: string
  status?: string
  supportedCurrencies?: string[]
  title: string
  totalOrders?: number
  totalVolume?: number
  type?: string
}

type BaysePriceHistoryResponse = {
  eventId: string
  eventTitle: string
  markets: Array<{
    lastPriceAtPreviousInterval?: { e: number; p: number }
    marketId: string
    priceHistory: Array<{ e: number; p: number }>
    title: string
  }>
}

type BayseEventsResponse = {
  events: BayseEvent[]
}

function normalizeBayseCategory(value?: string | null) {
  const category = formatCategory(value ?? 'General')

  return category === 'Crypto' ? 'Finance' : category
}

function mapBayseMarket(market: BayseMarket): PulseMarket {
  return {
    feePercentage: market.feePercentage ?? 0,
    id: buildProviderScopedId('bayse', market.id),
    imageUrl: market.imageUrl,
    liquidity: 0,
    noOutcome: {
      id: market.outcome2Id,
      label: market.outcome2Label,
      price: market.outcome2Price,
    },
    providerMarketId: market.id,
    rules: normalizeText(market.rules),
    status: market.status ?? 'open',
    title: market.title,
    totalOrders: market.totalOrders ?? 0,
    totalVolume: 0,
    yesOutcome: {
      id: market.outcome1Id,
      label: market.outcome1Label,
      price: market.outcome1Price,
    },
  }
}

function mapBayseEvent(event: BayseEvent): PulseEvent {
  return {
    additionalContext: normalizeText(event.additionalContext),
    category: normalizeBayseCategory(event.category),
    closingDate: event.closingDate,
    countryCodes: event.countryCodes ?? [],
    createdAt: event.createdAt,
    description: normalizeText(event.description),
    engine: event.engine ?? 'UNKNOWN',
    hashtags: event.hashtags ?? [],
    id: buildProviderScopedId('bayse', event.id),
    imageUrl: event.imageUrl,
    liquidity: event.liquidity ?? 0,
    markets: event.markets.map(mapBayseMarket),
    provider: 'bayse',
    providerEventId: event.id,
    regions: event.regions?.map((region) => region.name) ?? [],
    resolutionDate: event.resolutionDate,
    resolutionSource: event.resolutionSource,
    slug: event.slug,
    sourceUrl: null,
    status: event.status ?? 'open',
    supportedCurrencies: event.supportedCurrencies ?? [],
    title: event.title,
    totalOrders: event.totalOrders ?? 0,
    totalVolume: event.totalVolume ?? 0,
    type: event.type ?? 'UNKNOWN',
  }
}

async function listBayseEvents(params: PulseEventListParams = {}) {
  const searchParams = new URLSearchParams()

  if (params.status) {
    searchParams.set('status', params.status)
  }

  if (params.category && params.category !== 'All') {
    searchParams.set('category', params.category)
  }

  if (params.keyword) {
    searchParams.set('keyword', params.keyword)
  }

  const query = searchParams.toString()
  const payload = await fetchJson<BayseEventsResponse>(
    `${BAYSE_API_BASE}/v1/pm/events${query ? `?${query}` : ''}`,
  )

  return payload.events.map(mapBayseEvent)
}

async function getBayseEvent(eventId: string) {
  const payload = await fetchJson<BayseEvent>(`${BAYSE_API_BASE}/v1/pm/events/${eventId}`)

  return mapBayseEvent(payload)
}

async function getBaysePriceHistory({
  event,
  interval = '1d',
}: {
  event: PulseEvent
  interval?: string
}) {
  const payload = await fetchJson<BaysePriceHistoryResponse>(
    `${BAYSE_API_BASE}/v1/pm/events/${event.providerEventId}/price-history?interval=${interval}`,
  )
  const market = payload.markets[0]

  return {
    eventId: event.id,
    eventTitle: payload.eventTitle,
    marketId: market?.marketId
      ? buildProviderScopedId('bayse', market.marketId)
      : event.markets[0]?.id ?? '',
    marketTitle: market?.title ?? event.markets[0]?.title ?? 'Primary market',
    points:
      market?.priceHistory.map((point) => ({
        price: point.p,
        timestamp: point.e,
      })) ?? [],
    previousInterval: market?.lastPriceAtPreviousInterval
      ? {
          price: market.lastPriceAtPreviousInterval.p,
          timestamp: market.lastPriceAtPreviousInterval.e,
        }
      : undefined,
  } satisfies PulsePriceHistory
}

export const bayseProvider: MarketProvider = {
  getEvent: getBayseEvent,
  getPriceHistory: getBaysePriceHistory,
  listEvents: listBayseEvents,
  name: 'bayse',
}
