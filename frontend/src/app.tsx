import {
  Suspense,
  useEffect,
  lazy,
} from 'react'
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { AppRouter } from './router'
import {
  hydrateQueryClientFromStorage,
  subscribeToQueryCachePersistence,
} from './lib/query-persistence'
import { AuthProvider } from './features/auth/context'
import { DisplayCurrencyProvider } from './features/currency/context'

const ReactQueryDevtools = lazy(async () => ({
  default: (await import('@tanstack/react-query-devtools')).ReactQueryDevtools,
}))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 30 * 60_000,
      retry: 1,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
})

hydrateQueryClientFromStorage(queryClient)

export function App() {
  useEffect(() => {
    return subscribeToQueryCachePersistence(queryClient)
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DisplayCurrencyProvider>
          <AppRouter />
        </DisplayCurrencyProvider>
      </AuthProvider>
      {import.meta.env.DEV ? (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      ) : null}
    </QueryClientProvider>
  )
}
