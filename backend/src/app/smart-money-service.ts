import type {
  PulseSmartMoneyCategoryStat,
  PulseSmartMoneyJobStatus,
  PulseSmartMoneySignal,
  PulseSmartMoneySignalListParams,
  PulseSmartMoneyStatus,
  PulseSmartMoneyWallet,
  PulseSmartMoneyWalletDetail,
  PulseSmartMoneyWalletListParams,
} from '../contracts/pulse-smart-money.js'
import {
  getSmartMoneyActivityLookbackDays,
  getSmartMoneyLeaderboardLimit,
  getSmartMoneyMinSignalSizeUsd,
  getSmartMoneySignalWatchIntervalMs,
  getSmartMoneySnapshotRefreshIntervalMs,
  getSmartMoneyWatchWalletLimit,
} from '../db/config.js'
import {
  appendStoredSmartMoneySignals,
  countStoredSmartMoneySignals,
  countStoredSmartMoneyWallets,
  getSmartMoneySyncState,
  getStoredSmartMoneyWallet,
  listStoredSmartMoneySignalsByIds,
  listStoredSmartMoneySignals,
  listStoredSmartMoneyWalletAddresses,
  listStoredSmartMoneyWallets,
  recordSmartMoneySyncAttempt,
  recordSmartMoneySyncFailure,
  recordSmartMoneySyncSuccess,
  replaceStoredSmartMoneySnapshot,
  type StoredSmartMoneyPositionInput,
  type StoredSmartMoneySignalInput,
  type StoredSmartMoneyWalletInput,
} from '../db/smart-money-repository.js'
import type { PulseEvent } from '../contracts/pulse-events.js'
import {
  listPolymarketLeaderboardWallets,
  listPolymarketWalletActivity,
  listPolymarketWalletClosedPositions,
  listPolymarketWalletPositions,
  type PolymarketWalletActivity,
  type PolymarketWalletClosedPosition,
  type PolymarketWalletPosition,
  type SmartMoneySeedWallet,
} from '../providers/polymarket-smart-money.js'
import { formatCategory, normalizeText, toNumber } from '../providers/shared.js'
import { listEvents } from './events-service.js'
import { invalidateCachedResponses } from './response-cache.js'

const SMART_MONEY_SIGNAL_WATCH_SYNC_KEY = 'smart-money-signal-watch'
const SMART_MONEY_SNAPSHOT_SYNC_KEY = 'smart-money-snapshot'
let smartMoneySignalWatchPromise: Promise<PulseSmartMoneySignal[]> | null = null
let smartMoneySnapshotRefreshPromise: Promise<PulseSmartMoneySignal[]> | null = null
let signalWatchJobRunning = false
let snapshotJobRunning = false
let signalWatchInterval: NodeJS.Timeout | null = null
let snapshotRefreshInterval: NodeJS.Timeout | null = null
let schedulerStarted = false
const smartMoneySignalListeners = new Set<
  (signals: PulseSmartMoneySignal[]) => void
>()

type EventLookup = {
  byProviderEventId: Map<string, PulseEvent>
  bySlug: Map<string, PulseEvent>
}

type WalletSnapshot = {
  positions: StoredSmartMoneyPositionInput[]
  signals: Array<Omit<StoredSmartMoneySignalInput, 'walletAddress'> & {
    walletAddress: string
  }>
  wallet: StoredSmartMoneyWalletInput | null
}

const CATEGORY_ALIASES: Record<string, string> = {
  afcon: 'Sports',
  bayse: 'Finance',
  bitcoin: 'Finance',
  crypto: 'Finance',
  election: 'Politics',
  elections: 'Politics',
  fed: 'Finance',
  fifa: 'Sports',
  nba: 'Sports',
  nfl: 'Sports',
  politics: 'Politics',
  president: 'Politics',
  premier: 'Sports',
  rates: 'Finance',
  soccer: 'Sports',
  sport: 'Sports',
  sports: 'Sports',
  trump: 'Politics',
  ucl: 'Sports',
  worldcup: 'Sports',
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown smart money sync failure.'
}

