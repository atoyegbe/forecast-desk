export type PulseAlertChannel = 'email'
export type PulseAlertSubscriptionStatus = 'active' | 'paused'
export type PulseAlertSubscriptionType = 'wallet'
export type PulseAlertTriggerMode =
  | 'any-new-position'
  | 'winning-moves-only'
export type PulseAlertDeliveryChannel = 'email' | 'telegram'
export type PulseAlertRecentDeliveryStatus = 'delivered' | 'failed' | 'pending'

export type PulseAlertSubscription = {
  channel: PulseAlertChannel
  createdAt: string
  id: string
  lastDeliveryAttemptAt?: string | null
  lastDeliveredAt: string | null
  lastDeliveryStatus?: PulseAlertRecentDeliveryStatus | null
  minScore: number | null
  minSizeUsd: number | null
  status: PulseAlertSubscriptionStatus
  triggerMode: PulseAlertTriggerMode
  type: PulseAlertSubscriptionType
  updatedAt: string
  walletAddress: string
  walletLabel?: string | null
}

export type PulseAlertSubscriptionListData = {
  items: PulseAlertSubscription[]
}

export type PulseAlertSubscriptionCreateInput = {
  minScore?: number
  minSizeUsd?: number
  triggerMode?: PulseAlertTriggerMode
  type: PulseAlertSubscriptionType
  walletAddress: string
}

export type PulseAlertSubscriptionUpdateInput = {
  minScore?: number
  minSizeUsd?: number
  status?: PulseAlertSubscriptionStatus
  triggerMode?: PulseAlertTriggerMode
}

export type PulseAlertDeliveryStatus = 'failed' | 'pending' | 'sent'

export type PulseAlertDelivery = {
  attemptCount: number
  channel: PulseAlertChannel
  createdAt: string
  id: string
  lastAttemptAt: string | null
  lastError: string | null
  nextAttemptAt: string | null
  providerMessageId: string | null
  sentAt: string | null
  signalId: string
  status: PulseAlertDeliveryStatus
  subscriptionId: string
  updatedAt: string
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

export type PulseAlertRecentDeliveryListData = {
  items: PulseAlertRecentDelivery[]
}
