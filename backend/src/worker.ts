import 'dotenv/config'
import { startSmartMoneyScheduler, stopSmartMoneyScheduler } from './app/smart-money-service.js'
import { closeDbPool } from './db/pool.js'
import { ensureDiscoverySchema } from './db/schema.js'

let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  console.log(`[smart-money-worker] stopping on ${signal}`)
  stopSmartMoneyScheduler()
  await closeDbPool()
  process.exit(0)
}

async function start() {
  await ensureDiscoverySchema()
  startSmartMoneyScheduler()
  console.log('[smart-money-worker] scheduler started')
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
