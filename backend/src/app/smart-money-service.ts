import { randomUUID } from 'node:crypto'
import type {
  PulseSmartMoneyCategoryStat,
  PulseSmartMoneySignal,
  PulseSmartMoneySignalListParams,
  PulseSmartMoneyWallet,
  PulseSmartMoneyWalletDetail,
  PulseSmartMoneyWalletListParams,
} from '../contracts/pulse-smart-money.js'
import {
  getSmartMoneyActivityLookbackDays,
  getSmartMoneyLeaderboardLimit,
  getSmartMoneyMinSignalSizeUsd,
  getSmartMoneyRefreshIntervalMs,
} from '../db/config.js'
import {
  countStoredSmartMoneyWallets,
  getSmartMoneySyncState,
  getStoredSmartMoneyWallet,
  listStoredSmartMoneySignalIds,
  listStoredSmartMoneySignalsByIds,
  listStoredSmartMoneySignals,
  listStoredSmartMoneyWallets,
  recordSmartMoneySyncAttempt,
  recordSmartMoneySyncFailure,
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

const SMART_MONEY_SYNC_KEY = 'smart-money'
let smartMoneyRefreshPromise: Promise<PulseSmartMoneySignal[]> | null = null

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

function isSmartMoneySyncStale(lastRunAt?: string | null) {
  if (!lastRunAt) {
    return true
  }

  const parsedTimestamp = new Date(lastRunAt).getTime()

  if (Number.isNaN(parsedTimestamp)) {
    return true
  }

  return Date.now() - parsedTimestamp >= getSmartMoneyRefreshIntervalMs()
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
  seedWallet: SmartMoneySeedWallet,
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
      id: randomUUID(),
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

async function buildWalletSnapshot(
  seedWallet: SmartMoneySeedWallet,
  eventLookup: EventLookup,
) {
  const [openPositionsRaw, closedPositionsRaw, activity] = await Promise.all([
    listPolymarketWalletPositions(seedWallet.address),
    listPolymarketWalletClosedPositions(seedWallet.address),
    listPolymarketWalletActivity(seedWallet.address),
  ])
  const openPositions = openPositionsRaw.map((position) => {
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
      walletAddress: seedWallet.address,
    })
  })
  const closedPositions = closedPositionsRaw.map((position) => {
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
      walletAddress: seedWallet.address,
    })
  })
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
    seedWallet,
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
    .filter((signal) => walletByAddress.has(signal.walletAddress))
    .map((signal) => ({
      ...signal,
      id: `${signal.walletAddress}:${signal.conditionId}:${signal.outcome}:${signal.signalAt}`,
    })),
  )

  return {
    positions,
    signals,
    wallets,
  }
}

async function refreshSmartMoneySnapshot() {
  const attemptedAt = new Date()
  const existingSignalIds = new Set(await listStoredSmartMoneySignalIds())

  await recordSmartMoneySyncAttempt(SMART_MONEY_SYNC_KEY, attemptedAt)

  try {
    const snapshot = await buildSmartMoneySnapshot()
    await replaceStoredSmartMoneySnapshot(snapshot, attemptedAt, SMART_MONEY_SYNC_KEY)
    invalidateCachedResponses('/api/v1/smart-money')

    if (!existingSignalIds.size) {
      return [] as PulseSmartMoneySignal[]
    }

    const nextSignalIds = snapshot.signals
      .map((signal) => signal.id)
      .filter((signalId) => !existingSignalIds.has(signalId))

    return listStoredSmartMoneySignalsByIds(nextSignalIds)
  } catch (error) {
    await recordSmartMoneySyncFailure(
      SMART_MONEY_SYNC_KEY,
      getErrorMessage(error),
      attemptedAt,
    )
    throw error
  }
}

async function runSmartMoneyRefresh(force = false) {
  if (smartMoneyRefreshPromise) {
    return smartMoneyRefreshPromise
  }

  const [walletCount, state] = await Promise.all([
    countStoredSmartMoneyWallets(),
    getSmartMoneySyncState(SMART_MONEY_SYNC_KEY),
  ])

  if (!force && walletCount > 0 && !isSmartMoneySyncStale(state?.lastRunAt)) {
    return [] as PulseSmartMoneySignal[]
  }

  smartMoneyRefreshPromise = refreshSmartMoneySnapshot().finally(() => {
    smartMoneyRefreshPromise = null
  })

  return smartMoneyRefreshPromise
}

async function ensureSmartMoneySnapshot() {
  const [walletCount, state] = await Promise.all([
    countStoredSmartMoneyWallets(),
    getSmartMoneySyncState(SMART_MONEY_SYNC_KEY),
  ])

  if (walletCount <= 0) {
    await runSmartMoneyRefresh(true)
    return
  }

  if (isSmartMoneySyncStale(state?.lastRunAt)) {
    void runSmartMoneyRefresh().catch(() => {
      // Keep serving the stored snapshot when upstream refreshes fail.
    })
  }
}

export async function pollSmartMoneySignals() {
  return runSmartMoneyRefresh(true)
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
