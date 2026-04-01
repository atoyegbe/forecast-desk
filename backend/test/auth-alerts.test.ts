import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import { setTestEmailSender } from '../src/app/email-service.js'
import {
  handleStartCommand,
  handleStatusCommand,
  handleStopCommand,
} from '../src/bot/handlers.js'
import { registerAppTestLifecycle } from './helpers/test-app.js'
import {
  createTestTelegramMessage,
  registerTestTelegramBot,
  resetTestTelegramBot,
} from './helpers/test-telegram-bot.js'

const testApp = registerAppTestLifecycle()
const AUTH_MAGIC_TOKEN = 'test-magic-token'

afterEach(() => {
  setTestEmailSender(null)
  resetTestTelegramBot()
})

async function requestMagicLink(email: string, returnToPath = '/smart-money') {
  return testApp.getApp().inject({
    method: 'POST',
    payload: {
      email,
      returnToPath,
    },
    url: '/api/v1/auth/request-link',
  })
}

async function verifyMagicLink(email: string, token = AUTH_MAGIC_TOKEN) {
  return testApp.getApp().inject({
    method: 'POST',
    payload: {
      email,
      token,
    },
    url: '/api/v1/auth/verify-link',
  })
}

async function beginTelegramAuth() {
  return testApp.getApp().inject({
    method: 'POST',
    url: '/api/v1/auth/telegram/init',
  })
}

async function getTelegramAuthStatus(token: string) {
  return testApp.getApp().inject({
    method: 'GET',
    url: `/api/v1/auth/telegram/status?token=${encodeURIComponent(token)}`,
  })
}

async function issueTelegramConnectCode(input?: {
  chatId?: number
  username?: string
}) {
  const bot = registerTestTelegramBot()

  await handleStartCommand(
    bot,
    createTestTelegramMessage({
      chatId: input?.chatId,
      text: '/start',
      username: input?.username,
    }),
  )

  const codeMatch = bot.sentMessages[0]?.text.match(/\b(\d{6})\b/)

  assert.ok(codeMatch)

  return codeMatch[1]
}

function getCookieHeader(response: {
  headers: Record<string, string | string[] | undefined>
}) {
  const setCookieHeader = response.headers['set-cookie']
  const rawValue = Array.isArray(setCookieHeader)
    ? setCookieHeader[0]
    : setCookieHeader

  assert.ok(rawValue)

  const cookieHeader = rawValue.split(';', 1)[0]

  assert.match(cookieHeader, /^quorum_session=/)

  return cookieHeader
}

