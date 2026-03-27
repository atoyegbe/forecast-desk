import type { PoolClient } from 'pg'
import type {
  PulseEvent,
  PulseEventListParams,
  PulseMarket,
  PulseProvider,
} from '../contracts/pulse-events.js'
import { getDbPool } from './pool.js'

type Queryable = {
  query: PoolClient['query']
}

type EventRow = {
  additional_context: string
  category: string
  closing_date: Date | string | null
  country_codes: string[] | null
  created_at: Date | string
  description: string
  engine: string
  hashtags: string[] | null
  id: string
  image_url: string | null
  liquidity: number
  provider: PulseProvider
  provider_event_id: string
  regions: string[] | null
  resolution_date: Date | string | null
  resolution_source: string | null
  slug: string
  source_url: string | null
  status: string
  supported_currencies: string[] | null
  title: string
  total_orders: number
  total_volume: number
  type: string
}

type MarketRow = {
  event_id: string
  fee_percentage: number
  id: string
  image_url: string | null
  liquidity: number
  no_outcome_id: string
  no_outcome_label: string
  no_outcome_price: number
  provider_market_id: string
  rules: string | null
  status: string
  title: string
  total_orders: number
  total_volume: number
  yes_outcome_id: string
  yes_outcome_label: string
  yes_outcome_price: number
}

