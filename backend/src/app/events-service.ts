import type {
  PulseComparisonGroup,
  PulseMarket,
  PulseDivergenceListParams,
  PulseEvent,
  PulseEventComparison,
  PulseEventListParams,
  PulseComparedEvent,
  PulsePriceHistory,
  PulseProvider,
} from '../contracts/pulse-events.js'
import { getDiscoveryRefreshIntervalMs } from '../db/config.js'
import {
  countStoredDiscoveryEvents,
  getProviderSyncState,
  getStoredDiscoveryEvent,
  listStoredDiscoveryEvents,
  listStoredDiscoveryEventsByIds,
  recordProviderSyncAttempt,
  recordProviderSyncFailure,
  recordProviderSyncSuccess,
  upsertStoredDiscoveryEvents,
} from '../db/discovery-repository.js'
import {
  getStoredPriceHistory,
  replaceStoredPriceHistory,
} from '../db/history-repository.js'
import {
  countStoredEventLinks,
  getEventLinkSyncState,
  getStoredEventLinkByEventId,
  listStoredEventLinks,
  replaceStoredEventLinks,
  type StoredEventLinkRecord,
} from '../db/link-repository.js'
import { runEntityMatching } from '../entity-matcher/index.js'
import { parseProviderScopedId } from '../providers/provider-ids.js'
import { bayseProvider } from '../providers/bayse.js'
import { polymarketProvider } from '../providers/polymarket.js'

const providers = {
  bayse: bayseProvider,
  polymarket: polymarketProvider,
} as const

const providerNames = Object.keys(providers) as PulseProvider[]
const refreshLocks = new Map<PulseProvider, Promise<void>>()
let eventLinksRefreshPromise: Promise<void> | null = null

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

function normalizeMarketTitle(title: string) {
  const normalized = title
    .toLowerCase()
    .replace(/\bman city\b/g, 'manchester city')
    .replace(/\bman utd\b/g, 'manchester united')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  const subjectMatch = normalized.match(
    /^will (.+?) (win|qualify|finish|score|be|become|launch|release|retire|visit|meet|capture|buy|have)\b/,
  )

  if (subjectMatch?.[1]) {
    return subjectMatch[1].trim()
  }

  return normalized
}

function buildComparedEvent(
  event: PulseEvent,
  representativeMarket: PulseMarket,
): PulseComparedEvent {
  return {
    event,
    liquidity: event.liquidity,
    marketId: representativeMarket?.id ?? '',
    marketTitle: representativeMarket?.title ?? 'Primary market',
    noPrice: representativeMarket?.noOutcome.price ?? 0,
    totalVolume: event.totalVolume,
    yesPrice: representativeMarket?.yesOutcome.price ?? 0,
  }
}

function getRepresentativeMarkets(events: PulseEvent[]) {
  if (events.some((event) => !event.markets.length)) {
    return null
  }

  if (events.every((event) => event.markets.length === 1)) {
    return new Map(
      events.map((event) => [event.id, event.markets[0]]),
    )
  }

  const eventMarketMaps = events.map((event) => {
    const marketsByTitle = new Map<string, PulseMarket>()

    for (const market of event.markets) {
      const normalizedTitle = normalizeMarketTitle(market.title)
      const currentMarket = marketsByTitle.get(normalizedTitle)

      if (
        !currentMarket ||
        market.totalVolume > currentMarket.totalVolume ||
        market.yesOutcome.price > currentMarket.yesOutcome.price
      ) {
        marketsByTitle.set(normalizedTitle, market)
      }
    }

    return {
      event,
      marketsByTitle,
    }
  })

  const sharedTitles = new Set(eventMarketMaps[0]?.marketsByTitle.keys() ?? [])

  for (const entry of eventMarketMaps.slice(1)) {
    for (const title of [...sharedTitles]) {
      if (!entry.marketsByTitle.has(title)) {
        sharedTitles.delete(title)
      }
    }
  }

  if (!sharedTitles.size) {
    return null
  }

  const selectedTitle = [...sharedTitles].sort((leftTitle, rightTitle) => {
    const leftScore = eventMarketMaps.reduce((score, entry) => {
      const market = entry.marketsByTitle.get(leftTitle)

      return score + (market?.yesOutcome.price ?? 0)
    }, 0)
    const rightScore = eventMarketMaps.reduce((score, entry) => {
      const market = entry.marketsByTitle.get(rightTitle)

      return score + (market?.yesOutcome.price ?? 0)
    }, 0)

    if (rightScore !== leftScore) {
      return rightScore - leftScore
    }

    const leftVolume = eventMarketMaps.reduce((volume, entry) => {
      const market = entry.marketsByTitle.get(leftTitle)

      return volume + (market?.totalVolume ?? 0)
    }, 0)
    const rightVolume = eventMarketMaps.reduce((volume, entry) => {
      const market = entry.marketsByTitle.get(rightTitle)

      return volume + (market?.totalVolume ?? 0)
    }, 0)

    return rightVolume - leftVolume
  })[0]

  if (!selectedTitle) {
    return null
  }

  return new Map(
    eventMarketMaps.map((entry) => [entry.event.id, entry.marketsByTitle.get(selectedTitle)!]),
  )
}

