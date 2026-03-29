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

CREATE TABLE IF NOT EXISTS pulse_price_history_sync_state (
  market_id TEXT NOT NULL REFERENCES pulse_markets(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES pulse_events(id) ON DELETE CASCADE,
  interval TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (market_id, interval)
);

CREATE INDEX IF NOT EXISTS idx_pulse_price_history_sync_event
  ON pulse_price_history_sync_state(event_id, interval);

CREATE TABLE IF NOT EXISTS pulse_price_history (
  market_id TEXT NOT NULL REFERENCES pulse_markets(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES pulse_events(id) ON DELETE CASCADE,
  interval TEXT NOT NULL,
  point_timestamp BIGINT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (market_id, interval, point_timestamp)
);

CREATE INDEX IF NOT EXISTS idx_pulse_price_history_market_interval_time
  ON pulse_price_history(market_id, interval, point_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pulse_price_history_event_interval
  ON pulse_price_history(event_id, interval);

CREATE TABLE IF NOT EXISTS pulse_event_link_sync_state (
  sync_key TEXT PRIMARY KEY,
  last_run_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pulse_event_links (
  id TEXT PRIMARY KEY,
  canonical_title TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  match_method TEXT NOT NULL,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pulse_event_links_category
  ON pulse_event_links(category);
CREATE INDEX IF NOT EXISTS idx_pulse_event_links_confidence
  ON pulse_event_links(confidence DESC);

CREATE TABLE IF NOT EXISTS pulse_event_link_members (
  link_id TEXT NOT NULL REFERENCES pulse_event_links(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES pulse_events(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  PRIMARY KEY (link_id, event_id),
  UNIQUE(event_id)
);

CREATE INDEX IF NOT EXISTS idx_pulse_event_link_members_event
  ON pulse_event_link_members(event_id);

CREATE TABLE IF NOT EXISTS pulse_smart_money_sync_state (
  sync_key TEXT PRIMARY KEY,
  last_error TEXT,
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pulse_smart_money_sync_state
  ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS pulse_smart_money_wallets (
  address TEXT PRIMARY KEY,
  display_name TEXT,
  x_username TEXT,
  profile_image_url TEXT,
  verified_badge BOOLEAN NOT NULL DEFAULT FALSE,
  rank INTEGER NOT NULL DEFAULT 0,
  source_rank INTEGER,
  score INTEGER NOT NULL DEFAULT 0,
  win_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  roi DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_volume DOUBLE PRECISION NOT NULL DEFAULT 0,
  source_volume DOUBLE PRECISION NOT NULL DEFAULT 0,
  source_pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
  open_position_count INTEGER NOT NULL DEFAULT 0,
  closed_position_count INTEGER NOT NULL DEFAULT 0,
  market_count INTEGER NOT NULL DEFAULT 0,
  recency_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  category_stats_json JSONB NOT NULL DEFAULT '[]'::JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pulse_smart_money_wallets_rank
  ON pulse_smart_money_wallets(rank);
CREATE INDEX IF NOT EXISTS idx_pulse_smart_money_wallets_score
  ON pulse_smart_money_wallets(score DESC);
CREATE INDEX IF NOT EXISTS idx_pulse_smart_money_wallets_last_active
  ON pulse_smart_money_wallets(last_active_at DESC);

CREATE TABLE IF NOT EXISTS pulse_smart_money_positions (
  position_key TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES pulse_smart_money_wallets(address) ON DELETE CASCADE,
  event_id TEXT REFERENCES pulse_events(id) ON DELETE SET NULL,
  provider_event_id TEXT,
  provider TEXT NOT NULL DEFAULT 'polymarket',
  condition_id TEXT NOT NULL,
  event_slug TEXT NOT NULL,
  market_title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  icon_url TEXT,
  outcome TEXT NOT NULL,
  status TEXT NOT NULL,
  avg_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  current_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  share_count DOUBLE PRECISION NOT NULL DEFAULT 0,
  entry_value DOUBLE PRECISION NOT NULL DEFAULT 0,
  current_value DOUBLE PRECISION NOT NULL DEFAULT 0,
  cash_pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
  realized_pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
  closing_date TIMESTAMPTZ,
  position_timestamp TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pulse_smart_money_positions_wallet
  ON pulse_smart_money_positions(wallet_address, status);
CREATE INDEX IF NOT EXISTS idx_pulse_smart_money_positions_event
  ON pulse_smart_money_positions(event_id);

CREATE TABLE IF NOT EXISTS pulse_smart_money_signals (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES pulse_smart_money_wallets(address) ON DELETE CASCADE,
  event_id TEXT REFERENCES pulse_events(id) ON DELETE SET NULL,
  provider_event_id TEXT,
  provider TEXT NOT NULL DEFAULT 'polymarket',
  condition_id TEXT NOT NULL,
  event_slug TEXT NOT NULL,
  market_title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  icon_url TEXT,
  outcome TEXT NOT NULL,
  entry_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  current_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  price_delta DOUBLE PRECISION NOT NULL DEFAULT 0,
  size_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  signal_timestamp TIMESTAMPTZ NOT NULL,
  closing_date TIMESTAMPTZ,
  transaction_hash TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pulse_smart_money_signals_timestamp
  ON pulse_smart_money_signals(signal_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pulse_smart_money_signals_wallet
  ON pulse_smart_money_signals(wallet_address);
CREATE INDEX IF NOT EXISTS idx_pulse_smart_money_signals_category
  ON pulse_smart_money_signals(category);
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
