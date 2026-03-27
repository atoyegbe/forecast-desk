export type PulseProvider = 'polymarket'
export type PulseSmartMoneySignalSort = 'largest' | 'newest'

export type PulseFreshness = {
  isStale: boolean
  syncedAt: string
}

export type PulseSmartMoneyWallet = {
  address: string
  closedPositionCount: number
  displayName?: string | null
  freshness?: PulseFreshness
  isLive: boolean
  lastActiveAt?: string | null
  marketCount: number
  openPositionCount: number
  profileImageUrl?: string | null
  rank: number
  recencyScore: number
  roi: number
  score: number
  shortAddress: string
  sourcePnl: number
  sourceRank?: number | null
  sourceVolume: number
  totalVolume: number
  verifiedBadge: boolean
  winRate: number
  xUsername?: string | null
}

export type PulseSmartMoneyCategoryStat = {
  category: string
  positions: number
  roi: number
  winRate: number
}

export type PulseSmartMoneyPosition = {
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
  pnl: number
  provider: PulseProvider
  providerEventId?: string | null
  realizedPnl: number
  shareCount: number
  status: 'closed' | 'open'
  timestamp?: string | null
}

export type PulseSmartMoneySignal = {
  category: string
  closingDate?: string | null
  currentPrice: number
  entryPrice: number
  eventId?: string | null
  eventSlug: string
  iconUrl?: string | null
  id: string
  isNew: boolean
  marketTitle: string
  outcome: 'NO' | 'YES'
  priceDelta: number
  provider: 'polymarket'
  providerEventId?: string | null
  signalAt: string
  size: number
  walletAddress: string
  walletDisplayName?: string | null
  walletProfileImageUrl?: string | null
  walletRank: number
  walletScore: number
  walletShortAddress: string
  walletVerified: boolean
}

export type PulseSmartMoneyWalletDetail = {
  categoryStats: PulseSmartMoneyCategoryStat[]
  freshness?: PulseFreshness
  openPositions: PulseSmartMoneyPosition[]
  recentSignals: PulseSmartMoneySignal[]
  wallet: PulseSmartMoneyWallet
}

export type PulseSmartMoneySignalListParams = {
  category?: string
  limit?: number | string
  minScore?: number | string
  minSize?: number | string
  sort?: PulseSmartMoneySignalSort
}

export type PulseSmartMoneyWalletListParams = {
  limit?: number | string
  minScore?: number | string
  minVolume?: number | string
}

export type PulseSmartMoneyLiveMessage =
  | {
      timestamp: number
      type: 'connected' | 'heartbeat'
    }
  | {
      data: PulseSmartMoneySignal
      timestamp: number
      type: 'signal'
    }
  | {
      message: string
      timestamp: number
      type: 'error'
    }
