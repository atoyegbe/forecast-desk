import { fetchBackendJson } from '../../lib/api-client'
import type {
  PulseDivergenceListParams,
  PulseEvent,
  PulseEventComparison,
  PulseEventListParams,
  PulsePriceHistory,
  PulseComparisonGroup,
} from './types'

function buildQueryString(params: PulseEventListParams = {}) {
  const searchParams = new URLSearchParams()

  if (params.category) {
    searchParams.set('category', params.category)
  }

  if (params.keyword) {
    searchParams.set('keyword', params.keyword)
  }

  if (params.provider) {
    searchParams.set('provider', params.provider)
  }

  if (params.status) {
    searchParams.set('status', params.status)
  }

  const query = searchParams.toString()

  return query ? `?${query}` : ''
}

export async function listEvents(params: PulseEventListParams = {}) {
  const response = await fetchBackendJson<{ items: PulseEvent[] }>(
    `/events${buildQueryString(params)}`,
  )

  return response.data.items
}

export async function getEvent(eventId: string) {
  const response = await fetchBackendJson<PulseEvent>(
    `/events/${encodeURIComponent(eventId)}`,
  )

  return response.data
}

export async function getPriceHistoryForEvent(event: PulseEvent, interval = '1d') {
  return getPriceHistory(event.id, interval)
}

export async function getPriceHistory(eventId: string, interval = '1d') {
  const response = await fetchBackendJson<PulsePriceHistory>(
    `/events/${encodeURIComponent(eventId)}/history?interval=${encodeURIComponent(interval)}`,
  )

  return response.data
}

function buildDivergenceQueryString(params: PulseDivergenceListParams = {}) {
  const searchParams = new URLSearchParams()

  if (params.category) {
    searchParams.set('category', params.category)
  }

  if (params.limit !== undefined) {
    searchParams.set('limit', String(params.limit))
  }

  if (params.minDivergence !== undefined) {
    searchParams.set('minDivergence', String(params.minDivergence))
  }

  if (params.sort) {
    searchParams.set('sort', params.sort)
  }

  const query = searchParams.toString()

  return query ? `?${query}` : ''
}

export async function getEventCompare(eventId: string) {
  const response = await fetchBackendJson<PulseEventComparison | null>(
    `/events/${encodeURIComponent(eventId)}/compare`,
  )

  return response.data
}

export async function listDivergence(params: PulseDivergenceListParams = {}) {
  const response = await fetchBackendJson<{ items: PulseComparisonGroup[] }>(
    `/divergence${buildDivergenceQueryString(params)}`,
  )

  return response.data.items
}
