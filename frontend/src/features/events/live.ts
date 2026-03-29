import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import { parseProviderScopedId } from './provider-ids'
import type {
  LivePriceSnapshot,
  PulseLiveMessage,
} from './types'

type LiveStatus = 'connecting' | 'streaming' | 'closed' | 'error'

type LiveState = {
  lastUpdateAt: number | null
  snapshot: LivePriceSnapshot | null
  status: LiveStatus
}

const LIVE_RECONNECT_DELAY_MS = 1_500

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isLivePriceSnapshot(value: unknown): value is LivePriceSnapshot {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.eventId === 'string' &&
    typeof value.timestamp === 'number' &&
    Array.isArray(value.markets)
  )
}

function parseLiveMessage(rawMessage: string): PulseLiveMessage | null {
  try {
    const payload = JSON.parse(rawMessage) as unknown

    if (!isRecord(payload) || typeof payload.type !== 'string') {
      return null
    }

    if (payload.type === 'connected' && typeof payload.eventId === 'string') {
      return {
        eventId: payload.eventId,
        timestamp:
          typeof payload.timestamp === 'number' ? payload.timestamp : Date.now(),
        type: 'connected',
      }
    }

    if (payload.type === 'price_update' && isLivePriceSnapshot(payload.data)) {
      return {
        data: payload.data,
        timestamp:
          typeof payload.timestamp === 'number' ? payload.timestamp : payload.data.timestamp,
        type: 'price_update',
      }
    }

    if (payload.type === 'error' && typeof payload.message === 'string') {
      return {
        message: payload.message,
        timestamp:
          typeof payload.timestamp === 'number' ? payload.timestamp : Date.now(),
        type: 'error',
      }
    }
  } catch {
    return null
  }

  return null
}

function buildBackendLiveUrl(eventId: string) {
  const configuredBase = import.meta.env.VITE_BACKEND_WS_BASE?.trim()

  if (configuredBase) {
    return `${configuredBase.replace(/\/$/, '')}/api/v1/live/events/${encodeURIComponent(eventId)}`
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

  return `${protocol}//${window.location.host}/api/v1/live/events/${encodeURIComponent(eventId)}`
}

export function useLiveEventPrices(eventId?: string) {
  const [state, setState] = useState<LiveState>({
    lastUpdateAt: null,
    snapshot: null,
    status: 'closed',
  })
  const reconnectTimeoutRef = useRef<number | null>(null)
  const parsedEventId = useMemo(
    () => (eventId ? parseProviderScopedId(eventId) : null),
    [eventId],
  )

  const handleMessage = useEffectEvent((event: MessageEvent<string>) => {
    const message = parseLiveMessage(event.data)

    if (!message) {
      setState((current) => ({
        ...current,
        status: 'error',
      }))
      return
    }

    if (message.type === 'connected') {
      setState((current) => ({
        ...current,
        status: 'streaming',
      }))
      return
    }

    if (message.type === 'price_update') {
      if (message.data.eventId !== eventId) {
        return
      }

      setState({
        lastUpdateAt: message.timestamp,
        snapshot: message.data,
        status: 'streaming',
      })
      return
    }

    if (message.type === 'error') {
      setState((current) => ({
        ...current,
        status: 'error',
      }))
    }
  })

  useEffect(() => {
    if (!eventId || !parsedEventId) {
      return
    }

    let isActive = true
    let socket: WebSocket | null = null

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }

    const connect = () => {
      if (!isActive) {
        return
      }

      clearReconnectTimeout()
      setState((current) => ({
        ...current,
        status: 'connecting',
      }))

      socket = new WebSocket(buildBackendLiveUrl(eventId))

      socket.addEventListener('open', () => {
        setState((current) => ({
          ...current,
          status: 'connecting',
        }))
      })
      socket.addEventListener('message', handleMessage)
      socket.addEventListener('error', () => {
        setState((current) => ({
          ...current,
          status: 'error',
        }))
      })
      socket.addEventListener('close', () => {
        if (!isActive) {
          setState((current) => ({
            ...current,
            status: 'closed',
          }))
          return
        }

        setState((current) => ({
          ...current,
          status: current.status === 'error' ? 'error' : 'connecting',
        }))
        reconnectTimeoutRef.current = window.setTimeout(
          connect,
          LIVE_RECONNECT_DELAY_MS,
        )
      })
    }

    connect()

    return () => {
      isActive = false
      clearReconnectTimeout()
      socket?.close()
    }
  }, [eventId, parsedEventId])

  const snapshot =
    state.snapshot?.eventId === eventId ? state.snapshot : null
  const status = !eventId
    ? 'closed'
    : state.status === 'closed'
      ? 'connecting'
      : state.status

  return {
    lastUpdateAt: snapshot ? state.lastUpdateAt : null,
    snapshot,
    status,
  }
}
