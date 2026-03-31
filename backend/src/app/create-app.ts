import cors from '@fastify/cors'
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import {
  startSmartMoneyScheduler,
  stopSmartMoneyScheduler,
} from './smart-money-service.js'
import {
  getQuorumCorsAllowedOrigins,
  isSmartMoneySchedulerEnabled,
} from '../db/config.js'
import { closeDbPool } from '../db/pool.js'
import { ensureDiscoverySchema } from '../db/schema.js'
import { bayseLiveHub } from '../realtime/bayse-live-hub.js'
import { kalshiLiveHub } from '../realtime/kalshi-live-hub.js'
import { manifoldLiveHub } from '../realtime/manifold-live-hub.js'
import { polymarketLiveHub } from '../realtime/polymarket-live-hub.js'
import { smartMoneyLiveHub } from '../realtime/smart-money-live-hub.js'
import { healthRoute } from '../routes/health.js'
import { ogRoute } from '../routes/og.js'
import { v1AlertRoutes } from '../routes/v1/alerts.js'
import { v1AuthRoutes } from '../routes/v1/auth.js'
import { v1CurrencyRoutes } from '../routes/v1/currencies.js'
import { v1EventsRoutes } from '../routes/v1/events.js'
import { v1LiveRoutes } from '../routes/v1/live.js'
import { v1SmartMoneyRoutes } from '../routes/v1/smart-money.js'
import { v1UserRoutes } from '../routes/v1/user.js'

export async function createApp() {
  await ensureDiscoverySchema()

  const app = Fastify({
    logger: true,
  })

  const allowedOrigins = new Set(getQuorumCorsAllowedOrigins())

  await app.register(cors, {
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86_400,
    methods: ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST'],
    origin(requestOrigin, callback) {
      if (!requestOrigin) {
        callback(null, true)
        return
      }

      try {
        const normalizedOrigin = new URL(requestOrigin).origin

        callback(null, allowedOrigins.has(normalizedOrigin))
      } catch {
        callback(null, false)
      }
    },
  })

  await app.register(websocket)

  if (isSmartMoneySchedulerEnabled()) {
    startSmartMoneyScheduler()
  }

  app.addHook('onClose', async () => {
    bayseLiveHub.closeAll()
    kalshiLiveHub.closeAll()
    manifoldLiveHub.closeAll()
    polymarketLiveHub.closeAll()
    smartMoneyLiveHub.closeAll()
    stopSmartMoneyScheduler()
    await closeDbPool()
  })

  app.register(healthRoute)
  app.register(ogRoute)
  app.register(v1AuthRoutes, { prefix: '/api/v1' })
  app.register(v1AlertRoutes, { prefix: '/api/v1' })
  app.register(v1CurrencyRoutes, { prefix: '/api/v1' })
  app.register(v1EventsRoutes, { prefix: '/api/v1' })
  app.register(v1LiveRoutes, { prefix: '/api/v1' })
  app.register(v1SmartMoneyRoutes, { prefix: '/api/v1' })
  app.register(v1UserRoutes, { prefix: '/api/v1' })

  return app
}
