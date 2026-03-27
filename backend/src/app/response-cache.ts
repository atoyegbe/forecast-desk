import type {
  FastifyReply,
  FastifyRequest,
} from 'fastify'

type CacheEntry = {
  expiresAt: number
  value: unknown
}

export type HttpCachePolicy = {
  maxAgeSeconds: number
  staleWhileRevalidateSeconds: number
}

const responseCache = new Map<string, CacheEntry>()

function getCachedValue<T>(cacheKey: string) {
  const cacheEntry = responseCache.get(cacheKey)

  if (!cacheEntry) {
    return null
  }

  if (cacheEntry.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey)
    return null
  }

  return cacheEntry.value as T
}

function setCachedValue<T>(
  cacheKey: string,
  value: T,
  ttlMs: number,
) {
  responseCache.set(cacheKey, {
    expiresAt: Date.now() + ttlMs,
    value,
  })
}

export function invalidateCachedResponses(prefix: string) {
  for (const cacheKey of responseCache.keys()) {
    if (cacheKey.startsWith(prefix)) {
      responseCache.delete(cacheKey)
    }
  }
}

export function applyHttpCacheHeaders(
  reply: FastifyReply,
  policy: HttpCachePolicy,
) {
  reply.header(
    'Cache-Control',
    `public, max-age=${policy.maxAgeSeconds}, stale-while-revalidate=${policy.staleWhileRevalidateSeconds}`,
  )
}

export function buildRequestCacheKey(request: FastifyRequest) {
  return request.url
}

export async function withCachedResponse<T>(
  cacheKey: string,
  policy: HttpCachePolicy,
  loadValue: () => Promise<T>,
) {
  const cachedValue = getCachedValue<T>(cacheKey)

  if (cachedValue !== null) {
    return cachedValue
  }

  const freshValue = await loadValue()
  setCachedValue(cacheKey, freshValue, policy.maxAgeSeconds * 1_000)

  return freshValue
}
