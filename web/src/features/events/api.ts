import {
  formatCategory,
} from '../../lib/format'
import type {
  PulseEvent,
  PulseEventListParams,
  PulseMarket,
  PulsePriceHistory,
} from './types'

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

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
    marketId: string
    priceHistory: Array<{ e: number; p: number }>
    lastPriceAtPreviousInterval?: { e: number; p: number }
    title: string
  }>
}

type BayseEventsResponse = {
  events: BayseEvent[]
}

async function fetchJson<T>(path: string) {
  const response = await fetch(`${API_BASE}${path}`)

  if (!response.ok) {
    const fallback = `${response.status} ${response.statusText}`

    try {
      const errorBody = (await response.json()) as { message?: string }
      throw new Error(errorBody.message ?? fallback)
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }

      throw new Error(fallback)
    }
  }

  return (await response.json()) as T
}

function normalizeText(value?: string | null) {
  return (value ?? '').replace(/\r\n/g, '\n').trim()
}

function normalizeCategory(value?: string | null) {
  const category = formatCategory(value ?? 'General')

  return category === 'Crypto' ? 'Finance' : category
}

function mapMarket(market: BayseMarket): PulseMarket {
  return {
    id: market.id,
    title: market.title,
    status: market.status ?? 'open',
    feePercentage: market.feePercentage ?? 0,
    imageUrl: market.imageUrl,
    rules: normalizeText(market.rules),
    totalOrders: market.totalOrders ?? 0,
    yesOutcome: {
      id: market.outcome1Id,
      label: market.outcome1Label,
      price: market.outcome1Price,
    },
    noOutcome: {
      id: market.outcome2Id,
      label: market.outcome2Label,
      price: market.outcome2Price,
    },
  }
}

function mapEvent(event: BayseEvent): PulseEvent {
  return {
    id: event.id,
    provider: 'bayse',
    slug: event.slug,
    title: event.title,
    description: normalizeText(event.description),
    additionalContext: normalizeText(event.additionalContext),
    category: normalizeCategory(event.category),
    status: event.status ?? 'open',
    engine: event.engine ?? 'UNKNOWN',
    type: event.type ?? 'UNKNOWN',
    imageUrl: event.imageUrl,
    createdAt: event.createdAt,
    resolutionDate: event.resolutionDate,
    closingDate: event.closingDate,
    resolutionSource: event.resolutionSource,
    liquidity: event.liquidity ?? 0,
    totalOrders: event.totalOrders ?? 0,
    totalVolume: event.totalVolume ?? 0,
    supportedCurrencies: event.supportedCurrencies ?? [],
    hashtags: event.hashtags ?? [],
    regions: event.regions?.map((region) => region.name) ?? [],
    countryCodes: event.countryCodes ?? [],
    markets: event.markets.map(mapMarket),
  }
}

export async function listEvents(params: PulseEventListParams = {}) {
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
    `/v1/pm/events${query ? `?${query}` : ''}`,
  )

  return payload.events.map(mapEvent)
}

export async function getEvent(
  eventId: string,
) {
  const payload = await fetchJson<BayseEvent>(
    `/v1/pm/events/${eventId}`,
  )

  return mapEvent(payload)
}

export async function getPriceHistory(eventId: string, interval = '1d') {
  const payload = await fetchJson<BaysePriceHistoryResponse>(
    `/v1/pm/events/${eventId}/price-history?interval=${interval}`,
  )

  const market = payload.markets[0]

  return {
    eventId: payload.eventId,
    eventTitle: payload.eventTitle,
    marketId: market?.marketId ?? '',
    marketTitle: market?.title ?? 'Primary market',
    points:
      market?.priceHistory.map((point) => ({
        timestamp: point.e,
        price: point.p,
      })) ?? [],
    previousInterval: market?.lastPriceAtPreviousInterval
      ? {
          timestamp: market.lastPriceAtPreviousInterval.e,
          price: market.lastPriceAtPreviousInterval.p,
        }
      : undefined,
  } satisfies PulsePriceHistory
}
