import type { FastifyPluginAsync } from 'fastify'
import { createApiResponse } from '../../contracts/api-response.js'
import type {
  PulseDivergenceListData,
  PulseDivergenceListParams,
  PulseEventListParams,
  PulseEventsListData,
  PulseSearchParams,
  PulseSearchResultsData,
} from '../../contracts/pulse-events.js'
import {
  getEventCompare,
  getEvent,
  getPriceHistory,
  listEvents,
  listDivergence,
  searchEvents,
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
    Querystring: PulseSearchParams
  }>('/search', async (request) => {
    const items = await searchEvents(request.query)
    const data: PulseSearchResultsData = { items }

    return createApiResponse(data, {
      total: items.length,
    })
  })

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

  app.get<{
    Params: {
      eventId: string
    }
  }>('/events/:eventId/compare', async (request) => {
    const comparison = await getEventCompare(request.params.eventId)

    return createApiResponse(comparison)
  })

  app.get<{
    Querystring: PulseDivergenceListParams
  }>('/divergence', async (request) => {
    const items = await listDivergence(request.query)
    const data: PulseDivergenceListData = { items }

    return createApiResponse(data, {
      total: items.length,
    })
  })
}
