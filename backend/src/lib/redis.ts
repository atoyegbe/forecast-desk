import { Redis } from 'ioredis'
import {
  getRedisHost,
  getRedisPassword,
  getRedisPort,
  getRedisUrl,
  isCacheEnabled,
} from '../db/config.js'

const loggedMessages = new Set<string>()

function logOnce(message: string, error?: unknown) {
  if (loggedMessages.has(message)) {
    return
  }

  loggedMessages.add(message)

  if (error) {
    console.warn(message, error)
    return
  }

  console.warn(message)
}

function createRedisClient() {
  if (!isCacheEnabled()) {
    return null
  }

  const redisUrl = getRedisUrl()
  const redisHost = getRedisHost()
  const redisPassword = getRedisPassword() ?? undefined
  const redisPort = getRedisPort()

  if (!redisUrl && !redisHost) {
    return null
  }

  const client = redisUrl
    ? new Redis(redisUrl, {
        enableOfflineQueue: false,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
      })
    : new Redis({
        enableOfflineQueue: false,
        host: redisHost ?? 'localhost',
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        password: redisPassword,
        port: redisPort,
      })

  client.on('error', (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    logOnce(`[Redis] Connection error: ${message}`)
  })

  client.on('connect', () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Redis] Connected')
    }
  })

  return client
}

const redis = createRedisClient()
let connectPromise: Promise<Redis | null> | null = null

export async function getRedisClient() {
  if (!redis) {
    return null
  }

  if (redis.status === 'ready' || redis.status === 'connect') {
    return redis
  }

  if (!connectPromise) {
    connectPromise = redis.connect()
      .then(() => redis)
      .catch((error: unknown) => {
        logOnce('[Redis] Failed to connect. Cache will be bypassed.', error)
        return null
      })
      .finally(() => {
        connectPromise = null
      })
  }

  return connectPromise
}

export default redis
