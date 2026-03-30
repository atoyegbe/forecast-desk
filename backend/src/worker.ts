import 'dotenv/config'
import {
  startAlertDeliveryWorker,
  stopAlertDeliveryWorker,
} from './app/alerts-service.js'
import { startSmartMoneyScheduler, stopSmartMoneyScheduler } from './app/smart-money-service.js'
import { startTelegramBotWorker, stopTelegramBotWorker } from './bot/index.js'
import { closeDbPool } from './db/pool.js'
import { ensureDiscoverySchema } from './db/schema.js'

let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  console.log(`[smart-money-worker] stopping on ${signal}`)
  stopAlertDeliveryWorker()
  stopSmartMoneyScheduler()
  await stopTelegramBotWorker()
  await closeDbPool()
  process.exit(0)
}

async function start() {
  await ensureDiscoverySchema()
  startAlertDeliveryWorker()
  startSmartMoneyScheduler()
  await startTelegramBotWorker()
  console.log('[smart-money-worker] scheduler and alerts worker started')
}

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})

void start().catch(async (error) => {
  console.error('[smart-money-worker] failed to start', error)
  await closeDbPool().catch(() => {
    // Best effort shutdown after startup failures.
  })
  process.exit(1)
})
