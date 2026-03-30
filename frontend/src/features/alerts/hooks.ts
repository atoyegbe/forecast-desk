import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useAuth } from '../auth/context'
import {
  createAlertSubscription,
  deleteAlertSubscription,
  listAlertSubscriptions,
  listRecentAlertDeliveries,
  updateAlertSubscription,
} from './api'
import type {
  PulseAlertSubscriptionCreateInput,
  PulseAlertSubscriptionUpdateInput,
} from './types'

const ALERTS_QUERY_ROOT = ['alerts'] as const

export const alertKeys = {
  all: ALERTS_QUERY_ROOT,
  recentDeliveries: [...ALERTS_QUERY_ROOT, 'recent-deliveries'] as const,
  subscriptions: [...ALERTS_QUERY_ROOT, 'subscriptions'] as const,
}

export function useAlertSubscriptionsQuery() {
  const { sessionToken } = useAuth()

  return useQuery({
    enabled: Boolean(sessionToken),
    queryFn: () => listAlertSubscriptions(sessionToken!),
    queryKey: alertKeys.subscriptions,
    staleTime: 60_000,
  })
}

export function useCreateAlertSubscriptionMutation() {
  const { sessionToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: PulseAlertSubscriptionCreateInput) => {
      if (!sessionToken) {
        throw new Error('Sign in to create alerts.')
      }

      return createAlertSubscription(sessionToken, input)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: alertKeys.all,
      })
    },
  })
}

export function useDeleteAlertSubscriptionMutation() {
  const { sessionToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (subscriptionId: string) => {
      if (!sessionToken) {
        throw new Error('Sign in to manage alerts.')
      }

      return deleteAlertSubscription(sessionToken, subscriptionId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: alertKeys.all,
      })
    },
  })
}

export function useUpdateAlertSubscriptionMutation() {
  const { sessionToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      subscriptionId: string
      update: PulseAlertSubscriptionUpdateInput
    }) => {
      if (!sessionToken) {
        throw new Error('Sign in to manage alerts.')
      }

      return updateAlertSubscription(sessionToken, input.subscriptionId, input.update)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: alertKeys.all,
      })
    },
  })
}

export function useRecentAlertDeliveriesQuery() {
  const { sessionToken } = useAuth()

  return useQuery({
    enabled: Boolean(sessionToken),
    queryFn: () => listRecentAlertDeliveries(sessionToken!),
    queryKey: alertKeys.recentDeliveries,
    staleTime: 60_000,
  })
}
