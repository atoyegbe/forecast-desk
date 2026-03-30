const compactNumberFormatter = new Intl.NumberFormat('en-NG', {
  maximumFractionDigits: 1,
  notation: 'compact',
})

const compactCurrencyFormatterCache = new Map<string, Intl.NumberFormat>()
const compactTokenFormatterCache = new Map<string, Intl.NumberFormat>()

const dateFormatter = new Intl.DateTimeFormat('en-NG', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('en-NG', {
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  month: 'short',
})

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en-NG', {
  numeric: 'auto',
})

export function formatProbability(value: number) {
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`
}

export function formatSignedProbabilityChange(value: number) {
  const points = value * 100
  const sign = points > 0 ? '+' : points < 0 ? '-' : ''

  return `${sign}${Math.abs(points).toFixed(Math.abs(points) < 10 ? 1 : 0)} pts`
}

export function formatProbabilityPoints(value: number) {
  const points = value * 100

  return `${points.toFixed(points < 10 ? 1 : 0)} pts`
}

export function formatCompactNumber(value: number) {
  return compactNumberFormatter.format(value)
}

function getCompactCurrencyFormatter(
  currency: string,
  locale = 'en-NG',
  maximumFractionDigits = 0,
) {
  const cacheKey = `${locale}:${currency}:${maximumFractionDigits}`
  const cachedFormatter = compactCurrencyFormatterCache.get(cacheKey)

  if (cachedFormatter) {
    return cachedFormatter
  }

  const formatter = new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits,
    notation: 'compact',
    style: 'currency',
  })
  compactCurrencyFormatterCache.set(cacheKey, formatter)

  return formatter
}

function getCompactTokenFormatter(locale = 'en-NG') {
  const cachedFormatter = compactTokenFormatterCache.get(locale)

  if (cachedFormatter) {
    return cachedFormatter
  }

  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    notation: 'compact',
  })
  compactTokenFormatterCache.set(locale, formatter)

  return formatter
}

export function formatCompactCurrency(
  value: number,
  currency = 'USD',
  locale = 'en-NG',
) {
  return getCompactCurrencyFormatter(currency, locale).format(value)
}

export function formatCompactToken(
  value: number,
  token = 'MANA',
  locale = 'en-NG',
) {
  return `${getCompactTokenFormatter(locale).format(value)} ${token}`
}

export function formatDate(value?: string | number | null) {
  if (!value) return 'TBD'

  return dateFormatter.format(new Date(value))
}

export function formatDateTime(value?: string | number | null) {
  if (!value) return 'Awaiting schedule'

  return dateTimeFormatter.format(new Date(value))
}

export function formatRelativeTime(value?: number | null) {
  if (!value) return 'Waiting for live updates'

  const diffMs = value - Date.now()
  const diffMinutes = Math.round(diffMs / 60_000)

  if (Math.abs(diffMinutes) < 60) {
    return relativeTimeFormatter.format(diffMinutes, 'minute')
  }

  const diffHours = Math.round(diffMinutes / 60)

  return relativeTimeFormatter.format(diffHours, 'hour')
}

export function formatTimeAgo(value?: string | number | null) {
  if (!value) {
    return 'just now'
  }

  const diffMs = Date.now() - new Date(value).getTime()
  const diffMinutes = Math.round(diffMs / 60_000)

  if (Math.abs(diffMinutes) < 60) {
    return relativeTimeFormatter.format(-diffMinutes, 'minute')
  }

  const diffHours = Math.round(diffMinutes / 60)

  if (Math.abs(diffHours) < 48) {
    return relativeTimeFormatter.format(-diffHours, 'hour')
  }

  const diffDays = Math.round(diffHours / 24)

  return relativeTimeFormatter.format(-diffDays, 'day')
}

export function formatClosingCountdown(value?: string | number | null) {
  if (!value) return 'TBD'

  const diffMs = new Date(value).getTime() - Date.now()

  if (diffMs <= 0) {
    return 'Closed'
  }

  const diffMinutes = Math.round(diffMs / 60_000)

  if (diffMinutes < 60) {
    return `in ${diffMinutes}m`
  }

  const diffHours = Math.round(diffMinutes / 60)

  if (diffHours < 48) {
    return `in ${diffHours}h`
  }

  const diffDays = Math.round(diffHours / 24)

  return `in ${diffDays}d`
}

export function formatCategory(label: string) {
  return label
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(' ')
}

export function formatChartTick(timestamp: number) {
  return new Intl.DateTimeFormat('en-NG', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

export function formatWalletAddress(address: string) {
  if (address.length <= 12) {
    return address
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatSignedPercent(value: number) {
  const percentage = value * 100
  const sign = percentage > 0 ? '+' : percentage < 0 ? '-' : ''

  return `${sign}${Math.abs(percentage).toFixed(Math.abs(percentage) < 10 ? 1 : 0)}%`
}
