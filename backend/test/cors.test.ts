import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { registerAppTestLifecycle } from './helpers/test-app.js'

const testApp = registerAppTestLifecycle()

describe('CORS', () => {
  test('responds to preflight requests from an allowed frontend origin', async () => {
    const response = await testApp.getApp().inject({
      headers: {
        'access-control-request-method': 'GET',
        origin: 'http://localhost:5173',
      },
      method: 'OPTIONS',
      url: '/api/v1/currencies',
    })

    assert.equal(response.statusCode, 204)
    assert.equal(
      response.headers['access-control-allow-origin'],
      'http://localhost:5173',
    )
  })

  test('does not allow unknown origins', async () => {
    const response = await testApp.getApp().inject({
      headers: {
        origin: 'https://evil.example',
      },
      method: 'GET',
      url: '/api/v1/currencies',
    })

    assert.equal(
      response.headers['access-control-allow-origin'],
      undefined,
    )
  })
})
