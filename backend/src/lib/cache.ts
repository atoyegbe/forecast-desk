import { createHash } from 'node:crypto'
import { isCacheEnabled } from '../db/config.js'
import { getRedisClient } from './redis.js'

function shouldBypassCache() {
  return !isCacheEnabled()
}

export function formatCacheKeyPart(value: unknown, fallback = 'all') {
  if (value === '*') {
    return '*'
  }

  if (value === undefined || value === null) {
    return fallback
  }

  const rawValue = String(value).trim().toLowerCase()

  if (!rawValue) {
    return fallback
  }

  const normalizedValue = rawValue
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (normalizedValue && normalizedValue.length <= 32) {
    return normalizedValue
  }

  return createHash('sha1')
    .update(rawValue)
    .digest('hex')
    .slice(0, 20)
}

export function buildCacheKey(...parts: unknown[]) {
  return parts.map((part) => formatCacheKeyPart(part)).join(':')
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (shouldBypassCache()) {
    return null
  }

  const redis = await getRedisClient()

  if (!redis) {
    return null
  }

  try {
    const rawValue = await redis.get(key)

    if (!rawValue) {
      return null
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[cache] hit ${key}`)
    }

    return JSON.parse(rawValue) as T
  } catch {
    return null
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (shouldBypassCache() || value === null || value === undefined) {
    return
  }

  const redis = await getRedisClient()

  if (!redis) {
    return
  }

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } catch {
    // Cache writes are best-effort.
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (shouldBypassCache()) {
    return
  }

  const redis = await getRedisClient()

  if (!redis) {
    return
  }

  try {
    await redis.del(key)
  } catch {
    // Cache deletes are best-effort.
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  if (shouldBypassCache()) {
    return
  }

  const redis = await getRedisClient()

  if (!redis) {
    return
  }

  try {
    const stream = redis.scanStream({
      count: 100,
      match: pattern,
    })
    const pendingDeletes: Array<Promise<number>> = []

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (keys: string[]) => {
        if (!keys.length) {
          return
        }

        pendingDeletes.push(redis.del(...keys))
      })

      stream.on('end', resolve)
      stream.on('error', reject)
    })

    if (pendingDeletes.length) {
      await Promise.allSettled(pendingDeletes)
    }
  } catch {
    // Pattern deletes are best-effort.
  }
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGet<T>(key)

  if (hit !== null) {
    return hit
  }

  const freshValue = await fetcher()
  await cacheSet(key, freshValue, ttlSeconds)
  return freshValue
}
