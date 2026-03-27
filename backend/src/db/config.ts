const DEFAULT_DATABASE_URL = 'postgresql:///postgres'
const DEFAULT_DISCOVERY_REFRESH_INTERVAL_MS = 2 * 60 * 1000
const DEFAULT_SMART_MONEY_REFRESH_INTERVAL_MS = 5 * 60 * 1000
const DEFAULT_SMART_MONEY_LEADERBOARD_LIMIT = 20
const DEFAULT_SMART_MONEY_ACTIVITY_LOOKBACK_DAYS = 7
const DEFAULT_SMART_MONEY_MIN_SIGNAL_SIZE_USD = 500

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

function parsePositiveFloat(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseFloat(value)

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

export function getSmartMoneyRefreshIntervalMs() {
  return parsePositiveInteger(
    process.env.SMART_MONEY_REFRESH_INTERVAL_MS,
    DEFAULT_SMART_MONEY_REFRESH_INTERVAL_MS,
  )
}

export function getSmartMoneyLeaderboardLimit() {
  return parsePositiveInteger(
    process.env.SMART_MONEY_LEADERBOARD_LIMIT,
    DEFAULT_SMART_MONEY_LEADERBOARD_LIMIT,
  )
}

export function getSmartMoneyActivityLookbackDays() {
  return parsePositiveInteger(
    process.env.SMART_MONEY_ACTIVITY_LOOKBACK_DAYS,
    DEFAULT_SMART_MONEY_ACTIVITY_LOOKBACK_DAYS,
  )
}

export function getSmartMoneyMinSignalSizeUsd() {
  return parsePositiveFloat(
    process.env.SMART_MONEY_MIN_SIGNAL_SIZE_USD,
    DEFAULT_SMART_MONEY_MIN_SIGNAL_SIZE_USD,
  )
}

export {
  DEFAULT_DATABASE_URL,
  DEFAULT_DISCOVERY_REFRESH_INTERVAL_MS,
  DEFAULT_SMART_MONEY_ACTIVITY_LOOKBACK_DAYS,
  DEFAULT_SMART_MONEY_LEADERBOARD_LIMIT,
  DEFAULT_SMART_MONEY_MIN_SIGNAL_SIZE_USD,
  DEFAULT_SMART_MONEY_REFRESH_INTERVAL_MS,
}
