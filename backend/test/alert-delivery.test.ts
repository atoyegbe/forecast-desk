import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import { Client } from 'pg'
import {
  processPendingAlertDeliveries,
  queueAlertDeliveriesForSignals,
} from '../src/app/alerts-service.js'
import { setTestEmailSender } from '../src/app/email-service.js'
import type { PulseSmartMoneySignal } from '../src/contracts/pulse-smart-money.js'
import {
  replaceStoredSmartMoneySnapshot,
  type StoredSmartMoneySignalInput,
  type StoredSmartMoneyWalletInput,
} from '../src/db/smart-money-repository.js'
import { registerAppTestLifecycle } from './helpers/test-app.js'

const testApp = registerAppTestLifecycle()
const AUTH_MAGIC_TOKEN = 'test-magic-token'

afterEach(() => {
  setTestEmailSender(null)
})

async function queryRow<T>(query: string, values: unknown[] = []) {
  const client = new Client({
    connectionString: testApp.getConnectionString(),
  })

  await client.connect()

  try {
    const result = await client.query<T>(query, values)

    return result.rows[0] ?? null
  } finally {
    await client.end()
  }
}

async function requestAndVerify(email = 'reader@example.com') {
  await testApp.getApp().inject({
    method: 'POST',
    payload: {
      email,
      returnToPath: '/alerts',
    },
    url: '/api/v1/auth/request-link',
  })

  return testApp.getApp().inject({
    method: 'POST',
    payload: {
      email,
      token: AUTH_MAGIC_TOKEN,
    },
    url: '/api/v1/auth/verify-link',
  })
}

async function createWalletAlert(
  walletAddress: string,
  thresholds: {
    minScore?: number
    minSizeUsd?: number
    triggerMode?: 'any-new-position' | 'winning-moves-only'
  } = {},
) {
  const verifyResponse = await requestAndVerify()
  const token = verifyResponse.json().data.session.token as string

  const response = await testApp.getApp().inject({
    headers: {
      authorization: `Bearer ${token}`,
    },
    method: 'POST',
    payload: {
      minScore: thresholds.minScore,
      minSizeUsd: thresholds.minSizeUsd,
      triggerMode: thresholds.triggerMode,
      type: 'wallet',
      walletAddress,
    },
    url: '/api/v1/alerts/subscriptions',
  })

  assert.equal(response.statusCode, 201)

  return response.json().data.id as string
}

async function updateWalletAlertStatus(input: {
  email?: string
  status: 'active' | 'paused'
  subscriptionId: string
}) {
  const verifyResponse = await requestAndVerify(input.email)
  const token = verifyResponse.json().data.session.token as string

  const response = await testApp.getApp().inject({
    headers: {
      authorization: `Bearer ${token}`,
    },
    method: 'PATCH',
    payload: {
      status: input.status,
    },
    url: `/api/v1/alerts/subscriptions/${input.subscriptionId}`,
  })

  assert.equal(response.statusCode, 200)
}

