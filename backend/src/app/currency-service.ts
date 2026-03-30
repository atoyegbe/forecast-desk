import {
  DISPLAY_CURRENCIES,
  type PulseCurrencySnapshot,
  type PulseDisplayCurrency,
} from '../contracts/pulse-currency.js'
import {
  getFxApiBase,
  getFxCacheTtlMs,
} from '../db/config.js'
import { fetchJson } from '../providers/shared.js'

type FrankfurterRate = {
  base?: string | null
  date?: string | null
  quote?: string | null
  rate?: number | string | null
}

let cachedSnapshot: PulseCurrencySnapshot | null = null
let cachedAt = 0
let inFlightSnapshot: Promise<PulseCurrencySnapshot> | null = null

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

export async function getCurrencySnapshot() {
  const cacheTtlMs = getFxCacheTtlMs()

  if (cachedSnapshot && Date.now() - cachedAt < cacheTtlMs) {
    return cachedSnapshot
  }

  if (inFlightSnapshot) {
    return inFlightSnapshot
  }

  inFlightSnapshot = loadCurrencySnapshot()
    .then((snapshot) => {
      cachedSnapshot = snapshot
      cachedAt = Date.now()

      return snapshot
    })
    .catch((error) => {
      if (cachedSnapshot) {
        return cachedSnapshot
      }

      throw error
    })
    .finally(() => {
      inFlightSnapshot = null
    })

  return inFlightSnapshot
}
