import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { closeDbPool } from '../db/pool.js'
import { ensureDiscoverySchema } from '../db/schema.js'
import { bayseLiveHub } from '../realtime/bayse-live-hub.js'
import { healthRoute } from '../routes/health.js'
import { v1EventsRoutes } from '../routes/v1/events.js'
import { v1LiveRoutes } from '../routes/v1/live.js'

export async function createApp() {
  await ensureDiscoverySchema()

  const app = Fastify({
    logger: true,
  })

  await app.register(websocket)

  app.addHook('onClose', async () => {
    bayseLiveHub.closeAll()
    await closeDbPool()
  })

  app.register(healthRoute)
  app.register(v1EventsRoutes, { prefix: '/api/v1' })
  app.register(v1LiveRoutes, { prefix: '/api/v1' })

  return app
}
