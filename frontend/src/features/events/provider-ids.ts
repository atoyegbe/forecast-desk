import type { PulseProvider } from './types'

const PROVIDER_SEPARATOR = '__'

const PROVIDER_LABELS: Record<PulseProvider, string> = {
  bayse: 'Bayse',
  polymarket: 'Polymarket',
}

export function buildProviderScopedId(provider: PulseProvider, providerId: string) {
  return `${provider}${PROVIDER_SEPARATOR}${providerId}`
}

export function parseProviderScopedId(scopedId: string) {
  if (scopedId.startsWith(`polymarket${PROVIDER_SEPARATOR}`)) {
    return {
      provider: 'polymarket' as const,
      providerId: scopedId.slice(`polymarket${PROVIDER_SEPARATOR}`.length),
    }
  }

  if (scopedId.startsWith(`bayse${PROVIDER_SEPARATOR}`)) {
    return {
      provider: 'bayse' as const,
      providerId: scopedId.slice(`bayse${PROVIDER_SEPARATOR}`.length),
    }
  }

  return {
    provider: 'bayse' as const,
    providerId: scopedId,
  }
}

export function getProviderLabel(provider: PulseProvider) {
  return PROVIDER_LABELS[provider]
}
