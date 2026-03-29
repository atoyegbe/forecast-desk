import type { PoolClient } from 'pg'
import type {
  PulseSmartMoneyCategoryStat,
  PulseSmartMoneyPosition,
  PulseSmartMoneySignal,
  PulseSmartMoneySignalListParams,
  PulseSmartMoneyWallet,
  PulseSmartMoneyWalletDetail,
  PulseSmartMoneyWalletListParams,
} from '../contracts/pulse-smart-money.js'
import type { PulseFreshness } from '../contracts/pulse-events.js'
import { getSmartMoneySnapshotRefreshIntervalMs } from './config.js'
import { getDbPool } from './pool.js'

type Queryable = {
  query: PoolClient['query']
}

type WalletRow = {
  address: string
  category_stats_json: unknown
  closed_position_count: number
  display_name: string | null
  last_active_at: Date | string | null
  market_count: number
  open_position_count: number
  profile_image_url: string | null
  rank: number
  recency_score: number
  roi: number
  score: number
  source_pnl: number
  source_rank: number | null
  source_volume: number
  synced_at: Date | string
  total_volume: number
  verified_badge: boolean
  win_rate: number
  x_username: string | null
}

type PositionRow = {
  avg_price: number
  category: string
  closing_date: Date | string | null
  condition_id: string
  current_price: number
  current_value: number
  entry_value: number
  event_id: string | null
  event_slug: string
  icon_url: string | null
  market_title: string
  outcome: string
  position_timestamp: Date | string | null
  provider: 'polymarket'
  provider_event_id: string | null
  realized_pnl: number
  share_count: number
  status: 'closed' | 'open'
  cash_pnl: number
}

type SignalRow = {
  category: string
  closing_date: Date | string | null
  current_price: number
  entry_price: number
  event_id: string | null
  event_slug: string
  icon_url: string | null
  id: string
  market_title: string
  outcome: string
  price_delta: number
  provider: 'polymarket'
  provider_event_id: string | null
  signal_timestamp: Date | string
  size_usd: number
  wallet_address: string
  wallet_display_name: string | null
  wallet_profile_image_url: string | null
  wallet_rank: number
  wallet_score: number
  wallet_verified: boolean
}

export type SmartMoneySyncState = {
  lastError?: string | null
  lastRunAt?: string | null
  lastSuccessAt?: string | null
  syncKey: string
}

export type StoredSmartMoneyWalletInput = {
  address: string
  categoryStats: PulseSmartMoneyCategoryStat[]
  closedPositionCount: number
  displayName?: string | null
  lastActiveAt?: string | null
  marketCount: number
  openPositionCount: number
  profileImageUrl?: string | null
  rank: number
  recencyScore: number
  roi: number
  score: number
  sourcePnl: number
  sourceRank?: number | null
  sourceVolume: number
  totalVolume: number
  verifiedBadge: boolean
  winRate: number
  xUsername?: string | null
}

export type StoredSmartMoneyPositionInput = {
  avgPrice: number
  category: string
  closingDate?: string | null
  conditionId: string
  currentPrice: number
  currentValue: number
  entryValue: number
  eventId?: string | null
  eventSlug: string
  iconUrl?: string | null
  marketTitle: string
  outcome: 'NO' | 'YES'
  positionKey: string
  providerEventId?: string | null
  realizedPnl: number
  shareCount: number
  status: 'closed' | 'open'
  timestamp?: string | null
  walletAddress: string
  pnl: number
}

export type StoredSmartMoneySignalInput = {
  category: string
  closingDate?: string | null
  conditionId: string
  currentPrice: number
  entryPrice: number
  eventId?: string | null
  eventSlug: string
  iconUrl?: string | null
  id: string
  marketTitle: string
  outcome: 'NO' | 'YES'
  priceDelta: number
  providerEventId?: string | null
  signalAt: string
  size: number
  transactionHash?: string | null
  walletAddress: string
}

function parsePositiveInteger(value: number | string | undefined, fallback: number) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
  }

  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parsePositiveFloat(value: number | string | undefined, fallback = 0) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : fallback
  }

  if (!value) {
    return fallback
  }

  const parsed = Number.parseFloat(value)

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
}