export type ProviderSyncState = {
  lastAttemptAt?: string | null
  lastError?: string | null
  lastSuccessAt?: string | null
  provider: PulseProvider
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

function toNullableTimestampInput(value: Date | string | null | undefined) {
  const normalizedValue = typeof value === 'string' ? value.trim() : value

  if (!normalizedValue) {
    return null
  }

  if (normalizedValue instanceof Date) {
    return normalizedValue.toISOString()
  }

  const parsed = new Date(normalizedValue)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

function toRequiredTimestampInput(value: Date | string | null | undefined) {
  return toNullableTimestampInput(value) ?? new Date(0).toISOString()
}

function mapMarketRow(row: MarketRow): PulseMarket {
  return {
    feePercentage: row.fee_percentage,
    id: row.id,
    imageUrl: row.image_url,
    liquidity: row.liquidity,
    noOutcome: {
      id: row.no_outcome_id,
      label: row.no_outcome_label,
      price: row.no_outcome_price,
    },
    providerMarketId: row.provider_market_id,
    rules: row.rules ?? undefined,
    status: row.status,
    title: row.title,
    totalOrders: row.total_orders,
    totalVolume: row.total_volume,
    yesOutcome: {
      id: row.yes_outcome_id,
      label: row.yes_outcome_label,
      price: row.yes_outcome_price,
    },
  }
}

function mapEventRow(row: EventRow, markets: PulseMarket[]): PulseEvent {
  return {
    additionalContext: row.additional_context,
    category: row.category,
    closingDate: toIsoString(row.closing_date),
    countryCodes: row.country_codes ?? [],
    createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(),
    description: row.description,
    engine: row.engine,
    hashtags: row.hashtags ?? [],
    id: row.id,
    imageUrl: row.image_url,
    liquidity: row.liquidity,
    markets,
    provider: row.provider,
    providerEventId: row.provider_event_id,
    regions: row.regions ?? [],
    resolutionDate: toIsoString(row.resolution_date),
    resolutionSource: row.resolution_source,
    slug: row.slug,
    sourceUrl: row.source_url,
    status: row.status,
    supportedCurrencies: row.supported_currencies ?? [],
    title: row.title,
    totalOrders: row.total_orders,
    totalVolume: row.total_volume,
    type: row.type,
  }
}

function buildEventsWhereClause(params: PulseEventListParams = {}) {
  const conditions: string[] = []
  const values: Array<string | PulseProvider> = []
  const keyword = params.keyword?.trim()

  if (params.provider) {
    values.push(params.provider)
    conditions.push(`provider = $${values.length}`)
  }

  if (params.status) {
    values.push('open')
    conditions.push(
      params.status === 'open'
        ? `status = $${values.length}`
        : `status <> $${values.length}`,
    )
  }

  if (params.category && params.category !== 'All') {
    values.push(params.category)
    conditions.push(`category = $${values.length}`)
  }

  if (keyword) {
    values.push(`%${keyword}%`)
    conditions.push(`(title || ' ' || description || ' ' || additional_context) ILIKE $${values.length}`)
  }

  if (!conditions.length) {
    return {
      text: '',
      values,
    }
  }

  return {
    text: `WHERE ${conditions.join(' AND ')}`,
    values,
  }
}

async function loadMarketsByEventIds(eventIds: string[]) {
  if (!eventIds.length) {
    return new Map<string, PulseMarket[]>()
  }

  const result = await getDbPool().query<MarketRow>(
    `
      SELECT
        event_id,
        fee_percentage,
        id,
        image_url,
        liquidity,
        no_outcome_id,
        no_outcome_label,
        no_outcome_price,
        provider_market_id,
        rules,
        status,
        title,
        total_orders,
        total_volume,
        yes_outcome_id,
        yes_outcome_label,
        yes_outcome_price
      FROM pulse_markets
      WHERE event_id = ANY($1::TEXT[])
      ORDER BY total_volume DESC, title ASC
    `,
    [eventIds],
  )
  const groupedMarkets = new Map<string, PulseMarket[]>()

  for (const row of result.rows) {
    const collection = groupedMarkets.get(row.event_id) ?? []
    collection.push(mapMarketRow(row))
    groupedMarkets.set(row.event_id, collection)
  }

  return groupedMarkets
}

async function upsertEvent(client: Queryable, event: PulseEvent, syncedAt: Date) {
  await client.query(
    `
      INSERT INTO pulse_events (
        id,
        provider,
        provider_event_id,
        slug,
        title,
        description,
        additional_context,
        category,
        status,
        type,
        engine,
        image_url,
        source_url,
        resolution_source,
        created_at,
        closing_date,
        resolution_date,
        liquidity,
        total_orders,
        total_volume,
        country_codes,
        regions,
        hashtags,
        supported_currencies,
        raw_json,
        synced_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25::JSONB, $26
      )
      ON CONFLICT (id) DO UPDATE SET
        provider = EXCLUDED.provider,
        provider_event_id = EXCLUDED.provider_event_id,
        slug = EXCLUDED.slug,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        additional_context = EXCLUDED.additional_context,
        category = EXCLUDED.category,
        status = EXCLUDED.status,
        type = EXCLUDED.type,
        engine = EXCLUDED.engine,
        image_url = EXCLUDED.image_url,
        source_url = EXCLUDED.source_url,
        resolution_source = EXCLUDED.resolution_source,
        created_at = EXCLUDED.created_at,
        closing_date = EXCLUDED.closing_date,
        resolution_date = EXCLUDED.resolution_date,
        liquidity = EXCLUDED.liquidity,
        total_orders = EXCLUDED.total_orders,
        total_volume = EXCLUDED.total_volume,
        country_codes = EXCLUDED.country_codes,
        regions = EXCLUDED.regions,
        hashtags = EXCLUDED.hashtags,
        supported_currencies = EXCLUDED.supported_currencies,
        raw_json = EXCLUDED.raw_json,
        synced_at = EXCLUDED.synced_at
    `,
    [
      event.id,
      event.provider,
      event.providerEventId,
      event.slug,
      event.title,
      event.description,
      event.additionalContext,
      event.category,
      event.status,
      event.type,
      event.engine,
      event.imageUrl ?? null,
      event.sourceUrl ?? null,
      event.resolutionSource ?? null,
      toRequiredTimestampInput(event.createdAt),
      toNullableTimestampInput(event.closingDate),
      toNullableTimestampInput(event.resolutionDate),
      event.liquidity,
      event.totalOrders,
      event.totalVolume,
      event.countryCodes,
      event.regions,
      event.hashtags,
      event.supportedCurrencies,
      JSON.stringify(event),
      syncedAt,
    ],
  )

  // Markets are nested under an event in the read model, so replacing them keeps
  // the stored event shape aligned with the latest provider payload.
  await client.query('DELETE FROM pulse_markets WHERE event_id = $1', [event.id])

  for (const market of event.markets) {
    await client.query(
      `
        INSERT INTO pulse_markets (
          id,
          event_id,
          provider_market_id,
          title,
          status,
          rules,
          image_url,
          fee_percentage,
          liquidity,
          total_orders,
          total_volume,
          yes_outcome_id,
          yes_outcome_label,
          yes_outcome_price,
          no_outcome_id,
          no_outcome_label,
          no_outcome_price,
          raw_json,
          synced_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18::JSONB, $19
        )
      `,
      [
        market.id,
        event.id,
        market.providerMarketId,
        market.title,
        market.status,
        market.rules ?? null,
        market.imageUrl ?? null,
        market.feePercentage,
        market.liquidity,
        market.totalOrders,
        market.totalVolume,
        market.yesOutcome.id,
        market.yesOutcome.label,
        market.yesOutcome.price,
        market.noOutcome.id,
        market.noOutcome.label,
        market.noOutcome.price,
        JSON.stringify(market),
        syncedAt,
      ],
    )
  }
}

async function upsertProviderSyncState(
  provider: PulseProvider,
  input: {
    lastAttemptAt?: Date | null
    lastError?: string | null
    lastSuccessAt?: Date | null
  },
) {
  await getDbPool().query(
    `
      INSERT INTO pulse_provider_sync_state (
        provider,
        last_attempt_at,
        last_success_at,
        last_error,
        updated_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (provider) DO UPDATE SET
        last_attempt_at = COALESCE(EXCLUDED.last_attempt_at, pulse_provider_sync_state.last_attempt_at),
        last_success_at = COALESCE(EXCLUDED.last_success_at, pulse_provider_sync_state.last_success_at),
        last_error = EXCLUDED.last_error,
        updated_at = NOW()
    `,
    [
      provider,
      input.lastAttemptAt ?? null,
      input.lastSuccessAt ?? null,
      input.lastError ?? null,
    ],
  )
}

export async function countStoredDiscoveryEvents(provider?: PulseProvider) {
  const result = await getDbPool().query<{ count: string }>(
    provider
      ? 'SELECT COUNT(*)::TEXT AS count FROM pulse_events WHERE provider = $1'
      : 'SELECT COUNT(*)::TEXT AS count FROM pulse_events',
    provider ? [provider] : [],
  )

  return Number.parseInt(result.rows[0]?.count ?? '0', 10)
}

export async function getProviderSyncState(provider: PulseProvider) {
  const result = await getDbPool().query<{
    last_attempt_at: Date | string | null
    last_error: string | null
    last_success_at: Date | string | null
    provider: PulseProvider
  }>(
    `
      SELECT
        provider,
        last_attempt_at,
        last_success_at,
        last_error
      FROM pulse_provider_sync_state
      WHERE provider = $1
      LIMIT 1
    `,
    [provider],
  )
  const row = result.rows[0]

  if (!row) {
    return null
  }

  return {
    lastAttemptAt: toIsoString(row.last_attempt_at),
    lastError: row.last_error,
    lastSuccessAt: toIsoString(row.last_success_at),
    provider: row.provider,
  } satisfies ProviderSyncState
}

export async function listStoredDiscoveryEvents(params: PulseEventListParams = {}) {
  const whereClause = buildEventsWhereClause(params)
  const result = await getDbPool().query<EventRow>(
    `
      SELECT
        additional_context,
        category,
        closing_date,
        country_codes,
        created_at,
        description,
        engine,
        hashtags,
        id,
        image_url,
        liquidity,
        provider,
        provider_event_id,
        regions,
        resolution_date,
        resolution_source,
        slug,
        source_url,
        status,
        supported_currencies,
        title,
        total_orders,
        total_volume,
        type
      FROM pulse_events
      ${whereClause.text}
      ORDER BY total_volume DESC, title ASC
    `,
    whereClause.values,
  )
  const marketMap = await loadMarketsByEventIds(result.rows.map((row) => row.id))

  return result.rows.map((row) => mapEventRow(row, marketMap.get(row.id) ?? []))
}

export async function getStoredDiscoveryEvent(eventId: string) {
  const result = await getDbPool().query<EventRow>(
    `
      SELECT
        additional_context,
        category,
        closing_date,
        country_codes,
        created_at,
        description,
        engine,
        hashtags,
        id,
        image_url,
        liquidity,
        provider,
        provider_event_id,
        regions,
        resolution_date,
        resolution_source,
        slug,
        source_url,
        status,
        supported_currencies,
        title,
        total_orders,
        total_volume,
        type
      FROM pulse_events
      WHERE id = $1
      LIMIT 1
    `,
    [eventId],
  )
  const row = result.rows[0]

  if (!row) {
    return null
  }

  const marketMap = await loadMarketsByEventIds([eventId])

  return mapEventRow(row, marketMap.get(eventId) ?? [])
}

export async function recordProviderSyncAttempt(provider: PulseProvider, attemptedAt = new Date()) {
  await upsertProviderSyncState(provider, {
    lastAttemptAt: attemptedAt,
  })
}

export async function recordProviderSyncFailure(
  provider: PulseProvider,
  message: string,
  attemptedAt = new Date(),
) {
  await upsertProviderSyncState(provider, {
    lastAttemptAt: attemptedAt,
    lastError: message,
  })
}

export async function recordProviderSyncSuccess(
  provider: PulseProvider,
  succeededAt = new Date(),
  message: string | null = null,
) {
  await upsertProviderSyncState(provider, {
    lastAttemptAt: succeededAt,
    lastError: message,
    lastSuccessAt: succeededAt,
  })
}

export async function upsertStoredDiscoveryEvents(events: PulseEvent[], syncedAt = new Date()) {
  const client = await getDbPool().connect()

  try {
    await client.query('BEGIN')

    for (const event of events) {
      await upsertEvent(client, event, syncedAt)
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
