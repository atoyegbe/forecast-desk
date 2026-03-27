import type { FastifyPluginAsync } from 'fastify'
import { bayseLiveHub } from '../../realtime/bayse-live-hub.js'

const RUNTIME_HEARTBEAT_INTERVAL_MS = 20_000

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Live websocket subscription failed.'
}

export const v1LiveRoutes: FastifyPluginAsync = async (app) => {
  app.get('/live/runtime', { websocket: true }, (socket) => {
    socket.send(
      JSON.stringify({
        timestamp: Date.now(),
        type: 'connected',
      }),
    )

    const heartbeatInterval = setInterval(() => {
      try {
        socket.send(
          JSON.stringify({
            timestamp: Date.now(),
            type: 'heartbeat',
          }),
        )
      } catch {
        clearInterval(heartbeatInterval)
      }
    }, RUNTIME_HEARTBEAT_INTERVAL_MS)

    const teardown = () => {
      clearInterval(heartbeatInterval)
    }

    socket.on('close', teardown)
    socket.on('error', teardown)
  })

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
