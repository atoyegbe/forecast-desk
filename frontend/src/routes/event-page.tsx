import {
  Link,
  useParams,
} from '@tanstack/react-router'
import { DeskTabs } from '../components/desk-tabs'
import { DivergenceBar } from '../components/divergence-bar'
import { OutcomeStrip } from '../components/outcome-strip'
import { PlatformBadge } from '../components/platform-badge'
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
  getEventRoute,
} from '../lib/routes'
import { useUrlSelection } from '../lib/url-state'

const EVENT_TAB_IDS = ['live', 'rules', 'compare'] as const
const HISTORY_INTERVAL_IDS = ['1h', '4h', '1d', '1w'] as const

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
  const historyQuery = usePriceHistoryQuery(eventId, activeHistoryInterval)
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
  const liveStatusClass =
    liveFeed.status === 'streaming'
      ? 'live-dot'
      : liveFeed.status === 'error'
        ? 'live-dot offline'
        : 'live-dot warn'

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.18fr)_320px] lg:p-6">
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
                <div className="stat-label">Tempo</div>
                <strong>{getTempoLabel(event)}</strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Total volume</div>
                <strong>{formatCompactNumber(event.totalVolume)}</strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Resolves</div>
                <strong>{formatDate(event.resolutionDate)}</strong>
              </div>
            </div>

            <OutcomeStrip noPrice={noPrice} yesPrice={yesPrice} />
          </div>

          <div className="grid gap-4">
            <div className="panel-elevated relative min-h-[220px] overflow-hidden">
              <div className="absolute inset-0">
                {event.imageUrl ? (
                  <img
                    alt={event.title}
                    className="h-full w-full object-cover object-top opacity-40"
                    src={event.imageUrl}
                  />
                ) : null}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,15,16,0.18),rgba(13,15,16,0.94))]" />
              </div>
              <div className="relative flex h-full flex-col justify-end p-5">
                <div className="section-kicker">Market read</div>
                <div className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
                  {getMarketStance(yesPrice)}
                </div>
              </div>
            </div>

            <div className="panel-elevated p-4">
              <div className="flex items-center gap-2">
                <span className={liveStatusClass} />
                <span className="section-kicker">
                  {liveFeed.status === 'streaming'
                    ? 'Live'
                    : liveFeed.status === 'error'
                      ? 'Offline'
                      : 'Reconnecting'}
                </span>
              </div>
              <div className="mt-3 space-y-3 text-sm text-[var(--color-text-secondary)]">
                <div className="flex items-center justify-between gap-3">
                  <span>Snapshot sync</span>
                  <span className="mono-data text-[var(--color-text-primary)]">
                    {eventFreshnessLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Resolution target</span>
                  <span className="mono-data text-[var(--color-text-primary)]">
                    {formatDate(event.resolutionDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Provider</span>
                  <span className="text-[var(--color-text-primary)]">
                    {getProviderLabel(event.provider)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {compareQuery.data ? (
        <section className="panel-elevated p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="section-kicker">Cross-platform link</div>
              <div className="mt-2 text-lg font-medium text-[var(--color-text-primary)]">
                This event is also listed on {compareQuery.data.events.length - 1}{' '}
                other platform{compareQuery.data.events.length - 1 === 1 ? '' : 's'}.
              </div>
              <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Compared {compareFreshnessLabel}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {compareQuery.data.events.map((item) => (
                <span
                  className="terminal-chip gap-2"
                  key={item.event.id}
                >
                  <PlatformBadge platform={item.event.provider} short size="sm" />
                  <span className="mono-data text-[var(--color-text-primary)]">
                    {formatProbability(item.yesPrice)}
                  </span>
                </span>
              ))}
              <Link
                className="terminal-button terminal-button-primary text-sm font-medium"
                search={{ tab: 'compare' }}
                {...getEventRoute(event)}
              >
                View comparison
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="panel p-4 sm:p-5">
        <SectionHeader
          description="The chart stays on a fixed 0 to 100 scale so short-term repricings do not visually overstate themselves."
          kicker="Price history"
          title={historyQuery.data?.marketTitle ?? 'Primary market'}
        />

        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {HISTORY_INTERVAL_IDS.map((interval) => (
              <button
                className={`terminal-chip px-3 py-2 text-[11px] uppercase tracking-[0.18em] ${
                  activeHistoryInterval === interval
                    ? 'terminal-chip-active'
                    : 'border-[var(--color-border-subtle)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
                }`}
                key={interval}
                onClick={() => setActiveHistoryInterval(interval)}
                type="button"
              >
                {interval.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <span className="terminal-chip">History synced {historyFreshnessLabel}</span>
            {historyQuery.isLoading ? (
              <span className="terminal-chip">Loading stored history</span>
            ) : historyQuery.data?.freshness?.isStale ? (
              <span className="signal-chip terminal-chip">Using delayed stored history</span>
            ) : historyQuery.data ? (
              <span className="good-chip terminal-chip">Stored backend history</span>
            ) : (
              <span className="terminal-chip">History unavailable</span>
            )}
          </div>
        </div>

        <div className="mt-5">
          <PriceHistoryChart points={historyQuery.data?.points ?? []} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.22fr)_360px]">
        <section className="panel p-4 sm:p-5">
          <SectionHeader
            description="If an event has more than one sub-market, they live here. Some providers package a single event as multiple binary markets, so this board keeps the internal structure visible."
            kicker="Market board"
            title="Markets inside this event"
          />

          <div className="mt-5 space-y-4">
            {event.markets.map((market) => (
              <div
                className="panel-elevated p-4"
                key={market.id}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <PlatformBadge platform={event.provider} size="sm" />
                      <span className="terminal-chip text-[11px] uppercase tracking-[0.18em]">
                        {market.status}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-medium leading-snug text-[var(--color-text-primary)]">
                      {market.title}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm text-[var(--color-text-secondary)] lg:min-w-[16rem]">
                    <div>
                      <div className="stat-label">
                        {market.totalOrders > 0 ? 'Orders' : 'Liquidity'}
                      </div>
                      <div className="mono-data mt-1 text-base font-medium text-[var(--color-text-primary)]">
                        {formatCompactNumber(
                          market.totalOrders > 0
                            ? market.totalOrders
                            : market.liquidity,
                        )}
                      </div>
                    </div>
                    <div>
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

                <div className="mt-4">
                  <OutcomeStrip
                    noPrice={market.noOutcome.price}
                    yesPrice={market.yesOutcome.price}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <DeskTabs
          activeTabId={activeTabId}
          defaultTabId="live"
          items={[
            {
              content: (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                    <span className={liveStatusClass} />
                    <span className="capitalize">{liveFeed.status}</span>
                    <span className="mono-data text-[var(--color-text-tertiary)]">
                      {formatRelativeTime(liveFeed.lastUpdateAt)}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
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
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <PlatformBadge platform={comparedEvent.event.provider} size="sm" />
                            <h3 className="mt-3 text-lg font-medium leading-snug text-[var(--color-text-primary)]">
                              {comparedEvent.event.title}
                            </h3>
                            <div className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                              {comparedEvent.marketTitle}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm text-[var(--color-text-secondary)] lg:min-w-[15rem]">
                            <div>
                              <div className="stat-label">Yes price</div>
                              <div className="mono-data mt-1 text-base font-medium text-[var(--color-text-primary)]">
                                {formatProbability(comparedEvent.yesPrice)}
                              </div>
                            </div>
                            <div>
                              <div className="stat-label">Volume</div>
                              <div className="mono-data mt-1 text-base font-medium text-[var(--color-text-primary)]">
                                {formatCompactNumber(comparedEvent.totalVolume)}
                              </div>
                            </div>
                            <div>
                              <div className="stat-label">Resolution</div>
                              <div className="mono-data mt-1 text-base font-medium text-[var(--color-text-primary)]">
                                {formatDate(comparedEvent.event.resolutionDate)}
                              </div>
                            </div>
                            <div>
                              <div className="stat-label">Snapshot</div>
                              <div className="mono-data mt-1 text-base font-medium text-[var(--color-text-primary)]">
                                {comparedEvent.event.freshness?.syncedAt
                                  ? formatRelativeTime(
                                      new Date(comparedEvent.event.freshness.syncedAt).getTime(),
                                    )
                                  : 'Unavailable'}
                              </div>
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
                <div>
                  <p className="whitespace-pre-line text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                    {primaryMarket?.rules || 'Rules have not been published for this market yet.'}
                  </p>
                  {liveSourceUrl ? (
                    <a
                      className="terminal-button terminal-button-primary mt-6 text-sm font-medium"
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
      </div>
    </div>
  )
}