function normalizeOutcome(value?: string | null) {
  return value?.toUpperCase() === 'NO' ? 'NO' : 'YES'
}

function isSmartMoneySyncStale(
  lastSuccessAt: string | null | undefined,
  intervalMs: number,
) {
  if (!lastSuccessAt) {
    return true
  }

  const parsedTimestamp = new Date(lastSuccessAt).getTime()

  if (Number.isNaN(parsedTimestamp)) {
    return true
  }

  return Date.now() - parsedTimestamp >= intervalMs
}

function inferCategoryFromLabel(label: string) {
  const normalized = normalizeText(label).toLowerCase()

  for (const [token, category] of Object.entries(CATEGORY_ALIASES)) {
    if (normalized.includes(token)) {
      return category
    }
  }

  return 'General'
}

async function buildEventLookup() {
  const events = await listEvents({ provider: 'polymarket' })
  const byProviderEventId = new Map<string, PulseEvent>()
  const bySlug = new Map<string, PulseEvent>()

  for (const event of events) {
    byProviderEventId.set(event.providerEventId, event)
    bySlug.set(event.slug, event)
  }

  return {
    byProviderEventId,
    bySlug,
  } satisfies EventLookup
}

function resolveEventContext(
  input: {
    providerEventId?: string | null
    slug?: string | null
    title: string
  },
  lookup: EventLookup,
) {
  const providerEventId = normalizeText(input.providerEventId)
  const slug = normalizeText(input.slug)
  const matchedEvent =
    (providerEventId && lookup.byProviderEventId.get(providerEventId)) ||
    (slug && lookup.bySlug.get(slug)) ||
    null

  return {
    category: matchedEvent?.category ?? inferCategoryFromLabel(`${slug} ${input.title}`),
    closingDate: matchedEvent?.closingDate ?? null,
    eventId: matchedEvent?.id ?? null,
    eventSlug: matchedEvent?.slug ?? slug,
    providerEventId: matchedEvent?.providerEventId ?? providerEventId ?? null,
  }
}

function getPositionTimestamp(
  input: Pick<PolymarketWalletClosedPosition, 'timestamp'>,
) {
  const timestamp = toNumber(input.timestamp)

  return timestamp > 0 ? new Date(timestamp * 1000).toISOString() : null
}

function buildPositionKey(
  walletAddress: string,
  conditionId: string,
  outcome: 'NO' | 'YES',
  status: 'closed' | 'open',
) {
  return `${walletAddress}:${conditionId}:${outcome}:${status}`
}

function buildSignalId(
  walletAddress: string,
  conditionId: string,
  outcome: 'NO' | 'YES',
  signalAt: string,
) {
  return `${walletAddress}:${conditionId}:${outcome}:${signalAt}`
}

function buildPositionRecord(
  input: {
    category: string
    closingDate?: string | null
    conditionId: string
    currentPrice: number
    currentValue: number
    entryPrice: number
    entryValue: number
    eventId?: string | null
    eventSlug: string
    iconUrl?: string | null
    marketTitle: string
    outcome: 'NO' | 'YES'
    providerEventId?: string | null
    realizedPnl: number
    shareCount: number
    status: 'closed' | 'open'
    timestamp?: string | null
    walletAddress: string
  },
) {
  return {
    avgPrice: input.entryPrice,
    category: input.category,
    closingDate: input.closingDate,
    conditionId: input.conditionId,
    currentPrice: input.currentPrice,
    currentValue: input.currentValue,
    entryValue: input.entryValue,
    eventId: input.eventId,
    eventSlug: input.eventSlug,
    iconUrl: input.iconUrl,
    marketTitle: input.marketTitle,
    outcome: input.outcome,
    pnl: input.currentValue - input.entryValue,
    positionKey: buildPositionKey(
      input.walletAddress,
      input.conditionId,
      input.outcome,
      input.status,
    ),
    providerEventId: input.providerEventId,
    realizedPnl: input.realizedPnl,
    shareCount: input.shareCount,
    status: input.status,
    timestamp: input.timestamp,
    walletAddress: input.walletAddress,
  } satisfies StoredSmartMoneyPositionInput
}

