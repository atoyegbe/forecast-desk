import { QueryClient } from '@tanstack/react-query'
import { hydrateQueryClientFromStorage } from './query-persistence'

export const queryClient = new QueryClient({
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
