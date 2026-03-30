import type { PulseSmartMoneyWalletDetail } from './types'

export type QuorumPrerenderedWalletPayload = {
  address: string
  data: PulseSmartMoneyWalletDetail
  generatedAt: string
}

declare global {
  interface Window {
    __QUORUM_PRERENDERED_WALLET__?: QuorumPrerenderedWalletPayload
  }
}

function escapeScriptJson(value: string) {
  return value
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
}

export function serializePrerenderedWalletPayload(
  payload: QuorumPrerenderedWalletPayload,
) {
  return escapeScriptJson(JSON.stringify(payload))
}

export function getPrerenderedWallet(address?: string) {
  if (typeof window === 'undefined' || !address) {
    return undefined
  }

  const payload = window.__QUORUM_PRERENDERED_WALLET__

  if (!payload || payload.address !== address.toLowerCase()) {
    return undefined
  }

  return payload.data
}
