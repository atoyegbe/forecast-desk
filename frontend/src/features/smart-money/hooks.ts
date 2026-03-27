import { useQuery } from '@tanstack/react-query'
import {
  getSmartMoneyWallet,
  listSmartMoneySignals,
  listSmartMoneyWallets,
} from './api'
import type {
  PulseSmartMoneySignalListParams,
  PulseSmartMoneyWalletListParams,
} from './types'

const smartMoneyKeys = {
  all: ['smart-money'] as const,
  signals: (params: PulseSmartMoneySignalListParams) =>
    [...smartMoneyKeys.all, 'signals', params] as const,
  wallet: (address: string) =>
    [...smartMoneyKeys.all, 'wallet', address.toLowerCase()] as const,
  wallets: (params: PulseSmartMoneyWalletListParams) =>
    [...smartMoneyKeys.all, 'wallets', params] as const,
}

export function useSmartMoneySignalsQuery(params: PulseSmartMoneySignalListParams) {
  return useQuery({
    queryFn: () => listSmartMoneySignals(params),
    queryKey: smartMoneyKeys.signals(params),
    staleTime: 180_000,
    refetchInterval: 240_000,
  })
}

export function useSmartMoneyWalletsQuery(params: PulseSmartMoneyWalletListParams) {
  return useQuery({
    queryFn: () => listSmartMoneyWallets(params),
    queryKey: smartMoneyKeys.wallets(params),
    staleTime: 180_000,
    refetchInterval: 240_000,
  })
}

export function useSmartMoneyWalletQuery(address?: string) {
  return useQuery({
    enabled: Boolean(address),
    queryFn: () => getSmartMoneyWallet(address!),
    queryKey: address
      ? smartMoneyKeys.wallet(address)
      : smartMoneyKeys.wallet('missing'),
    staleTime: 180_000,
  })
}
