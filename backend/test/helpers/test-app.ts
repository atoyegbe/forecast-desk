import type { FastifyInstance } from 'fastify'
import { Client } from 'pg'
import { after, before, beforeEach } from 'node:test'
import { closeDbPool } from '../../src/db/pool.js'
import {
  ensureDiscoverySchema,
  resetDiscoverySchemaState,
} from '../../src/db/schema.js'
import { createApp } from '../../src/app/create-app.js'
import { createTestDatabase, dropTestDatabase } from './test-db.js'

let app: FastifyInstance | null = null
let connectionString = ''
let databaseName = ''

async function resetPublicSchema() {
  const client = new Client({
    connectionString,
  })

  await client.connect()
  await client.query('DROP SCHEMA public CASCADE')
  await client.query('CREATE SCHEMA public')
  await client.query('GRANT ALL ON SCHEMA public TO PUBLIC')
  await client.end()
  await closeDbPool()
  resetDiscoverySchemaState()
  await ensureDiscoverySchema()
}

export function registerAppTestLifecycle() {
  before(async () => {
    process.env.QUORUM_AUTH_TEST_MAGIC_TOKEN = 'test-magic-token'
    process.env.QUORUM_AUTH_FRONTEND_BASE_URL = 'http://localhost:5173'
    process.env.QUORUM_TELEGRAM_BOT_TOKEN = 'test-telegram-token'
    process.env.QUORUM_TELEGRAM_BOT_USERNAME = 'QuorumAlertsBot'
    process.env.SMART_MONEY_SCHEDULER_ENABLED = 'false'
    const database = await createTestDatabase()

    connectionString = database.connectionString
    databaseName = database.databaseName
    process.env.DATABASE_URL = connectionString
    await closeDbPool()
    app = await createApp()
  })

  beforeEach(async () => {
    await resetPublicSchema()
  })

  after(async () => {
    await app?.close()
    await closeDbPool()
    if (databaseName) {
      await dropTestDatabase(databaseName)
    }
  })

  return {
    getApp() {
      if (!app) {
        throw new Error('Test app is not initialized')
      }

      return app
    },
    getConnectionString() {
      return connectionString
    },
  }
}
