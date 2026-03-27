import type { FastifyPluginAsync } from 'fastify'
import { bayseLiveHub } from '../../realtime/bayse-live-hub.js'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Live websocket subscription failed.'
}

export const v1LiveRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Params: {
      eventId: string
    }
  }>('/live/events/:eventId', { websocket: true }, (socket, request) => {
    let unsubscribe: (() => void) | null = null

    try {
      unsubscribe = bayseLiveHub.subscribe(request.params.eventId, socket)
    } catch (error) {
      socket.send(
        JSON.stringify({
          message: getErrorMessage(error),
          timestamp: Date.now(),
          type: 'error',
        }),
      )
      socket.close(1008, 'Unsupported live event')
      return
    }

    socket.on('close', () => {
      unsubscribe?.()
    })
    socket.on('error', () => {
      unsubscribe?.()
    })
  })
}
