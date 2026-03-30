import type { FastifyPluginAsync } from 'fastify'
import { getCurrencySnapshot } from '../../app/currency-service.js'
import { createApiResponse } from '../../contracts/api-response.js'

export const v1CurrencyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/currencies', async () => {
    const snapshot = await getCurrencySnapshot()

    return createApiResponse(snapshot)
  })
}
