import {
  Link,
  useParams,
} from '@tanstack/react-router'
import { DeskTabs } from '../components/desk-tabs'
import { DivergenceBar } from '../components/divergence-bar'
import { PlatformBadge } from '../components/platform-badge'
import { PriceDisplay } from '../components/price-display'
import { PriceHistoryChart } from '../components/price-history-chart'
import { SectionHeader } from '../components/section-header'
import { getProviderLabel } from '../features/events/provider-ids'
import { useLiveEventPrices } from '../features/events/live'
import {
  useEventCompareQuery,
  useEventQuery,
  usePriceHistoryQuery,
} from '../features/events/hooks'
import {
  getMarketStance,
  getTempoLabel,
} from '../features/events/insights'
import type { PulseMarket } from '../features/events/types'
import {
  formatCompactNumber,
  formatDate,
  formatDateTime,
  formatProbability,
  formatProbabilityPoints,
  formatRelativeTime,
} from '../lib/format'
import {
  getCategoryRoute,
  getEventCompareRoute,
  getEventRoute,
} from '../lib/routes'
import { useUrlSelection } from '../lib/url-state'

const EVENT_TAB_IDS = ['live', 'rules', 'compare'] as const
const HISTORY_INTERVAL_IDS = ['1d', '1w', '1m', 'all'] as const

type ProbabilityMeterProps = {
  noPrice: number
  size?: 'md' | 'sm'
  yesPrice: number
}

function ProbabilityMeter({
  noPrice,
  size = 'md',
  yesPrice,
}: ProbabilityMeterProps) {
  const safeYesPrice = Math.min(Math.max(yesPrice, 0), 1)
  const safeNoPrice = Math.min(Math.max(noPrice, 0), 1)
  const yesLeads = safeYesPrice >= safeNoPrice
  const boxPadding = size === 'sm' ? 'px-3 py-3' : 'px-4 py-4'
  const boxValue = size === 'sm' ? 'text-[1.45rem]' : 'text-[1.8rem]'
  const barHeight = size === 'sm' ? 'h-3.5' : 'h-4'

  return (
    <div className={size === 'sm' ? 'space-y-2.5' : 'space-y-3'}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div
          className={`rounded-lg border ${
            yesLeads
              ? 'border-[var(--color-up-border)] bg-[var(--color-up-dim)] text-[var(--color-up)]'
              : 'border-[var(--color-down-border)] bg-[var(--color-down-dim)] text-[var(--color-down)]'
          } ${boxPadding}`}
        >
          <div className="stat-label text-current/70">Yes</div>
          <div className={`mono-data mt-1 font-medium leading-none ${boxValue}`}>
            {formatProbability(safeYesPrice)}
          </div>
        </div>
        <div
          className={`rounded-lg border ${
            yesLeads
              ? 'border-[var(--color-down-border)] bg-[var(--color-down-dim)] text-[var(--color-down)]'
              : 'border-[var(--color-up-border)] bg-[var(--color-up-dim)] text-[var(--color-up)]'
          } ${boxPadding} text-right`}
        >
          <div className="stat-label text-current/70">No</div>
          <div className={`mono-data mt-1 font-medium leading-none ${boxValue}`}>
            {formatProbability(safeNoPrice)}
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        <div className={`flex ${barHeight}`}>
          <div
            className={yesLeads ? 'bg-[var(--color-up)]' : 'bg-[var(--color-down)]'}
            style={{ width: `${safeYesPrice * 100}%` }}
          />
          <div
            className={yesLeads ? 'bg-[var(--color-down)]' : 'bg-[var(--color-up)]'}
            style={{ width: `${safeNoPrice * 100}%` }}
          />
        </div>
        <div className="pointer-events-none absolute inset-y-1 left-1/2 w-px -translate-x-1/2 rounded-full bg-[var(--surface-meter-divider)]" />
      </div>
    </div>
  )
}