async function seedSmartMoneySignals() {
  const wallet: StoredSmartMoneyWalletInput = {
    address: '0xabc123',
    categoryStats: [],
    closedPositionCount: 12,
    displayName: 'Signal Whale',
    lastActiveAt: '2026-03-29T10:00:00.000Z',
    marketCount: 6,
    openPositionCount: 2,
    profileImageUrl: null,
    rank: 3,
    recencyScore: 0.9,
    roi: 0.32,
    score: 82,
    sourcePnl: 12000,
    sourceRank: 3,
    sourceVolume: 52000,
    totalVolume: 70000,
    verifiedBadge: true,
    winRate: 0.68,
    xUsername: 'signalwhale',
  }
  const signals: StoredSmartMoneySignalInput[] = [
    {
      category: 'Politics',
      conditionId: 'condition-1',
      currentPrice: 0.61,
      entryPrice: 0.56,
      eventId: null,
      eventSlug: 'nigeria-election',
      iconUrl: null,
      id: 'signal-1',
      marketTitle: 'Will Nigeria election result be contested?',
      outcome: 'YES',
      priceDelta: 0.05,
      providerEventId: null,
      signalAt: '2026-03-29T10:15:00.000Z',
      size: 2500,
      transactionHash: '0xsignal1',
      walletAddress: wallet.address,
    },
    {
      category: 'Politics',
      conditionId: 'condition-2',
      currentPrice: 0.43,
      entryPrice: 0.41,
      eventId: null,
      eventSlug: 'lagos-governor',
      iconUrl: null,
      id: 'signal-2',
      marketTitle: 'Will Lagos governor face a runoff?',
      outcome: 'YES',
      priceDelta: 0.02,
      providerEventId: null,
      signalAt: '2026-03-29T10:20:00.000Z',
      size: 400,
      transactionHash: '0xsignal2',
      walletAddress: wallet.address,
    },
  ]

    await replaceStoredSmartMoneySnapshot(
      {
        positions: [],
        signals,
        wallets: [wallet],
      },
      new Date('2026-03-29T10:30:00.000Z'),
      'alert-delivery-tests',
    )

  return signals.map(
    (signal): PulseSmartMoneySignal => ({
      category: signal.category,
      closingDate: null,
      currentPrice: signal.currentPrice,
      entryPrice: signal.entryPrice,
      eventId: signal.eventId ?? null,
      eventSlug: signal.eventSlug,
      iconUrl: signal.iconUrl ?? null,
      id: signal.id,
      isNew: true,
      marketTitle: signal.marketTitle,
      outcome: signal.outcome,
      priceDelta: signal.priceDelta,
      provider: 'polymarket',
      providerEventId: signal.providerEventId ?? null,
      signalAt: signal.signalAt,
      size: signal.size,
      walletAddress: signal.walletAddress,
      walletDisplayName: wallet.displayName,
      walletProfileImageUrl: wallet.profileImageUrl,
      walletRank: wallet.rank,
      walletScore: wallet.score,
      walletShortAddress: '0xabc1...c123',
      walletVerified: wallet.verifiedBadge,
    }),
  )
}

