import {
  Suspense,
  useEffect,
  lazy,
} from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { AppRouter } from './router'
import { subscribeToQueryCachePersistence } from './lib/query-persistence'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './features/auth/context'
import { ToastProvider } from './components/toast-provider'
import { DisplayCurrencyProvider } from './features/currency/context'

const ReactQueryDevtools = lazy(async () => ({
  default: (await import('@tanstack/react-query-devtools')).ReactQueryDevtools,
}))

export function App() {
  useEffect(() => {
    return subscribeToQueryCachePersistence(queryClient)
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <DisplayCurrencyProvider>
            <AppRouter />
          </DisplayCurrencyProvider>
        </AuthProvider>
      </ToastProvider>
      {import.meta.env.DEV ? (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      ) : null}
    </QueryClientProvider>
  )
}
