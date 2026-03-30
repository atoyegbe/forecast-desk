import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type Query,
  type QueryClient,
} from '@tanstack/react-query'

const QUERY_CACHE_STORAGE_KEY = 'quorum-query-cache'
const QUERY_CACHE_BUSTER = '2026-03-30-cache-v2'
const QUERY_CACHE_MAX_AGE_MS = 10 * 60_000
const QUERY_CACHE_SAVE_DELAY_MS = 1_000

type PersistedQueryCache = {
  buster: string
  clientState: DehydratedState
  timestamp: number
}

function isExpiredCache(timestamp: number) {
  return Date.now() - timestamp > QUERY_CACHE_MAX_AGE_MS
}

function shouldPersistQuery(
  query: Query<unknown, Error, unknown, readonly unknown[]>,
) {
  const [scope, segment] = query.queryKey

  if (query.state.status !== 'success' || query.state.data === undefined) {
    return false
  }

  if (scope === 'runtime') {
    return false
  }

  if (scope === 'alerts') {
    return false
  }

  if (scope === 'events' && (segment === 'price-history' || segment === 'movers')) {
    return false
  }

  return true
}

function removePersistedQueryCache() {
  window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY)
}

export function hydrateQueryClientFromStorage(queryClient: QueryClient) {
  if (typeof window === 'undefined') {
    return
  }

  const rawPersistedCache = window.localStorage.getItem(QUERY_CACHE_STORAGE_KEY)

  if (!rawPersistedCache) {
    return
  }

  try {
    const persistedCache = JSON.parse(rawPersistedCache) as PersistedQueryCache

    if (
      persistedCache.buster !== QUERY_CACHE_BUSTER ||
      isExpiredCache(persistedCache.timestamp)
    ) {
      removePersistedQueryCache()
      return
    }

    hydrate(queryClient, persistedCache.clientState)
  } catch {
    removePersistedQueryCache()
  }
}

function persistQueryClientToStorage(queryClient: QueryClient) {
  const clientState = dehydrate(queryClient, {
    shouldDehydrateQuery: shouldPersistQuery,
  })

  try {
    window.localStorage.setItem(
      QUERY_CACHE_STORAGE_KEY,
      JSON.stringify({
        buster: QUERY_CACHE_BUSTER,
        clientState,
        timestamp: Date.now(),
      } satisfies PersistedQueryCache),
    )
  } catch {
    removePersistedQueryCache()
  }
}

export function subscribeToQueryCachePersistence(queryClient: QueryClient) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  let persistTimeoutId: number | null = null

  const flushPersistence = () => {
    if (persistTimeoutId !== null) {
      window.clearTimeout(persistTimeoutId)
      persistTimeoutId = null
    }

    persistQueryClientToStorage(queryClient)
  }

  const schedulePersistence = () => {
    if (persistTimeoutId !== null) {
      window.clearTimeout(persistTimeoutId)
    }

    persistTimeoutId = window.setTimeout(
      flushPersistence,
      QUERY_CACHE_SAVE_DELAY_MS,
    )
  }

  const unsubscribe = queryClient.getQueryCache().subscribe(schedulePersistence)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      flushPersistence()
    }
  }

  window.addEventListener('beforeunload', flushPersistence)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    unsubscribe()
    window.removeEventListener('beforeunload', flushPersistence)
    document.removeEventListener('visibilitychange', handleVisibilityChange)

    if (persistTimeoutId !== null) {
      window.clearTimeout(persistTimeoutId)
    }
  }
}