function MarketBoardRow({
  market,
  provider,
}: {
  market: PulseMarket
  provider: 'bayse' | 'polymarket'
}) {
  const secondaryMetricLabel =
    market.totalOrders > 0 ? 'Orders' : 'Liquidity'
  const secondaryMetricValue =
    market.totalOrders > 0 ? market.totalOrders : market.liquidity

  return (
    <div className="panel-elevated p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_88px_88px_120px_120px] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PlatformBadge platform={provider} short size="sm" />
            <span className="terminal-chip border-[var(--color-border-subtle)] bg-transparent px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              {market.status}
            </span>
          </div>

          <h3 className="mt-3 max-w-4xl text-[1.02rem] font-medium leading-snug text-[var(--color-text-primary)] sm:text-[1.14rem]">
            {market.title}
          </h3>

          <div className="mt-3 overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
            <div className="flex h-1.5">
              <div
                className={
                  market.yesOutcome.price >= market.noOutcome.price
                    ? 'bg-[var(--color-up)]'
                    : 'bg-[var(--color-down)]'
                }
                style={{ width: `${market.yesOutcome.price * 100}%` }}
              />
              <div
                className={
                  market.yesOutcome.price >= market.noOutcome.price
                    ? 'bg-[var(--color-down)]'
                    : 'bg-[var(--color-up)]'
                }
                style={{ width: `${market.noOutcome.price * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-up-border)] bg-[var(--color-up-dim)] px-3 py-3 xl:rounded-none xl:border-0 xl:bg-transparent xl:px-0 xl:py-0 xl:text-right">
          <div className="stat-label">Yes</div>
          <div
            className={`mono-data mt-1 text-[1.1rem] font-medium ${
              market.yesOutcome.price >= market.noOutcome.price
                ? 'text-[var(--color-up)]'
                : 'text-[var(--color-down)]'
            }`}
          >
            {formatProbability(market.yesOutcome.price)}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-down-border)] bg-[var(--color-down-dim)] px-3 py-3 xl:rounded-none xl:border-0 xl:bg-transparent xl:px-0 xl:py-0 xl:text-right">
          <div className="stat-label">No</div>
          <div
            className={`mono-data mt-1 text-[1.1rem] font-medium ${
              market.noOutcome.price > market.yesOutcome.price
                ? 'text-[var(--color-up)]'
                : 'text-[var(--color-down)]'
            }`}
          >
            {formatProbability(market.noOutcome.price)}
          </div>
        </div>

        <div className="text-left xl:text-right">
          <div className="stat-label">{secondaryMetricLabel}</div>
          <div className="mono-data mt-1 text-base font-medium text-[var(--color-text-primary)]">
            {formatCompactNumber(secondaryMetricValue)}
          </div>
        </div>

        <div className="text-left xl:text-right">
          <div className="stat-label">
            {market.totalOrders > 0 ? 'Fee' : 'Market volume'}
          </div>
          <div className="mono-data mt-1 text-base font-medium text-[var(--color-text-primary)]">
            {market.totalOrders > 0
              ? `${market.feePercentage}%`
              : formatCompactNumber(market.totalVolume)}
          </div>
        </div>
      </div>
    </div>
  )
}

export function EventPage() {
  const eventId = useParams({
    strict: false,
    select: (params) => ('eventId' in params ? params.eventId : undefined),
  })
  const [activeTabId, setActiveTabId] = useUrlSelection({
    fallback: 'live',
    key: 'tab',
    values: EVENT_TAB_IDS,
  })
  const [activeHistoryInterval, setActiveHistoryInterval] = useUrlSelection({
    fallback: '1d',
    key: 'range',
    values: HISTORY_INTERVAL_IDS,
  })
  const eventQuery = useEventQuery(eventId)
  const compareQuery = useEventCompareQuery(eventId)
  const historyQuery = usePriceHistoryQuery(eventId, 'all')
  const liveFeed = useLiveEventPrices(eventId)

  if (eventQuery.isLoading) {
    return (
      <div className="panel p-8 text-[var(--color-text-secondary)]">
        Loading event detail...
      </div>
    )
  }

  if (eventQuery.error || !eventQuery.data) {
    return (
      <div className="panel p-8 text-[var(--color-text-secondary)]">
        <p className="text-lg text-[var(--color-down)]">
          {(eventQuery.error as Error)?.message ?? 'This event was not found.'}
        </p>
        <Link
          className="terminal-button mt-4 text-sm font-medium"
          to="/"
        >
          Back to markets
        </Link>
      </div>
    )
  }

  const event = eventQuery.data
  const primaryMarket = event.markets[0]
  const liveMarket = liveFeed.snapshot?.markets.find(
    (market) => market.marketId === primaryMarket?.id,
  )
  const liveSourceUrl = event.sourceUrl ?? event.resolutionSource
  const yesPrice = liveMarket?.yesPrice ?? primaryMarket?.yesOutcome.price ?? 0
  const noPrice = liveMarket?.noPrice ?? primaryMarket?.noOutcome.price ?? 0
  const eventFreshnessLabel = event.freshness?.syncedAt
    ? formatRelativeTime(new Date(event.freshness.syncedAt).getTime())
    : 'Snapshot timing unavailable'
  const historyFreshnessLabel = historyQuery.data?.freshness?.syncedAt
    ? formatRelativeTime(new Date(historyQuery.data.freshness.syncedAt).getTime())
    : 'History timing unavailable'
  const compareFreshnessLabel = compareQuery.data?.comparedAt
    ? formatRelativeTime(new Date(compareQuery.data.comparedAt).getTime())
    : 'Comparison timing unavailable'
  const liveStatusLabel =
    liveFeed.status === 'streaming'
      ? 'Connected'
      : liveFeed.status === 'error'
        ? 'Offline'
        : 'Reconnecting'
  const liveStatusClass =
    liveFeed.status === 'streaming'
      ? 'live-dot'
      : liveFeed.status === 'error'
        ? 'live-dot offline'
        : 'live-dot warn'

  return (
    <div className="space-y-6">
      <section className="panel p-5 lg:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_340px]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="section-kicker hover:text-[var(--color-text-primary)]"
                {...getCategoryRoute(
                  event.category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                )}
              >
                {event.category}
              </Link>
              <PlatformBadge platform={event.provider} />
              <span className="terminal-chip text-[11px] uppercase tracking-[0.18em]">
                {event.status}
              </span>
              <span className="terminal-chip text-[11px] uppercase tracking-[0.18em]">
                {getTempoLabel(event)}
              </span>
              {event.freshness?.isStale ? (
                <span className="signal-chip terminal-chip text-[11px] uppercase tracking-[0.18em]">
                  Delayed snapshot
                </span>
              ) : null}
            </div>

            <div>
              <h1 className="display-title">{event.title}</h1>
              <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                {event.description || 'This market is being tracked live on NaijaPulse.'}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="flex items-end gap-4">
                  {HISTORY_INTERVAL_IDS.map((interval) => (
                    <button
                      className={`mono-data min-h-11 border-b-2 px-2 pb-2 pt-2 text-[11px] uppercase tracking-[0.18em] transition ${
                        activeHistoryInterval === interval
                          ? 'border-[var(--color-brand)] text-[var(--color-text-primary)]'
                          : 'border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
                      }`}
                      key={interval}
                      onClick={() => setActiveHistoryInterval(interval)}
                      type="button"
                    >
                      {interval.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <PriceHistoryChart
                isLoading={historyQuery.isLoading}
                points={historyQuery.data?.points ?? []}
                range={activeHistoryInterval}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="metric-card">
                <div className="stat-label">Yes</div>
                <strong
                  className={
                    yesPrice >= noPrice
                      ? 'text-[var(--color-up)]'
                      : 'text-[var(--color-down)]'
                  }
                >
                  {formatProbability(yesPrice)}
                </strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Total volume</div>
                <strong>{formatCompactNumber(event.totalVolume)}</strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Liquidity</div>
                <strong>{formatCompactNumber(event.liquidity)}</strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Resolves</div>
                <strong>{formatDate(event.resolutionDate)}</strong>
              </div>
            </div>

            <ProbabilityMeter noPrice={noPrice} yesPrice={yesPrice} />
          </div>

          <div className="panel-elevated p-4">
            <div>
              <div className="section-kicker">Event read</div>
              <h2 className="mt-3 text-[1.65rem] font-bold leading-tight tracking-[-0.045em] text-[var(--color-text-primary)]">
                {getMarketStance(yesPrice)}
              </h2>
            </div>

            <div className="subtle-rule mt-4 pt-4">
              <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
                A compact operational read on the current state of the event.
              </p>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <span className={liveStatusClass} />
              <span className="section-kicker">{liveStatusLabel}</span>
              <span className="mono-data text-sm text-[var(--color-text-secondary)]">
                {formatRelativeTime(liveFeed.lastUpdateAt)}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 text-sm">
              <span className="text-[var(--color-text-tertiary)]">Snapshot sync</span>
              <span className="mono-data text-right text-[var(--color-text-primary)]">
                {eventFreshnessLabel}
              </span>
              <span className="text-[var(--color-text-tertiary)]">History sync</span>
              <span className="mono-data text-right text-[var(--color-text-primary)]">
                {historyFreshnessLabel}
              </span>
              <span className="text-[var(--color-text-tertiary)]">Created</span>
              <span className="mono-data text-right text-[var(--color-text-primary)]">
                {formatDateTime(event.createdAt)}
              </span>
              <span className="text-[var(--color-text-tertiary)]">Provider</span>
              <span className="mono-data text-right text-[var(--color-text-primary)]">
                {getProviderLabel(event.provider)}
              </span>
            </div>

            {liveSourceUrl ? (
              <div className="mt-5">
                <a
                  className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3 text-sm font-medium text-[var(--color-text-primary)] transition-[border-color,background-color,color] duration-150 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                  href={liveSourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {event.provider === 'polymarket'
                    ? 'Open on Polymarket'
                    : 'View resolution source'}
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {compareQuery.data ? (
        <section className="rounded-xl border border-[var(--color-brand-border)] border-l-[3px] border-l-[var(--color-brand)] bg-[var(--color-brand-dim)] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 sm:gap-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-bg-surface)]/70 p-2 text-[var(--color-brand)]">
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <rect height="5" rx="1" width="5" x="1" y="1" />
                  <rect height="5" rx="1" width="5" x="10" y="1" />
                  <rect height="5" rx="1" width="5" x="1" y="10" />
                  <rect height="5" rx="1" width="5" x="10" y="10" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <div className="section-kicker">Cross-platform link</div>
                <div className="mt-2 text-lg font-semibold leading-tight text-[var(--color-text-primary)]">
                  This event is also listed on {compareQuery.data.events.length - 1}{' '}
                  other platform{compareQuery.data.events.length - 1 === 1 ? '' : 's'}.
                </div>
                <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  Compared {compareFreshnessLabel}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2.5">
                {compareQuery.data.events.map((item) => (
                  <span
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2"
                    key={item.event.id}
                  >
                    <PlatformBadge platform={item.event.provider} short size="sm" />
                    <PriceDisplay size="sm" value={item.yesPrice} />
                  </span>
                ))}
              </div>

              <Link
                className="inline-flex items-center justify-center rounded-lg bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-[#0f1115] transition hover:brightness-[1.04]"
                {...getEventCompareRoute(event)}
              >
                View comparison
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <DeskTabs
        activeTabId={activeTabId}
        defaultTabId="live"
        items={[
          {
            content: (
              <div className="space-y-5">
                <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                  <span className={liveStatusClass} />
                  <span>{liveStatusLabel}</span>
                  <span className="mono-data text-[var(--color-text-tertiary)]">
                    {formatRelativeTime(liveFeed.lastUpdateAt)}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="metric-card">
                    <div className="stat-label">Created</div>
                    <strong>{formatDateTime(event.createdAt)}</strong>
                  </div>
                  <div className="metric-card">
                    <div className="stat-label">Resolution target</div>
                    <strong>{formatDate(event.resolutionDate)}</strong>
                  </div>
                  <div className="metric-card">
                    <div className="stat-label">Provider</div>
                    <strong>{getProviderLabel(event.provider)}</strong>
                  </div>
                  <div className="metric-card">
                    <div className="stat-label">Tracked markets</div>
                    <strong>{formatCompactNumber(event.markets.length)}</strong>
                  </div>
                </div>
              </div>
            ),
            description: 'A quick operational read on whether the live feed is flowing and what baseline metadata surrounds the event.',
            id: 'live',
            kicker: 'Live status',
            label: 'Live Pulse',
            title: 'Realtime event pulse',
          },
          {
            content: compareQuery.isLoading ? (
              <div className="panel-elevated px-4 py-5 text-sm text-[var(--color-text-secondary)]">
                Matching this event against other venues...
              </div>
            ) : compareQuery.data ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                  <span>Compared {compareFreshnessLabel}</span>
                  <span className="terminal-chip">
                    {compareQuery.data.matchMethod === 'exact'
                      ? 'Exact title/date link'
                      : 'Fuzzy title/date link'}
                  </span>
                  <span className="good-chip terminal-chip">
                    {Math.round(compareQuery.data.confidence * 100)}% confidence
                  </span>
                </div>

                <DivergenceBar items={compareQuery.data.events} />

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="metric-card">
                    <div className="stat-label">Max spread</div>
                    <strong>{formatProbabilityPoints(compareQuery.data.maxDivergence)}</strong>
                  </div>
                  <div className="metric-card">
                    <div className="stat-label">Weighted spread</div>
                    <strong>{formatProbabilityPoints(compareQuery.data.weightedDivergence)}</strong>
                  </div>
                  <div className="metric-card">
                    <div className="stat-label">Linked venues</div>
                    <strong>{formatCompactNumber(compareQuery.data.events.length)}</strong>
                  </div>
                </div>

                <div className="space-y-3">
                  {compareQuery.data.events.map((comparedEvent) => (
                    <div
                      className="panel-elevated p-4"
                      key={comparedEvent.event.id}
                    >
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_120px_120px_120px] lg:items-center">
                        <div className="min-w-0">
                          <PlatformBadge platform={comparedEvent.event.provider} size="sm" />
                          <h3 className="mt-3 text-lg font-medium leading-snug text-[var(--color-text-primary)]">
                            {comparedEvent.event.title}
                          </h3>
                          <div className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                            {comparedEvent.marketTitle}
                          </div>
                        </div>

                        <div className="text-left lg:text-right">
                          <div className="stat-label">Yes price</div>
                          <div className="mono-data mt-1 text-base font-medium text-[var(--color-text-primary)]">
                            {formatProbability(comparedEvent.yesPrice)}
                          </div>
                        </div>

                        <div className="text-left lg:text-right">
                          <div className="stat-label">Volume</div>
                          <div className="mono-data mt-1 text-base font-medium text-[var(--color-text-primary)]">
                            {formatCompactNumber(comparedEvent.totalVolume)}
                          </div>
                        </div>

                        <div className="text-left lg:text-right">
                          <div className="stat-label">Resolution</div>
                          <div className="mono-data mt-1 text-base font-medium text-[var(--color-text-primary)]">
                            {formatDate(comparedEvent.event.resolutionDate)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link
                          className="terminal-button text-sm font-medium"
                          {...getEventRoute(comparedEvent.event)}
                        >
                          Open event page
                        </Link>
                        <span className="terminal-chip text-sm">
                          {comparedEvent.event.category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    className="terminal-button text-sm font-medium"
                    {...getEventCompareRoute(event)}
                  >
                    Open compare desk
                  </Link>
                  <Link
                    className="terminal-button terminal-button-primary text-sm font-medium"
                    to="/divergence"
                  >
                    Open divergence board
                  </Link>
                </div>
              </div>
            ) : (
              <div className="panel-elevated px-4 py-5 text-sm leading-7 text-[var(--color-text-secondary)]">
                No cross-platform match has been confirmed for this event yet. The matcher only links events when title overlap and timing are strong enough to avoid false positives.
              </div>
            ),
            description: 'This is the cross-platform read: how the same event prices on other venues, and how wide the spread has become.',
            id: 'compare',
            kicker: 'Cross-platform read',
            label: 'Compare',
            title: 'How other venues are pricing this story',
          },
          {
            content: (
              <div className="space-y-5">
                <p className="whitespace-pre-line text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                  {primaryMarket?.rules || 'Rules have not been published for this market yet.'}
                </p>
                {liveSourceUrl ? (
                  <a
                    className="terminal-button terminal-button-primary text-sm font-medium"
                    href={liveSourceUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {event.provider === 'polymarket'
                      ? 'View on Polymarket'
                      : 'View resolution source'}
                  </a>
                ) : null}
              </div>
            ),
            description: 'The rules matter more than the narrative. This is where you check what actually resolves the market before reading too much into the price.',
            id: 'rules',
            kicker: 'Resolution rules',
            label: 'Rules',
            title: 'What this market is asking',
          },
        ]}
        onTabChange={setActiveTabId}
      />

      <section className="panel p-4 sm:p-5">
        <SectionHeader
          description="If an event has more than one sub-market, they live here. Some providers package a single event as multiple binary markets, so this board keeps the internal structure visible."
          kicker="Market board"
          title="Markets inside this event"
        />

        <div className="mt-5 space-y-3">
          {event.markets.map((market) => (
            <MarketBoardRow
              key={market.id}
              market={market}
              provider={event.provider}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
