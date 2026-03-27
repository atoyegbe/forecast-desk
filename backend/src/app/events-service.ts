import type {
  PulseEvent,
  PulseEventListParams,
  PulsePriceHistory,
  PulseProvider,
} from '../contracts/pulse-events.js'
import { getDiscoveryRefreshIntervalMs } from '../db/config.js'
import {
  countStoredDiscoveryEvents,
  getProviderSyncState,
  getStoredDiscoveryEvent,
  listStoredDiscoveryEvents,
  recordProviderSyncAttempt,
  recordProviderSyncFailure,
  recordProviderSyncSuccess,
  upsertStoredDiscoveryEvents,
} from '../db/discovery-repository.js'
import {
  getStoredPriceHistory,
  replaceStoredPriceHistory,
} from '../db/history-repository.js'
import { parseProviderScopedId } from '../providers/provider-ids.js'
import { bayseProvider } from '../providers/bayse.js'
import { polymarketProvider } from '../providers/polymarket.js'

const providers = {
  bayse: bayseProvider,
  polymarket: polymarketProvider,
} as const

const providerNames = Object.keys(providers) as PulseProvider[]
const refreshLocks = new Map<PulseProvider, Promise<void>>()

function getProvider(provider: PulseProvider) {
  return providers[provider]
}

function dedupeEvents(events: PulseEvent[]) {
  const dedupedEvents = new Map<string, PulseEvent>()

  for (const event of events) {
    dedupedEvents.set(event.id, event)
  }

  return [...dedupedEvents.values()]
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown discovery sync failure.'
}

function getFreshnessSnapshot(syncedAt = new Date()) {
  return {
    isStale: false,
    syncedAt: syncedAt.toISOString(),
  }
}

function isDiscoverySyncStale(lastSuccessAt?: string | null) {
  if (!lastSuccessAt) {
    return true
  }

  const parsedTimestamp = new Date(lastSuccessAt).getTime()

  if (Number.isNaN(parsedTimestamp)) {
    return true
  }

  return Date.now() - parsedTimestamp >= getDiscoveryRefreshIntervalMs()
}

async function fetchProviderDiscoverySnapshot(provider: PulseProvider) {
  const providerClient = getProvider(provider)
  const results = await Promise.allSettled([
    providerClient.listEvents({ status: 'open' }),
    providerClient.listEvents({ status: 'closed' }),
  ])
  const events = dedupeEvents(
    results.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
  )

  if (!events.length) {
    const firstFailure = results.find((result) => result.status === 'rejected')

    if (firstFailure?.status === 'rejected') {
      throw firstFailure.reason
    }

    throw new Error(`No discovery events returned for ${provider}.`)
  }

  const partialFailure = results.some((result) => result.status === 'rejected')

  return {
    events,
    note: partialFailure
      ? `${provider} discovery refresh was partial; one provider feed failed during sync.`
      : null,
  }
}

async function refreshProviderDiscovery(provider: PulseProvider) {
  const attemptedAt = new Date()

  await recordProviderSyncAttempt(provider, attemptedAt)

  try {
    const snapshot = await fetchProviderDiscoverySnapshot(provider)
    await upsertStoredDiscoveryEvents(snapshot.events, attemptedAt)
    await recordProviderSyncSuccess(provider, attemptedAt, snapshot.note)
  } catch (error) {
    await recordProviderSyncFailure(provider, getErrorMessage(error), attemptedAt)
    throw error
  }
}

async function ensureProviderDiscovery(provider: PulseProvider) {
  const state = await getProviderSyncState(provider)

  if (!isDiscoverySyncStale(state?.lastSuccessAt)) {
    return
  }

  const existingRefresh = refreshLocks.get(provider)

  if (existingRefresh) {
    return existingRefresh
  }

  const refreshPromise = refreshProviderDiscovery(provider).finally(() => {
    refreshLocks.delete(provider)
  })

  refreshLocks.set(provider, refreshPromise)

  return refreshPromise
}

async function ensureDiscoveryCache(provider?: PulseProvider) {
  const targetedProviders = provider ? [provider] : providerNames
  const results = await Promise.allSettled(
    targetedProviders.map((target) => ensureProviderDiscovery(target)),
  )
  const storedCount = await countStoredDiscoveryEvents(provider)

  if (storedCount > 0) {
    return
  }

  const firstFailure = results.find((result) => result.status === 'rejected')

  if (firstFailure?.status === 'rejected') {
    throw firstFailure.reason
  }

  throw new Error('No discovery events are available.')
}

export async function listEvents(params: PulseEventListParams = {}) {
  await ensureDiscoveryCache(params.provider)

  return listStoredDiscoveryEvents(params)
}

export async function getEvent(eventId: string) {
  const { provider, providerId } = parseProviderScopedId(eventId)
  await ensureDiscoveryCache(provider)
  const storedEvent = await getStoredDiscoveryEvent(eventId)

  if (storedEvent) {
    return storedEvent
  }

  const syncedAt = new Date()
  const event = await getProvider(provider).getEvent(providerId)

  await upsertStoredDiscoveryEvents([event], syncedAt)

  return {
    ...event,
    freshness: getFreshnessSnapshot(syncedAt),
  }
}

export async function getPriceHistory(
  eventId: string,
  interval = '1d',
): Promise<PulsePriceHistory> {
  const event = await getEvent(eventId)
  const primaryMarket = event.markets[0]

  if (!primaryMarket) {
    return {
      eventId: event.id,
      eventTitle: event.title,
      freshness: event.freshness,
      marketId: '',
      marketTitle: 'Primary market',
      points: [],
    }
  }

  const storedHistory = await getStoredPriceHistory(event, primaryMarket.id, interval)

  if (storedHistory && !storedHistory.freshness?.isStale) {
    return storedHistory
  }

  try {
    const syncedAt = new Date()
    const liveHistory = await getProvider(event.provider).getPriceHistory({
      event,
      interval,
    })

    await replaceStoredPriceHistory(event, liveHistory, interval, syncedAt)
    const persistedHistory = await getStoredPriceHistory(
      event,
      liveHistory.marketId || primaryMarket.id,
      interval,
    )

    return (
      persistedHistory ?? {
        ...liveHistory,
        freshness: getFreshnessSnapshot(syncedAt),
      }
    )
  } catch (error) {
    if (storedHistory) {
      return {
        ...storedHistory,
        freshness: storedHistory.freshness
          ? {
              ...storedHistory.freshness,
              isStale: true,
            }
          : undefined,
      }
    }

    throw error
  }
}
