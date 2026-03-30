export type PulseAlertTriggerMode = 'any-new-position' | 'winning-moves-only'
export type PulseAlertRecentDeliveryStatus = 'delivered' | 'failed' | 'pending'
export type PulseAlertDeliveryChannel = 'email' | 'telegram'

export type PulseAlertSubscription = {
  channel: 'email'
  createdAt: string
  id: string
  lastDeliveryAttemptAt?: string | null
  lastDeliveredAt: string | null
  lastDeliveryStatus?: PulseAlertRecentDeliveryStatus | null
  minScore: number | null
  minSizeUsd: number | null
  status: 'active' | 'paused'
  triggerMode: PulseAlertTriggerMode
  type: 'wallet'
  updatedAt: string
  walletAddress: string
  walletLabel?: string | null
}

export type PulseAlertSubscriptionCreateInput = {
  minScore?: number
  minSizeUsd?: number
  triggerMode?: PulseAlertTriggerMode
  type: 'wallet'
  walletAddress: string
}

export type PulseAlertSubscriptionUpdateInput = {
  minScore?: number
  minSizeUsd?: number
  status?: 'active' | 'paused'
  triggerMode?: PulseAlertTriggerMode
}

export type PulseAlertRecentDelivery = {
  channel: PulseAlertDeliveryChannel
  id: string
  marketTitle: string
  occurredAt: string
  status: PulseAlertRecentDeliveryStatus
  walletAddress: string
  walletLabel?: string | null
}
