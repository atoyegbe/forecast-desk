import { randomUUID } from 'node:crypto'
import type {
  PulseAlertDelivery,
  PulseAlertDeliveryChannel,
  PulseAlertDeliveryStatus,
  PulseAlertRecentDelivery,
  PulseAlertRecentDeliveryStatus,
  PulseAlertSubscription,
  PulseAlertTriggerMode,
} from '../contracts/pulse-alerts.js'
import type { PulseSmartMoneySignal } from '../contracts/pulse-smart-money.js'
import { getDbPool } from './pool.js'

type AlertSubscriptionRow = {
  channel: 'email'
  created_at: Date | string
  id: string
  last_delivery_attempt_at: Date | string | null
  last_delivered_at: Date | string | null
  last_delivery_status: PulseAlertRecentDeliveryStatus | null
  min_score: number | null
  min_size_usd: number | null
  status: 'active' | 'paused'
  trigger_mode: PulseAlertTriggerMode
  type: 'wallet'
  updated_at: Date | string
  wallet_address: string
  wallet_label: string | null
}

type AlertDeliveryRow = {
  attempt_count: number
  channel: PulseAlertDeliveryChannel
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

type RecentAlertDeliveryRow = {
  channel: 'email' | 'telegram'
  created_at: Date | string
  id: string
  last_attempt_at: Date | string | null
  market_title: string
  sent_at: Date | string | null
  status: PulseAlertDeliveryStatus
  wallet_address: string
  wallet_label: string | null
}

type AlertSubscriptionMatchRow = AlertSubscriptionRow & {
  default_channel: 'both' | 'email' | 'telegram'
  user_email: string
  user_telegram_chat_id: string | null
  user_telegram_handle: string | null
}

type PendingAlertDeliveryJobRow = AlertDeliveryRow & {
  last_delivered_at: Date | string | null
  min_score: number | null
  min_size_usd: number | null
  subscription_channel: 'email'
  subscription_created_at: Date | string
  subscription_status: 'active' | 'paused'
  trigger_mode: PulseAlertTriggerMode
  subscription_updated_at: Date | string
  type: 'wallet'
  user_default_channel: 'both' | 'email' | 'telegram'
  user_email: string
  user_telegram_chat_id: string | null
  user_telegram_handle: string | null
  wallet_address: string
}

export type StoredAlertSubscription = PulseAlertSubscription & {
  userDefaultChannel?: 'both' | 'email' | 'telegram'
  userEmail?: string
  userTelegramChatId?: string | null
  userTelegramHandle?: string | null
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
    lastDeliveryAttemptAt: toIsoString(row.last_delivery_attempt_at),
    lastDeliveredAt: toIsoString(row.last_delivered_at),
    lastDeliveryStatus: row.last_delivery_status,
    minScore: row.min_score,
    minSizeUsd: row.min_size_usd,
    status: row.status,
    triggerMode: row.trigger_mode,
    type: row.type,
    updatedAt: toIsoString(row.updated_at) ?? new Date(0).toISOString(),
    walletAddress: row.wallet_address,
    walletLabel: row.wallet_label,
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

function mapRecentDelivery(row: RecentAlertDeliveryRow): PulseAlertRecentDelivery {
  return {
    channel: row.channel,
    id: row.id,
    marketTitle: row.market_title,
    occurredAt:
      toIsoString(row.sent_at) ??
      toIsoString(row.last_attempt_at) ??
      toIsoString(row.created_at) ??
      new Date(0).toISOString(),
    status: row.status === 'sent' ? 'delivered' : row.status,
    walletAddress: row.wallet_address,
    walletLabel: row.wallet_label,
  }
}

export async function createAlertSubscription(input: {
  minScore?: number | null
  minSizeUsd?: number | null
  triggerMode: PulseAlertTriggerMode
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
        min_size_usd,
        trigger_mode
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        type,
        channel,
        status,
        wallet_address,
        NULL::TEXT AS wallet_label,
        min_score,
        min_size_usd,
        trigger_mode,
        NULL::TIMESTAMPTZ AS last_delivery_attempt_at,
        NULL::TEXT AS last_delivery_status,
        NULL::TIMESTAMPTZ AS last_delivered_at,
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
      input.triggerMode,
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
        wallets.display_name AS wallet_label,
        subscriptions.min_score,
        subscriptions.min_size_usd,
        subscriptions.trigger_mode,
        NULL::TIMESTAMPTZ AS last_delivery_attempt_at,
        NULL::TEXT AS last_delivery_status,
        NULL::TIMESTAMPTZ AS last_delivered_at,
        subscriptions.created_at,
        subscriptions.updated_at,
        users.email AS user_email,
        users.default_channel,
        users.telegram_chat_id AS user_telegram_chat_id,
        users.telegram_handle AS user_telegram_handle
      FROM pulse_alert_subscriptions subscriptions
      JOIN pulse_users users ON users.id = subscriptions.user_id
      LEFT JOIN pulse_smart_money_wallets wallets
        ON wallets.address = subscriptions.wallet_address
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
      userDefaultChannel: row.default_channel,
      userEmail: row.user_email,
      userTelegramChatId: row.user_telegram_chat_id,
      userTelegramHandle: row.user_telegram_handle,
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

        if (
          subscription.triggerMode === 'winning-moves-only' &&
          signal.priceDelta < 0.05
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
        subscriptions.id,
        subscriptions.type,
        subscriptions.channel,
        subscriptions.status,
        subscriptions.wallet_address,
        wallets.display_name AS wallet_label,
        subscriptions.min_score,
        subscriptions.min_size_usd,
        subscriptions.trigger_mode,
        latest_delivery.delivery_activity_at AS last_delivery_attempt_at,
        latest_delivery.delivery_status AS last_delivery_status,
        last_sent_delivery.last_delivered_at,
        subscriptions.created_at,
        subscriptions.updated_at
      FROM pulse_alert_subscriptions subscriptions
      LEFT JOIN pulse_smart_money_wallets wallets
        ON wallets.address = subscriptions.wallet_address
      LEFT JOIN LATERAL (
        SELECT
          CASE
            WHEN deliveries.status = 'sent' THEN 'delivered'
            ELSE deliveries.status
          END AS delivery_status,
          COALESCE(
            deliveries.sent_at,
            deliveries.last_attempt_at,
            deliveries.created_at
          ) AS delivery_activity_at
        FROM pulse_alert_deliveries deliveries
        WHERE deliveries.subscription_id = subscriptions.id
        ORDER BY COALESCE(
          deliveries.sent_at,
          deliveries.last_attempt_at,
          deliveries.created_at
        ) DESC
        LIMIT 1
      ) latest_delivery ON TRUE
      LEFT JOIN LATERAL (
        SELECT MAX(deliveries.sent_at) AS last_delivered_at
        FROM pulse_alert_deliveries deliveries
        WHERE deliveries.subscription_id = subscriptions.id
          AND deliveries.status = 'sent'
      ) last_sent_delivery ON TRUE
      WHERE subscriptions.user_id = $1
      ORDER BY subscriptions.created_at DESC
    `,
    [userId],
  )

  return result.rows.map((row) => mapSubscription(row))
}

export async function updateAlertSubscriptionStatus(input: {
  id: string
  minScore?: number | null
  minSizeUsd?: number | null
  status?: 'active' | 'paused'
  triggerMode?: PulseAlertTriggerMode
  userId: string
}) {
  const result = await getDbPool().query<AlertSubscriptionRow>(
    `
      UPDATE pulse_alert_subscriptions
      SET
        status = COALESCE($3, status),
        min_score = COALESCE($4, min_score),
        min_size_usd = COALESCE($5, min_size_usd),
        trigger_mode = COALESCE($6, trigger_mode),
        updated_at = NOW()
      WHERE id = $1
        AND user_id = $2
      RETURNING
        id,
        type,
        channel,
        status,
        wallet_address,
        NULL::TEXT AS wallet_label,
        min_score,
        min_size_usd,
        trigger_mode,
        NULL::TIMESTAMPTZ AS last_delivery_attempt_at,
        NULL::TEXT AS last_delivery_status,
        NULL::TIMESTAMPTZ AS last_delivered_at,
        created_at,
        updated_at
    `,
    [
      input.id,
      input.userId,
      input.status ?? null,
      input.minScore ?? null,
      input.minSizeUsd ?? null,
      input.triggerMode ?? null,
    ],
  )

  return result.rows[0] ? mapSubscription(result.rows[0]) : null
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

export async function listRecentAlertDeliveriesByUser(userId: string, limit = 5) {
  const result = await getDbPool().query<RecentAlertDeliveryRow>(
    `
      SELECT
        deliveries.id,
        deliveries.channel,
        deliveries.status,
        deliveries.sent_at,
        deliveries.last_attempt_at,
        deliveries.created_at,
        signals.market_title,
        subscriptions.wallet_address,
        wallets.display_name AS wallet_label
      FROM pulse_alert_deliveries deliveries
      JOIN pulse_alert_subscriptions subscriptions
        ON subscriptions.id = deliveries.subscription_id
      JOIN pulse_smart_money_signals signals
        ON signals.id = deliveries.signal_id
      LEFT JOIN pulse_smart_money_wallets wallets
        ON wallets.address = subscriptions.wallet_address
      WHERE subscriptions.user_id = $1
      ORDER BY COALESCE(
        deliveries.sent_at,
        deliveries.last_attempt_at,
        deliveries.created_at
      ) DESC
      LIMIT $2
    `,
    [userId, limit],
  )

  return result.rows.map((row) => mapRecentDelivery(row))
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
        subscriptions.trigger_mode,
        subscriptions.status AS subscription_status,
        subscriptions.channel AS subscription_channel,
        subscriptions.created_at AS subscription_created_at,
        subscriptions.updated_at AS subscription_updated_at,
        (
          SELECT MAX(previous_deliveries.sent_at)
          FROM pulse_alert_deliveries previous_deliveries
          WHERE previous_deliveries.subscription_id = subscriptions.id
            AND previous_deliveries.status = 'sent'
        ) AS last_delivered_at,
        users.email AS user_email,
        users.default_channel AS user_default_channel,
        users.telegram_chat_id AS user_telegram_chat_id,
        users.telegram_handle AS user_telegram_handle
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
      lastDeliveredAt: toIsoString(row.last_delivered_at),
      minScore: row.min_score,
      minSizeUsd: row.min_size_usd,
      status: row.subscription_status,
      triggerMode: row.trigger_mode,
      type: row.type,
      updatedAt:
        toIsoString(row.subscription_updated_at) ?? new Date(0).toISOString(),
      userEmail: row.user_email,
      userDefaultChannel: row.user_default_channel,
      userTelegramChatId: row.user_telegram_chat_id,
      userTelegramHandle: row.user_telegram_handle,
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

  const queuedDeliveries = matches.flatMap((match) => {
    const preferredChannels: PulseAlertDeliveryChannel[] =
      match.subscription.userDefaultChannel === 'telegram'
        ? match.subscription.userTelegramChatId
          ? ['telegram']
          : ['email']
        : match.subscription.userDefaultChannel === 'both'
          ? match.subscription.userTelegramChatId
            ? ['email', 'telegram']
            : ['email']
          : ['email']

    return preferredChannels.map((channel) => ({
      channel,
      id: randomUUID(),
      signalId: match.signal.id,
      subscriptionId: match.subscription.id,
    }))
  })

  if (!queuedDeliveries.length) {
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
      queuedDeliveries.map((delivery) => delivery.id),
      queuedDeliveries.map((delivery) => delivery.subscriptionId),
      queuedDeliveries.map((delivery) => delivery.signalId),
      queuedDeliveries.map((delivery) => delivery.channel),
    ],
  )

  return result.rows.map((row) => mapDelivery(row))
}
