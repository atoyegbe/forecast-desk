import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { getBackendHealth } from './api'

const RUNTIME_RECONNECT_DELAY_MS = 1_500
const RUNTIME_OFFLINE_DELAY_MS = 5_000

export type RuntimeConnectionState =
  | 'connected'
  | 'reconnecting'
  | 'disconnected'

export function useBackendHealthQuery() {
  return useQuery({
    queryKey: ['runtime', 'backend-health'],
    queryFn: getBackendHealth,
    retry: false,
    staleTime: 30_000,
  })
}

function buildRuntimeLiveUrl() {
  const configuredBase = import.meta.env.QUORUM_PUBLIC_BACKEND_WS_BASE?.trim()

  if (configuredBase) {
    return `${configuredBase.replace(/\/$/, '')}/api/v1/live/runtime`
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

  return `${protocol}//${window.location.host}/api/v1/live/runtime`
}

function getLatestActiveQueryUpdateAt(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient
    .getQueryCache()
    .findAll()
    .reduce((latestTimestamp, query) => {
      if (!query.isActive()) {
        return latestTimestamp
      }

      return Math.max(latestTimestamp, query.state.dataUpdatedAt)
    }, 0)
}

function formatFreshnessLabel(updatedAt: number, now: number) {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - updatedAt) / 1_000),
  )

  if (elapsedSeconds < 60) {
    return `Updated ${elapsedSeconds}s ago`
  }

  return `Updated ${Math.floor(elapsedSeconds / 60)}m ago`
}

export function useRuntimeLiveConnection() {
  const [status, setStatus] = useState<RuntimeConnectionState>('reconnecting')
  const offlineTimeoutRef = useRef<number | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    let isActive = true
    let socket: WebSocket | null = null

    const clearOfflineTimeout = () => {
      if (offlineTimeoutRef.current !== null) {
        window.clearTimeout(offlineTimeoutRef.current)
        offlineTimeoutRef.current = null
      }
    }

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }

    const markReconnecting = () => {
      setStatus((currentStatus) =>
        currentStatus === 'disconnected' ? currentStatus : 'reconnecting',
      )

      if (offlineTimeoutRef.current !== null) {
        return
      }

      offlineTimeoutRef.current = window.setTimeout(() => {
        offlineTimeoutRef.current = null
        setStatus('disconnected')
      }, RUNTIME_OFFLINE_DELAY_MS)
    }

    const connect = () => {
      if (!isActive) {
        return
      }

      clearReconnectTimeout()
      socket = new WebSocket(buildRuntimeLiveUrl())

      socket.addEventListener('open', () => {
        clearOfflineTimeout()
        setStatus('connected')
      })

      socket.addEventListener('error', () => {
        markReconnecting()
      })

      socket.addEventListener('close', () => {
        if (!isActive) {
          return
        }

        markReconnecting()

        if (reconnectTimeoutRef.current !== null) {
          return
        }

        reconnectTimeoutRef.current = window.setTimeout(() => {
          reconnectTimeoutRef.current = null
          connect()
        }, RUNTIME_RECONNECT_DELAY_MS)
      })
    }

    connect()

    return () => {
      isActive = false
      clearOfflineTimeout()
      clearReconnectTimeout()
      socket?.close()
    }
  }, [])

  return status
}

export function useRuntimeFreshnessLabel() {
  const queryClient = useQueryClient()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const updatedAt = useMemo(
    () => getLatestActiveQueryUpdateAt(queryClient),
    [queryClient, now],
  )

  return useMemo(
    () => formatFreshnessLabel(updatedAt || now, now),
    [now, updatedAt],
  )
}
