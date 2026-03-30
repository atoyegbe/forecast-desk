const DEFAULT_DATABASE_URL = 'postgresql:///postgres'
const DEFAULT_ALERT_DELIVERY_INTERVAL_MS = 60 * 1000
const DEFAULT_DISCOVERY_REFRESH_INTERVAL_MS = 2 * 60 * 1000
const DEFAULT_FX_API_BASE = 'https://api.frankfurter.dev/v2'
const DEFAULT_FX_CACHE_TTL_MS = 30 * 60 * 1000
const DEFAULT_PULSE_AUTH_CODE_TTL_MINUTES = 15
const DEFAULT_PULSE_SESSION_TTL_DAYS = 30
const DEFAULT_PULSE_TELEGRAM_CONNECT_CODE_TTL_MINUTES = 15
const DEFAULT_PULSE_TELEGRAM_POLL_INTERVAL_MS = 15 * 1000
const DEFAULT_SMART_MONEY_SCHEDULER_ENABLED = true
const DEFAULT_SMART_MONEY_DISCOVERY_LOOKBACK_DAYS = 30
const DEFAULT_SMART_MONEY_DISCOVERY_WALLET_LIMIT = 40
const DEFAULT_SMART_MONEY_SIGNAL_WATCH_INTERVAL_MS = 5 * 60 * 1000
const DEFAULT_SMART_MONEY_SNAPSHOT_REFRESH_INTERVAL_MS = 30 * 60 * 1000
const DEFAULT_SMART_MONEY_LEADERBOARD_LIMIT = 20
const DEFAULT_SMART_MONEY_WATCH_WALLET_LIMIT = 100
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

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return fallback
}

export function getDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim()

  return value || DEFAULT_DATABASE_URL
}

export function getAlertDeliveryIntervalMs() {
  return parsePositiveInteger(
    process.env.ALERT_DELIVERY_INTERVAL_MS,
    DEFAULT_ALERT_DELIVERY_INTERVAL_MS,
  )
}

export function getDiscoveryRefreshIntervalMs() {
  return parsePositiveInteger(
    process.env.DISCOVERY_REFRESH_INTERVAL_MS,
    DEFAULT_DISCOVERY_REFRESH_INTERVAL_MS,
  )
}

export function getFxApiBase() {
  const value = process.env.FX_API_BASE?.trim()

  return value || DEFAULT_FX_API_BASE
}

export function getFxCacheTtlMs() {
  return parsePositiveInteger(
    process.env.FX_CACHE_TTL_MS,
    DEFAULT_FX_CACHE_TTL_MS,
  )
}

export function getPulseAuthCodeTtlMinutes() {
  return parsePositiveInteger(
    process.env.PULSE_AUTH_CODE_TTL_MINUTES,
    DEFAULT_PULSE_AUTH_CODE_TTL_MINUTES,
  )
}

export function getPulseAuthFrontendBaseUrl() {
  return process.env.PULSE_AUTH_FRONTEND_BASE_URL?.trim() || null
}

export function getPulseAuthTestMagicToken() {
  return process.env.PULSE_AUTH_TEST_MAGIC_TOKEN?.trim() || null
}

export function getPulseEmailFrom() {
  return process.env.PULSE_EMAIL_FROM?.trim() || 'alerts@quorum.local'
}

export function getPulseSessionTtlDays() {
  return parsePositiveInteger(
    process.env.PULSE_SESSION_TTL_DAYS,
    DEFAULT_PULSE_SESSION_TTL_DAYS,
  )
}

export function getPulseTelegramBotToken() {
  return process.env.PULSE_TELEGRAM_BOT_TOKEN?.trim() || null
}

export function getPulseTelegramBotUsername() {
  return process.env.PULSE_TELEGRAM_BOT_USERNAME?.trim() || null
}