function toFreshness(value: Date | string | null | undefined): PulseFreshness {
  const syncedAt = toIsoString(value) ?? new Date(0).toISOString()
  const parsedTimestamp = new Date(syncedAt).getTime()
  const isStale =
    Number.isNaN(parsedTimestamp) ||
    Date.now() - parsedTimestamp >= getSmartMoneySnapshotRefreshIntervalMs()

  return {
    isStale,
    syncedAt,
  }
}

function formatWalletAddress(address: string) {
  if (address.length <= 12) {
    return address
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function parseCategoryStats(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as PulseSmartMoneyCategoryStat[]
  }

  return value
    .map((entry) => {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        typeof entry.category !== 'string' ||
        typeof entry.positions !== 'number' ||
        typeof entry.roi !== 'number' ||
        typeof entry.winRate !== 'number'
      ) {
        return null
      }

      return {
        category: entry.category,
        positions: entry.positions,
        roi: entry.roi,
        winRate: entry.winRate,
      } satisfies PulseSmartMoneyCategoryStat
    })
    .filter((entry): entry is PulseSmartMoneyCategoryStat => Boolean(entry))
}

function mapWalletRow(row: WalletRow): PulseSmartMoneyWallet {
  const lastActiveAt = toIsoString(row.last_active_at)

  return {
    address: row.address,
    closedPositionCount: row.closed_position_count,
    displayName: row.display_name,
    freshness: toFreshness(row.synced_at),
    isLive: Boolean(lastActiveAt) && Date.now() - new Date(lastActiveAt!).getTime() <= 30 * 60 * 1000,
    lastActiveAt,
    marketCount: row.market_count,
    openPositionCount: row.open_position_count,
    profileImageUrl: row.profile_image_url,
    rank: row.rank,
    recencyScore: row.recency_score,
    roi: row.roi,
    score: row.score,
    shortAddress: formatWalletAddress(row.address),
    sourcePnl: row.source_pnl,
    sourceRank: row.source_rank,
    sourceVolume: row.source_volume,
    totalVolume: row.total_volume,
    verifiedBadge: row.verified_badge,
    winRate: row.win_rate,
    xUsername: row.x_username,
  }
}

function normalizeOutcome(value: string) {
  return value.toUpperCase() === 'NO' ? 'NO' : 'YES'
}

function mapPositionRow(row: PositionRow): PulseSmartMoneyPosition {
  return {
    category: row.category,
    closingDate: toIsoString(row.closing_date),
    conditionId: row.condition_id,
    currentPrice: row.current_price,
    currentValue: row.current_value,
    entryPrice: row.avg_price,
    entryValue: row.entry_value,
    eventId: row.event_id,
    eventSlug: row.event_slug,
    iconUrl: row.icon_url,
    marketTitle: row.market_title,
    outcome: normalizeOutcome(row.outcome),
    pnl: row.cash_pnl,
    provider: row.provider,
    providerEventId: row.provider_event_id,
    realizedPnl: row.realized_pnl,
    shareCount: row.share_count,
    status: row.status,
    timestamp: toIsoString(row.position_timestamp),
  }
}

function mapSignalRow(row: SignalRow): PulseSmartMoneySignal {
  const signalAt = toIsoString(row.signal_timestamp) ?? new Date(0).toISOString()

  return {
    category: row.category,
    closingDate: toIsoString(row.closing_date),
    currentPrice: row.current_price,
    entryPrice: row.entry_price,
    eventId: row.event_id,
    eventSlug: row.event_slug,
    iconUrl: row.icon_url,
    id: row.id,
    isNew: Date.now() - new Date(signalAt).getTime() <= 60_000,
    marketTitle: row.market_title,
    outcome: normalizeOutcome(row.outcome),
    priceDelta: row.price_delta,
    provider: row.provider,
    providerEventId: row.provider_event_id,
    signalAt,
    size: row.size_usd,
    walletAddress: row.wallet_address,
    walletDisplayName: row.wallet_display_name,
    walletProfileImageUrl: row.wallet_profile_image_url,
    walletRank: row.wallet_rank,
    walletScore: row.wallet_score,
    walletShortAddress: formatWalletAddress(row.wallet_address),
    walletVerified: row.wallet_verified,
  }
}

