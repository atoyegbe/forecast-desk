import { fetchBackendJson } from '../../lib/api-client'
import type {
  PulseAlertRecentDelivery,
  PulseAlertSubscription,
  PulseAlertSubscriptionCreateInput,
  PulseAlertSubscriptionUpdateInput,
} from './types'

export async function createAlertSubscription(input: PulseAlertSubscriptionCreateInput) {
  const response = await fetchBackendJson<PulseAlertSubscription>(
    '/alerts/subscriptions',
    {
      body: JSON.stringify(input),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  )

  return response.data
}

export async function deleteAlertSubscription(subscriptionId: string) {
  await fetchBackendJson<null>(`/alerts/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'DELETE',
  })
}

export async function listAlertSubscriptions() {
  const response = await fetchBackendJson<{ items: PulseAlertSubscription[] }>(
    '/alerts/subscriptions',
  )

  return response.data.items
}

export async function updateAlertSubscription(
  subscriptionId: string,
  input: PulseAlertSubscriptionUpdateInput,
) {
  const response = await fetchBackendJson<PulseAlertSubscription>(
    `/alerts/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      body: JSON.stringify(input),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    },
  )

  return response.data
}

export async function listRecentAlertDeliveries() {
  const response = await fetchBackendJson<{ items: PulseAlertRecentDelivery[] }>(
    '/alerts/deliveries/recent',
  )

  return response.data.items
}

export async function unsubscribeAlertByToken(token: string) {
  const response = await fetchBackendJson<{ unsubscribed: boolean }>(
    '/alerts/unsubscribe',
    {
      body: JSON.stringify({ token }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  )

  return response.data.unsubscribed
}
