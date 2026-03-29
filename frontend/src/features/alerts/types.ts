export type PulseAlertSubscription = {
  channel: 'email'
  createdAt: string
  id: string
  minScore: number | null
  minSizeUsd: number | null
  status: 'active' | 'paused'
  type: 'wallet'
  updatedAt: string
  walletAddress: string
}

export type PulseAlertSubscriptionCreateInput = {
  minScore?: number
  minSizeUsd?: number
  type: 'wallet'
  walletAddress: string
}
