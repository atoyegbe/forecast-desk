import { DeskTabs } from '../components/desk-tabs'
import { Link, useParams } from 'react-router-dom'
import { OutcomeStrip } from '../components/outcome-strip'
import { PriceHistoryChart } from '../components/price-history-chart'
import { SectionHeader } from '../components/section-header'
import { useLiveEventPrices } from '../features/events/live'
import {
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
  formatRelativeTime,
} from '../lib/format'
import { useUrlSelection } from '../lib/url-state'

const EVENT_TAB_IDS = ['live', 'rules'] as const

export function EventPage() {
  const { eventId } = useParams()
  const [activeTabId, setActiveTabId] = useUrlSelection({
    fallback: 'live',
    key: 'tab',
    values: EVENT_TAB_IDS,
  })
  const eventQuery = useEventQuery(eventId)
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
  const yesPrice = liveMarket?.yesPrice ?? primaryMarket?.yesOutcome.price ?? 0
  const noPrice = liveMarket?.noPrice ?? primaryMarket?.noOutcome.price ?? 0

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
              to={`/categories/${event.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            >
              {event.category} desk
            </Link>
            <h1 className="display-title mt-4 text-5xl leading-[0.95] text-stone-950 sm:text-6xl">
              {event.title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-stone-600 sm:text-lg">
              {event.description || 'This market is being tracked live on Pulse Markets.'}
            </p>

            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.4rem] border border-stone-900/10 bg-white p-4">
                <div className="stat-label">Yes</div>
                <div className="mt-2 text-3xl font-semibold text-teal-700">
                  {formatProbability(yesPrice)}
                </div>
              </div>
              <div className="rounded-[1.4rem] border border-stone-900/10 bg-white p-4">
                <div className="stat-label">Total volume</div>
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
          <div className="mt-6">
            <PriceHistoryChart points={historyQuery.data?.points ?? []} />
          </div>
        </section>

        <section className="panel p-6">
          <SectionHeader
            description="If an event has more than one sub-market, they live here. For now most Bayse events in this UI read like a single lead market, but the page is ready for multiple."
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
                      <div className="stat-label">Orders</div>
                      <div className="mt-1 text-lg font-semibold text-stone-950">
                        {formatCompactNumber(market.totalOrders)}
                      </div>
                    </div>
                    <div>
                      <div className="stat-label">Fee</div>
                      <div className="mt-1 text-lg font-semibold text-stone-950">
                        {market.feePercentage}%
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
                      <div className="stat-label">Currencies</div>
                      <div className="mt-2 text-base font-medium text-stone-950">
                        {event.supportedCurrencies.join(', ') || 'USD'}
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
              content: (
                <div>
                  <p className="whitespace-pre-line text-base leading-8 text-stone-600">
                    {primaryMarket?.rules || 'Rules have not been published for this market yet.'}
                  </p>
                  {event.resolutionSource ? (
                    <a
                      className="dark-pill mt-6 border border-stone-900/10 px-4 py-2 text-sm font-medium"
                      href={event.resolutionSource}
                      rel="noreferrer"
                      target="_blank"
                    >
                      View resolution source
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