async function insertWallet(
  client: Queryable,
  wallet: StoredSmartMoneyWalletInput,
  syncedAt: Date,
) {
  await client.query(
    `
      INSERT INTO pulse_smart_money_wallets (
        address,
        display_name,
        x_username,
        profile_image_url,
        verified_badge,
        rank,
        source_rank,
        score,
        win_rate,
        roi,
        total_volume,
        source_volume,
        source_pnl,
        open_position_count,
        closed_position_count,
        market_count,
        recency_score,
        last_active_at,
        category_stats_json,
        synced_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19::JSONB, $20
      )
    `,
    [
      wallet.address,
      wallet.displayName ?? null,
      wallet.xUsername ?? null,
      wallet.profileImageUrl ?? null,
      wallet.verifiedBadge,
      wallet.rank,
      wallet.sourceRank ?? null,
      wallet.score,
      wallet.winRate,
      wallet.roi,
      wallet.totalVolume,
      wallet.sourceVolume,
      wallet.sourcePnl,
      wallet.openPositionCount,
      wallet.closedPositionCount,
      wallet.marketCount,
      wallet.recencyScore,
      wallet.lastActiveAt ?? null,
      JSON.stringify(wallet.categoryStats),
      syncedAt.toISOString(),
    ],
  )
}

async function insertPosition(
  client: Queryable,
  position: StoredSmartMoneyPositionInput,
  syncedAt: Date,
) {
  await client.query(
    `
      INSERT INTO pulse_smart_money_positions (
        position_key,
        wallet_address,
        event_id,
        provider_event_id,
        provider,
        condition_id,
        event_slug,
        market_title,
        category,
        icon_url,
        outcome,
        status,
        avg_price,
        current_price,
        share_count,
        entry_value,
        current_value,
        cash_pnl,
        realized_pnl,
        closing_date,
        position_timestamp,
        synced_at
      )
      VALUES (
        $1, $2, $3, $4, 'polymarket', $5, $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      )
    `,
    [
      position.positionKey,
      position.walletAddress,
      position.eventId ?? null,
      position.providerEventId ?? null,
      position.conditionId,
      position.eventSlug,
      position.marketTitle,
      position.category,
      position.iconUrl ?? null,
      position.outcome,
      position.status,
      position.avgPrice,
      position.currentPrice,
      position.shareCount,
      position.entryValue,
      position.currentValue,
      position.pnl,
      position.realizedPnl,
      position.closingDate ?? null,
      position.timestamp ?? null,
      syncedAt.toISOString(),
    ],
  )
}

async function insertSignal(
  client: Queryable,
  signal: StoredSmartMoneySignalInput,
  syncedAt: Date,
) {
  await client.query(
    `
      INSERT INTO pulse_smart_money_signals (
        id,
        wallet_address,
        event_id,
        provider_event_id,
        provider,
        condition_id,
        event_slug,
        market_title,
        category,
        icon_url,
        outcome,
        entry_price,
        current_price,
        price_delta,
        size_usd,
        signal_timestamp,
        closing_date,
        transaction_hash,
        synced_at
      )
      VALUES (
        $1, $2, $3, $4, 'polymarket', $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18
      )
    `,
    [
      signal.id,
      signal.walletAddress,
      signal.eventId ?? null,
      signal.providerEventId ?? null,
      signal.conditionId,
      signal.eventSlug,
      signal.marketTitle,
      signal.category,
      signal.iconUrl ?? null,
      signal.outcome,
      signal.entryPrice,
      signal.currentPrice,
      signal.priceDelta,
      signal.size,
      signal.signalAt,
      signal.closingDate ?? null,
      signal.transactionHash ?? null,
      syncedAt.toISOString(),
    ],
  )
}

export async function countStoredSmartMoneyWallets() {
  const result = await getDbPool().query<{ count: string }>(
    'SELECT COUNT(*)::TEXT AS count FROM pulse_smart_money_wallets',
  )

  return Number.parseInt(result.rows[0]?.count ?? '0', 10)
}

export async function listStoredSmartMoneySignalIds() {
  const result = await getDbPool().query<{ id: string }>(
    `
      SELECT id
      FROM pulse_smart_money_signals
    `,
  )

  return result.rows.map((row) => row.id)
}

