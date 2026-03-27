import type { FastifyPluginAsync } from 'fastify'
import {
  applyHttpCacheHeaders,
  buildRequestCacheKey,
  withCachedResponse,
} from '../../app/response-cache.js'
import { createApiResponse } from '../../contracts/api-response.js'
import type {
  PulseSmartMoneySignalListData,
  PulseSmartMoneySignalListParams,
  PulseSmartMoneyWalletListData,
  PulseSmartMoneyWalletListParams,
} from '../../contracts/pulse-smart-money.js'
import {
  getSmartMoneyWallet,
  listSmartMoneySignals,
  listSmartMoneyWallets,
} from '../../app/smart-money-service.js'

const SMART_MONEY_CACHE_POLICY = {
  maxAgeSeconds: 120,
  staleWhileRevalidateSeconds: 600,
} as const

export const v1SmartMoneyRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Querystring: PulseSmartMoneySignalListParams
  }>('/smart-money/signals', async (request, reply) => {
    applyHttpCacheHeaders(reply, SMART_MONEY_CACHE_POLICY)

    return withCachedResponse(
      buildRequestCacheKey(request),
      SMART_MONEY_CACHE_POLICY,
      async () => {
        const items = await listSmartMoneySignals(request.query)
        const data: PulseSmartMoneySignalListData = { items }

        return createApiResponse(data, {
          total: items.length,
        })
      },
    )
  })

  app.get<{
    Querystring: PulseSmartMoneyWalletListParams
  }>('/smart-money/wallets', async (request, reply) => {
    applyHttpCacheHeaders(reply, SMART_MONEY_CACHE_POLICY)

    return withCachedResponse(
      buildRequestCacheKey(request),
      SMART_MONEY_CACHE_POLICY,
      async () => {
        const items = await listSmartMoneyWallets(request.query)
        const data: PulseSmartMoneyWalletListData = { items }

        return createApiResponse(data, {
          total: items.length,
        })
      },
    )
  })

  app.get<{
    Params: {
      address: string
    }
  }>('/smart-money/wallets/:address', async (request, reply) => {
    applyHttpCacheHeaders(reply, SMART_MONEY_CACHE_POLICY)

    return withCachedResponse(
      buildRequestCacheKey(request),
      SMART_MONEY_CACHE_POLICY,
      async () => {
        const wallet = await getSmartMoneyWallet(request.params.address)

        return createApiResponse(wallet)
      },
    )
  })
}
