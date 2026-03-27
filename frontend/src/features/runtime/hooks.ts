import { useQuery } from '@tanstack/react-query'
import { getBackendHealth } from './api'

export function useBackendHealthQuery() {
  return useQuery({
    queryKey: ['runtime', 'backend-health'],
    queryFn: getBackendHealth,
    retry: false,
    staleTime: 30_000,
  })
}
