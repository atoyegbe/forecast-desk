import type {
  PulseEvent,
  PulseMover,
  PulseMoverWindow,
  PulseMoverWindowStats,
  PulsePriceHistory,
  PulsePricePoint,
} from './types'

export const EMPTY_EVENTS: PulseEvent[] = []
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const MOVER_WINDOWS = [
  { id: '1h', label: '1H', durationMs: HOUR_MS, weight: 1.15 },
  { id: '6h', label: '6H', durationMs: 6 * HOUR_MS, weight: 1 },
  { id: '24h', label: '24H', durationMs: DAY_MS, weight: 0.9 },
] as const satisfies ReadonlyArray<{
  durationMs: number
  id: PulseMoverWindow
  label: string
  weight: number
}>

export function getPrimaryMarket(event?: PulseEvent) {
  return event?.markets[0]
}

export function getYesPrice(event?: PulseEvent) {
  return getPrimaryMarket(event)?.yesOutcome.price ?? 0
}

export function sortByVolume(a: PulseEvent, b: PulseEvent) {
  return b.totalVolume - a.totalVolume
}

export function sortByOrders(a: PulseEvent, b: PulseEvent) {
  return b.totalOrders - a.totalOrders
}

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1)
}

function normalizeSignal(value: number, ceiling: number) {
  return clamp01(value / ceiling)
}

export function getActivityScore(event: PulseEvent) {
  const ordersSignal = Math.log10(event.totalOrders + 10)
  const volumeSignal = Math.log10(event.totalVolume + 10)
  const liquiditySignal = Math.log10(event.liquidity + 10)

  if (event.totalOrders <= 0) {
    return volumeSignal * 0.72 + liquiditySignal * 0.28
  }

  return ordersSignal * 0.45 + volumeSignal * 0.4 + liquiditySignal * 0.15
}

export function sortByActivityScore(a: PulseEvent, b: PulseEvent) {
  return getActivityScore(b) - getActivityScore(a)
}

export function getContestabilityScore(event: PulseEvent) {
  const distanceFromMiddle = Math.abs(getYesPrice(event) - 0.5)
  const middleScore = 1 - clamp01(distanceFromMiddle / 0.5)
  const attentionScore = normalizeSignal(getActivityScore(event), 4.6)

  return middleScore * 0.76 + attentionScore * 0.24
}

export function sortByTightRace(a: PulseEvent, b: PulseEvent) {
  return getContestabilityScore(b) - getContestabilityScore(a)
}

export function isNigeriaRelevant(event: PulseEvent) {
  return (
    event.countryCodes.includes('NG') ||
    event.regions.includes('Nigeria') ||
    /nigeria|naija|lagos|tinubu|super eagles|bbnaija|davido|wizkid|ayra|afcon|abuja|obi/i.test(
      `${event.title} ${event.description} ${event.additionalContext}`,
    )
  )
}

