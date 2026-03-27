import {
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react'
import { buildProviderScopedId, parseProviderScopedId } from './provider-ids'
import type { LivePriceSnapshot } from './types'

type LiveStatus = 'connecting' | 'streaming' | 'closed' | 'error'

type LiveState = {
  lastUpdateAt: number | null
  snapshot: LivePriceSnapshot | null
  status: LiveStatus
}

function extractMarketPrices(payload: Record<string, unknown>) {
  const marketId = typeof payload.id === 'string' ? payload.id : ''
  const title =
    typeof payload.question === 'string'
      ? payload.question
      : typeof payload.title === 'string'
        ? payload.title
        : 'Market'
  const prices =
    typeof payload.prices === 'object' && payload.prices !== null
      ? (payload.prices as Record<string, unknown>)
      : null
  const yesPrice =
    typeof prices?.YES === 'number'
      ? prices.YES
      : typeof payload.outcome1Price === 'number'
        ? payload.outcome1Price
        : 0
  const noPrice =
    typeof prices?.NO === 'number'
      ? prices.NO
      : typeof payload.outcome2Price === 'number'
        ? payload.outcome2Price
        : Math.max(0, 1 - yesPrice)

  return {
    marketId: buildProviderScopedId('bayse', marketId),
    noPrice,
    title,
    yesPrice,
  }
}

export function useLiveEventPrices(eventId?: string) {
  const [state, setState] = useState<LiveState>({
    lastUpdateAt: null,
    snapshot: null,
    status: 'closed',
  })
  const parsedEventId = useMemo(
    () => (eventId ? parseProviderScopedId(eventId) : null),
    [eventId],
  )

  const handleMessage = useEffectEvent((event: MessageEvent<string>) => {
    const providerEventId = parsedEventId?.providerId
    const chunks = event.data.split('\n')

    for (const chunk of chunks) {
      const message = chunk.trim()

      if (!message) {
        continue
      }

      try {
        const payload = JSON.parse(message) as Record<string, unknown>
        const type = payload.type

        if (type === 'connected') {
          setState((current) => ({
            ...current,
            status: 'streaming',
          }))
          continue
        }

        if (type !== 'price_update') {
          continue
        }

        const data =
          typeof payload.data === 'object' && payload.data !== null
            ? (payload.data as Record<string, unknown>)
            : null

        if (!data || data.id !== providerEventId) {
          continue
        }

        const markets = Array.isArray(data.markets)
          ? data.markets
              .filter(
                (market): market is Record<string, unknown> =>
                  typeof market === 'object' && market !== null,
              )
              .map(extractMarketPrices)
          : []

        setState({
          lastUpdateAt:
            typeof payload.timestamp === 'number' ? payload.timestamp : Date.now(),
          snapshot: {
            eventId:
              typeof data.id === 'string'
                ? buildProviderScopedId('bayse', data.id)
                : eventId ?? '',
            markets,
            timestamp:
              typeof payload.timestamp === 'number'
                ? payload.timestamp
                : Date.now(),
          },
          status: 'streaming',
        })
      } catch {
        setState((current) => ({
          ...current,
          status: 'error',
        }))
      }
    }
  })

  useEffect(() => {
    if (!eventId || !parsedEventId) {
      return
    }

    if (parsedEventId.provider !== 'bayse') {
      return
    }

    const socketUrl =
      import.meta.env.VITE_MARKETS_WS_URL ??
      'wss://socket.bayse.markets/ws/v1/markets'
    const socket = new WebSocket(socketUrl)

    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          channel: 'prices',
          eventId: parsedEventId.providerId,
          type: 'subscribe',
        }),
      )
    })
    socket.addEventListener('message', handleMessage)
    socket.addEventListener('error', () => {
      setState((current) => ({
        ...current,
        status: 'error',
      }))
    })
    socket.addEventListener('close', () => {
      setState((current) => ({
        ...current,
        status: current.status === 'error' ? 'error' : 'closed',
      }))
    })

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            room: `prices:${parsedEventId.providerId}`,
            type: 'unsubscribe',
          }),
        )
      }

      socket.close()
    }
  }, [eventId, parsedEventId])

  const snapshot =
    state.snapshot?.eventId === eventId ? state.snapshot : null
  const status = !eventId
    ? 'closed'
    : parsedEventId?.provider !== 'bayse'
      ? 'closed'
    : state.status === 'error'
      ? 'error'
      : snapshot
        ? state.status
        : 'connecting'

  return {
    lastUpdateAt: snapshot ? state.lastUpdateAt : null,
    snapshot,
    status,
  }
}
