import type {
  PulseEvent,
  PulseFreshness,
  PulsePriceHistory,
  PulsePricePoint,
} from '../contracts/pulse-events.js'
import { getDiscoveryRefreshIntervalMs } from './config.js'
import { getDbPool } from './pool.js'

type HistorySyncRow = {
  synced_at: Date | string
}

type PriceHistoryRow = {
  point_timestamp: string | number
  price: number
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
    Date.now() - parsedTimestamp >= getDiscoveryRefreshIntervalMs()

  return {
    isStale,
    syncedAt,
  }
}

function toPointTimestamp(value: string | number) {
  return typeof value === 'number' ? value : Number.parseInt(value, 10)
}

function dedupeHistoryPoints(points: PulsePricePoint[]) {
  const uniquePoints = new Map<number, PulsePricePoint>()

  for (const point of points) {
    uniquePoints.set(point.timestamp, point)
  }

  return [...uniquePoints.values()].sort((a, b) => a.timestamp - b.timestamp)
}

function buildStoredHistory(
  event: PulseEvent,
  marketId: string,
  points: PulsePricePoint[],
  syncedAt: Date | string,
): PulsePriceHistory {
  const market = event.markets.find((candidate) => candidate.id === marketId)

  return {
    eventId: event.id,
    eventTitle: event.title,
    freshness: toFreshness(syncedAt),
    marketId,
    marketTitle: market?.title ?? 'Primary market',
    points,
    previousInterval: points[0],
  }
}

export async function getStoredPriceHistory(
  event: PulseEvent,
  marketId: string,
  interval: string,
) {
  const syncResult = await getDbPool().query<HistorySyncRow>(
    `
      SELECT synced_at
      FROM pulse_price_history_sync_state
      WHERE market_id = $1 AND interval = $2
      LIMIT 1
    `,
    [marketId, interval],
  )
  const syncRow = syncResult.rows[0]

  if (!syncRow) {
    return null
  }

  const pointsResult = await getDbPool().query<PriceHistoryRow>(
    `
      SELECT point_timestamp, price
      FROM pulse_price_history
      WHERE market_id = $1 AND interval = $2
      ORDER BY point_timestamp ASC
    `,
    [marketId, interval],
  )
  const points = pointsResult.rows.map((row) => ({
    price: row.price,
    timestamp: toPointTimestamp(row.point_timestamp),
  }))

  return buildStoredHistory(event, marketId, points, syncRow.synced_at)
}

export async function replaceStoredPriceHistory(
  event: PulseEvent,
  history: PulsePriceHistory,
  interval: string,
  syncedAt = new Date(),
) {
  const normalizedPoints = dedupeHistoryPoints(history.points)
  const client = await getDbPool().connect()

  try {
    await client.query('BEGIN')
    await client.query(
      `
        INSERT INTO pulse_price_history_sync_state (
          market_id,
          event_id,
          interval,
          synced_at
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (market_id, interval) DO UPDATE SET
          event_id = EXCLUDED.event_id,
          synced_at = EXCLUDED.synced_at
      `,
      [history.marketId, event.id, interval, syncedAt],
    )
    await client.query(
      'DELETE FROM pulse_price_history WHERE market_id = $1 AND interval = $2',
      [history.marketId, interval],
    )

    for (const point of normalizedPoints) {
      await client.query(
        `
          INSERT INTO pulse_price_history (
            market_id,
            event_id,
            interval,
            point_timestamp,
            price,
            synced_at
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          history.marketId,
          event.id,
          interval,
          point.timestamp,
          point.price,
          syncedAt,
        ],
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