export function getPulseTelegramConnectCodeTtlMinutes() {
  return parsePositiveInteger(
    process.env.PULSE_TELEGRAM_CONNECT_CODE_TTL_MINUTES,
    DEFAULT_PULSE_TELEGRAM_CONNECT_CODE_TTL_MINUTES,
  )
}

export function getPulseTelegramPollIntervalMs() {
  return parsePositiveInteger(
    process.env.PULSE_TELEGRAM_POLL_INTERVAL_MS,
    DEFAULT_PULSE_TELEGRAM_POLL_INTERVAL_MS,
  )
}

export function getResendApiKey() {
  return process.env.RESEND_API_KEY?.trim() || null
}

export function isSmartMoneySchedulerEnabled() {
  return parseBoolean(
    process.env.SMART_MONEY_SCHEDULER_ENABLED,
    DEFAULT_SMART_MONEY_SCHEDULER_ENABLED,
  )
}

export function getSmartMoneyDiscoveryLookbackDays() {
  return parsePositiveInteger(
    process.env.SMART_MONEY_DISCOVERY_LOOKBACK_DAYS,
    DEFAULT_SMART_MONEY_DISCOVERY_LOOKBACK_DAYS,
  )
}

export function getSmartMoneyDiscoveryWalletLimit() {
  return parsePositiveInteger(
    process.env.SMART_MONEY_DISCOVERY_WALLET_LIMIT,
    DEFAULT_SMART_MONEY_DISCOVERY_WALLET_LIMIT,
  )
}

export function getSmartMoneySignalWatchIntervalMs() {
  return parsePositiveInteger(
    process.env.SMART_MONEY_REFRESH_INTERVAL_MS,
    DEFAULT_SMART_MONEY_SIGNAL_WATCH_INTERVAL_MS,
  )
}

export function getSmartMoneySnapshotRefreshIntervalMs() {
  return parsePositiveInteger(
    process.env.SMART_MONEY_SNAPSHOT_REFRESH_INTERVAL_MS,
    DEFAULT_SMART_MONEY_SNAPSHOT_REFRESH_INTERVAL_MS,
  )
}

export function getSmartMoneyLeaderboardLimit() {
  return parsePositiveInteger(
    process.env.SMART_MONEY_LEADERBOARD_LIMIT,
    DEFAULT_SMART_MONEY_LEADERBOARD_LIMIT,
  )
}

export function getSmartMoneyWatchWalletLimit() {
  return parsePositiveInteger(
    process.env.SMART_MONEY_WATCH_WALLET_LIMIT,
    DEFAULT_SMART_MONEY_WATCH_WALLET_LIMIT,
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
  DEFAULT_ALERT_DELIVERY_INTERVAL_MS,
  DEFAULT_DISCOVERY_REFRESH_INTERVAL_MS,
  DEFAULT_FX_API_BASE,
  DEFAULT_FX_CACHE_TTL_MS,
  DEFAULT_PULSE_AUTH_CODE_TTL_MINUTES,
  DEFAULT_PULSE_SESSION_TTL_DAYS,
  DEFAULT_PULSE_TELEGRAM_CONNECT_CODE_TTL_MINUTES,
  DEFAULT_PULSE_TELEGRAM_POLL_INTERVAL_MS,
  DEFAULT_SMART_MONEY_ACTIVITY_LOOKBACK_DAYS,
  DEFAULT_SMART_MONEY_DISCOVERY_LOOKBACK_DAYS,
  DEFAULT_SMART_MONEY_DISCOVERY_WALLET_LIMIT,
  DEFAULT_SMART_MONEY_LEADERBOARD_LIMIT,
  DEFAULT_SMART_MONEY_MIN_SIGNAL_SIZE_USD,
  DEFAULT_SMART_MONEY_SCHEDULER_ENABLED,
  DEFAULT_SMART_MONEY_SIGNAL_WATCH_INTERVAL_MS,
  DEFAULT_SMART_MONEY_SNAPSHOT_REFRESH_INTERVAL_MS,
  DEFAULT_SMART_MONEY_WATCH_WALLET_LIMIT,
}
