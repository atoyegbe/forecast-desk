import type { PulseMatchMethod, PulseProvider } from '../contracts/pulse-events.js'
import { getDbPool } from './pool.js'

export type StoredEventLinkRecord = {
  category: string
  confidence: number
  eventIds: string[]
  id: string
  matchMethod: PulseMatchMethod
  matchedAt: string
  title: string
}

export type StoredEventLinkInput = Omit<StoredEventLinkRecord, 'matchedAt'>

type EventLinkRow = {
  canonical_title: string
  category: string
  confidence: number
  event_ids: string[] | null
  id: string
  match_method: PulseMatchMethod
  matched_at: Date | string
}

type EventLinkSyncRow = {
  last_run_at: Date | string | null
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

function mapEventLinkRow(row: EventLinkRow): StoredEventLinkRecord {
  return {
    category: row.category,
    confidence: row.confidence,
    eventIds: row.event_ids ?? [],
    id: row.id,
    matchMethod: row.match_method,
    matchedAt: toIsoString(row.matched_at) ?? new Date(0).toISOString(),
    title: row.canonical_title,
  }
}

async function listEventLinks(whereClause = '', values: Array<string> = []) {
  const result = await getDbPool().query<EventLinkRow>(
    `
      SELECT
        links.id,
        links.canonical_title,
        links.category,
        links.confidence,
        links.match_method,
        links.matched_at,
        ARRAY_AGG(members.event_id ORDER BY members.provider, members.event_id) AS event_ids
      FROM pulse_event_links AS links
      JOIN pulse_event_link_members AS members
        ON members.link_id = links.id
      ${whereClause}
      GROUP BY
        links.id,
        links.canonical_title,
        links.category,
        links.confidence,
        links.match_method,
        links.matched_at
      ORDER BY links.confidence DESC, links.canonical_title ASC
    `,
    values,
  )

  return result.rows.map(mapEventLinkRow)
}

export async function countStoredEventLinks() {
  const result = await getDbPool().query<{ count: string }>(
    'SELECT COUNT(*)::TEXT AS count FROM pulse_event_links',
  )

  return Number.parseInt(result.rows[0]?.count ?? '0', 10)
}

export async function getEventLinkSyncState() {
  const result = await getDbPool().query<EventLinkSyncRow>(
    `
      SELECT last_run_at
      FROM pulse_event_link_sync_state
      WHERE sync_key = 'default'
      LIMIT 1
    `,
  )
  const row = result.rows[0]

  if (!row) {
    return null
  }

  return {
    lastRunAt: toIsoString(row.last_run_at),
  }
}

export async function getStoredEventLinkByEventId(eventId: string) {
  const links = await listEventLinks(
    `
      WHERE links.id IN (
        SELECT link_id
        FROM pulse_event_link_members
        WHERE event_id = $1
      )
    `,
    [eventId],
  )

  return links[0] ?? null
}

export async function listStoredEventLinks() {
  return listEventLinks()
}

export async function replaceStoredEventLinks(
  links: StoredEventLinkInput[],
  matchedAt = new Date(),
) {
  const client = await getDbPool().connect()

  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM pulse_event_links')

    for (const link of links) {
      await client.query(
        `
          INSERT INTO pulse_event_links (
            id,
            canonical_title,
            category,
            confidence,
            match_method,
            matched_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `,
        [
          link.id,
          link.title,
          link.category,
          link.confidence,
          link.matchMethod,
          matchedAt,
        ],
      )

      for (const eventId of link.eventIds) {
        const provider = eventId.startsWith('polymarket__')
          ? 'polymarket'
          : 'bayse'

        await client.query(
          `
            INSERT INTO pulse_event_link_members (
              link_id,
              event_id,
              provider
            )
            VALUES ($1, $2, $3)
          `,
          [link.id, eventId, provider satisfies PulseProvider],
        )
      }
    }

    await client.query(
      `
        INSERT INTO pulse_event_link_sync_state (
          sync_key,
          last_run_at,
          updated_at
        )
        VALUES ('default', $1, NOW())
        ON CONFLICT (sync_key) DO UPDATE SET
          last_run_at = EXCLUDED.last_run_at,
          updated_at = NOW()
      `,
      [matchedAt],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
