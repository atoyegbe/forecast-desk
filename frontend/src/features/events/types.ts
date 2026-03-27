export type PulseProvider = 'bayse' | 'polymarket'
export type PulseMatchMethod = 'exact' | 'fuzzy'

export type PulseOutcome = {
  id: string
  label: string
  price: number
}

export type PulseFreshness = {
  isStale: boolean
  syncedAt: string
}

export type PulseMarket = {
  id: string
  providerMarketId: string
  title: string
  status: string
  feePercentage: number
  imageUrl?: string | null
  rules?: string
  totalOrders: number
  totalVolume: number
  liquidity: number
  yesOutcome: PulseOutcome
  noOutcome: PulseOutcome
}

export type PulseEvent = {
  id: string
  provider: PulseProvider
  providerEventId: string
  slug: string
  title: string
  description: string
  additionalContext: string
  category: string
  status: string
  engine: string
  type: string
  freshness?: PulseFreshness
  imageUrl?: string | null
  createdAt: string
  resolutionDate?: string | null
  closingDate?: string | null
  resolutionSource?: string | null
  sourceUrl?: string | null
  liquidity: number
  totalOrders: number
  totalVolume: number
  supportedCurrencies: string[]
  hashtags: string[]
  regions: string[]
  countryCodes: string[]
  markets: PulseMarket[]
}

export type PulsePricePoint = {
  timestamp: number
  price: number
}

export type PulsePriceHistory = {
  eventId: string
  eventTitle: string
  freshness?: PulseFreshness
  marketId: string
  marketTitle: string
  points: PulsePricePoint[]
  previousInterval?: PulsePricePoint
}

export type PulseEventListParams = {
  category?: string
  keyword?: string
  provider?: PulseProvider
  status?: string
}

export type PulseSearchParams = {
  category?: string
  provider?: PulseProvider
  q?: string
  status?: string
}

export type PulseComparedEvent = {
  event: PulseEvent
  liquidity: number
  marketId: string
  marketTitle: string
  noPrice: number
  totalVolume: number
  yesPrice: number
}

export type PulseComparisonGroup = {
  category: string
  comparedAt: string
  confidence: number
  events: PulseComparedEvent[]
  linkId: string
  matchMethod: PulseMatchMethod
  maxDivergence: number
  title: string
  weightedDivergence: number
}

export type PulseEventComparison = PulseComparisonGroup & {
  anchorEventId: string
}

export type PulseDivergenceListParams = {
  category?: string
  limit?: number | string
  minDivergence?: number | string
  sort?: 'divergence' | 'volume'
}

export type LiveMarketPrice = {
  marketId: string
  title: string
  yesPrice: number
  noPrice: number
}

export type LivePriceSnapshot = {
  eventId: string
  timestamp: number
  markets: LiveMarketPrice[]
}

export type PulseLiveMessage =
  | {
      eventId: string
      timestamp: number
      type: 'connected'
    }
  | {
      data: LivePriceSnapshot
      timestamp: number
      type: 'price_update'
    }
  | {
      message: string
      timestamp: number
      type: 'error'
    }

export type PulseMoverWindow = '1h' | '6h' | '24h'

export type PulseMoverWindowStats = {
  absChange: number
  change: number
  coverageRatio: number
  previousPrice: number
}

export type PulseMover = {
  activityScore: number
  bestWindow: PulseMoverWindow
  changesByWindow: Record<PulseMoverWindow, PulseMoverWindowStats>
  event: PulseEvent
  currentPrice: number
  previousPrice: number
  change: number
  absChange: number
  trendScore: number
}
