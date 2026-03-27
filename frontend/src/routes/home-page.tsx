import {
  startTransition,
  useDeferredValue,
  useMemo,
  useState,
} from 'react'
import { Link } from '@tanstack/react-router'
import { CompactMarketCard } from '../components/compact-market-card'
import { DeskTabs } from '../components/desk-tabs'
import { MarketRow } from '../components/market-row'
import { PlatformBadge } from '../components/platform-badge'
import { SectionHeader } from '../components/section-header'
import { getProviderLabel } from '../features/events/provider-ids'
import {
  useDivergenceQuery,
  useEventsQuery,
  useMoversQuery,
} from '../features/events/hooks'
import {
  EMPTY_EVENTS,
  MOVER_WINDOWS,
  getCategorySlug,
  getMoverChange,
  getMarketStance,
  getTempoLabel,
  getTopMoverWindow,
  getYesPrice,
  isNigeriaRelevant,
  sortByActivityScore,
  sortByTightRace,
  sortByVolume,
} from '../features/events/insights'
import {
  formatCompactNumber,
  formatDate,
  formatProbability,
  formatProbabilityPoints,
  formatSignedProbabilityChange,
} from '../lib/format'
import {
  getCategoryRoute,
  getEventRoute,
} from '../lib/routes'
import { useUrlSelection } from '../lib/url-state'
import type {
  PulseMoverWindow,
  PulseProvider,
} from '../features/events/types'

const HOME_TAB_IDS = ['briefing', 'repricing', 'closest', 'velocity'] as const
const MOVER_WINDOW_IDS: readonly PulseMoverWindow[] = ['1h', '6h', '24h']
const PROVIDER_FILTER_IDS = ['all', 'bayse', 'polymarket'] as const
const BOARD_CATEGORY_MERGE_MAP: Record<string, string> = {
  Starmer: 'Politics',
  Trump: 'Politics',
}

type HomeProviderSelection = (typeof PROVIDER_FILTER_IDS)[number]

const providerFilterMeta: Array<{
  description: string
  id: HomeProviderSelection
  label: string
}> = [
  {
    description: 'Merge every tracked venue into one public board.',
    id: 'all',
    label: 'All venues',
  },
  {
    description: 'Read only Bayse markets.',
    id: 'bayse',
    label: 'Bayse',
  },
  {
    description: 'Read only Polymarket markets.',
    id: 'polymarket',
    label: 'Polymarket',
  },
]

function getVenueSummaryLabel(providers: PulseProvider[]) {
  if (!providers.length) {
    return 'No venues'
  }

  if (providers.length === 1) {
    return getProviderLabel(providers[0])
  }

  return 'Mixed venues'
}

function getBoardCategory(category: string) {
  return BOARD_CATEGORY_MERGE_MAP[category] ?? category
}

