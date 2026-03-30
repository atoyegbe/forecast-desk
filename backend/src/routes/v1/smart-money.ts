import type { FastifyPluginAsync } from 'fastify'
import { createApiResponse } from '../../contracts/api-response.js'
import type {
  PulseSmartMoneySignalListData,
  PulseSmartMoneySignalListParams,
  PulseSmartMoneyStatus,
  PulseSmartMoneyWalletListData,
  PulseSmartMoneyWalletListParams,
} from '../../contracts/pulse-smart-money.js'
import {
  getSmartMoneyStatus,
  getSmartMoneyWallet,
  listSmartMoneySignals,
  listSmartMoneyWallets,
} from '../../app/smart-money-service.js'

export const v1SmartMoneyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/smart-money/status', async () => {
    const status = await getSmartMoneyStatus()

    return createApiResponse<PulseSmartMoneyStatus>(status)
  })

  app.get<{
    Querystring: PulseSmartMoneySignalListParams
  }>('/smart-money/signals', async (request) => {
    const items = await listSmartMoneySignals(request.query)
    const data: PulseSmartMoneySignalListData = { items }

    return createApiResponse(data, {
      total: items.length,
    })
  })

  app.get<{
    Querystring: PulseSmartMoneyWalletListParams
  }>('/smart-money/wallets', async (request) => {
    const items = await listSmartMoneyWallets(request.query)
    const data: PulseSmartMoneyWalletListData = { items }

    return createApiResponse(data, {
      total: items.length,
    })
  })

  app.get<{
    Params: {
      address: string
    }
  }>('/smart-money/wallets/:address', async (request) => {
    const wallet = await getSmartMoneyWallet(request.params.address)

    return createApiResponse(wallet)
  })
}
