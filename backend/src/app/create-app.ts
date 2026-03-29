import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import {
  startSmartMoneyScheduler,
  stopSmartMoneyScheduler,
} from './smart-money-service.js'
import { closeDbPool } from '../db/pool.js'
import { ensureDiscoverySchema } from '../db/schema.js'
import { bayseLiveHub } from '../realtime/bayse-live-hub.js'
import { smartMoneyLiveHub } from '../realtime/smart-money-live-hub.js'
import { healthRoute } from '../routes/health.js'
import { v1CurrencyRoutes } from '../routes/v1/currencies.js'
import { v1EventsRoutes } from '../routes/v1/events.js'
import { v1LiveRoutes } from '../routes/v1/live.js'
import { v1SmartMoneyRoutes } from '../routes/v1/smart-money.js'

export async function createApp() {
  await ensureDiscoverySchema()

  const app = Fastify({
    logger: true,
  })

  await app.register(websocket)
  startSmartMoneyScheduler()

  app.addHook('onClose', async () => {
    bayseLiveHub.closeAll()
    smartMoneyLiveHub.closeAll()
    stopSmartMoneyScheduler()
    await closeDbPool()
  })

  app.register(healthRoute)
  app.register(v1CurrencyRoutes, { prefix: '/api/v1' })
  app.register(v1EventsRoutes, { prefix: '/api/v1' })
  app.register(v1LiveRoutes, { prefix: '/api/v1' })
  app.register(v1SmartMoneyRoutes, { prefix: '/api/v1' })

  return app
}
