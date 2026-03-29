import { randomUUID } from 'node:crypto'
import type {
  PulseAlertDelivery,
  PulseAlertDeliveryStatus,
  PulseAlertSubscription,
} from '../contracts/pulse-alerts.js'
import type { PulseSmartMoneySignal } from '../contracts/pulse-smart-money.js'
import { getDbPool } from './pool.js'

type AlertSubscriptionRow = {
  channel: 'email'
  created_at: Date | string
  id: string
  min_score: number | null
  min_size_usd: number | null
  status: 'active' | 'paused'
  type: 'wallet'
  updated_at: Date | string
  wallet_address: string
}

type AlertDeliveryRow = {
  attempt_count: number
  channel: 'email'
  created_at: Date | string
  id: string
  last_attempt_at: Date | string | null
  last_error: string | null
  next_attempt_at: Date | string | null
  provider_message_id: string | null
  sent_at: Date | string | null
  signal_id: string
  status: PulseAlertDeliveryStatus
  subscription_id: string
  updated_at: Date | string
}

type AlertSubscriptionMatchRow = AlertSubscriptionRow & {
  user_email: string
}

type PendingAlertDeliveryJobRow = AlertDeliveryRow & {
  min_score: number | null
  min_size_usd: number | null
  subscription_channel: 'email'
  subscription_created_at: Date | string
  subscription_status: 'active' | 'paused'
  subscription_updated_at: Date | string
  type: 'wallet'
  user_email: string
  wallet_address: string
}

export type StoredAlertSubscription = PulseAlertSubscription & {
  userEmail?: string
}

