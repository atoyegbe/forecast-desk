export type PulseAlertTriggerMode = 'any-new-position' | 'winning-moves-only'

export type PulseAlertSubscription = {
  channel: 'email'
  createdAt: string
  id: string
  lastDeliveredAt: string | null
  minScore: number | null
  minSizeUsd: number | null
  status: 'active' | 'paused'
  triggerMode: PulseAlertTriggerMode
  type: 'wallet'
  updatedAt: string
  walletAddress: string
}

export type PulseAlertSubscriptionCreateInput = {
  minScore?: number
  minSizeUsd?: number
  triggerMode?: PulseAlertTriggerMode
  type: 'wallet'
  walletAddress: string
}

export type PulseAlertSubscriptionUpdateInput = {
  status: 'active' | 'paused'
}
