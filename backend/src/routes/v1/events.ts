import type { FastifyPluginAsync } from 'fastify'
import {
  createApiResponse,
} from '../../contracts/api-response.js'
import {
  type PulseEventListParams,
  type PulseEventsListData,
} from '../../contracts/pulse-events.js'
import {
  getEvent,
  getPriceHistory,
  listEvents,
} from '../../app/events-service.js'

export const v1EventsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Querystring: PulseEventListParams
  }>(
    '/events',
    async (request) => {
      const items = await listEvents(request.query)
      const data: PulseEventsListData = { items }

      return createApiResponse(data, {
        total: items.length,
      })
    },
  )

  app.get<{
    Params: {
      eventId: string
    }
  }>('/events/:eventId', async (request) => {
    const event = await getEvent(request.params.eventId)

    return createApiResponse(event)
  })

  app.get<{
    Params: {
      eventId: string
    }
    Querystring: {
      interval?: string
    }
  }>('/events/:eventId/history', async (request) => {
    const history = await getPriceHistory(
      request.params.eventId,
      request.query.interval,
    )

    return createApiResponse(history)
  })
}
