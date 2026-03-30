import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  formatCompactCurrency,
  formatCompactToken,
} from '../../lib/format'
import { useCurrenciesQuery } from './hooks'
import {
  DISPLAY_CURRENCIES,
  type PulseDisplayCurrency,
  type PulseMoneyUnit,
} from './types'

const DISPLAY_CURRENCY_STORAGE_KEY = 'quorum-display-currency'

type DisplayCurrencyContextValue = {
  availableCurrencies: PulseDisplayCurrency[]
  convertMoney: (value: number, sourceCurrency?: PulseMoneyUnit) => number
  displayCurrency: PulseDisplayCurrency
  formatMoney: (value: number, sourceCurrency?: PulseMoneyUnit) => string
  formatMoneyChange: (value: number, sourceCurrency?: PulseMoneyUnit) => string
  setDisplayCurrency: (currency: PulseDisplayCurrency) => void
}

const DisplayCurrencyContext = createContext<DisplayCurrencyContextValue | null>(
  null,
)

const EURO_REGIONS = new Set([
  'AT',
  'BE',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PT',
  'SI',
  'SK',
])

function getBrowserRegion(locale: string) {
  try {
    return new Intl.Locale(locale).region?.toUpperCase() ?? null
  } catch {
    const fallbackRegion = locale.split('-')[1]

    return fallbackRegion ? fallbackRegion.toUpperCase() : null
  }
}

function getNumberLocale() {
  return window.navigator.languages?.[0] ?? window.navigator.language ?? 'en-NG'
}

function getDefaultDisplayCurrency(): PulseDisplayCurrency {
  const localeCandidates = [
    ...(window.navigator.languages ?? []),
    window.navigator.language,
  ].filter(Boolean)

  for (const locale of localeCandidates) {
    const region = getBrowserRegion(locale)

    if (!region) {
      continue
    }

    if (region === 'NG') {
      return 'NGN'
    }

    if (region === 'GB') {
      return 'GBP'
    }

    if (region === 'CA') {
      return 'CAD'
    }

    if (region === 'AU') {
      return 'AUD'
    }

    if (region === 'JP') {
      return 'JPY'
    }

    if (region === 'CH') {
      return 'CHF'
    }

    if (region === 'SG') {
      return 'SGD'
    }

    if (EURO_REGIONS.has(region)) {
      return 'EUR'
    }
  }

  return 'USD'
}

function getInitialDisplayCurrency(): PulseDisplayCurrency {
  const storedCurrency = window.localStorage.getItem(DISPLAY_CURRENCY_STORAGE_KEY)

  if (
    storedCurrency &&
    DISPLAY_CURRENCIES.includes(storedCurrency as PulseDisplayCurrency)
  ) {
    return storedCurrency as PulseDisplayCurrency
  }

  return getDefaultDisplayCurrency()
}

function normalizeMoneyUnit(sourceCurrency: PulseMoneyUnit | undefined) {
  if (sourceCurrency === 'USDC') {
    return 'USD'
  }

  return sourceCurrency ?? 'USD'
}

export function DisplayCurrencyProvider({
  children,
}: {
  children: ReactNode
}) {
  const [displayCurrency, setDisplayCurrency] = useState<PulseDisplayCurrency>(
    getInitialDisplayCurrency,
  )
  const currenciesQuery = useCurrenciesQuery()
  const rates = currenciesQuery.data?.rates
  const resolvedDisplayCurrency =
    rates && rates[displayCurrency] > 0 ? displayCurrency : 'USD'
  const availableCurrencies = DISPLAY_CURRENCIES.filter((currency) => {
    if (!rates) {
      return true
    }

    return currency === 'USD' || rates[currency] > 0
  })

  useEffect(() => {
    window.localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY, displayCurrency)
  }, [displayCurrency])

  const convertMoney = (value: number, sourceCurrency: PulseMoneyUnit = 'USD') => {
    if (!Number.isFinite(value)) {
      return 0
    }

    const normalizedSourceCurrency = normalizeMoneyUnit(sourceCurrency)

    if (normalizedSourceCurrency === 'MANA' || !rates) {
      return value
    }

    const sourceRate =
      normalizedSourceCurrency === 'USD' ? 1 : rates[normalizedSourceCurrency]
    const targetRate =
      resolvedDisplayCurrency === 'USD' ? 1 : rates[resolvedDisplayCurrency]

    if (!Number.isFinite(sourceRate) || sourceRate <= 0) {
      return value
    }

    const usdValue = value / sourceRate

    return usdValue * targetRate
  }

  const formatMoney = (value: number, sourceCurrency: PulseMoneyUnit = 'USD') => {
    if (!Number.isFinite(value)) {
      return '—'
    }

    const normalizedSourceCurrency = normalizeMoneyUnit(sourceCurrency)

    if (normalizedSourceCurrency === 'MANA') {
      return formatCompactToken(value, 'MANA', getNumberLocale())
    }

    return formatCompactCurrency(
      convertMoney(value, normalizedSourceCurrency),
      resolvedDisplayCurrency,
      getNumberLocale(),
    )
  }

  const formatMoneyChange = (
    value: number,
    sourceCurrency: PulseMoneyUnit = 'USD',
  ) => {
    if (!Number.isFinite(value)) {
      return '—'
    }

    const absolute = formatMoney(Math.abs(value), sourceCurrency)

    if (value > 0) {
      return `+${absolute}`
    }

    if (value < 0) {
      return `-${absolute}`
    }

    return absolute
  }

  return (
    <DisplayCurrencyContext.Provider
      value={{
        availableCurrencies,
        convertMoney,
        displayCurrency: resolvedDisplayCurrency,
        formatMoney,
        formatMoneyChange,
        setDisplayCurrency,
      }}
    >
      {children}
    </DisplayCurrencyContext.Provider>
  )
}

export function useDisplayCurrency() {
  const context = useContext(DisplayCurrencyContext)

  if (!context) {
    throw new Error('useDisplayCurrency must be used within DisplayCurrencyProvider')
  }

  return context
}
