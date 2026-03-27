export type NormalizedPlatform = 'polymarket' | 'kalshi' | 'manifold' | 'bayse'

export type NormalizedCategory =
  | 'politics'
  | 'sports'
  | 'crypto'
  | 'finance'
  | 'entertainment'
  | 'science'
  | 'world_events'
  | 'other'

export type NormalizedMarket = {
  category: NormalizedCategory
  closingAt: Date
  createdAt: Date
  currency: 'USD' | 'NGN'
  description: string | null
  engine: 'clob' | 'amm' | 'play_money'
  id: string
  ingestedAt: Date
  liquidity: number
  noPrice: number
  platform: NormalizedPlatform
  platformId: string
  platformUrl: string
  rawData: Record<string, unknown>
  resolution: 'yes' | 'no' | 'n/a' | null
  resolvedAt: Date | null
  spread: number
  status: 'open' | 'closed' | 'resolved' | 'cancelled'
  tags: string[]
  title: string
  updatedAt: Date
  usdEquivalentPrice: number
  volume24h: number
  volumeTotal: number
  yesPrice: number
}
