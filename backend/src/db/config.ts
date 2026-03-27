const DEFAULT_DATABASE_URL = 'postgresql:///postgres'
const DEFAULT_DISCOVERY_REFRESH_INTERVAL_MS = 2 * 60 * 1000

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

export function getDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim()

  return value || DEFAULT_DATABASE_URL
}

export function getDiscoveryRefreshIntervalMs() {
  return parsePositiveInteger(
    process.env.DISCOVERY_REFRESH_INTERVAL_MS,
    DEFAULT_DISCOVERY_REFRESH_INTERVAL_MS,
  )
}

export {
  DEFAULT_DATABASE_URL,
  DEFAULT_DISCOVERY_REFRESH_INTERVAL_MS,
}