describe('Auth and alerts', () => {
  test('requests a passwordless magic link for a valid email', async () => {
    const response = await requestMagicLink('reader@example.com')

    assert.equal(response.statusCode, 200)
  })

  test('sends a magic link back to the app and ignores unsafe return paths', async () => {
    const sentMessages: string[] = []

    setTestEmailSender(async (input) => {
      sentMessages.push(input.text)

      return {
        providerMessageId: 'email_auth_1',
      }
    })

    const response = await requestMagicLink(
      'reader@example.com',
      'https://malicious.example/steal-session',
    )

    assert.equal(response.statusCode, 200)
    assert.equal(sentMessages.length, 1)
    assert.match(sentMessages[0] ?? '', /http:\/\/localhost:5173\/\?auth_email=reader%40example\.com&auth_token=test-magic-token/)
    assert.doesNotMatch(sentMessages[0] ?? '', /malicious\.example/)
  })

  test('rejects malformed login email addresses', async () => {
    const response = await testApp.getApp().inject({
      method: 'POST',
      payload: {
        email: 'not-an-email',
      },
      url: '/api/v1/auth/request-link',
    })

    assert.equal(response.statusCode, 400)
  })

  test('verifies a passwordless magic link, returns a session, and sets a cookie', async () => {
    await requestMagicLink('reader@example.com')

    const response = await verifyMagicLink('reader@example.com')

    assert.equal(response.statusCode, 200)

    const payload = response.json()

    assert.equal(payload.data.user.email, 'reader@example.com')
    assert.equal(typeof payload.data.session.token, 'string')
    assert.equal(payload.data.session.token.length > 20, true)
    assert.match(String(response.headers['set-cookie'] ?? ''), /quorum_session=/)
  })

  test('rejects expired or invalid magic links', async () => {
    await requestMagicLink('reader@example.com')

    const invalidTokenResponse = await verifyMagicLink(
      'reader@example.com',
      'not-the-right-token',
    )

    assert.equal(invalidTokenResponse.statusCode, 401)

    const wrongEmailResponse = await verifyMagicLink('other@example.com')

    assert.equal(wrongEmailResponse.statusCode, 401)
  })

  test('rejects malformed verify-link payloads', async () => {
    const response = await testApp.getApp().inject({
      method: 'POST',
      payload: {
        email: 'reader@example.com',
        token: 'short',
      },
      url: '/api/v1/auth/verify-link',
    })

    assert.equal(response.statusCode, 400)
  })

  test('does not allow a passwordless magic link to be reused', async () => {
    await requestMagicLink('reader@example.com')

    const firstResponse = await verifyMagicLink('reader@example.com')
    const secondResponse = await verifyMagicLink('reader@example.com')

    assert.equal(firstResponse.statusCode, 200)
    assert.equal(secondResponse.statusCode, 401)
  })

  test('requires authentication before listing alert subscriptions', async () => {
    const response = await testApp.getApp().inject({
      method: 'GET',
      url: '/api/v1/alerts/subscriptions',
    })

    assert.equal(response.statusCode, 401)
  })

  test('requires authentication before creating a wallet alert subscription', async () => {
    const response = await testApp.getApp().inject({
      method: 'POST',
      payload: {
        minScore: 70,
        minSizeUsd: 1000,
        type: 'wallet',
        walletAddress: '0xabc123',
      },
      url: '/api/v1/alerts/subscriptions',
    })

    assert.equal(response.statusCode, 401)
  })

  test('returns the authenticated user session via /auth/me when using the session cookie', async () => {
    await requestMagicLink('reader@example.com')
    const verifyResponse = await verifyMagicLink('reader@example.com')
    const cookieHeader = getCookieHeader(verifyResponse)

    const response = await testApp.getApp().inject({
      headers: {
        cookie: cookieHeader,
      },
      method: 'GET',
      url: '/api/v1/auth/me',
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.json().data.user.email, 'reader@example.com')
    assert.equal(response.json().data.user.defaultChannel, 'email')
    assert.equal(response.json().data.user.telegramHandle, null)
  })

  test('starts Telegram auth, approves via the bot deep link, and authenticates with a cookie session', async () => {
    const bot = registerTestTelegramBot()
    const initResponse = await beginTelegramAuth()

    assert.equal(initResponse.statusCode, 200)
    assert.equal(typeof initResponse.json().data.token, 'string')
    assert.equal(
      initResponse.json().data.botUrl,
      `https://t.me/QuorumSignalsBot?start=auth_${initResponse.json().data.token}`,
    )

    const pendingResponse = await getTelegramAuthStatus(
      initResponse.json().data.token,
    )

    assert.equal(pendingResponse.statusCode, 200)
    assert.equal(pendingResponse.json().data.status, 'pending')

    await handleStartCommand(
      bot,
      createTestTelegramMessage({
        chatId: 7777,
        text: `/start auth_${initResponse.json().data.token}`,
        username: 'telegram_signin',
      }),
      `auth_${initResponse.json().data.token}`,
    )

    assert.equal(bot.sentMessages.length, 1)
    assert.match(bot.sentMessages[0]?.text ?? '', /Signed in to Quorum/)

    const approvedResponse = await getTelegramAuthStatus(
      initResponse.json().data.token,
    )

    assert.equal(approvedResponse.statusCode, 200)
    assert.equal(approvedResponse.json().data.status, 'approved')
    assert.equal(approvedResponse.json().data.username, 'telegram_signin')

    const cookieHeader = getCookieHeader(approvedResponse)
    const meResponse = await testApp.getApp().inject({
      headers: {
        cookie: cookieHeader,
      },
      method: 'GET',
      url: '/api/v1/auth/me',
    })

    assert.equal(meResponse.statusCode, 200)
    assert.equal(meResponse.json().data.user.authProvider, 'telegram')
    assert.equal(meResponse.json().data.user.email, null)
    assert.equal(meResponse.json().data.user.telegramHandle, '@telegram_signin')
    assert.equal(meResponse.json().data.user.defaultChannel, 'telegram')
  })

  test('allows a Telegram-authenticated user to add an email via magic link', async () => {
    const sentMessages: string[] = []

    setTestEmailSender(async (input) => {
      sentMessages.push(input.text)

      return {
        providerMessageId: 'email_link_1',
      }
    })

    const bot = registerTestTelegramBot()
    const initResponse = await beginTelegramAuth()

    await handleStartCommand(
      bot,
      createTestTelegramMessage({
        chatId: 7788,
        text: `/start auth_${initResponse.json().data.token}`,
        username: 'telegram_email_link',
      }),
      `auth_${initResponse.json().data.token}`,
    )

    const approvedResponse = await getTelegramAuthStatus(
      initResponse.json().data.token,
    )
    const cookieHeader = getCookieHeader(approvedResponse)

    const requestEmailLinkResponse = await testApp.getApp().inject({
      headers: {
        cookie: cookieHeader,
      },
      method: 'POST',
      payload: {
        email: 'reader@example.com',
      },
      url: '/api/v1/auth/email-link',
    })

    assert.equal(requestEmailLinkResponse.statusCode, 200)
    assert.equal(sentMessages.length, 1)
    assert.match(
      sentMessages[0] ?? '',
      /http:\/\/localhost:5173\/alerts\?auth_email=reader%40example\.com&auth_token=test-magic-token/,
    )

    const verifyResponse = await verifyMagicLink('reader@example.com')

    assert.equal(verifyResponse.statusCode, 200)
    assert.equal(verifyResponse.json().data.status, 'email-linked')
    assert.equal(verifyResponse.json().data.user.authProvider, 'telegram')
    assert.equal(verifyResponse.json().data.user.email, 'reader@example.com')

    const meResponse = await testApp.getApp().inject({
      headers: {
        cookie: cookieHeader,
      },
      method: 'GET',
      url: '/api/v1/auth/me',
    })

    assert.equal(meResponse.statusCode, 200)
    assert.equal(meResponse.json().data.user.authProvider, 'telegram')
    assert.equal(meResponse.json().data.user.email, 'reader@example.com')
    assert.equal(meResponse.json().data.user.telegramHandle, '@telegram_email_link')
    assert.equal(meResponse.json().data.user.defaultChannel, 'telegram')
  })

  test('returns and updates the authenticated user profile', async () => {
    await requestMagicLink('reader@example.com')
    const verifyResponse = await verifyMagicLink('reader@example.com')
    const token = verifyResponse.json().data.session.token as string

    const meResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'GET',
      url: '/api/v1/user/me',
    })

    assert.equal(meResponse.statusCode, 200)
    assert.equal(meResponse.json().data.email, 'reader@example.com')
    assert.equal(meResponse.json().data.defaultChannel, 'email')
    assert.equal(meResponse.json().data.telegramHandle, null)

    const code = await issueTelegramConnectCode({
      username: 'alerts_reader',
    })

    const connectResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
      payload: {
        code,
      },
      url: '/api/v1/telegram/connect',
    })

    assert.equal(connectResponse.statusCode, 200)
    assert.equal(connectResponse.json().data.handle, '@alerts_reader')

    const patchResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'PATCH',
      payload: {
        defaultChannel: 'both',
        email: 'alerts@example.com',
      },
      url: '/api/v1/user/preferences',
    })

    assert.equal(patchResponse.statusCode, 200)
    assert.equal(patchResponse.json().data.email, 'alerts@example.com')
    assert.equal(patchResponse.json().data.defaultChannel, 'both')
  })

  test('connects and disconnects Telegram for the authenticated user', async () => {
    await requestMagicLink('reader@example.com')
    const verifyResponse = await verifyMagicLink('reader@example.com')
    const token = verifyResponse.json().data.session.token as string

    const invalidResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
      payload: {
        code: '000000',
      },
      url: '/api/v1/telegram/connect',
    })

    assert.equal(invalidResponse.statusCode, 400)
    assert.equal(invalidResponse.json().error.code, 'invalid_code')

    const code = await issueTelegramConnectCode({
      chatId: 2002,
      username: 'reader_channel',
    })

    const connectResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
      payload: {
        code,
      },
      url: '/api/v1/telegram/connect',
    })

    assert.equal(connectResponse.statusCode, 200)
    assert.equal(connectResponse.json().data.handle, '@reader_channel')

    const meResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'GET',
      url: '/api/v1/user/me',
    })

    assert.equal(meResponse.statusCode, 200)
    assert.equal(meResponse.json().data.telegramHandle, '@reader_channel')

    const disconnectResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'DELETE',
      url: '/api/v1/telegram/connect',
    })

    assert.equal(disconnectResponse.statusCode, 204)

    const refreshedResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'GET',
      url: '/api/v1/user/me',
    })

    assert.equal(refreshedResponse.statusCode, 200)
    assert.equal(refreshedResponse.json().data.telegramHandle, null)
    assert.equal(refreshedResponse.json().data.defaultChannel, 'email')
  })

  test('does not allow a Telegram connect code to be claimed twice', async () => {
    await requestMagicLink('reader@example.com')
    const verifyResponse = await verifyMagicLink('reader@example.com')
    const token = verifyResponse.json().data.session.token as string
    const code = await issueTelegramConnectCode({
      chatId: 3003,
      username: 'reader_once',
    })

    const firstConnectResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
      payload: {
        code,
      },
      url: '/api/v1/telegram/connect',
    })

    const secondConnectResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
      payload: {
        code,
      },
      url: '/api/v1/telegram/connect',
    })

    assert.equal(firstConnectResponse.statusCode, 200)
    assert.equal(secondConnectResponse.statusCode, 400)
    assert.equal(secondConnectResponse.json().error.code, 'invalid_code')
  })

  test('locks Telegram verification after three failed attempts', async () => {
    await requestMagicLink('reader@example.com')
    const verifyResponse = await verifyMagicLink('reader@example.com')
    const token = verifyResponse.json().data.session.token as string

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await testApp.getApp().inject({
        headers: {
          authorization: `Bearer ${token}`,
        },
        method: 'POST',
        payload: {
          code: '000000',
        },
        url: '/api/v1/telegram/connect',
      })

      assert.equal(response.statusCode, 400)
      assert.equal(response.json().error.code, 'invalid_code')
    }

    const lockedResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
      payload: {
        code: '000000',
      },
      url: '/api/v1/telegram/connect',
    })

    assert.equal(lockedResponse.statusCode, 429)
    assert.equal(lockedResponse.json().error.code, 'too_many_attempts')
  })

  test('reports Telegram connection status through the bot command', async () => {
    await requestMagicLink('reader@example.com')
    const verifyResponse = await verifyMagicLink('reader@example.com')
    const token = verifyResponse.json().data.session.token as string
    const code = await issueTelegramConnectCode({
      chatId: 9010,
      username: 'status_reader',
    })

    const connectResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
      payload: {
        code,
      },
      url: '/api/v1/telegram/connect',
    })

    assert.equal(connectResponse.statusCode, 200)

    const createSubscriptionResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
      payload: {
        type: 'wallet',
        walletAddress: '0xabc123',
      },
      url: '/api/v1/alerts/subscriptions',
    })

    assert.equal(createSubscriptionResponse.statusCode, 201)

    const bot = registerTestTelegramBot()

    await handleStatusCommand(
      bot,
      createTestTelegramMessage({
        chatId: 9010,
        text: '/status',
        username: 'status_reader',
      }),
    )

    assert.equal(bot.sentMessages.length, 1)
    assert.match(bot.sentMessages[0]?.text ?? '', /reader@example\\\.com/)
    assert.match(bot.sentMessages[0]?.text ?? '', /`1`/)
  })

  test('disconnects Telegram through the bot /stop command', async () => {
    await requestMagicLink('reader@example.com')
    const verifyResponse = await verifyMagicLink('reader@example.com')
    const token = verifyResponse.json().data.session.token as string
    const code = await issueTelegramConnectCode({
      chatId: 9020,
      username: 'stop_reader',
    })

    const connectResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
      payload: {
        code,
      },
      url: '/api/v1/telegram/connect',
    })

    assert.equal(connectResponse.statusCode, 200)

    const bot = registerTestTelegramBot()

    await handleStopCommand(
      bot,
      createTestTelegramMessage({
        chatId: 9020,
        text: '/stop',
        username: 'stop_reader',
      }),
    )

    assert.equal(bot.sentMessages.length, 1)
    assert.match(bot.sentMessages[0]?.text ?? '', /Alerts paused/)

    const refreshedResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'GET',
      url: '/api/v1/user/me',
    })

    assert.equal(refreshedResponse.statusCode, 200)
    assert.equal(refreshedResponse.json().data.telegramHandle, null)
    assert.equal(refreshedResponse.json().data.defaultChannel, 'email')
  })

  test('creates and lists wallet alert subscriptions for an authenticated user', async () => {
    await requestMagicLink('reader@example.com')
    const verifyResponse = await verifyMagicLink('reader@example.com')
    const token = verifyResponse.json().data.session.token as string

    const createResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
      payload: {
        minScore: 70,
        minSizeUsd: 1500,
        triggerMode: 'winning-moves-only',
        type: 'wallet',
        walletAddress: '0xAbC123',
      },
      url: '/api/v1/alerts/subscriptions',
    })

    assert.equal(createResponse.statusCode, 201)
    assert.equal(createResponse.json().data.walletAddress, '0xabc123')

    const listResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'GET',
      url: '/api/v1/alerts/subscriptions',
    })

    assert.equal(listResponse.statusCode, 200)
    assert.equal(listResponse.json().data.items.length, 1)
    assert.equal(listResponse.json().data.items[0].walletAddress, '0xabc123')
    assert.equal(
      listResponse.json().data.items[0].triggerMode,
      'winning-moves-only',
    )
    assert.equal(listResponse.json().data.items[0].lastDeliveredAt, null)
  })

  test('pauses and resumes wallet alert subscriptions for the authenticated user', async () => {
    await requestMagicLink('reader@example.com')
    const verifyResponse = await verifyMagicLink('reader@example.com')
    const token = verifyResponse.json().data.session.token as string
    const createResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
      payload: {
        minScore: 70,
        minSizeUsd: 1500,
        triggerMode: 'any-new-position',
        type: 'wallet',
        walletAddress: '0xAbC123',
      },
      url: '/api/v1/alerts/subscriptions',
    })

    const subscriptionId = createResponse.json().data.id as string
    const pauseResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'PATCH',
      payload: {
        status: 'paused',
      },
      url: `/api/v1/alerts/subscriptions/${subscriptionId}`,
    })
    const resumeResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'PATCH',
      payload: {
        status: 'active',
      },
      url: `/api/v1/alerts/subscriptions/${subscriptionId}`,
    })

    assert.equal(pauseResponse.statusCode, 200)
    assert.equal(pauseResponse.json().data.status, 'paused')
    assert.equal(resumeResponse.statusCode, 200)
    assert.equal(resumeResponse.json().data.status, 'active')
  })

  test('updates wallet alert trigger and thresholds for the authenticated user', async () => {
    await requestMagicLink('reader@example.com')
    const verifyResponse = await verifyMagicLink('reader@example.com')
    const token = verifyResponse.json().data.session.token as string
    const createResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
      payload: {
        minScore: 65,
        minSizeUsd: 900,
        triggerMode: 'any-new-position',
        type: 'wallet',
        walletAddress: '0xAbC123',
      },
      url: '/api/v1/alerts/subscriptions',
    })

    const subscriptionId = createResponse.json().data.id as string
    const updateResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'PATCH',
      payload: {
        minScore: 82,
        minSizeUsd: 2500,
        triggerMode: 'winning-moves-only',
      },
      url: `/api/v1/alerts/subscriptions/${subscriptionId}`,
    })

    assert.equal(updateResponse.statusCode, 200)
    assert.equal(updateResponse.json().data.minScore, 82)
    assert.equal(updateResponse.json().data.minSizeUsd, 2500)
    assert.equal(
      updateResponse.json().data.triggerMode,
      'winning-moves-only',
    )
  })

  test('rejects duplicate wallet subscriptions for the same authenticated user', async () => {
    await requestMagicLink('reader@example.com')
    const verifyResponse = await verifyMagicLink('reader@example.com')
    const token = verifyResponse.json().data.session.token as string

    const payload = {
      minScore: 60,
      minSizeUsd: 1000,
      type: 'wallet',
      walletAddress: '0xabc123',
    }

    const firstCreate = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
      payload,
      url: '/api/v1/alerts/subscriptions',
    })
    const secondCreate = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
      payload,
      url: '/api/v1/alerts/subscriptions',
    })

    assert.equal(firstCreate.statusCode, 201)
    assert.equal(secondCreate.statusCode, 409)
  })

  test('deletes wallet alert subscriptions for the authenticated user', async () => {
    await requestMagicLink('reader@example.com')
    const verifyResponse = await verifyMagicLink('reader@example.com')
    const token = verifyResponse.json().data.session.token as string
    const createResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
      payload: {
        minScore: 65,
        minSizeUsd: 1200,
        type: 'wallet',
        walletAddress: '0xabc123',
      },
      url: '/api/v1/alerts/subscriptions',
    })

    const subscriptionId = createResponse.json().data.id as string
    const deleteResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'DELETE',
      url: `/api/v1/alerts/subscriptions/${subscriptionId}`,
    })

    assert.equal(deleteResponse.statusCode, 204)

    const listResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'GET',
      url: '/api/v1/alerts/subscriptions',
    })

    assert.equal(listResponse.statusCode, 200)
    assert.equal(listResponse.json().data.items.length, 0)
  })
})
