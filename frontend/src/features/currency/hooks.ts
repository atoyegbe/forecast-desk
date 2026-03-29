import { useQuery } from '@tanstack/react-query'
import { getCurrencySnapshot } from './api'

const CURRENCY_QUERY_KEY = ['currencies'] as const

export function useCurrenciesQuery() {
  return useQuery({
    queryFn: getCurrencySnapshot,
    queryKey: CURRENCY_QUERY_KEY,
    staleTime: 30 * 60_000,
    refetchInterval: 30 * 60_000,
  })
}
