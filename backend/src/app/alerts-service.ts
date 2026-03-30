import type {
  PulseAlertRecentDelivery,
  PulseAlertSubscription,
  PulseAlertSubscriptionCreateInput,
  PulseAlertSubscriptionUpdateInput,
} from '../contracts/pulse-alerts.js'
import type { PulseSmartMoneySignal } from '../contracts/pulse-smart-money.js'
import { getAlertDeliveryIntervalMs } from '../db/config.js'
import { withSmartMoneyJobLock } from '../db/job-locks.js'
import {
  createAlertSubscription,
  deleteAlertSubscription,
  getActiveAlertSubscriptionsForSignals,
  listAlertSubscriptionsByUser,
  listRecentAlertDeliveriesByUser,
  listPendingAlertDeliveryJobs,
  markAlertDeliveryFailed,
  markAlertDeliverySent,
  queueAlertDeliveriesForMatches,
  unsubscribeAlertByDeliveryToken,
  updateAlertSubscriptionStatus,
} from '../db/alerts-repository.js'
import {
  listStoredSmartMoneySignalsByIds,
  listStoredSmartMoneyWalletsByAddresses,
} from '../db/smart-money-repository.js'
import { sendWalletSignalAlertEmail } from './email-service.js'
import { sendWalletSignalAlertTelegram } from './telegram-service.js'

type PostgresError = Error & {
  code?: string
}

const MAX_ALERT_DELIVERY_BACKOFF_MS = 60 * 60 * 1000
const ALERT_DELIVERY_LOCK_KEY = 'alert-delivery-worker'
let alertDeliveryInterval: NodeJS.Timeout | null = null
let alertDeliveryPromise: Promise<{
  failed: number
  processed: number
  sent: number
}> | null = null