export async function countStoredSmartMoneySignals() {
  const result = await getDbPool().query<{ count: string }>(
    'SELECT COUNT(*)::TEXT AS count FROM pulse_smart_money_signals',
  )

  return Number.parseInt(result.rows[0]?.count ?? '0', 10)
}

export async function listStoredSmartMoneyWalletAddresses(limit: number) {
  const parsedLimit = parsePositiveInteger(limit, 100)
  const result = await getDbPool().query<{ address: string }>(
    `
      SELECT address
      FROM pulse_smart_money_wallets
      ORDER BY rank ASC, score DESC, total_volume DESC
      LIMIT $1
    `,
    [parsedLimit],
  )

  return result.rows.map((row) => row.address)
}

export async function getSmartMoneySyncState(syncKey = 'smart-money') {
  const result = await getDbPool().query<{
    last_error: string | null
    last_run_at: Date | string | null
    last_success_at: Date | string | null
    sync_key: string
  }>(
    `
      SELECT
        last_error,
        last_run_at,
        last_success_at,
        sync_key
      FROM pulse_smart_money_sync_state
      WHERE sync_key = $1
    `,
    [syncKey],
  )
  const row = result.rows[0]

  if (!row) {
    return null
  }

  return {
    lastError: row.last_error,
    lastRunAt: toIsoString(row.last_run_at),
    lastSuccessAt: toIsoString(row.last_success_at),
    syncKey: row.sync_key,
  } satisfies SmartMoneySyncState
}

export async function recordSmartMoneySyncAttempt(syncKey: string, timestamp: Date) {
  await getDbPool().query(
    `
      INSERT INTO pulse_smart_money_sync_state (sync_key, last_run_at, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (sync_key) DO UPDATE SET
        last_run_at = EXCLUDED.last_run_at,
        updated_at = NOW()
    `,
    [syncKey, timestamp.toISOString()],
  )
}

export async function recordSmartMoneySyncSuccess(syncKey: string, timestamp: Date) {
  await getDbPool().query(
    `
      INSERT INTO pulse_smart_money_sync_state (
        sync_key,
        last_run_at,
        last_success_at,
        last_error,
        updated_at
      )
      VALUES ($1, $2, $2, NULL, NOW())
      ON CONFLICT (sync_key) DO UPDATE SET
        last_run_at = EXCLUDED.last_run_at,
        last_success_at = EXCLUDED.last_success_at,
        last_error = NULL,
        updated_at = NOW()
    `,
    [syncKey, timestamp.toISOString()],
  )
}

export async function recordSmartMoneySyncFailure(
  syncKey: string,
  message: string,
  timestamp: Date,
) {
  await getDbPool().query(
    `
      INSERT INTO pulse_smart_money_sync_state (sync_key, last_run_at, last_error, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (sync_key) DO UPDATE SET
        last_run_at = EXCLUDED.last_run_at,
        last_error = EXCLUDED.last_error,
        updated_at = NOW()
    `,
    [syncKey, timestamp.toISOString(), message],
  )
}

