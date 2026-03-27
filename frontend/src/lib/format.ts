const compactNumberFormatter = new Intl.NumberFormat('en-NG', {
  maximumFractionDigits: 1,
  notation: 'compact',
})

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
