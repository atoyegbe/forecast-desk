import {
  useEffect,
  useRef,
} from 'react'
import {
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  getSmartMoneyStatus,
  getSmartMoneyWallet,
  listSmartMoneySignals,
  listSmartMoneyWallets,
} from './api'
import type {
  PulseSmartMoneyLiveMessage,
  PulseSmartMoneySignal,
  PulseSmartMoneySignalListParams,
  PulseSmartMoneyWalletListParams,
} from './types'

const SMART_MONEY_RECONNECT_DELAY_MS = 3_000
const SMART_MONEY_QUERY_ROOT = ['smart-money'] as const

export const smartMoneyKeys = {
  all: SMART_MONEY_QUERY_ROOT,
  signals: (params: PulseSmartMoneySignalListParams) =>
    [...SMART_MONEY_QUERY_ROOT, 'signals', params] as const,
  signalsAll: [...SMART_MONEY_QUERY_ROOT, 'signals'] as const,
  status: [...SMART_MONEY_QUERY_ROOT, 'status'] as const,
  wallet: (address: string) =>
    [...SMART_MONEY_QUERY_ROOT, 'wallet', address.toLowerCase()] as const,
  wallets: (params: PulseSmartMoneyWalletListParams) =>
    [...SMART_MONEY_QUERY_ROOT, 'wallets', params] as const,
  walletsAll: [...SMART_MONEY_QUERY_ROOT, 'wallets'] as const,
}

function buildSmartMoneyLiveUrl() {
  const configuredBase = import.meta.env.VITE_BACKEND_WS_BASE?.trim()

  if (configuredBase) {
    return `${configuredBase.replace(/\/$/, '')}/api/v1/live/smart-money/signals`
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

  return `${protocol}//${window.location.host}/api/v1/live/smart-money/signals`
}

function parseNumericFilter(value: number | string | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (!value) {
    return 0
  }

  const parsed = Number.parseFloat(value)

  return Number.isFinite(parsed) ? parsed : 0
}

function matchesSignalParams(
  signal: PulseSmartMoneySignal,
  params: PulseSmartMoneySignalListParams | undefined,
) {
  if (!params) {
    return true
  }

  if (params.category && params.category !== 'All' && signal.category !== params.category) {
    return false
  }

  if (params.minScore !== undefined && signal.walletScore < parseNumericFilter(params.minScore)) {
    return false
  }

  if (params.minSize !== undefined && signal.size < parseNumericFilter(params.minSize)) {
    return false
  }

  return true
}

function sortSignals(
  signals: PulseSmartMoneySignal[],
  sort: PulseSmartMoneySignalListParams['sort'],
) {
  return [...signals].sort((leftSignal, rightSignal) => {
    if (sort === 'largest') {
      if (rightSignal.size !== leftSignal.size) {
        return rightSignal.size - leftSignal.size
      }
    }

    return (
      new Date(rightSignal.signalAt).getTime() - new Date(leftSignal.signalAt).getTime()
    )
  })
}

function updateSignalQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  incomingSignal: PulseSmartMoneySignal,
) {
  const nextSignal = {
    ...incomingSignal,
    isNew: true,
  } satisfies PulseSmartMoneySignal
  const signalQueries = queryClient.getQueryCache().findAll({
    queryKey: smartMoneyKeys.signalsAll,
  })

  for (const query of signalQueries) {
    const [, , params] = query.queryKey as [
      'smart-money',
      'signals',
      PulseSmartMoneySignalListParams | undefined,
    ]

    if (!matchesSignalParams(nextSignal, params)) {
      continue
    }

    queryClient.setQueryData(query.queryKey, (currentSignals: PulseSmartMoneySignal[] | undefined) => {
      const dedupedSignals = [
        nextSignal,
        ...(currentSignals ?? []).filter((signal) => signal.id !== nextSignal.id),
      ]
      const sortedSignals = sortSignals(dedupedSignals, params?.sort)
      const limit = Math.max(1, Math.floor(parseNumericFilter(params?.limit || 30)))

      return sortedSignals.slice(0, limit)
    })
  }
}

export function useSmartMoneySignalsQuery(params: PulseSmartMoneySignalListParams) {
  return useQuery({
    queryFn: () => listSmartMoneySignals(params),
    queryKey: smartMoneyKeys.signals(params),
    staleTime: 180_000,
    refetchInterval: 240_000,
  })
}

export function useSmartMoneyStatusQuery() {
  return useQuery({
    queryFn: () => getSmartMoneyStatus(),
    queryKey: smartMoneyKeys.status,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}

export function useSmartMoneyWalletsQuery(params: PulseSmartMoneyWalletListParams) {
  return useQuery({
    queryFn: () => listSmartMoneyWallets(params),
    queryKey: smartMoneyKeys.wallets(params),
    staleTime: 180_000,
    refetchInterval: 240_000,
  })
}

export function useSmartMoneyWalletQuery(address?: string) {
  return useQuery({
    enabled: Boolean(address),
    queryFn: () => getSmartMoneyWallet(address!),
    queryKey: address
      ? smartMoneyKeys.wallet(address)
      : smartMoneyKeys.wallet('missing'),
    staleTime: 180_000,
  })
}

export function useSmartMoneyLiveSignals() {
  const queryClient = useQueryClient()
  const reconnectTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
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
      socket = new WebSocket(buildSmartMoneyLiveUrl())

      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data) as PulseSmartMoneyLiveMessage

          if (message.type !== 'signal') {
            return
          }

          updateSignalQueries(queryClient, message.data)
          void queryClient.invalidateQueries({
            queryKey: smartMoneyKeys.status,
          })
          void queryClient.invalidateQueries({
            queryKey: smartMoneyKeys.walletsAll,
          })
          void queryClient.invalidateQueries({
            queryKey: smartMoneyKeys.wallet(message.data.walletAddress),
          })
        } catch {
          // Ignore malformed live payloads and wait for the next event.
        }
      })

      socket.addEventListener('close', () => {
        if (!isActive || reconnectTimeoutRef.current !== null) {
          return
        }

        reconnectTimeoutRef.current = window.setTimeout(() => {
          reconnectTimeoutRef.current = null
          connect()
        }, SMART_MONEY_RECONNECT_DELAY_MS)
      })

      socket.addEventListener('error', () => {
        socket?.close()
      })
    }

    connect()

    return () => {
      isActive = false
      clearReconnectTimeout()
      socket?.close()
    }
  }, [queryClient])
}
