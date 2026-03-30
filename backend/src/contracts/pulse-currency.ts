export const DISPLAY_CURRENCIES = [
  'USD',
  'NGN',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'JPY',
  'CHF',
  'SGD',
] as const

export type PulseDisplayCurrency = (typeof DISPLAY_CURRENCIES)[number]

export type PulseCurrencySnapshot = {
  asOf: string
  baseCurrency: 'USD'
  provider: 'frankfurter'
  rates: Record<PulseDisplayCurrency, number>
}
