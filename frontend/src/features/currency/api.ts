import { fetchBackendJson } from '../../lib/api-client'
import type { PulseCurrencySnapshot } from './types'

export async function getCurrencySnapshot() {
  const response = await fetchBackendJson<PulseCurrencySnapshot>('/currencies')

  return response.data
}
