import Fastify from 'fastify'
import { closeDbPool } from '../db/pool.js'
import { ensureDiscoverySchema } from '../db/schema.js'
import { healthRoute } from '../routes/health.js'
import { v1EventsRoutes } from '../routes/v1/events.js'

export async function createApp() {
  await ensureDiscoverySchema()

  const app = Fastify({
    logger: true,
  })

  app.addHook('onClose', async () => {
    await closeDbPool()
  })

  app.register(healthRoute)
  app.register(v1EventsRoutes, { prefix: '/api/v1' })

  return app
}
