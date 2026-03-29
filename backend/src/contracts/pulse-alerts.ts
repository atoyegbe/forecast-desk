export type PulseAlertChannel = 'email'
export type PulseAlertSubscriptionStatus = 'active' | 'paused'
export type PulseAlertSubscriptionType = 'wallet'
export type PulseAlertTriggerMode =
  | 'any-new-position'
  | 'winning-moves-only'

export type PulseAlertSubscription = {
  channel: PulseAlertChannel
  createdAt: string
  id: string
  lastDeliveredAt: string | null
  minScore: number | null
  minSizeUsd: number | null
  status: PulseAlertSubscriptionStatus
  triggerMode: PulseAlertTriggerMode
  type: PulseAlertSubscriptionType
  updatedAt: string
  walletAddress: string
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
  status: PulseAlertSubscriptionStatus
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
