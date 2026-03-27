import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getEvent,
  getPriceHistory,
  getPriceHistoryForEvent,
  listEvents,
} from './api'
import {
  buildMover,
  sortByActivityScore,
} from './insights'
import type {
  PulseEvent,
  PulseEventListParams,
} from './types'

const eventKeys = {
  all: ['events'] as const,
  list: (params: PulseEventListParams) =>
    [...eventKeys.all, 'list', params] as const,
  detail: (eventId: string) => [...eventKeys.all, 'detail', eventId] as const,
  priceHistory: (eventId: string, interval: string) =>
    [...eventKeys.all, 'price-history', eventId, interval] as const,
}

export function useEventsQuery(params: PulseEventListParams) {
  return useQuery({
    queryKey: eventKeys.list(params),
    queryFn: () => listEvents(params),
    staleTime: 45_000,
    refetchInterval: 90_000,
  })
}

export function useEventQuery(eventId?: string) {
  return useQuery({
    enabled: Boolean(eventId),
    queryKey: eventId
      ? eventKeys.detail(eventId)
      : eventKeys.detail('missing'),
    queryFn: () => getEvent(eventId!),
    staleTime: 60_000,
  })
}

export function usePriceHistoryQuery(eventId?: string, interval = '1d') {
  return useQuery({
    enabled: Boolean(eventId),
    queryKey: eventId
      ? eventKeys.priceHistory(eventId, interval)
      : eventKeys.priceHistory('missing', interval),
    queryFn: () => getPriceHistory(eventId!, interval),
    staleTime: 120_000,
  })
}

export function useMoversQuery(
  events: PulseEvent[],
  limit = 8,
) {
  const candidateEvents = useMemo(() => {
    return [...events].sort(sortByActivityScore).slice(0, limit)
  }, [events, limit])
  const candidateIds = useMemo(() => {
    return candidateEvents.map((event) => event.id)
  }, [candidateEvents])

  return useQuery({
    enabled: candidateIds.length > 0,
    queryKey: [...eventKeys.all, 'movers', candidateIds] as const,
    queryFn: async () => {
      const histories = await Promise.all(
        candidateEvents.map(async (event) => {
          try {
            return await getPriceHistoryForEvent(event, '1d')
          } catch {
            return null
          }
        }),
      )

      return candidateEvents
        .map((event, index) => buildMover(event, histories[index]))
        .sort((a, b) => b.trendScore - a.trendScore)
    },
    staleTime: 120_000,
  })
}
