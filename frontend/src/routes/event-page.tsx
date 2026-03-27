import { DeskTabs } from '../components/desk-tabs'
import {
  Link,
  useParams,
} from '@tanstack/react-router'
import { DivergenceBar } from '../components/divergence-bar'
import { OutcomeStrip } from '../components/outcome-strip'
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
  const eventQuery = useEventQuery(eventId)
  const compareQuery = useEventCompareQuery(eventId)
  const historyQuery = usePriceHistoryQuery(eventId, '1d')
  const liveFeed = useLiveEventPrices(eventId)

  if (eventQuery.isLoading) {
    return (
      <div className="panel p-8 text-stone-500">
        Loading event detail...
      </div>
    )
  }

  if (eventQuery.error || !eventQuery.data) {
    return (
      <div className="panel p-8 text-stone-600">
        <p className="text-lg text-rose-700">
          {(eventQuery.error as Error)?.message ?? 'This event was not found.'}
        </p>
        <Link
          className="mt-4 inline-flex rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm text-stone-900"
          to="/"
        >
          Back to front page
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

  return (
    <div className="space-y-8">
      <section className="panel overflow-hidden">
        <div className="grid 2xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
          <div className="relative min-h-[320px] bg-stone-950">
            {event.imageUrl ? (
              <img
                alt={event.title}
                className="absolute inset-0 h-full w-full object-cover opacity-80"
                src={event.imageUrl}
              />
            ) : null}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.78))]" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-stone-50">
              <div className="section-kicker text-stone-300">Market read</div>
              <div className="mt-3 max-w-sm text-sm leading-7 text-stone-200">
                {getMarketStance(yesPrice)}
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            <Link
              className="section-kicker text-stone-500 hover:text-stone-900"
              {...getCategoryRoute(
                event.category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              )}
            >
              {event.category} desk / {getProviderLabel(event.provider)}
            </Link>
            <h1 className="display-title mt-4 text-5xl leading-[0.95] text-stone-950 sm:text-6xl">
              {event.title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-stone-600 sm:text-lg">
              {event.description || 'This market is being tracked live on Pulse Markets.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-stone-500">
              <span>
                Snapshot synced {eventFreshnessLabel}
              </span>
              {event.freshness?.isStale ? (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-700">
                  Delayed backend snapshot
                </span>
              ) : null}
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.4rem] border border-stone-900/10 bg-white p-4">
                <div className="stat-label">Yes</div>
                <div className="mt-2 text-3xl font-semibold text-teal-700">
                  {formatProbability(yesPrice)}
                </div>
              </div>
              <div className="rounded-[1.4rem] border border-stone-900/10 bg-white p-4">
                <div className="stat-label">Traded volume</div>
                <div className="mt-2 text-3xl font-semibold text-stone-950">
                  {formatCompactNumber(event.totalVolume)}
                </div>
              </div>
              <div className="rounded-[1.4rem] border border-stone-900/10 bg-white p-4">
                <div className="stat-label">Tempo</div>
                <div className="mt-2 text-2xl font-semibold text-stone-950">
                  {getTempoLabel(event)}
                </div>
              </div>
            </div>

            <div className="mt-7">
              <OutcomeStrip noPrice={noPrice} yesPrice={yesPrice} />
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        <section className="panel p-6">
          <SectionHeader
            description="A clean intraday view of the primary market. This is the fastest way to see whether the market is steadily drifting or repricing in steps."
            kicker="Price history"
            title={historyQuery.data?.marketTitle ?? 'Primary market'}
          />
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-stone-500">
            <span>
              History synced {historyFreshnessLabel}
            </span>
            {historyQuery.isLoading ? (
              <span className="rounded-full border border-stone-900/10 bg-stone-950/[0.03] px-3 py-1 text-stone-600">
                Loading stored history
              </span>
            ) : historyQuery.data?.freshness?.isStale ? (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-700">
                Using delayed stored history
              </span>
            ) : historyQuery.data ? (
              <span className="rounded-full border border-teal-700/10 bg-teal-700/5 px-3 py-1 text-teal-700">
                Stored backend history
              </span>
            ) : (
              <span className="rounded-full border border-stone-900/10 bg-stone-950/[0.03] px-3 py-1 text-stone-600">
                History snapshot unavailable
              </span>
            )}
          </div>
          <div className="mt-6">
            <PriceHistoryChart points={historyQuery.data?.points ?? []} />
          </div>
        </section>

        <section className="panel p-6">
          <SectionHeader
            description="If an event has more than one sub-market, they live here. Some providers package a single event as multiple binary markets, so this board keeps the internal structure visible."
            kicker="Market board"
            title="Markets inside this event"
          />

          <div className="mt-6 space-y-4">
            {event.markets.map((market) => (
              <div
                className="rounded-[1.5rem] border border-stone-900/10 bg-white p-5"
                key={market.id}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="section-kicker">{market.status}</div>
                    <h3 className="mt-3 text-2xl font-semibold leading-tight text-stone-950">
                      {market.title}
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-stone-600">
                    <div>
                      <div className="stat-label">
                        {market.totalOrders > 0 ? 'Orders' : 'Liquidity'}
                      </div>
                      <div className="mt-1 text-lg font-semibold text-stone-950">
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
                      <div className="mt-1 text-lg font-semibold text-stone-950">
                        {market.totalOrders > 0
                          ? `${market.feePercentage}%`
                          : formatCompactNumber(market.totalVolume)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
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
                  <div className="flex items-center gap-3 text-sm text-stone-600">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        liveFeed.status === 'streaming'
                          ? 'bg-teal-500 shadow-[0_0_18px_rgba(20,184,166,0.35)]'
                          : liveFeed.status === 'error'
                            ? 'bg-rose-500'
                            : 'bg-stone-400'
                      }`}
                    />
                    <span className="capitalize">{liveFeed.status}</span>
                    <span className="text-stone-400">
                      {formatRelativeTime(liveFeed.lastUpdateAt)}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                      <div className="stat-label">Created</div>
                      <div className="mt-2 text-base font-medium text-stone-950">
                        {formatDateTime(event.createdAt)}
                      </div>
                    </div>
                    <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                      <div className="stat-label">Resolution target</div>
                      <div className="mt-2 text-base font-medium text-stone-950">
                        {formatDate(event.resolutionDate)}
                      </div>
                    </div>
                    <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                      <div className="stat-label">Provider</div>
                      <div className="mt-2 text-base font-medium text-stone-950">
                        {getProviderLabel(event.provider)}
                      </div>
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
                <div className="rounded-[1.35rem] border border-stone-900/10 bg-white px-4 py-5 text-sm text-stone-600">
                  Matching this event against other venues...
                </div>
              ) : compareQuery.data ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
                    <span>
                      Compared {compareFreshnessLabel}
                    </span>
                    <span className="rounded-full border border-stone-900/10 bg-white px-3 py-1 text-stone-700">
                      {compareQuery.data.matchMethod === 'exact'
                        ? 'Exact title/date link'
                        : 'Fuzzy title/date link'}
                    </span>
                    <span className="rounded-full border border-teal-700/10 bg-teal-700/5 px-3 py-1 text-teal-700">
                      {Math.round(compareQuery.data.confidence * 100)}% confidence
                    </span>
                  </div>

                  <DivergenceBar items={compareQuery.data.events} />

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                      <div className="stat-label">Max spread</div>
                      <div className="mt-2 text-3xl font-semibold text-stone-950">
                        {formatProbabilityPoints(compareQuery.data.maxDivergence)}
                      </div>
                    </div>
                    <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                      <div className="stat-label">Weighted spread</div>
                      <div className="mt-2 text-3xl font-semibold text-stone-950">
                        {formatProbabilityPoints(compareQuery.data.weightedDivergence)}
                      </div>
                    </div>
                    <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                      <div className="stat-label">Linked venues</div>
                      <div className="mt-2 text-3xl font-semibold text-stone-950">
                        {formatCompactNumber(compareQuery.data.events.length)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {compareQuery.data.events.map((comparedEvent) => (
                      <div
                        className="rounded-[1.45rem] border border-stone-900/10 bg-white p-5"
                        key={comparedEvent.event.id}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="section-kicker">
                              {getProviderLabel(comparedEvent.event.provider)}
                            </div>
                            <h3 className="mt-3 text-2xl font-semibold leading-tight text-stone-950">
                              {comparedEvent.event.title}
                            </h3>
                            <div className="mt-3 text-sm leading-7 text-stone-600">
                              {comparedEvent.marketTitle}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm text-stone-600 lg:min-w-[15rem]">
                            <div>
                              <div className="stat-label">Yes price</div>
                              <div className="mt-1 text-lg font-semibold text-teal-700">
                                {formatProbability(comparedEvent.yesPrice)}
                              </div>
                            </div>
                            <div>
                              <div className="stat-label">Volume</div>
                              <div className="mt-1 text-lg font-semibold text-stone-950">
                                {formatCompactNumber(comparedEvent.totalVolume)}
                              </div>
                            </div>
                            <div>
                              <div className="stat-label">Resolution</div>
                              <div className="mt-1 text-lg font-semibold text-stone-950">
                                {formatDate(comparedEvent.event.resolutionDate)}
                              </div>
                            </div>
                            <div>
                              <div className="stat-label">Snapshot</div>
                              <div className="mt-1 text-lg font-semibold text-stone-950">
                                {comparedEvent.event.freshness?.syncedAt
                                  ? formatRelativeTime(
                                      new Date(comparedEvent.event.freshness.syncedAt).getTime(),
                                    )
                                  : 'Unavailable'}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <Link
                            className="dark-pill px-4 py-2 text-sm"
                            {...getEventRoute(comparedEvent.event)}
                          >
                            Open event page
                          </Link>
                          <span className="rounded-full border border-stone-900/10 bg-stone-950/[0.03] px-4 py-2 text-sm text-stone-700">
                            {comparedEvent.event.category}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      className="dark-pill px-4 py-2 text-sm"
                      to="/divergence"
                    >
                      Open divergence board
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="rounded-[1.35rem] border border-stone-900/10 bg-white px-4 py-5 text-sm leading-7 text-stone-600">
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
                  <p className="whitespace-pre-line text-base leading-8 text-stone-600">
                    {primaryMarket?.rules || 'Rules have not been published for this market yet.'}
                  </p>
                  {liveSourceUrl ? (
                    <a
                      className="dark-pill mt-6 border border-stone-900/10 px-4 py-2 text-sm font-medium"
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