export class DuplicateAlertSubscriptionError extends Error {
  constructor() {
    super('You already have a matching wallet alert.')
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Alert delivery failed.'
}

function getDeliveryBackoffMs(attemptCount: number) {
  if (attemptCount <= 0) {
    return 5 * 60 * 1000
  }

  return Math.min(
    5 * 60 * 1000 * 2 ** Math.max(0, attemptCount - 1),
    MAX_ALERT_DELIVERY_BACKOFF_MS,
  )
}

function parseOptionalNumber(value: number | undefined, max?: number) {
  if (value === undefined) {
    return null
  }

  if (!Number.isFinite(value) || value < 0) {
    return Number.NaN
  }

  if (max !== undefined && value > max) {
    return Number.NaN
  }

  return value
}

export function validateAlertSubscriptionInput(
  input: PulseAlertSubscriptionCreateInput,
) {
  const walletAddress = input.walletAddress.trim().toLowerCase()
  const minScore = parseOptionalNumber(input.minScore, 100)
  const minSizeUsd = parseOptionalNumber(input.minSizeUsd)
  const triggerMode = input.triggerMode ?? 'any-new-position'

  if (input.type !== 'wallet') {
    throw new Error('Only wallet alerts are supported right now.')
  }

  if (!walletAddress) {
    throw new Error('Wallet address is required.')
  }

  if (Number.isNaN(minScore)) {
    throw new Error('Minimum score must be between 0 and 100.')
  }

  if (Number.isNaN(minSizeUsd)) {
    throw new Error('Minimum signal size must be zero or greater.')
  }

  if (
    triggerMode !== 'any-new-position' &&
    triggerMode !== 'winning-moves-only'
  ) {
    throw new Error('Trigger mode is invalid.')
  }

  return {
    minScore,
    minSizeUsd,
    triggerMode,
    type: 'wallet' as const,
    walletAddress,
  }
}

export async function createWalletAlertSubscription(
  userId: string,
  input: PulseAlertSubscriptionCreateInput,
): Promise<PulseAlertSubscription> {
  const validatedInput = validateAlertSubscriptionInput(input)

  try {
    return await createAlertSubscription({
      minScore: validatedInput.minScore,
      minSizeUsd: validatedInput.minSizeUsd,
      triggerMode: validatedInput.triggerMode,
      type: validatedInput.type,
      userId,
      walletAddress: validatedInput.walletAddress,
    })
  } catch (error) {
    if ((error as PostgresError).code === '23505') {
      throw new DuplicateAlertSubscriptionError()
    }

    throw error
  }
}

export async function deleteUserAlertSubscription(userId: string, id: string) {
  return deleteAlertSubscription({
    id,
    userId,
  })
}

export async function updateUserAlertSubscription(
  userId: string,
  id: string,
  input: PulseAlertSubscriptionUpdateInput,
) {
  const minScore = parseOptionalNumber(input.minScore, 100)
  const minSizeUsd = parseOptionalNumber(input.minSizeUsd)

  if (
    input.status !== undefined &&
    input.status !== 'active' &&
    input.status !== 'paused'
  ) {
    throw new Error('Alert status is invalid.')
  }

  if (Number.isNaN(minScore)) {
    throw new Error('Minimum score must be between 0 and 100.')
  }

  if (Number.isNaN(minSizeUsd)) {
    throw new Error('Minimum signal size must be zero or greater.')
  }

  if (
    input.triggerMode !== undefined &&
    input.triggerMode !== 'any-new-position' &&
    input.triggerMode !== 'winning-moves-only'
  ) {
    throw new Error('Trigger mode is invalid.')
  }

  return updateAlertSubscriptionStatus({
    id,
    minScore,
    minSizeUsd,
    status: input.status,
    triggerMode: input.triggerMode,
    userId,
  })
}

export async function listUserAlertSubscriptions(userId: string) {
  return listAlertSubscriptionsByUser(userId)
}

export async function listUserRecentAlertDeliveries(
  userId: string,
  limit = 5,
): Promise<PulseAlertRecentDelivery[]> {
  return listRecentAlertDeliveriesByUser(userId, limit)
}

export async function unsubscribeAlert(token: string) {
  const normalizedToken = token.trim()

  if (!normalizedToken) {
    throw new Error('Unsubscribe token is required.')
  }

  return unsubscribeAlertByDeliveryToken(normalizedToken)
}

export async function queueAlertDeliveriesForSignals(
  signals: PulseSmartMoneySignal[],
) {
  const matches = await getActiveAlertSubscriptionsForSignals(signals)

  return queueAlertDeliveriesForMatches(matches)
}

export async function processPendingAlertDeliveries(limit = 25) {
  const jobs = await listPendingAlertDeliveryJobs(limit)

  if (!jobs.length) {
    return {
      failed: 0,
      processed: 0,
      sent: 0,
    }
  }

  const signals = await listStoredSmartMoneySignalsByIds(
    jobs.map((job) => job.delivery.signalId),
  )
  const signalById = new Map(signals.map((signal) => [signal.id, signal]))
  const wallets = await listStoredSmartMoneyWalletsByAddresses(
    signals.map((signal) => signal.walletAddress),
  )
  const walletByAddress = new Map(
    wallets.map((wallet) => [wallet.address.toLowerCase(), wallet]),
  )
  let failed = 0
  let sent = 0

  for (const job of jobs) {
    const signal = signalById.get(job.delivery.signalId)
    const wallet = walletByAddress.get(signal?.walletAddress.toLowerCase() ?? '') ?? null

    if (!signal) {
      failed += 1
      await markAlertDeliveryFailed({
        backoffUntil: new Date(
          Date.now() + getDeliveryBackoffMs(job.delivery.attemptCount),
        ).toISOString(),
        deliveryId: job.delivery.id,
        error: 'Missing alert signal context.',
      })
      continue
    }

    try {
      const result = job.delivery.channel === 'telegram'
        ? await (() => {
            if (!job.subscription.userTelegramChatId) {
              throw new Error('Missing Telegram chat connection.')
            }

            return sendWalletSignalAlertTelegram({
              chatId: job.subscription.userTelegramChatId,
              signal,
              wallet,
            })
          })()
        : await (() => {
            if (!job.subscription.userEmail) {
              throw new Error('Missing user email for alert delivery.')
            }

            return sendWalletSignalAlertEmail({
              email: job.subscription.userEmail,
              signal,
              subscription: job.subscription,
              unsubscribeToken: job.delivery.id,
              wallet,
            })
          })()

      await markAlertDeliverySent({
        deliveryId: job.delivery.id,
        providerMessageId: result.providerMessageId,
      })
      sent += 1
    } catch (error) {
      failed += 1
      await markAlertDeliveryFailed({
        backoffUntil: new Date(
          Date.now() + getDeliveryBackoffMs(job.delivery.attemptCount + 1),
        ).toISOString(),
        deliveryId: job.delivery.id,
        error: getErrorMessage(error),
      })
    }
  }

  return {
    failed,
    processed: jobs.length,
    sent,
  }
}

export async function runAlertDeliveryWorkerCycle(force = false) {
  if (alertDeliveryPromise) {
    return alertDeliveryPromise
  }

  if (!force && alertDeliveryInterval === null) {
    return {
      failed: 0,
      processed: 0,
      sent: 0,
    }
  }

  alertDeliveryPromise = withSmartMoneyJobLock(
    ALERT_DELIVERY_LOCK_KEY,
    () => processPendingAlertDeliveries(),
  )
    .then((result) => result ?? { failed: 0, processed: 0, sent: 0 })
    .finally(() => {
      alertDeliveryPromise = null
    })

  return alertDeliveryPromise
}

export function startAlertDeliveryWorker() {
  if (alertDeliveryInterval) {
    return
  }

  void runAlertDeliveryWorkerCycle(true)
  alertDeliveryInterval = setInterval(() => {
    void runAlertDeliveryWorkerCycle(true)
  }, getAlertDeliveryIntervalMs())
}

export function stopAlertDeliveryWorker() {
  if (!alertDeliveryInterval) {
    return
  }

  clearInterval(alertDeliveryInterval)
  alertDeliveryInterval = null
}