export type PendingAlertDeliveryJob = {
  delivery: PulseAlertDelivery
  subscription: StoredAlertSubscription
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function mapSubscription(row: AlertSubscriptionRow): PulseAlertSubscription {
  return {
    channel: row.channel,
    createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(),
    id: row.id,
    minScore: row.min_score,
    minSizeUsd: row.min_size_usd,
    status: row.status,
    type: row.type,
    updatedAt: toIsoString(row.updated_at) ?? new Date(0).toISOString(),
    walletAddress: row.wallet_address,
  }
}

function mapDelivery(row: AlertDeliveryRow): PulseAlertDelivery {
  return {
    attemptCount: row.attempt_count,
    channel: row.channel,
    createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(),
    id: row.id,
    lastAttemptAt: toIsoString(row.last_attempt_at),
    lastError: row.last_error,
    nextAttemptAt: toIsoString(row.next_attempt_at),
    providerMessageId: row.provider_message_id,
    sentAt: toIsoString(row.sent_at),
    signalId: row.signal_id,
    status: row.status,
    subscriptionId: row.subscription_id,
    updatedAt: toIsoString(row.updated_at) ?? new Date(0).toISOString(),
  }
}

export async function createAlertSubscription(input: {
  minScore?: number | null
  minSizeUsd?: number | null
  type: 'wallet'
  userId: string
  walletAddress: string
}) {
  const result = await getDbPool().query<AlertSubscriptionRow>(
    `
      INSERT INTO pulse_alert_subscriptions (
        id,
        user_id,
        type,
        wallet_address,
        min_score,
        min_size_usd
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        type,
        channel,
        status,
        wallet_address,
        min_score,
        min_size_usd,
        created_at,
        updated_at
    `,
    [
      randomUUID(),
      input.userId,
      input.type,
      input.walletAddress,
      input.minScore ?? null,
      input.minSizeUsd ?? null,
    ],
  )

  return mapSubscription(result.rows[0])
}

export async function deleteAlertSubscription(input: {
  id: string
  userId: string
}) {
  const result = await getDbPool().query(
    `
      DELETE FROM pulse_alert_subscriptions
      WHERE id = $1
        AND user_id = $2
      RETURNING id
    `,
    [input.id, input.userId],
  )

  return (result.rowCount ?? 0) > 0
}

export async function getActiveAlertSubscriptionsForSignals(
  signals: PulseSmartMoneySignal[],
) {
  if (!signals.length) {
    return [] as Array<{
      signal: PulseSmartMoneySignal
      subscription: StoredAlertSubscription
    }>
  }

  const walletAddresses = [...new Set(signals.map((signal) => signal.walletAddress))]
  const result = await getDbPool().query<AlertSubscriptionMatchRow>(
    `
      SELECT
        subscriptions.id,
        subscriptions.type,
        subscriptions.channel,
        subscriptions.status,
        subscriptions.wallet_address,
        subscriptions.min_score,
        subscriptions.min_size_usd,
        subscriptions.created_at,
        subscriptions.updated_at,
        users.email AS user_email
      FROM pulse_alert_subscriptions subscriptions
      JOIN pulse_users users ON users.id = subscriptions.user_id
      WHERE subscriptions.status = 'active'
        AND subscriptions.type = 'wallet'
        AND subscriptions.wallet_address = ANY($1::TEXT[])
    `,
    [walletAddresses],
  )

  const subscriptionsByWallet = new Map<string, StoredAlertSubscription[]>()

  for (const row of result.rows) {
    const subscription = {
      ...mapSubscription(row),
      userEmail: row.user_email,
    } satisfies StoredAlertSubscription
    const currentSubscriptions =
      subscriptionsByWallet.get(subscription.walletAddress) ?? []

    currentSubscriptions.push(subscription)
    subscriptionsByWallet.set(subscription.walletAddress, currentSubscriptions)
  }

  return signals.flatMap((signal) => {
    const matches = subscriptionsByWallet.get(signal.walletAddress) ?? []

    return matches
      .filter((subscription) => {
        if (
          subscription.minScore !== null &&
          signal.walletScore < subscription.minScore
        ) {
          return false
        }

        if (
          subscription.minSizeUsd !== null &&
          signal.size < subscription.minSizeUsd
        ) {
          return false
        }

        return true
      })
      .map((subscription) => ({
        signal,
        subscription,
      }))
  })
}

export async function listAlertSubscriptionsByUser(userId: string) {
  const result = await getDbPool().query<AlertSubscriptionRow>(
    `
      SELECT
        id,
        type,
        channel,
        status,
        wallet_address,
        min_score,
        min_size_usd,
        created_at,
        updated_at
      FROM pulse_alert_subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId],
  )

  return result.rows.map((row) => mapSubscription(row))
}

export async function listPendingAlertDeliveries(limit = 25) {
  const result = await getDbPool().query<AlertDeliveryRow>(
    `
      SELECT
        id,
        subscription_id,
        signal_id,
        channel,
        status,
        attempt_count,
        last_attempt_at,
        next_attempt_at,
        sent_at,
        last_error,
        provider_message_id,
        created_at,
        updated_at
      FROM pulse_alert_deliveries
      WHERE status = 'pending'
        AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
      ORDER BY created_at ASC
      LIMIT $1
    `,
    [limit],
  )

  return result.rows.map((row) => mapDelivery(row))
}

export async function listPendingAlertDeliveryJobs(limit = 25) {
  const result = await getDbPool().query<PendingAlertDeliveryJobRow>(
    `
      SELECT
        deliveries.id,
        deliveries.subscription_id,
        deliveries.signal_id,
        deliveries.channel,
        deliveries.status,
        deliveries.attempt_count,
        deliveries.last_attempt_at,
        deliveries.next_attempt_at,
        deliveries.sent_at,
        deliveries.last_error,
        deliveries.provider_message_id,
        deliveries.created_at,
        deliveries.updated_at,
        subscriptions.type,
        subscriptions.wallet_address,
        subscriptions.min_score,
        subscriptions.min_size_usd,
        subscriptions.status AS subscription_status,
        subscriptions.channel AS subscription_channel,
        subscriptions.created_at AS subscription_created_at,
        subscriptions.updated_at AS subscription_updated_at,
        users.email AS user_email
      FROM pulse_alert_deliveries deliveries
      JOIN pulse_alert_subscriptions subscriptions
        ON subscriptions.id = deliveries.subscription_id
      JOIN pulse_users users ON users.id = subscriptions.user_id
      WHERE deliveries.status = 'pending'
        AND (deliveries.next_attempt_at IS NULL OR deliveries.next_attempt_at <= NOW())
        AND subscriptions.status = 'active'
      ORDER BY deliveries.created_at ASC
      LIMIT $1
    `,
    [limit],
  )

  return result.rows.map((row) => ({
    delivery: mapDelivery(row),
    subscription: {
      channel: row.subscription_channel,
      createdAt:
        toIsoString(row.subscription_created_at) ?? new Date(0).toISOString(),
      id: row.subscription_id,
      minScore: row.min_score,
      minSizeUsd: row.min_size_usd,
      status: row.subscription_status,
      type: row.type,
      updatedAt:
        toIsoString(row.subscription_updated_at) ?? new Date(0).toISOString(),
      userEmail: row.user_email,
      walletAddress: row.wallet_address,
    } satisfies StoredAlertSubscription,
  }))
}

export async function markAlertDeliveryFailed(input: {
  backoffUntil?: string | null
  deliveryId: string
  error: string
}) {
  const result = await getDbPool().query<AlertDeliveryRow>(
    `
      UPDATE pulse_alert_deliveries
      SET
        attempt_count = attempt_count + 1,
        last_attempt_at = NOW(),
        last_error = $2,
        next_attempt_at = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        subscription_id,
        signal_id,
        channel,
        status,
        attempt_count,
        last_attempt_at,
        next_attempt_at,
        sent_at,
        last_error,
        provider_message_id,
        created_at,
        updated_at
    `,
    [input.deliveryId, input.error, input.backoffUntil ?? null],
  )

  return result.rows[0] ? mapDelivery(result.rows[0]) : null
}

export async function markAlertDeliverySent(input: {
  deliveryId: string
  providerMessageId?: string | null
}) {
  const result = await getDbPool().query<AlertDeliveryRow>(
    `
      UPDATE pulse_alert_deliveries
      SET
        status = 'sent',
        attempt_count = attempt_count + 1,
        last_attempt_at = NOW(),
        sent_at = NOW(),
        next_attempt_at = NULL,
        last_error = NULL,
        provider_message_id = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        subscription_id,
        signal_id,
        channel,
        status,
        attempt_count,
        last_attempt_at,
        next_attempt_at,
        sent_at,
        last_error,
        provider_message_id,
        created_at,
        updated_at
    `,
    [input.deliveryId, input.providerMessageId ?? null],
  )

  return result.rows[0] ? mapDelivery(result.rows[0]) : null
}

export async function queueAlertDeliveriesForMatches(
  matches: Array<{
    signal: PulseSmartMoneySignal
    subscription: StoredAlertSubscription
  }>,
) {
  if (!matches.length) {
    return [] as PulseAlertDelivery[]
  }

  const result = await getDbPool().query<AlertDeliveryRow>(
    `
      INSERT INTO pulse_alert_deliveries (
        id,
        subscription_id,
        signal_id,
        channel
      )
      SELECT * FROM UNNEST(
        $1::TEXT[],
        $2::TEXT[],
        $3::TEXT[],
        $4::TEXT[]
      )
      AS queued(id, subscription_id, signal_id, channel)
      ON CONFLICT (subscription_id, signal_id, channel)
      DO NOTHING
      RETURNING
        id,
        subscription_id,
        signal_id,
        channel,
        status,
        attempt_count,
        last_attempt_at,
        next_attempt_at,
        sent_at,
        last_error,
        provider_message_id,
        created_at,
        updated_at
    `,
    [
      matches.map(() => randomUUID()),
      matches.map((match) => match.subscription.id),
      matches.map((match) => match.signal.id),
      matches.map((match) => match.subscription.channel),
    ],
  )

  return result.rows.map((row) => mapDelivery(row))
}
