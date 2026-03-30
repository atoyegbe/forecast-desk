import {
  DISPLAY_CURRENCIES,
  type PulseCurrencySnapshot,
  type PulseDisplayCurrency,
} from '../contracts/pulse-currency.js'
import {
  getFxApiBase,
  getFxCacheTtlMs,
} from '../db/config.js'
import { buildCacheKey, cached } from '../lib/cache.js'
import { fetchJson } from '../providers/shared.js'

type FrankfurterRate = {
  base?: string | null
  date?: string | null
  quote?: string | null
  rate?: number | string | null
}

let inFlightSnapshot: Promise<PulseCurrencySnapshot> | null = null
let lastKnownSnapshot: PulseCurrencySnapshot | null = null

function isDisplayCurrency(value: string): value is PulseDisplayCurrency {
  return DISPLAY_CURRENCIES.includes(value as PulseDisplayCurrency)
}

function createDefaultRates(): Record<PulseDisplayCurrency, number> {
  return Object.fromEntries(
    DISPLAY_CURRENCIES.map((currency) => [currency, currency === 'USD' ? 1 : 0]),
  ) as Record<PulseDisplayCurrency, number>
}

async function loadCurrencySnapshot() {
  const quoteCurrencies = DISPLAY_CURRENCIES.filter(
    (currency) => currency !== 'USD',
  ).join(',')
  const payload = await fetchJson<FrankfurterRate[]>(
    `${getFxApiBase()}/rates?base=USD&quotes=${quoteCurrencies}`,
  )
  const rates = createDefaultRates()
  let asOf = new Date().toISOString()

  for (const item of payload) {
    if (
      item.base?.toUpperCase() !== 'USD' ||
      typeof item.quote !== 'string' ||
      !isDisplayCurrency(item.quote.toUpperCase())
    ) {
      continue
    }

    const rate = Number(item.rate)

    if (!Number.isFinite(rate) || rate <= 0) {
      continue
    }

    const quoteCurrency = item.quote.toUpperCase() as PulseDisplayCurrency
    rates[quoteCurrency] = rate

    if (item.date) {
      asOf = new Date(`${item.date}T00:00:00.000Z`).toISOString()
    }
  }

  return {
    asOf,
    baseCurrency: 'USD',
    provider: 'frankfurter',
    rates,
  } satisfies PulseCurrencySnapshot
}

async function loadFreshCurrencySnapshot() {
  if (inFlightSnapshot) {
    return inFlightSnapshot
  }

  inFlightSnapshot = loadCurrencySnapshot()
    .then((snapshot) => {
      lastKnownSnapshot = snapshot
      return snapshot
    })
    .catch((error) => {
      if (lastKnownSnapshot) {
        return lastKnownSnapshot
      }

      throw error
    })
    .finally(() => {
      inFlightSnapshot = null
    })

  return inFlightSnapshot
}

export async function getCurrencySnapshot() {
  const cacheTtlSeconds = Math.max(60, Math.floor(getFxCacheTtlMs() / 1_000))

  return cached(
    buildCacheKey('currencies', 'snapshot', 'display'),
    cacheTtlSeconds,
    loadFreshCurrencySnapshot,
  )
}
