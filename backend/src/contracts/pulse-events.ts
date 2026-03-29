export type PulseProvider = 'bayse' | 'kalshi' | 'manifold' | 'polymarket'
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
  feePercentage: number
  id: string
  imageUrl?: string | null
  liquidity: number
  noOutcome: PulseOutcome
  providerMarketId: string
  rules?: string
  status: string
  title: string
  totalOrders: number
  totalVolume: number
  yesOutcome: PulseOutcome
}

export type PulseEvent = {
  additionalContext: string
  category: string
  closingDate?: string | null
  countryCodes: string[]
  createdAt: string
  description: string
  engine: string
  freshness?: PulseFreshness
  hashtags: string[]
  id: string
  imageUrl?: string | null
  liquidity: number
  markets: PulseMarket[]
  provider: PulseProvider
  providerEventId: string
  regions: string[]
  resolutionDate?: string | null
  resolutionSource?: string | null
  slug: string
  sourceUrl?: string | null
  status: string
  supportedCurrencies: string[]
  title: string
  totalOrders: number
  totalVolume: number
  type: string
}

export type PulsePricePoint = {
  price: number
  timestamp: number
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

export type LiveMarketPrice = {
  marketId: string
  noPrice: number
  title: string
  yesPrice: number
}

export type LivePriceSnapshot = {
  eventId: string
  markets: LiveMarketPrice[]
  timestamp: number
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

export type PulseEventListParams = {
  category?: string
  keyword?: string
  provider?: PulseProvider
  status?: string
}

export type PulseEventsListData = {
  items: PulseEvent[]
}

export type PulseSearchParams = {
  category?: string
  provider?: PulseProvider
  q?: string
  status?: string
}

export type PulseSearchResultsData = {
  items: PulseEvent[]
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

export type PulseDivergenceListData = {
  items: PulseComparisonGroup[]
}