function buildCategoryStats(
  positions: Array<{
    category: string
    entryValue: number
    realizedPnl: number
  }>,
) {
  const statsByCategory = new Map<
    string,
    {
      invested: number
      positions: number
      realizedPnl: number
      wins: number
    }
  >()

  for (const position of positions) {
    const currentStats = statsByCategory.get(position.category) ?? {
      invested: 0,
      positions: 0,
      realizedPnl: 0,
      wins: 0,
    }

    currentStats.invested += position.entryValue
    currentStats.positions += 1
    currentStats.realizedPnl += position.realizedPnl

    if (position.realizedPnl > 0) {
      currentStats.wins += 1
    }

    statsByCategory.set(position.category, currentStats)
  }

  return [...statsByCategory.entries()]
    .map(
      ([category, stats]): PulseSmartMoneyCategoryStat => ({
        category,
        positions: stats.positions,
        roi: stats.invested > 0 ? stats.realizedPnl / stats.invested : 0,
        winRate: stats.positions > 0 ? stats.wins / stats.positions : 0,
      }),
    )
    .sort((leftStat, rightStat) => rightStat.winRate - leftStat.winRate)
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function dedupePositions(positions: StoredSmartMoneyPositionInput[]) {
  const uniquePositions = new Map<string, StoredSmartMoneyPositionInput>()

  for (const position of positions) {
    const currentPosition = uniquePositions.get(position.positionKey)

    if (!currentPosition || position.entryValue > currentPosition.entryValue) {
      uniquePositions.set(position.positionKey, position)
    }
  }

  return [...uniquePositions.values()]
}

function dedupeSignals(signals: StoredSmartMoneySignalInput[]) {
  const uniqueSignals = new Map<string, StoredSmartMoneySignalInput>()

  for (const signal of signals) {
    const currentSignal = uniqueSignals.get(signal.id)

    if (!currentSignal || signal.size > currentSignal.size) {
      uniqueSignals.set(signal.id, signal)
    }
  }

  return [...uniqueSignals.values()]
}

function buildWalletScore(
  closedPositions: StoredSmartMoneyPositionInput[],
  openPositions: StoredSmartMoneyPositionInput[],
  lastActiveAt: string | null,
) {
  if (closedPositions.length < 5) {
    return null
  }

  const totalInvested = closedPositions.reduce(
    (total, position) => total + position.entryValue,
    0,
  )
  const realizedProfit = closedPositions.reduce(
    (total, position) => total + position.realizedPnl,
    0,
  )
  const winCount = closedPositions.filter((position) => position.realizedPnl > 0).length
  const winRate = closedPositions.length > 0 ? winCount / closedPositions.length : 0
  const roi = totalInvested > 0 ? realizedProfit / totalInvested : 0
  const allPositions = [...openPositions, ...closedPositions]
  const totalVolume = allPositions.reduce((total, position) => total + position.entryValue, 0)
  const marketCount = new Set(allPositions.map((position) => position.conditionId)).size
  const categories = new Set(allPositions.map((position) => position.category))
  const lastActiveTimestamp = lastActiveAt ? new Date(lastActiveAt).getTime() : Number.NaN
  const daysSinceActive = Number.isNaN(lastActiveTimestamp)
    ? 365
    : (Date.now() - lastActiveTimestamp) / (1000 * 60 * 60 * 24)
  const recencyScore = Math.max(0, 1 - daysSinceActive / 60)
  const score = clampScore(
    winRate * 40 +
      (Math.max(-1, Math.min(roi, 2)) + 1) / 3 * 30 +
      Math.min(categories.size, 5) / 5 * 15 +
      recencyScore * 15,
  )

  return {
    closedPositionCount: closedPositions.length,
    marketCount,
    openPositionCount: openPositions.length,
    recencyScore,
    roi,
    score,
    totalVolume,
    winRate,
  }
}

function buildSignalCandidates(
  input: {
    activities: PolymarketWalletActivity[]
    currentPositions: StoredSmartMoneyPositionInput[]
    eventLookup: EventLookup
    walletAddress: string
  },
) {
  const cutoff = Date.now() - getSmartMoneyActivityLookbackDays() * 24 * 60 * 60 * 1000
  const minimumSignalSize = getSmartMoneyMinSignalSizeUsd()
  const positionByCondition = new Map<string, StoredSmartMoneyPositionInput>()

  for (const position of input.currentPositions) {
    positionByCondition.set(
      `${position.conditionId}:${position.outcome}`,
      position,
    )
  }

  const dedupedActivity = new Map<string, PolymarketWalletActivity>()

  for (const activity of input.activities) {
    const timestamp = toNumber(activity.timestamp) * 1000

    if (
      normalizeText(activity.type).toUpperCase() !== 'TRADE' ||
      normalizeText(activity.side).toUpperCase() !== 'BUY' ||
      timestamp < cutoff ||
      toNumber(activity.usdcSize) < minimumSignalSize
    ) {
      continue
    }

    const outcome = normalizeOutcome(activity.outcome)
    const key = `${activity.conditionId}:${outcome}`

    if (!dedupedActivity.has(key)) {
      dedupedActivity.set(key, activity)
    }
  }

  return [...dedupedActivity.values()].map((activity) => {
    const outcome = normalizeOutcome(activity.outcome)
    const matchingPosition = positionByCondition.get(`${activity.conditionId}:${outcome}`)
    const eventContext = resolveEventContext(
      {
        providerEventId: matchingPosition?.providerEventId,
        slug: activity.eventSlug ?? matchingPosition?.eventSlug,
        title: normalizeText(activity.title),
      },
      input.eventLookup,
    )
    const entryPrice = toNumber(activity.price)
    const currentPrice = matchingPosition?.currentPrice ?? entryPrice
    const signalAt = new Date(toNumber(activity.timestamp) * 1000).toISOString()

    return {
      category: eventContext.category,
      closingDate: eventContext.closingDate,
      conditionId: activity.conditionId,
      currentPrice,
      entryPrice,
      eventId: eventContext.eventId,
      eventSlug: eventContext.eventSlug,
      iconUrl: normalizeText(activity.icon) || matchingPosition?.iconUrl || null,
      id: buildSignalId(
        input.walletAddress,
        activity.conditionId,
        outcome,
        signalAt,
      ),
      marketTitle: normalizeText(activity.title) || matchingPosition?.marketTitle || 'Market',
      outcome,
      priceDelta: currentPrice - entryPrice,
      providerEventId: eventContext.providerEventId,
      signalAt,
      size: toNumber(activity.usdcSize),
      transactionHash: normalizeText(activity.transactionHash) || null,
      walletAddress: input.walletAddress,
    } satisfies StoredSmartMoneySignalInput
  })
}

function buildOpenPositionRecords(
  positions: PolymarketWalletPosition[],
  eventLookup: EventLookup,
  walletAddress: string,
) {
  return positions.map((position) => {
    const eventContext = resolveEventContext(
      {
        providerEventId: normalizeText(position.eventId ? String(position.eventId) : ''),
        slug: position.eventSlug,
        title: normalizeText(position.title),
      },
      eventLookup,
    )

    return buildPositionRecord({
      category: eventContext.category,
      closingDate: eventContext.closingDate ?? normalizeText(position.endDate) ?? null,
      conditionId: position.conditionId,
      currentPrice: toNumber(position.curPrice),
      currentValue: toNumber(position.currentValue),
      entryPrice: toNumber(position.avgPrice),
      entryValue: toNumber(position.initialValue),
      eventId: eventContext.eventId,
      eventSlug: eventContext.eventSlug,
      iconUrl: normalizeText(position.icon) || null,
      marketTitle: normalizeText(position.title) || 'Market',
      outcome: normalizeOutcome(position.outcome),
      providerEventId: eventContext.providerEventId,
      realizedPnl: toNumber(position.realizedPnl),
      shareCount: toNumber(position.size),
      status: 'open',
      walletAddress,
    })
  })
}

function buildClosedPositionRecords(
  positions: PolymarketWalletClosedPosition[],
  eventLookup: EventLookup,
  walletAddress: string,
) {
  return positions.map((position) => {
    const eventContext = resolveEventContext(
      {
        providerEventId: normalizeText(position.eventId ? String(position.eventId) : ''),
        slug: position.eventSlug,
        title: normalizeText(position.title),
      },
      eventLookup,
    )

    return buildPositionRecord({
      category: eventContext.category,
      closingDate: eventContext.closingDate ?? normalizeText(position.endDate) ?? null,
      conditionId: position.conditionId,
      currentPrice: toNumber(position.curPrice),
      currentValue: toNumber(position.totalBought) + toNumber(position.realizedPnl),
      entryPrice: toNumber(position.avgPrice),
      entryValue: toNumber(position.totalBought),
      eventId: eventContext.eventId,
      eventSlug: eventContext.eventSlug,
      iconUrl: normalizeText(position.icon) || null,
      marketTitle: normalizeText(position.title) || 'Market',
      outcome: normalizeOutcome(position.outcome),
      providerEventId: eventContext.providerEventId,
      realizedPnl: toNumber(position.realizedPnl),
      shareCount: toNumber(position.totalBought),
      status: 'closed',
      timestamp: getPositionTimestamp(position),
      walletAddress,
    })
  })
}

async function buildWalletSnapshot(
  seedWallet: SmartMoneySeedWallet,
  eventLookup: EventLookup,
) {
  const [openPositionsRaw, closedPositionsRaw, activity] = await Promise.all([
    listPolymarketWalletPositions(seedWallet.address),
    listPolymarketWalletClosedPositions(seedWallet.address),
    listPolymarketWalletActivity(seedWallet.address),
  ])
  const openPositions = buildOpenPositionRecords(
    openPositionsRaw,
    eventLookup,
    seedWallet.address,
  )
  const closedPositions = buildClosedPositionRecords(
    closedPositionsRaw,
    eventLookup,
    seedWallet.address,
  )
  const lastActivityTimestamp = activity
    .map((entry) => toNumber(entry.timestamp))
    .sort((leftValue, rightValue) => rightValue - leftValue)[0]
  const derivedDisplayName =
    seedWallet.displayName ??
    normalizeText(activity[0]?.name) ??
    normalizeText(activity[0]?.pseudonym) ??
    null
  const profileImageUrl =
    seedWallet.profileImageUrl ??
    normalizeText(activity[0]?.profileImageOptimized) ??
    normalizeText(activity[0]?.profileImage) ??
    null
  const lastActiveAt =
    lastActivityTimestamp > 0
      ? new Date(lastActivityTimestamp * 1000).toISOString()
      : null
  const score = buildWalletScore(
    closedPositions,
    openPositions,
    lastActiveAt,
  )

  if (!score) {
    return {
      positions: [],
      signals: [],
      wallet: null,
    } satisfies WalletSnapshot
  }

  const wallet: StoredSmartMoneyWalletInput = {
    address: seedWallet.address,
    categoryStats: buildCategoryStats(closedPositions),
    closedPositionCount: score.closedPositionCount,
    displayName: derivedDisplayName,
    lastActiveAt,
    marketCount: score.marketCount,
    openPositionCount: score.openPositionCount,
    profileImageUrl,
    rank: 0,
    recencyScore: score.recencyScore,
    roi: score.roi,
    score: score.score,
    sourcePnl: seedWallet.sourcePnl,
    sourceRank: seedWallet.sourceRank,
    sourceVolume: seedWallet.sourceVolume,
    totalVolume: score.totalVolume,
    verifiedBadge: seedWallet.verifiedBadge,
    winRate: score.winRate,
    xUsername: seedWallet.xUsername,
  }

  return {
    positions: [...openPositions, ...closedPositions],
    signals: buildSignalCandidates({
      activities: activity,
      currentPositions: openPositions,
      eventLookup,
      walletAddress: seedWallet.address,
    }),
    wallet,
  } satisfies WalletSnapshot
}

async function buildWalletWatchSignals(
  walletAddress: string,
  eventLookup: EventLookup,
) {
  const [openPositionsRaw, activity] = await Promise.all([
    listPolymarketWalletPositions(walletAddress),
    listPolymarketWalletActivity(walletAddress),
  ])
  const openPositions = buildOpenPositionRecords(
    openPositionsRaw,
    eventLookup,
    walletAddress,
  )

  return buildSignalCandidates({
    activities: activity,
    currentPositions: openPositions,
    eventLookup,
    walletAddress,
  })
}

async function buildSmartMoneySnapshot() {
  const eventLookup = await buildEventLookup()
  const seedWallets = await listPolymarketLeaderboardWallets(
    getSmartMoneyLeaderboardLimit(),
  )
  const snapshots: WalletSnapshot[] = []

  for (const seedWallet of seedWallets) {
    snapshots.push(await buildWalletSnapshot(seedWallet, eventLookup))
  }

  const wallets = snapshots
    .map((snapshot) => snapshot.wallet)
    .filter((wallet): wallet is StoredSmartMoneyWalletInput => Boolean(wallet))
    .sort((leftWallet, rightWallet) => {
      if (rightWallet.score !== leftWallet.score) {
        return rightWallet.score - leftWallet.score
      }

      return rightWallet.totalVolume - leftWallet.totalVolume
    })
    .map((wallet, index) => ({
      ...wallet,
      rank: index + 1,
    }))
  const walletByAddress = new Map(
    wallets.map((wallet) => [wallet.address, wallet]),
  )
  const positions = dedupePositions(
    snapshots.flatMap((snapshot) => snapshot.positions),
  )
  const signals = dedupeSignals(
    snapshots
    .flatMap((snapshot) => snapshot.signals)
    .filter((signal) => walletByAddress.has(signal.walletAddress)),
  )

  return {
    positions,
    signals,
    wallets,
  }
}

function emitSmartMoneySignals(signals: PulseSmartMoneySignal[]) {
  if (!signals.length) {
    return
  }

  for (const listener of smartMoneySignalListeners) {
    listener(signals)
  }
}

async function refreshSmartMoneySnapshot() {
  const attemptedAt = new Date()

  await recordSmartMoneySyncAttempt(SMART_MONEY_SNAPSHOT_SYNC_KEY, attemptedAt)

  try {
    const snapshot = await buildSmartMoneySnapshot()
    await replaceStoredSmartMoneySnapshot(
      snapshot,
      attemptedAt,
      SMART_MONEY_SNAPSHOT_SYNC_KEY,
    )
    invalidateCachedResponses('/api/v1/smart-money')
    await recordSmartMoneySyncSuccess(
      SMART_MONEY_SNAPSHOT_SYNC_KEY,
      attemptedAt,
    )

    return [] as PulseSmartMoneySignal[]
  } catch (error) {
    await recordSmartMoneySyncFailure(
      SMART_MONEY_SNAPSHOT_SYNC_KEY,
      getErrorMessage(error),
      attemptedAt,
    )
    throw error
  }
}

async function watchSmartMoneySignals() {
  const attemptedAt = new Date()

  await recordSmartMoneySyncAttempt(SMART_MONEY_SIGNAL_WATCH_SYNC_KEY, attemptedAt)

  try {
    const walletCount = await countStoredSmartMoneyWallets()

    if (walletCount <= 0) {
      await runSmartMoneySnapshotRefresh(true)
      await recordSmartMoneySyncSuccess(
        SMART_MONEY_SIGNAL_WATCH_SYNC_KEY,
        attemptedAt,
      )

      return [] as PulseSmartMoneySignal[]
    }

    const eventLookup = await buildEventLookup()
    const watchedWalletAddresses = await listStoredSmartMoneyWalletAddresses(
      getSmartMoneyWatchWalletLimit(),
    )
    const candidateSignals = dedupeSignals(
      (
        await Promise.all(
          watchedWalletAddresses.map((walletAddress) =>
            buildWalletWatchSignals(walletAddress, eventLookup),
          ),
        )
      ).flat(),
    )
    const insertedSignalIds = await appendStoredSmartMoneySignals(
      candidateSignals,
      attemptedAt,
    )

    await recordSmartMoneySyncSuccess(
      SMART_MONEY_SIGNAL_WATCH_SYNC_KEY,
      attemptedAt,
    )

    if (!insertedSignalIds.length) {
      return [] as PulseSmartMoneySignal[]
    }

    invalidateCachedResponses('/api/v1/smart-money')

    const nextSignals = await listStoredSmartMoneySignalsByIds(insertedSignalIds)
    emitSmartMoneySignals(nextSignals)

    return nextSignals
  } catch (error) {
    await recordSmartMoneySyncFailure(
      SMART_MONEY_SIGNAL_WATCH_SYNC_KEY,
      getErrorMessage(error),
      attemptedAt,
    )
    throw error
  }
}

async function runSmartMoneySnapshotRefresh(force = false) {
  if (smartMoneySnapshotRefreshPromise) {
    return smartMoneySnapshotRefreshPromise
  }

  const [walletCount, state] = await Promise.all([
    countStoredSmartMoneyWallets(),
    getSmartMoneySyncState(SMART_MONEY_SNAPSHOT_SYNC_KEY),
  ])

  if (
    !force &&
    walletCount > 0 &&
    !isSmartMoneySyncStale(
      state?.lastSuccessAt,
      getSmartMoneySnapshotRefreshIntervalMs(),
    )
  ) {
    return [] as PulseSmartMoneySignal[]
  }

  snapshotJobRunning = true
  smartMoneySnapshotRefreshPromise = refreshSmartMoneySnapshot().finally(() => {
    smartMoneySnapshotRefreshPromise = null
    snapshotJobRunning = false
  })

  return smartMoneySnapshotRefreshPromise
}

async function runSmartMoneySignalWatch(force = false) {
  if (smartMoneySignalWatchPromise) {
    return smartMoneySignalWatchPromise
  }

  const state = await getSmartMoneySyncState(SMART_MONEY_SIGNAL_WATCH_SYNC_KEY)

  if (
    !force &&
    !isSmartMoneySyncStale(
      state?.lastSuccessAt,
      getSmartMoneySignalWatchIntervalMs(),
    )
  ) {
    return [] as PulseSmartMoneySignal[]
  }

  signalWatchJobRunning = true
  smartMoneySignalWatchPromise = watchSmartMoneySignals().finally(() => {
    smartMoneySignalWatchPromise = null
    signalWatchJobRunning = false
  })

  return smartMoneySignalWatchPromise
}

async function ensureSmartMoneySnapshot() {
  const [walletCount, state] = await Promise.all([
    countStoredSmartMoneyWallets(),
    getSmartMoneySyncState(SMART_MONEY_SNAPSHOT_SYNC_KEY),
  ])

  if (walletCount <= 0) {
    await runSmartMoneySnapshotRefresh(true)
    return
  }

  if (
    isSmartMoneySyncStale(
      state?.lastSuccessAt,
      getSmartMoneySnapshotRefreshIntervalMs(),
    )
  ) {
    void runSmartMoneySnapshotRefresh().catch(() => {
      // Keep serving the stored snapshot when upstream refreshes fail.
    })
  }
}

export async function pollSmartMoneySignals() {
  return runSmartMoneySignalWatch(true)
}

export function subscribeToSmartMoneySignals(
  listener: (signals: PulseSmartMoneySignal[]) => void,
) {
  smartMoneySignalListeners.add(listener)

  return () => {
    smartMoneySignalListeners.delete(listener)
  }
}

export function startSmartMoneyScheduler() {
  if (schedulerStarted) {
    return
  }

  schedulerStarted = true
  void runSmartMoneySnapshotRefresh().catch(() => {
    // The status endpoint carries job failures; startup should not crash on upstream errors.
  })
  void runSmartMoneySignalWatch().catch(() => {
    // The status endpoint carries job failures; startup should not crash on upstream errors.
  })
  snapshotRefreshInterval = setInterval(() => {
    void runSmartMoneySnapshotRefresh().catch(() => {
      // Keep background jobs alive on transient failures.
    })
  }, getSmartMoneySnapshotRefreshIntervalMs())
  signalWatchInterval = setInterval(() => {
    void runSmartMoneySignalWatch().catch(() => {
      // Keep background jobs alive on transient failures.
    })
  }, getSmartMoneySignalWatchIntervalMs())
}

export function stopSmartMoneyScheduler() {
  schedulerStarted = false

  if (snapshotRefreshInterval) {
    clearInterval(snapshotRefreshInterval)
    snapshotRefreshInterval = null
  }

  if (signalWatchInterval) {
    clearInterval(signalWatchInterval)
    signalWatchInterval = null
  }
}

function toJobStatus(
  job: 'signal-watch' | 'snapshot',
  state: Awaited<ReturnType<typeof getSmartMoneySyncState>>,
  isRunning: boolean,
  intervalMs: number,
) {
  return {
    intervalMs,
    isRunning,
    isStale: isSmartMoneySyncStale(state?.lastSuccessAt, intervalMs),
    job,
    lastError: state?.lastError ?? null,
    lastRunAt: state?.lastRunAt ?? null,
    lastSuccessAt: state?.lastSuccessAt ?? null,
  } satisfies PulseSmartMoneyJobStatus
}

export async function getSmartMoneyStatus() {
  const [walletCount, signalCount, snapshotState, signalWatchState] = await Promise.all([
    countStoredSmartMoneyWallets(),
    countStoredSmartMoneySignals(),
    getSmartMoneySyncState(SMART_MONEY_SNAPSHOT_SYNC_KEY),
    getSmartMoneySyncState(SMART_MONEY_SIGNAL_WATCH_SYNC_KEY),
  ])

  return {
    jobStatus: [
      toJobStatus(
        'snapshot',
        snapshotState,
        snapshotJobRunning,
        getSmartMoneySnapshotRefreshIntervalMs(),
      ),
      toJobStatus(
        'signal-watch',
        signalWatchState,
        signalWatchJobRunning,
        getSmartMoneySignalWatchIntervalMs(),
      ),
    ],
    signalCount,
    walletCount,
    watchWalletLimit: getSmartMoneyWatchWalletLimit(),
  } satisfies PulseSmartMoneyStatus
}

export async function listSmartMoneySignals(params: PulseSmartMoneySignalListParams) {
  await ensureSmartMoneySnapshot()

  return listStoredSmartMoneySignals(params)
}

export async function listSmartMoneyWallets(params: PulseSmartMoneyWalletListParams) {
  await ensureSmartMoneySnapshot()

  return listStoredSmartMoneyWallets(params)
}

export async function getSmartMoneyWallet(address: string) {
  await ensureSmartMoneySnapshot()

  const wallet = await getStoredSmartMoneyWallet(address)

  if (!wallet) {
    throw new Error('Smart money wallet not found.')
  }

  return wallet
}