function buildComparisonGroup(
  link: StoredEventLinkRecord,
  events: PulseEvent[],
): PulseComparisonGroup | null {
  const representativeMarkets = getRepresentativeMarkets(events)

  if (!representativeMarkets) {
    return null
  }

  const comparedEvents = events
    .map((event) => {
      const representativeMarket = representativeMarkets.get(event.id)

      return representativeMarket
        ? buildComparedEvent(event, representativeMarket)
        : null
    })
    .filter((event): event is PulseComparedEvent => Boolean(event))
    .sort((leftEvent, rightEvent) => rightEvent.totalVolume - leftEvent.totalVolume)

  if (comparedEvents.length < 2) {
    return null
  }

  const prices = comparedEvents.map((event) => event.yesPrice)
  const maxDivergence = Math.max(...prices) - Math.min(...prices)
  const totalVolume = comparedEvents.reduce(
    (volume, event) => volume + event.totalVolume,
    0,
  )
  const weightedMidpoint =
    totalVolume > 0
      ? comparedEvents.reduce(
          (price, event) => price + event.yesPrice * (event.totalVolume / totalVolume),
          0,
        )
      : prices.reduce((price, value) => price + value, 0) / comparedEvents.length
  const weightedDivergence = Math.max(
    ...comparedEvents.map((event) => Math.abs(event.yesPrice - weightedMidpoint)),
  )

  return {
    category: link.category,
    comparedAt: link.matchedAt,
    confidence: link.confidence,
    events: comparedEvents,
    linkId: link.id,
    matchMethod: link.matchMethod,
    maxDivergence,
    title: link.title,
    weightedDivergence,
  }
}

function parsePositiveInteger(value: number | string | undefined, fallback: number) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
  }

  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parsePositiveFloat(value: number | string | undefined, fallback = 0) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : fallback
  }

  if (!value) {
    return fallback
  }

  const parsed = Number.parseFloat(value)

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
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

async function refreshEventLinks() {
  const matchedAt = new Date()
  const openEvents = await listStoredDiscoveryEvents({ status: 'open' })
  const links = runEntityMatching(openEvents)

  await replaceStoredEventLinks(links, matchedAt)
}

async function ensureEventLinksCache() {
  const [syncState, storedLinkCount] = await Promise.all([
    getEventLinkSyncState(),
    countStoredEventLinks(),
  ])

  if (storedLinkCount > 0 && !isDiscoverySyncStale(syncState?.lastRunAt)) {
    return
  }

  if (eventLinksRefreshPromise) {
    return eventLinksRefreshPromise
  }

  eventLinksRefreshPromise = refreshEventLinks().finally(() => {
    eventLinksRefreshPromise = null
  })

  return eventLinksRefreshPromise
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

export async function getEventCompare(eventId: string): Promise<PulseEventComparison | null> {
  const event = await getEvent(eventId)

  if (event.status !== 'open') {
    return null
  }

  await ensureDiscoveryCache()
  await ensureEventLinksCache()
  const link = await getStoredEventLinkByEventId(event.id)

  if (!link) {
    return null
  }

  const linkedEvents = await listStoredDiscoveryEventsByIds(link.eventIds)
  const comparisonGroup = buildComparisonGroup(link, linkedEvents)

  if (!comparisonGroup) {
    return null
  }

  return {
    ...comparisonGroup,
    anchorEventId: event.id,
  }
}

export async function listDivergence(params: PulseDivergenceListParams = {}) {
  await ensureDiscoveryCache()
  await ensureEventLinksCache()

  const links = await listStoredEventLinks()
  const linkedEvents = await listStoredDiscoveryEventsByIds(
    links.flatMap((link) => link.eventIds),
  )
  const linkedEventsById = new Map(linkedEvents.map((event) => [event.id, event]))
  const comparisonGroups = links
    .map((link) => {
      const events = link.eventIds
        .map((eventId) => linkedEventsById.get(eventId))
        .filter((event): event is PulseEvent => Boolean(event))

      return buildComparisonGroup(link, events)
    })
    .filter((group): group is PulseComparisonGroup => Boolean(group))
  const categoryFilter = params.category?.trim()
  const minimumDivergence = parsePositiveFloat(params.minDivergence, 0)
  const sortOrder = params.sort === 'volume' ? 'volume' : 'divergence'
  const limitedCount = parsePositiveInteger(params.limit, 24)

  return comparisonGroups
    .filter((group) => {
      if (categoryFilter && categoryFilter !== 'All' && group.category !== categoryFilter) {
        return false
      }

      return group.maxDivergence >= minimumDivergence
    })
    .sort((leftGroup, rightGroup) => {
      if (sortOrder === 'volume') {
        const leftVolume = leftGroup.events.reduce(
          (volume, event) => volume + event.totalVolume,
          0,
        )
        const rightVolume = rightGroup.events.reduce(
          (volume, event) => volume + event.totalVolume,
          0,
        )

        if (rightVolume !== leftVolume) {
          return rightVolume - leftVolume
        }
      }

      if (rightGroup.maxDivergence !== leftGroup.maxDivergence) {
        return rightGroup.maxDivergence - leftGroup.maxDivergence
      }

      return rightGroup.confidence - leftGroup.confidence
    })
    .slice(0, limitedCount)
}
