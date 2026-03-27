import { Pool } from 'pg'
import { getDatabaseUrl } from './config.js'

let pool: Pool | null = null

export function getDbPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
    })
  }

  return pool
}

export async function closeDbPool() {
  if (!pool) {
    return
  }

  const activePool = pool
  pool = null
  await activePool.end()
}
