import { getDbPool } from './pool.js'

const DISCOVERY_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS pulse_provider_sync_state (
  provider TEXT PRIMARY KEY,
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pulse_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  additional_context TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  status TEXT NOT NULL DEFAULT 'open',
  type TEXT NOT NULL DEFAULT 'UNKNOWN',
  engine TEXT NOT NULL DEFAULT 'UNKNOWN',
  image_url TEXT,
  source_url TEXT,
  resolution_source TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  closing_date TIMESTAMPTZ,
  resolution_date TIMESTAMPTZ,
  liquidity DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_volume DOUBLE PRECISION NOT NULL DEFAULT 0,
  country_codes TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  regions TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  hashtags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  supported_currencies TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  raw_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_pulse_events_provider ON pulse_events(provider);
CREATE INDEX IF NOT EXISTS idx_pulse_events_category ON pulse_events(category);
CREATE INDEX IF NOT EXISTS idx_pulse_events_status ON pulse_events(status);
CREATE INDEX IF NOT EXISTS idx_pulse_events_total_volume ON pulse_events(total_volume DESC);
CREATE INDEX IF NOT EXISTS idx_pulse_events_title_search
  ON pulse_events USING GIN (to_tsvector('english', title));

CREATE TABLE IF NOT EXISTS pulse_markets (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES pulse_events(id) ON DELETE CASCADE,
  provider_market_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  rules TEXT,
  image_url TEXT,
  fee_percentage DOUBLE PRECISION NOT NULL DEFAULT 0,
  liquidity DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_volume DOUBLE PRECISION NOT NULL DEFAULT 0,
  yes_outcome_id TEXT NOT NULL,
  yes_outcome_label TEXT NOT NULL,
  yes_outcome_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  no_outcome_id TEXT NOT NULL,
  no_outcome_label TEXT NOT NULL,
  no_outcome_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  raw_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, provider_market_id)
);

CREATE INDEX IF NOT EXISTS idx_pulse_markets_event_id ON pulse_markets(event_id);
CREATE INDEX IF NOT EXISTS idx_pulse_markets_total_volume ON pulse_markets(total_volume DESC);
`

let schemaReadyPromise: Promise<void> | null = null

async function runDiscoverySchemaBootstrap() {
  await getDbPool().query(DISCOVERY_SCHEMA_SQL)
}

export function ensureDiscoverySchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = runDiscoverySchemaBootstrap()
  }

  return schemaReadyPromise
}