export function getCategorySlug(category: string) {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function getCategoryLabelFromSlug(events: PulseEvent[], slug?: string) {
  if (!slug) {
    return null
  }

  return (
    events.find((event) => getCategorySlug(event.category) === slug)?.category ??
    null
  )
}

function getHistoryCoverageRatio(
  points: PulsePricePoint[],
  durationMs: number,
) {
  if (points.length < 2) {
    return 0
  }

  const coveredDuration =
    points[points.length - 1].timestamp - points[0].timestamp

  return clamp01(coveredDuration / durationMs)
}

function getPriceChangeCountForWindow(
  points: PulsePricePoint[],
  durationMs: number,
) {
  if (points.length < 2) {
    return 0
  }

  const latestTimestamp = points[points.length - 1].timestamp
  const cutoff = latestTimestamp - durationMs
  const visiblePoints = points.filter((point) => point.timestamp >= cutoff)

  return Math.max(visiblePoints.length - 1, 0)
}

function getReferencePointForWindow(
  points: PulsePricePoint[],
  durationMs: number,
) {
  if (!points.length) {
    return null
  }

  const latestTimestamp = points[points.length - 1].timestamp
  const cutoff = latestTimestamp - durationMs
  let candidate = points[0]

  for (const point of points) {
    if (point.timestamp <= cutoff) {
      candidate = point
      continue
    }

    break
  }

  return candidate
}

export function getMoverWindowStats(
  currentPrice: number,
  points: PulsePricePoint[],
  window: PulseMoverWindow,
) {
  const windowConfig = MOVER_WINDOWS.find((candidate) => candidate.id === window)
  const durationMs = windowConfig?.durationMs ?? DAY_MS
  const referencePoint = getReferencePointForWindow(points, durationMs)
  const previousPrice = referencePoint?.price ?? currentPrice
  const change = currentPrice - previousPrice

  return {
    absChange: Math.abs(change),
    change,
    coverageRatio: getHistoryCoverageRatio(points, durationMs),
    priceChanges: getPriceChangeCountForWindow(points, durationMs),
    previousPrice,
  } satisfies PulseMoverWindowStats
}

export function buildMover(event: PulseEvent, history?: PulsePriceHistory | null) {
  const currentPrice = getYesPrice(event)
  const points = history?.points ?? []
  const activityScore = getActivityScore(event)
  const changesByWindow = Object.fromEntries(
    MOVER_WINDOWS.map((window) => [
      window.id,
      getMoverWindowStats(currentPrice, points, window.id),
    ]),
  ) as Record<PulseMoverWindow, PulseMoverWindowStats>
  const bestWindow = MOVER_WINDOWS.reduce((best, window) => {
    const bestStats = changesByWindow[best.id]
    const currentStats = changesByWindow[window.id]

    return currentStats.absChange > bestStats.absChange ? window : best
  }, MOVER_WINDOWS[0]).id
  const defaultWindowStats = changesByWindow['24h']
  const trendScore = MOVER_WINDOWS.reduce((sum, window) => {
    const stats = changesByWindow[window.id]
    const coverageWeight = 0.65 + stats.coverageRatio * 0.35

    return sum + stats.absChange * window.weight * coverageWeight
  }, 0) * (0.9 + normalizeSignal(activityScore, 4.6) * 0.4)

  return {
    activityScore,
    absChange: defaultWindowStats.absChange,
    bestWindow,
    change: defaultWindowStats.change,
    changesByWindow,
    currentPrice,
    event,
    previousPrice: defaultWindowStats.previousPrice,
    trendScore,
  } satisfies PulseMover
}

export function getMoverChange(
  mover: PulseMover,
  window: PulseMoverWindow = '24h',
) {
  return mover.changesByWindow[window].change
}

export function getMoverAbsChange(
  mover: PulseMover,
  window: PulseMoverWindow = '24h',
) {
  return mover.changesByWindow[window].absChange
}

export function getTopMoverWindow(
  movers: PulseMover[],
  window: PulseMoverWindow = '24h',
) {
  return [...movers].sort(
    (a, b) => getMoverAbsChange(b, window) - getMoverAbsChange(a, window),
  )
}

export function getMarketStance(price: number) {
  if (price >= 0.75) {
    return 'The market is leaning hard toward a yes outcome.'
  }

  if (price <= 0.25) {
    return 'The board is pricing a yes outcome as unlikely right now.'
  }

  if (Math.abs(price - 0.5) <= 0.04) {
    return 'This market is nearly split down the middle.'
  }

  if (price > 0.5) {
    return 'The market is leaning yes, but conviction is still contestable.'
  }

  return 'The market is leaning no, but still vulnerable to new information.'
}

export function getTempoLabel(event: PulseEvent) {
  const activityScore = getActivityScore(event)

  if (activityScore >= 4.1) {
    return 'Heavy traffic'
  }

  if (activityScore >= 3.2) {
    return 'Active desk'
  }

  if (activityScore >= 2.3) {
    return 'Steady tape'
  }

  return 'Early signal'
}

export function getTempoLabelFromPriceChanges(priceChanges: number) {
  if (priceChanges > 20) {
    return 'Heavy traffic'
  }

  if (priceChanges >= 5) {
    return 'Moderate'
  }

  return 'Quiet'
}