export function HomePage() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTabId, setActiveTabId] = useUrlSelection({
    fallback: 'briefing',
    key: 'tab',
    values: HOME_TAB_IDS,
  })
  const [activeMoverWindow, setActiveMoverWindow] = useUrlSelection({
    fallback: '24h',
    key: 'window',
    values: MOVER_WINDOW_IDS,
  })
  const [activeProviderId, setActiveProviderId] = useUrlSelection({
    fallback: 'all',
    key: 'provider',
    values: PROVIDER_FILTER_IDS,
  })
  const deferredSearchTerm = useDeferredValue(searchTerm.trim())
  const eventsQuery = useEventsQuery({
    keyword: deferredSearchTerm.length >= 2 ? deferredSearchTerm : undefined,
    status: 'open',
  })
  const events = eventsQuery.data ?? EMPTY_EVENTS
  const providerFilteredEvents = useMemo(() => {
    if (activeProviderId === 'all') {
      return events
    }

    return events.filter((event) => event.provider === activeProviderId)
  }, [activeProviderId, events])

  const categories = useMemo(() => {
    return [
      'All',
      ...new Set(providerFilteredEvents.map((event) => event.category).sort()),
    ]
  }, [providerFilteredEvents])
  const boardCategories = useMemo(() => {
    return [
      'All',
      ...new Set(
        providerFilteredEvents.map((event) => getBoardCategory(event.category)).sort(),
      ),
    ]
  }, [providerFilteredEvents])
  const effectiveCategory = boardCategories.includes(activeCategory)
    ? activeCategory
    : 'All'

  const filteredEvents = useMemo(() => {
    return providerFilteredEvents
      .filter((event) => {
        if (effectiveCategory === 'All') {
          return true
        }

        return getBoardCategory(event.category) === effectiveCategory
      })
      .sort(sortByVolume)
  }, [effectiveCategory, providerFilteredEvents])
  const moversQuery = useMoversQuery(filteredEvents, 16)
  const divergenceQuery = useDivergenceQuery({
    limit: 3,
    sort: 'divergence',
  })

  const nigeriaDesk = useMemo(() => {
    return providerFilteredEvents.filter(isNigeriaRelevant).sort(sortByVolume)
  }, [providerFilteredEvents])

  const rankedMovers = useMemo(() => {
    return getTopMoverWindow(moversQuery.data ?? [], activeMoverWindow)
  }, [activeMoverWindow, moversQuery.data])
  const moversUp = rankedMovers
    .filter((mover) => getMoverChange(mover, activeMoverWindow) > 0)
    .slice(0, 3)
  const moversDown = rankedMovers
    .filter((mover) => getMoverChange(mover, activeMoverWindow) < 0)
    .slice(0, 3)
  const spotlight = nigeriaDesk[0] ?? filteredEvents[0]
  const volumeLeaders = filteredEvents.slice(0, 6)
  const tightRaces = [...filteredEvents].sort(sortByTightRace).slice(0, 3)
  const highVelocity = [...filteredEvents].sort(sortByActivityScore).slice(0, 4)
  const categoryDesks = categories
    .filter((category) => category !== 'All')
    .map((category) => {
      const categoryEvents = providerFilteredEvents
        .filter((event) => event.category === category)
        .sort(sortByActivityScore)
      const venueMix = Array.from(
        new Set(categoryEvents.map((event) => event.provider)),
      ) as PulseProvider[]

      return {
        category,
        count: categoryEvents.length,
        lead: categoryEvents[0],
        venueLabel: getVenueSummaryLabel(venueMix),
      }
    })
    .filter((entry) => entry.lead)
    .slice(0, 4)
  const spotlightPrice = getYesPrice(spotlight)
  const leadMover = rankedMovers[0]
  const activeProviderLabel =
    activeProviderId === 'all'
      ? 'All venues'
      : getProviderLabel(activeProviderId)
  const hasBoardResults = filteredEvents.length > 0
  const topDivergences = divergenceQuery.data ?? []
  const trendingSidebarEvents = volumeLeaders.slice(0, 3)

  return (
    <div className="space-y-6">
      <section className="panel p-5 lg:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_360px]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Signal feed</span>
              <span className="terminal-chip text-[11px] uppercase tracking-[0.18em]">
                {activeProviderLabel}
              </span>
              <span className="terminal-chip text-[11px] uppercase tracking-[0.18em]">
                {formatCompactNumber(filteredEvents.length)} open markets
              </span>
            </div>

            <div>
              <div className="section-kicker">What the crowd is saying now</div>
              <h1 className="display-title mt-3">
                {spotlight?.title ?? 'Reading the live market tape.'}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                {spotlight?.description ||
                  'NaijaPulse is a data-dense public market desk. Scan the lead market, then move directly into repricings, divergence, and the densest order flow on the board.'}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="metric-card">
                <div className="stat-label">Yes price</div>
                <strong
                  className={
                    spotlightPrice >= 0.5
                      ? 'text-[var(--color-up)]'
                      : 'text-[var(--color-down)]'
                  }
                >
                  {formatProbability(spotlightPrice)}
                </strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Traded volume</div>
                <strong>{formatCompactNumber(spotlight?.totalVolume ?? 0)}</strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Resolution</div>
                <strong>{formatDate(spotlight?.resolutionDate)}</strong>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {spotlight ? (
                <Link
                  className="terminal-button terminal-button-primary text-sm font-medium"
                  {...getEventRoute(spotlight)}
                >
                  Open market
                </Link>
              ) : null}
              {spotlight ? (
                <Link
                  className="terminal-button text-sm font-medium"
                  {...getCategoryRoute(getCategorySlug(spotlight.category))}
                >
                  Browse {spotlight.category}
                </Link>
              ) : null}
              {spotlight ? (
                <span className="terminal-chip text-sm">
                  {getProviderLabel(spotlight.provider)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="panel-elevated p-4">
              <SectionHeader
                description="Lead market"
                kicker="Top line"
                title={spotlight?.title ?? 'Watching the board'}
              />
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {spotlight ? (
                    <PlatformBadge platform={spotlight.provider} size="sm" />
                  ) : null}
                  <span className="terminal-chip text-[11px] uppercase tracking-[0.18em]">
                    {spotlight?.category ?? 'Open desk'}
                  </span>
                </div>
                <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
                  {getMarketStance(spotlightPrice)}
                </p>
              </div>
            </div>

            <div className="panel-elevated p-4">
              <SectionHeader
                description="The front page stays compact: breadth, desk count, and the strongest sampled repricing."
                kicker="Desk snapshot"
                title="Market structure right now"
              />
              <div className="mt-4 grid gap-3">
                <div className="metric-card">
                  <div className="stat-label">Open names</div>
                  <strong>{formatCompactNumber(events.length)}</strong>
                </div>
                <div className="metric-card">
                  <div className="stat-label">Tracked desks</div>
                  <strong>{formatCompactNumber(categories.length - 1)}</strong>
                </div>
                <div className="metric-card">
                  <div className="stat-label">Largest repricing</div>
                  <strong>
                    {leadMover
                      ? formatSignedProbabilityChange(
                          getMoverChange(leadMover, activeMoverWindow),
                        )
                      : 'Watching'}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
        <div className="space-y-6">
          <section className="panel p-4 sm:p-5">
            <SectionHeader
              description="Use search, venue filters, and category desks without leaving the main board. The feed stays dense and shareable through URL state."
              kicker="Discovery"
              title="Scan the board"
            />

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
              <label className="terminal-input">
                <span className="section-kicker !tracking-[0.14em]">Search</span>
                <input
                  onChange={(event) => {
                    const nextValue = event.target.value

                    startTransition(() => {
                      setSearchTerm(nextValue)
                    })
                  }}
                  placeholder="Ayra, election, AFCON..."
                  value={searchTerm}
                />
              </label>

              <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-start xl:min-w-[28rem]">
                <div className="space-y-2 lg:min-w-[11rem]">
                  <div className="section-kicker">Venue</div>
                  <div className="flex flex-wrap gap-2">
                    {providerFilterMeta.map((provider) => (
                      <button
                        className={`terminal-chip px-3 py-2 text-[11px] uppercase tracking-[0.18em] ${
                          activeProviderId === provider.id
                            ? 'terminal-chip-active'
                            : 'border-[var(--color-border-subtle)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
                        }`}
                        key={provider.id}
                        onClick={() => {
                          startTransition(() => {
                            setActiveProviderId(provider.id)
                          })
                        }}
                        title={provider.description}
                        type="button"
                      >
                        {provider.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 lg:min-w-[18rem] lg:flex-1">
                  <div className="section-kicker">Category</div>
                  <div className="flex flex-wrap gap-2">
                    {boardCategories.map((category) => (
                      <button
                        className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
                          effectiveCategory === category
                            ? 'border-[var(--color-brand)] bg-[rgba(0,197,142,0.15)] text-[var(--color-brand)]'
                            : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                        }`}
                        key={category}
                        onClick={() => {
                          startTransition(() => {
                            setActiveCategory(category)
                          })
                        }}
                        type="button"
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader
              description="The main board ranks the open market tape by traded volume. Start here before moving into divergence or a vertical desk."
              kicker="Main board"
              title="Where order flow is thickest"
            />

            {eventsQuery.isLoading ? (
              <div className="panel p-6 text-[var(--color-text-secondary)]">
                Loading the live market board...
              </div>
            ) : null}

            {eventsQuery.error ? (
              <div className="panel p-6 text-[var(--color-down)]">
                {(eventsQuery.error as Error).message}
              </div>
            ) : null}

            {!eventsQuery.isLoading && !eventsQuery.error && !hasBoardResults ? (
              <div className="panel p-6 text-[var(--color-text-secondary)]">
                No open markets matched this venue and desk combination.
              </div>
            ) : null}

            <div className="space-y-3">
              {volumeLeaders.map((event) => (
                <MarketRow event={event} key={event.id} />
              ))}
            </div>
          </section>

          <DeskTabs
            activeTabId={activeTabId}
            defaultTabId="briefing"
            items={[
              {
                content: (
                  <div className="space-y-5">
                    <div className="panel-elevated p-4">
                      <div className="stat-label">Largest repricing sampled</div>
                      <div className="mt-3 text-xl font-medium leading-snug text-[var(--color-text-primary)]">
                        {leadMover?.event.title ?? 'Waiting for mover data'}
                      </div>
                      <div className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)]">
                        {leadMover
                          ? getMarketStance(leadMover.currentPrice)
                          : 'We sample high-volume names and compare them with prior daily history to surface actual repricings.'}
                      </div>
                      {leadMover ? (
                        <div className="signal-chip terminal-chip mt-4">
                          {formatSignedProbabilityChange(
                            getMoverChange(leadMover, activeMoverWindow),
                          )}{' '}
                          over {activeMoverWindow.toUpperCase()}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="metric-card">
                        <div className="stat-label">Open names</div>
                        <strong>{formatCompactNumber(events.length)}</strong>
                      </div>
                      <div className="metric-card">
                        <div className="stat-label">Tracked desks</div>
                        <strong>{formatCompactNumber(categories.length - 1)}</strong>
                      </div>
                      <div className="metric-card">
                        <div className="stat-label">Lead tempo</div>
                        <strong>{spotlight ? getTempoLabel(spotlight) : 'Loading'}</strong>
                      </div>
                    </div>
                  </div>
                ),
                description: 'A quick read on what is moving, how broad the board is, and how much tempo sits in the current lead story.',
                id: 'briefing',
                kicker: 'Morning briefing',
                label: 'Briefing',
                title: 'What the board is doing now',
              },
              {
                content: (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {MOVER_WINDOWS.map((window) => (
                          <button
                            className={`terminal-chip px-3 py-2 text-[11px] uppercase tracking-[0.18em] ${
                              activeMoverWindow === window.id
                                ? 'terminal-chip-active'
                                : 'border-[var(--color-border-subtle)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
                            }`}
                            key={window.id}
                            onClick={() => setActiveMoverWindow(window.id)}
                            type="button"
                          >
                            {window.label}
                          </button>
                        ))}
                      </div>
                      <div className="section-kicker">Moving up</div>
                      {moversUp.map((mover) => (
                        <MarketRow
                          accent="positive"
                          change={getMoverChange(mover, activeMoverWindow)}
                          event={mover.event}
                          key={`${mover.event.id}-up-${activeMoverWindow}`}
                        />
                      ))}
                    </div>
                    <div className="space-y-4">
                      <div className="section-kicker">Moving down</div>
                      {moversDown.map((mover) => (
                        <MarketRow
                          accent="negative"
                          change={getMoverChange(mover, activeMoverWindow)}
                          event={mover.event}
                          key={`${mover.event.id}-down-${activeMoverWindow}`}
                        />
                      ))}
                    </div>
                  </div>
                ),
                description: 'Repricing is now window-aware. Switch between one hour, six hours, and one day to separate fresh shocks from slower drifts.',
                id: 'repricing',
                kicker: 'Repricing',
                label: 'Repricing',
                title: 'Biggest moves',
              },
              {
                content: (
                  <div className="space-y-4">
                    {tightRaces.map((event) => (
                      <MarketRow event={event} key={event.id} />
                    ))}
                  </div>
                ),
                description: 'These are the names nearest the middle, where conviction is weakest and new information can still swing the board.',
                id: 'closest',
                kicker: 'Closest calls',
                label: 'Closest Calls',
                title: 'Markets that can still flip',
              },
              {
                content: (
                  <div className="space-y-4">
                    {highVelocity.map((event) => (
                      <MarketRow event={event} key={event.id} />
                    ))}
                  </div>
                ),
                description: 'Velocity blends traded volume, liquidity, and order count so the desk can surface names that are heating up before they become obvious by volume alone.',
                id: 'velocity',
                kicker: 'Velocity',
                label: 'Velocity',
                title: 'Fast tape names',
              },
            ]}
            onTabChange={setActiveTabId}
          />
        </div>

        <aside className="space-y-4">
          <section className="panel p-4">
            <SectionHeader
              description="Compact reads on the heaviest names in the book."
              kicker="Trending"
              title="High-volume markets"
            />
            <div className="mt-4 space-y-3">
              {trendingSidebarEvents.map((event) => (
                <CompactMarketCard event={event} key={event.id} />
              ))}
            </div>
          </section>

          <section className="panel p-4">
            <SectionHeader
              description="Quick entry points into the busiest desks."
              kicker="Desks"
              title="Verticals to follow"
            />
            <div className="mt-4 space-y-3">
              {categoryDesks.map((desk) => (
                <Link
                  className="panel-elevated block p-4 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)]"
                  key={desk.category}
                  {...getCategoryRoute(getCategorySlug(desk.category))}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="section-kicker">{desk.category}</div>
                    <div className="mono-data text-sm text-[var(--color-text-secondary)]">
                      {formatCompactNumber(desk.count)}
                    </div>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-[var(--color-text-primary)]">
                    {desk.lead?.title}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-[var(--color-text-secondary)]">
                    <span>{desk.venueLabel}</span>
                    <span className="mono-data">
                      {formatCompactNumber(desk.lead?.totalVolume ?? 0)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="panel p-4">
            <SectionHeader
              description="The widest stored cross-platform spreads."
              kicker="Top divergence"
              title="Where venues disagree"
            />
            <div className="mt-4 space-y-3">
              {topDivergences.length ? topDivergences.map((entry) => (
                <Link
                  className="panel-elevated block p-4 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)]"
                  key={entry.linkId}
                  search={{
                    tab: 'compare',
                  }}
                  {...getEventRoute(entry.events[0].event)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {entry.events.map((item) => (
                        <PlatformBadge
                          key={item.event.id}
                          platform={item.event.provider}
                          short
                          size="sm"
                        />
                      ))}
                    </div>
                    <div className="mono-data text-sm text-[var(--color-signal)]">
                      {formatProbabilityPoints(entry.maxDivergence)}
                    </div>
                  </div>
                  <div className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--color-text-primary)]">
                    {entry.title}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-[var(--color-text-secondary)]">
                    <span>{entry.category}</span>
                    <span>{Math.round(entry.confidence * 100)}% confidence</span>
                  </div>
                </Link>
              )) : (
                <div className="panel-elevated p-4 text-sm leading-6 text-[var(--color-text-secondary)]">
                  Divergence matches are still being computed for this board.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
