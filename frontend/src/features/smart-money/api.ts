import { fetchBackendJson } from '../../lib/api-client'
import type {
  PulseSmartMoneySignal,
  PulseSmartMoneySignalListParams,
  PulseSmartMoneyWallet,
  PulseSmartMoneyWalletDetail,
  PulseSmartMoneyWalletListParams,
} from './types'

function buildSignalQueryString(params: PulseSmartMoneySignalListParams = {}) {
  const searchParams = new URLSearchParams()

  if (params.category) {
    searchParams.set('category', params.category)
  }

  if (params.limit !== undefined) {
    searchParams.set('limit', String(params.limit))
  }

  if (params.minScore !== undefined) {
    searchParams.set('minScore', String(params.minScore))
  }

  if (params.minSize !== undefined) {
    searchParams.set('minSize', String(params.minSize))
  }

  if (params.sort) {
    searchParams.set('sort', params.sort)
  }

  const query = searchParams.toString()

  return query ? `?${query}` : ''
}

function buildWalletQueryString(params: PulseSmartMoneyWalletListParams = {}) {
  const searchParams = new URLSearchParams()

  if (params.limit !== undefined) {
    searchParams.set('limit', String(params.limit))
  }

  if (params.minScore !== undefined) {
    searchParams.set('minScore', String(params.minScore))
  }

  if (params.minVolume !== undefined) {
    searchParams.set('minVolume', String(params.minVolume))
  }

  const query = searchParams.toString()

  return query ? `?${query}` : ''
}

export async function listSmartMoneySignals(
  params: PulseSmartMoneySignalListParams = {},
) {
  const response = await fetchBackendJson<{ items: PulseSmartMoneySignal[] }>(
    `/smart-money/signals${buildSignalQueryString(params)}`,
  )

  return response.data.items
}

export async function listSmartMoneyWallets(
  params: PulseSmartMoneyWalletListParams = {},
) {
  const response = await fetchBackendJson<{ items: PulseSmartMoneyWallet[] }>(
    `/smart-money/wallets${buildWalletQueryString(params)}`,
  )

  return response.data.items
}

export async function getSmartMoneyWallet(address: string) {
  const response = await fetchBackendJson<PulseSmartMoneyWalletDetail>(
    `/smart-money/wallets/${encodeURIComponent(address.toLowerCase())}`,
  )

  return response.data
}
