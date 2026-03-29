import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { registerAppTestLifecycle } from './helpers/test-app.js'

const testApp = registerAppTestLifecycle()
const AUTH_CODE = '123456'

async function requestLoginCode(email: string) {
  return testApp.getApp().inject({
    method: 'POST',
    payload: {
      email,
    },
    url: '/api/v1/auth/request-code',
  })
}

async function verifyLoginCode(email: string, code = AUTH_CODE) {
  return testApp.getApp().inject({
    method: 'POST',
    payload: {
      code,
      email,
    },
    url: '/api/v1/auth/verify-code',
  })
}

describe('Phase 7 auth and alerts', () => {
  test('requests a passwordless login code for a valid email', async () => {
    const response = await requestLoginCode('reader@example.com')

    assert.equal(response.statusCode, 200)
  })

  test('rejects malformed login email addresses', async () => {
    const response = await testApp.getApp().inject({
      method: 'POST',
      payload: {
        email: 'not-an-email',
      },
      url: '/api/v1/auth/request-code',
    })

    assert.equal(response.statusCode, 400)
  })

  test('verifies a passwordless code and returns a bearer session', async () => {
    await requestLoginCode('reader@example.com')

    const response = await verifyLoginCode('reader@example.com')

    assert.equal(response.statusCode, 200)

    const payload = response.json()

    assert.equal(payload.data.user.email, 'reader@example.com')
    assert.equal(typeof payload.data.session.token, 'string')
    assert.equal(payload.data.session.token.length > 20, true)
  })

  test('rejects expired or invalid login codes', async () => {
    await requestLoginCode('reader@example.com')

    const invalidCodeResponse = await verifyLoginCode('reader@example.com', '000000')

    assert.equal(invalidCodeResponse.statusCode, 401)

    const wrongEmailResponse = await verifyLoginCode('other@example.com')

    assert.equal(wrongEmailResponse.statusCode, 401)
  })

  test('does not allow a passwordless code to be reused', async () => {
    await requestLoginCode('reader@example.com')

    const firstResponse = await verifyLoginCode('reader@example.com')
    const secondResponse = await verifyLoginCode('reader@example.com')

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

  test('returns the authenticated user session via /auth/me', async () => {
    await requestLoginCode('reader@example.com')
    const verifyResponse = await verifyLoginCode('reader@example.com')
    const token = verifyResponse.json().data.session.token as string

    const response = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'GET',
      url: '/api/v1/auth/me',
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.json().data.user.email, 'reader@example.com')
  })

  test('creates and lists wallet alert subscriptions for an authenticated user', async () => {
    await requestLoginCode('reader@example.com')
    const verifyResponse = await verifyLoginCode('reader@example.com')
    const token = verifyResponse.json().data.session.token as string

    const createResponse = await testApp.getApp().inject({
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: 'POST',
      payload: {
        minScore: 70,
        minSizeUsd: 1500,
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
  })

  test('rejects duplicate wallet subscriptions for the same authenticated user', async () => {
    await requestLoginCode('reader@example.com')
    const verifyResponse = await verifyLoginCode('reader@example.com')
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
    await requestLoginCode('reader@example.com')
    const verifyResponse = await verifyLoginCode('reader@example.com')
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
