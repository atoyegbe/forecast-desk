import { getDbPool } from './pool.js'

const SMART_MONEY_LOCK_NAMESPACE = 42_205

export async function withSmartMoneyJobLock<T>(
  lockKey: string,
  task: () => Promise<T>,
) {
  const client = await getDbPool().connect()

  try {
    const result = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1, hashtext($2)) AS acquired',
      [SMART_MONEY_LOCK_NAMESPACE, lockKey],
    )

    if (!result.rows[0]?.acquired) {
      return null
    }

    try {
      return await task()
    } finally {
      await client.query(
        'SELECT pg_advisory_unlock($1, hashtext($2))',
        [SMART_MONEY_LOCK_NAMESPACE, lockKey],
      )
    }
  } finally {
    client.release()
  }
}
