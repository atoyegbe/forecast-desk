import { fetchBackendJson } from '../../lib/api-client'
import type {
  PulseAlertSubscription,
  PulseAlertSubscriptionCreateInput,
} from './types'

function buildAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export async function createAlertSubscription(
  token: string,
  input: PulseAlertSubscriptionCreateInput,
) {
  const response = await fetchBackendJson<PulseAlertSubscription>(
    '/alerts/subscriptions',
    {
      body: JSON.stringify(input),
      headers: buildAuthHeaders(token),
      method: 'POST',
    },
  )

  return response.data
}

export async function deleteAlertSubscription(token: string, subscriptionId: string) {
  await fetchBackendJson<null>(`/alerts/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: 'DELETE',
  })
}

export async function listAlertSubscriptions(token: string) {
  const response = await fetchBackendJson<{ items: PulseAlertSubscription[] }>(
    '/alerts/subscriptions',
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  return response.data.items
}
