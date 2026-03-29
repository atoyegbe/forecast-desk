import { randomUUID } from 'node:crypto'
import { Client } from 'pg'

const DEFAULT_ADMIN_DATABASE_URL = 'postgresql:///postgres'

function buildDatabaseUrl(baseUrl: string, databaseName: string) {
  const parsedUrl = new URL(baseUrl)

  parsedUrl.pathname = `/${databaseName}`

  return parsedUrl.toString()
}

export async function createTestDatabase() {
  const adminDatabaseUrl =
    process.env.TEST_ADMIN_DATABASE_URL?.trim() || DEFAULT_ADMIN_DATABASE_URL
  const databaseName = `naija_pulse_test_${randomUUID().replace(/-/g, '')}`
  const adminClient = new Client({
    connectionString: adminDatabaseUrl,
  })

  await adminClient.connect()
  await adminClient.query(`CREATE DATABASE "${databaseName}"`)
  await adminClient.end()

  return {
    connectionString: buildDatabaseUrl(adminDatabaseUrl, databaseName),
    databaseName,
  }
}

export async function dropTestDatabase(databaseName: string) {
  const adminDatabaseUrl =
    process.env.TEST_ADMIN_DATABASE_URL?.trim() || DEFAULT_ADMIN_DATABASE_URL
  const adminClient = new Client({
    connectionString: adminDatabaseUrl,
  })

  await adminClient.connect()
  await adminClient.query(
    `
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1
        AND pid <> pg_backend_pid()
    `,
    [databaseName],
  )
  await adminClient.query(`DROP DATABASE IF EXISTS "${databaseName}"`)
  await adminClient.end()
}
