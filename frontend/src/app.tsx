import {
  Suspense,
  lazy,
} from 'react'
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { AppRouter } from './router'

const ReactQueryDevtools = lazy(async () => ({
  default: (await import('@tanstack/react-query-devtools')).ReactQueryDevtools,
}))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
      {import.meta.env.DEV ? (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      ) : null}
    </QueryClientProvider>
  )
}