export async function replaceStoredSmartMoneySnapshot(
  input: {
    positions: StoredSmartMoneyPositionInput[]
    signals: StoredSmartMoneySignalInput[]
    wallets: StoredSmartMoneyWalletInput[]
  },
  syncedAt: Date,
  syncKey = 'smart-money',
) {
  const client = await getDbPool().connect()

  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM pulse_smart_money_signals')
    await client.query('DELETE FROM pulse_smart_money_positions')
    await client.query('DELETE FROM pulse_smart_money_wallets')

    for (const wallet of input.wallets) {
      await insertWallet(client, wallet, syncedAt)
    }

    for (const position of input.positions) {
      await insertPosition(client, position, syncedAt)
    }

    for (const signal of input.signals) {
      await insertSignal(client, signal, syncedAt)
    }

    await client.query(
      `
        INSERT INTO pulse_smart_money_sync_state (
          sync_key,
          last_run_at,
          last_success_at,
          last_error,
          updated_at
        )
        VALUES ($1, $2, $2, NULL, NOW())
        ON CONFLICT (sync_key) DO UPDATE SET
          last_run_at = EXCLUDED.last_run_at,
          last_success_at = EXCLUDED.last_success_at,
          last_error = NULL,
          updated_at = NOW()
      `,
      [syncKey, syncedAt.toISOString()],
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function appendStoredSmartMoneySignals(
  signals: StoredSmartMoneySignalInput[],
  syncedAt: Date,
) {
  if (!signals.length) {
    return [] as string[]
  }

  const client = await getDbPool().connect()
  const insertedIds: string[] = []

  try {
    await client.query('BEGIN')

    for (const signal of signals) {
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO pulse_smart_money_signals (
            id,
            wallet_address,
            event_id,
            provider_event_id,
            provider,
            condition_id,
            event_slug,
            market_title,
            category,
            icon_url,
            outcome,
            entry_price,
            current_price,
            price_delta,
            size_usd,
            signal_timestamp,
            closing_date,
            transaction_hash,
            synced_at
          )
          VALUES (
            $1, $2, $3, $4, 'polymarket', $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18
          )
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `,
        [
          signal.id,
          signal.walletAddress,
          signal.eventId ?? null,
          signal.providerEventId ?? null,
          signal.conditionId,
          signal.eventSlug,
          signal.marketTitle,
          signal.category,
          signal.iconUrl ?? null,
          signal.outcome,
          signal.entryPrice,
          signal.currentPrice,
          signal.priceDelta,
          signal.size,
          signal.signalAt,
          signal.closingDate ?? null,
          signal.transactionHash ?? null,
          syncedAt.toISOString(),
        ],
      )

      if (result.rows[0]?.id) {
        insertedIds.push(result.rows[0].id)
      }
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return insertedIds
}

export async function listStoredSmartMoneySignals(
  params: PulseSmartMoneySignalListParams = {},
) {
  const conditions: string[] = []
  const values: Array<number | string> = []

  if (params.category && params.category !== 'All') {
    values.push(params.category)
    conditions.push(`s.category = $${values.length}`)
  }

  if (params.minSize !== undefined) {
    values.push(parsePositiveFloat(params.minSize))
    conditions.push(`s.size_usd >= $${values.length}`)
  }

  if (params.minScore !== undefined) {
    values.push(parsePositiveFloat(params.minScore))
    conditions.push(`w.score >= $${values.length}`)
  }

  const limit = parsePositiveInteger(params.limit, 30)
  values.push(limit)
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const orderClause =
    params.sort === 'largest'
      ? 'ORDER BY s.size_usd DESC, s.signal_timestamp DESC'
      : 'ORDER BY s.signal_timestamp DESC'
  const result = await getDbPool().query<SignalRow>(
    `
      SELECT
        s.category,
        s.closing_date,
        s.current_price,
        s.entry_price,
        s.event_id,
        s.event_slug,
        s.icon_url,
        s.id,
        s.market_title,
        s.outcome,
        s.price_delta,
        s.provider,
        s.provider_event_id,
        s.signal_timestamp,
        s.size_usd,
        s.wallet_address,
        w.display_name AS wallet_display_name,
        w.profile_image_url AS wallet_profile_image_url,
        w.rank AS wallet_rank,
        w.score AS wallet_score,
        w.verified_badge AS wallet_verified
      FROM pulse_smart_money_signals s
      INNER JOIN pulse_smart_money_wallets w
        ON w.address = s.wallet_address
      ${whereClause}
      ${orderClause}
      LIMIT $${values.length}
    `,
    values,
  )

  return result.rows.map(mapSignalRow)
}

export async function listStoredSmartMoneySignalsByIds(ids: string[]) {
  if (!ids.length) {
    return [] as PulseSmartMoneySignal[]
  }

  const result = await getDbPool().query<SignalRow>(
    `
      SELECT
        s.category,
        s.closing_date,
        s.current_price,
        s.entry_price,
        s.event_id,
        s.event_slug,
        s.icon_url,
        s.id,
        s.market_title,
        s.outcome,
        s.price_delta,
        s.provider,
        s.provider_event_id,
        s.signal_timestamp,
        s.size_usd,
        s.wallet_address,
        w.display_name AS wallet_display_name,
        w.profile_image_url AS wallet_profile_image_url,
        w.rank AS wallet_rank,
        w.score AS wallet_score,
        w.verified_badge AS wallet_verified
      FROM pulse_smart_money_signals s
      INNER JOIN pulse_smart_money_wallets w
        ON w.address = s.wallet_address
      WHERE s.id = ANY($1::text[])
      ORDER BY s.signal_timestamp DESC, s.size_usd DESC
    `,
    [ids],
  )

  return result.rows.map(mapSignalRow)
}

export async function listStoredSmartMoneyWallets(
  params: PulseSmartMoneyWalletListParams = {},
) {
  const conditions: string[] = []
  const values: Array<number | string> = []

  if (params.minScore !== undefined) {
    values.push(parsePositiveFloat(params.minScore))
    conditions.push(`score >= $${values.length}`)
  }

  if (params.minVolume !== undefined) {
    values.push(parsePositiveFloat(params.minVolume))
    conditions.push(`total_volume >= $${values.length}`)
  }

  const limit = parsePositiveInteger(params.limit, 25)
  values.push(limit)
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const result = await getDbPool().query<WalletRow>(
    `
      SELECT
        address,
        category_stats_json,
        closed_position_count,
        display_name,
        last_active_at,
        market_count,
        open_position_count,
        profile_image_url,
        rank,
        recency_score,
        roi,
        score,
        source_pnl,
        source_rank,
        source_volume,
        synced_at,
        total_volume,
        verified_badge,
        win_rate,
        x_username
      FROM pulse_smart_money_wallets
      ${whereClause}
      ORDER BY rank ASC, score DESC, last_active_at DESC NULLS LAST
      LIMIT $${values.length}
    `,
    values,
  )

  return result.rows.map(mapWalletRow)
}

export async function getStoredSmartMoneyWallet(address: string) {
  const walletResult = await getDbPool().query<WalletRow>(
    `
      SELECT
        address,
        category_stats_json,
        closed_position_count,
        display_name,
        last_active_at,
        market_count,
        open_position_count,
        profile_image_url,
        rank,
        recency_score,
        roi,
        score,
        source_pnl,
        source_rank,
        source_volume,
        synced_at,
        total_volume,
        verified_badge,
        win_rate,
        x_username
      FROM pulse_smart_money_wallets
      WHERE address = $1
    `,
    [address.toLowerCase()],
  )
  const walletRow = walletResult.rows[0]

  if (!walletRow) {
    return null
  }

  const [positionsResult, signalsResult] = await Promise.all([
    getDbPool().query<PositionRow>(
      `
        SELECT
          avg_price,
          category,
          closing_date,
          condition_id,
          current_price,
          current_value,
          entry_value,
          event_id,
          event_slug,
          icon_url,
          market_title,
          outcome,
          position_timestamp,
          provider,
          provider_event_id,
          realized_pnl,
          share_count,
          status,
          cash_pnl
        FROM pulse_smart_money_positions
        WHERE wallet_address = $1 AND status = 'open'
        ORDER BY current_value DESC, market_title ASC
      `,
      [address.toLowerCase()],
    ),
    getDbPool().query<SignalRow>(
      `
        SELECT
          s.category,
          s.closing_date,
          s.current_price,
          s.entry_price,
          s.event_id,
          s.event_slug,
          s.icon_url,
          s.id,
          s.market_title,
          s.outcome,
          s.price_delta,
          s.provider,
          s.provider_event_id,
          s.signal_timestamp,
          s.size_usd,
          s.wallet_address,
          w.display_name AS wallet_display_name,
          w.profile_image_url AS wallet_profile_image_url,
          w.rank AS wallet_rank,
          w.score AS wallet_score,
          w.verified_badge AS wallet_verified
        FROM pulse_smart_money_signals s
        INNER JOIN pulse_smart_money_wallets w
          ON w.address = s.wallet_address
        WHERE s.wallet_address = $1
        ORDER BY s.signal_timestamp DESC
        LIMIT 12
      `,
      [address.toLowerCase()],
    ),
  ])

  return {
    categoryStats: parseCategoryStats(walletRow.category_stats_json),
    freshness: toFreshness(walletRow.synced_at),
    openPositions: positionsResult.rows.map(mapPositionRow),
    recentSignals: signalsResult.rows.map(mapSignalRow),
    wallet: mapWalletRow(walletRow),
  } satisfies PulseSmartMoneyWalletDetail
}
