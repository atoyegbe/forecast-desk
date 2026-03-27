import { fetchBackendJson } from '../../lib/api-client'
import type {
  PulseEvent,
  PulseEventListParams,
  PulsePriceHistory,
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