describe('Alert delivery pipeline', () => {
  test('queues only matching wallet alert deliveries and dedupes repeats', async () => {
    await createWalletAlert('0xAbC123', {
      minScore: 70,
      minSizeUsd: 1000,
    })
    const [matchingSignal, belowThresholdSignal] = await seedSmartMoneySignals()

    await queueAlertDeliveriesForSignals([matchingSignal, belowThresholdSignal])
    await queueAlertDeliveriesForSignals([matchingSignal])

    const row = await queryRow<{ count: string }>(
      'SELECT COUNT(*)::TEXT AS count FROM pulse_alert_deliveries',
    )

    assert.equal(row?.count, '1')
  })

  test('queues winning-only alerts only when the position is already up five points', async () => {
    await createWalletAlert('0xAbC123', {
      triggerMode: 'winning-moves-only',
    })
    const [winningSignal, notYetWinningSignal] = await seedSmartMoneySignals()

    await queueAlertDeliveriesForSignals([winningSignal, notYetWinningSignal])

    const row = await queryRow<{ count: string }>(
      'SELECT COUNT(*)::TEXT AS count FROM pulse_alert_deliveries',
    )

    assert.equal(row?.count, '1')
  })

  test('does not queue deliveries for paused wallet alerts', async () => {
    const subscriptionId = await createWalletAlert('0xAbC123', {
      minScore: 70,
      minSizeUsd: 1000,
    })
    const [matchingSignal] = await seedSmartMoneySignals()

    await updateWalletAlertStatus({
      status: 'paused',
      subscriptionId,
    })
    await queueAlertDeliveriesForSignals([matchingSignal])

    const row = await queryRow<{ count: string }>(
      'SELECT COUNT(*)::TEXT AS count FROM pulse_alert_deliveries',
    )

    assert.equal(row?.count, '0')
  })

  test('processes pending alert deliveries and marks them sent', async () => {
    await createWalletAlert('0xabc123', {
      minScore: 70,
      minSizeUsd: 1000,
    })
    const [matchingSignal] = await seedSmartMoneySignals()
    const sentEmails: Array<{
      html?: string
      subject: string
      text: string
    }> = []

    setTestEmailSender(async (input) => {
      sentEmails.push({
        html: input.html,
        subject: input.subject,
        text: input.text,
      })

      return {
        providerMessageId: 'email_123',
      }
    })

    await queueAlertDeliveriesForSignals([matchingSignal])

    const result = await processPendingAlertDeliveries()
    const delivery = await queryRow<{
      attempt_count: number
      provider_message_id: string | null
      status: string
    }>(
      `
        SELECT attempt_count, provider_message_id, status
        FROM pulse_alert_deliveries
      `,
    )

    assert.deepEqual(result, {
      failed: 0,
      processed: 1,
      sent: 1,
    })
    assert.equal(sentEmails.length, 1)
    assert.match(sentEmails[0]?.subject ?? '', /Signal Whale/)
    assert.match(sentEmails[0]?.text ?? '', /View market:/)
    assert.match(sentEmails[0]?.html ?? '', /<table/i)
    assert.match(
      sentEmails[0]?.html ?? '',
      /Signal Whale opened a new position\./,
    )
    assert.match(sentEmails[0]?.html ?? '', /View market on Quorum/)
    assert.match(sentEmails[0]?.html ?? '', /Manage alerts/)
    assert.match(sentEmails[0]?.html ?? '', /unsubscribe\?token=/i)
    assert.doesNotMatch(sentEmails[0]?.html ?? '', /display:\s*flex/i)
    assert.doesNotMatch(sentEmails[0]?.html ?? '', /var\(/i)
    assert.equal(delivery?.status, 'sent')
    assert.equal(delivery?.attempt_count, 1)
    assert.equal(delivery?.provider_message_id, 'email_123')
  })

  test('surfaces the last delivered time on the wallet subscription', async () => {
    await createWalletAlert('0xabc123', {
      minScore: 70,
      minSizeUsd: 1000,
    })
    const [matchingSignal] = await seedSmartMoneySignals()

    setTestEmailSender(async () => ({
      providerMessageId: 'email_456',
    }))

    await queueAlertDeliveriesForSignals([matchingSignal])
    await processPendingAlertDeliveries()

    const verifyResponse = await requestAndVerify()
    const token = verifyResponse.json().data.session.token as string
    const listResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'GET',
      url: '/api/v1/alerts/subscriptions',
    })

    assert.equal(listResponse.statusCode, 200)
    assert.equal(
      typeof listResponse.json().data.items[0].lastDeliveredAt,
      'string',
    )
  })

  test('backs off failed alert deliveries without dropping the job', async () => {
    await createWalletAlert('0xabc123', {
      minScore: 70,
      minSizeUsd: 1000,
    })
    const [matchingSignal] = await seedSmartMoneySignals()

    setTestEmailSender(async () => {
      throw new Error('Resend is down')
    })

    await queueAlertDeliveriesForSignals([matchingSignal])

    const result = await processPendingAlertDeliveries()
    const delivery = await queryRow<{
      attempt_count: number
      last_error: string | null
      next_attempt_at: Date | string | null
      status: string
    }>(
      `
        SELECT attempt_count, last_error, next_attempt_at, status
        FROM pulse_alert_deliveries
      `,
    )

    assert.deepEqual(result, {
      failed: 1,
      processed: 1,
      sent: 0,
    })
    assert.equal(delivery?.status, 'pending')
    assert.equal(delivery?.attempt_count, 1)
    assert.match(delivery?.last_error ?? '', /Resend is down/)
    assert.ok(delivery?.next_attempt_at)
  })
})
