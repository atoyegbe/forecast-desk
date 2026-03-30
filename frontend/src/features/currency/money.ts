import type {
  PulseEvent,
  PulseProvider,
} from '../events/types'
import type { PulseMoneyUnit } from './types'

export function getProviderMoneyUnit(provider: PulseProvider): PulseMoneyUnit {
  if (provider === 'manifold') {
    return 'MANA'
  }

  return 'USD'
}

export function getEventMoneyUnit(
  event: Pick<PulseEvent, 'provider'>,
): PulseMoneyUnit {
  return getProviderMoneyUnit(event.provider)
}
