import type { FastifyPluginAsync } from 'fastify'
import {
  applyHttpCacheHeaders,
  buildRequestCacheKey,
  withCachedResponse,
} from '../../app/response-cache.js'
import { getCurrencySnapshot } from '../../app/currency-service.js'
import { createApiResponse } from '../../contracts/api-response.js'

const CURRENCY_CACHE_POLICY = {
  maxAgeSeconds: 300,
  staleWhileRevalidateSeconds: 1_800,
} as const

export const v1CurrencyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/currencies', async (request, reply) => {
    applyHttpCacheHeaders(reply, CURRENCY_CACHE_POLICY)

    return withCachedResponse(
      buildRequestCacheKey(request),
      CURRENCY_CACHE_POLICY,
      async () => {
        const snapshot = await getCurrencySnapshot()

        return createApiResponse(snapshot)
      },
    )
  })
}
