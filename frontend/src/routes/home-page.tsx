import {
  startTransition,
  useDeferredValue,
  useMemo,
  useState,
} from 'react'
import { DeskTabs } from '../components/desk-tabs'
import { Link } from '@tanstack/react-router'
import { MarketRow } from '../components/market-row'
import { SectionHeader } from '../components/section-header'
import { getProviderLabel } from '../features/events/provider-ids'
import {
  useEventsQuery,
  useMoversQuery,
} from '../features/events/hooks'
import {
  EMPTY_EVENTS,
  MOVER_WINDOWS,
  getCategorySlug,
  getMoverChange,
  getMarketStance,
  getTopMoverWindow,
  getTempoLabel,
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

type HomeProviderSelection = (typeof PROVIDER_FILTER_IDS)[number]

const providerFilterMeta: Array<{
  description: string
  id: HomeProviderSelection
  label: string
}> = [
  {
    description: 'Merge every tracked venue into one public board.',
    id: 'all',
    label: 'All Venues',
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
  const effectiveCategory = categories.includes(activeCategory)
    ? activeCategory
    : 'All'

  const filteredEvents = useMemo(() => {
    return providerFilteredEvents
      .filter((event) => {
        if (effectiveCategory === 'All') {
          return true
        }

        return event.category === effectiveCategory
      })
      .sort(sortByVolume)
  }, [effectiveCategory, providerFilteredEvents])
  const moversQuery = useMoversQuery(filteredEvents, 16)

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

  return (
    <div className="space-y-8">
      <section className="panel overflow-hidden">
        <div className="grid 2xl:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.22fr)]">
          <div className="relative min-h-[420px] bg-stone-950">
            {spotlight?.imageUrl ? (
              <img
                alt={spotlight.title}
                className="absolute inset-0 h-full w-full object-cover object-top opacity-85"
                src={spotlight.imageUrl}
              />
            ) : null}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.06),rgba(0,0,0,0.78))]" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-stone-50 sm:p-7">
              <div className="section-kicker text-stone-300">Lead market</div>
              <div className="mt-3 max-w-sm text-sm leading-7 text-stone-200">
                {getMarketStance(spotlightPrice)}
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            <div className="eyebrow">Front page feature / {activeProviderLabel}</div>
            <h1 className="display-title mt-6 text-5xl leading-[0.92] text-stone-950 sm:text-6xl">
              {spotlight?.title ?? 'Reading the live public market tape.'}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
              {spotlight?.description ||
                'Pulse Markets turns raw prediction market activity into a cleaner public-facing market desk.'}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                <div className="stat-label">Yes price</div>
                <div className="mt-2 text-3xl font-semibold text-teal-700">
                  {formatProbability(spotlightPrice)}
                </div>
              </div>
              <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                <div className="stat-label">Traded volume</div>
                <div className="mt-2 text-3xl font-semibold text-stone-950">
                  {formatCompactNumber(spotlight?.totalVolume ?? 0)}
                </div>
              </div>
              <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                <div className="stat-label">Resolution</div>
                <div className="mt-2 text-lg font-semibold text-stone-950">
                  {formatDate(spotlight?.resolutionDate)}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {spotlight ? (
                <Link
                  className="dark-pill px-5 py-3 text-sm"
                  {...getEventRoute(spotlight)}
                >
                  Open lead story
                </Link>
              ) : null}
              {spotlight ? (
                <Link
                  className="inline-flex items-center justify-center rounded-full border border-stone-900/10 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-900/20"
                  {...getCategoryRoute(getCategorySlug(spotlight.category))}
                >
                  Browse {spotlight.category} desk
                </Link>
              ) : null}
              {spotlight ? (
                <span className="inline-flex items-center justify-center rounded-full border border-stone-900/10 bg-white px-5 py-3 text-sm font-semibold text-stone-600">
                  {getProviderLabel(spotlight.provider)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {categoryDesks.map((desk) => (
          <Link
            className="panel p-5 transition hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(28,25,23,0.1)]"
            key={desk.category}
            {...getCategoryRoute(getCategorySlug(desk.category))}
          >
            <div className="section-kicker">{desk.category} desk</div>
            <div className="mt-4 text-xl font-semibold leading-snug text-stone-950">
              {desk.lead?.title}
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 text-sm text-stone-500">
              <span>{desk.count} events</span>
              <span>{desk.venueLabel}</span>
            </div>
            <div className="mt-2 flex items-center justify-end gap-4 text-sm text-stone-500">
              <span>
                {formatCompactNumber(desk.lead?.totalVolume ?? 0)}{' '}
                traded
              </span>
            </div>
          </Link>
        ))}
      </section>

      <section className="space-y-4">
        <SectionHeader
          description="The main board is where volume is concentrated. This is the fastest way to scan what the market cares about before diving into a category desk."
          kicker="Main board"
          title="Where the tape is thickest"
        />

        <div className="panel p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-2xl">
              <div className="section-kicker">Discovery</div>
              <p className="mt-3 text-sm leading-7 text-stone-600">
                Search the live board, lock it to a venue, or narrow it to a
                desk without leaving the main scan.
              </p>
            </div>

            <div className="flex flex-col gap-3 xl:min-w-[58%] xl:flex-row xl:items-center xl:justify-end">
              <label className="flex min-w-[240px] flex-1 items-center gap-3 rounded-full border border-stone-900/10 bg-white px-4 py-3 text-sm text-stone-500">
                <span>Search</span>
                <input
                  className="min-w-0 flex-1 bg-transparent text-stone-950 outline-none placeholder:text-stone-400"
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
            </div>

            <div className="flex flex-col gap-3 border-t border-stone-900/10 pt-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="section-kicker">Venue filter</div>
                <div className="flex flex-wrap gap-2">
                  {providerFilterMeta.map((provider) => (
                    <button
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        activeProviderId === provider.id
                          ? 'active-pill'
                          : 'border border-stone-900/10 bg-white text-stone-700 hover:border-stone-900/20'
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

              <div className="space-y-2 lg:max-w-[34rem]">
                <div className="section-kicker">Desk filter</div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {categories.map((category) => (
                    <button
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        effectiveCategory === category
                          ? 'dark-pill'
                          : 'border border-stone-900/10 bg-white text-stone-700 hover:border-stone-900/20'
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
        </div>

        {eventsQuery.isLoading ? (
          <div className="panel p-6 text-stone-500">
            Loading the live market board...
          </div>
        ) : null}

        {eventsQuery.error ? (
          <div className="panel p-6 text-rose-700">
            {(eventsQuery.error as Error).message}
          </div>
        ) : null}

        {!eventsQuery.isLoading && !eventsQuery.error && !hasBoardResults ? (
          <div className="panel p-6 text-stone-600">
            No open markets matched this venue and desk combination.
          </div>
        ) : null}

        <div className="space-y-4">
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
                <div className="rounded-[1.4rem] border border-stone-900/10 bg-stone-950/[0.03] p-5">
                  <div className="stat-label">Largest repricing sampled</div>
                  <div className="mt-3 text-2xl font-semibold leading-snug text-stone-950">
                    {leadMover?.event.title ?? 'Waiting for mover data'}
                  </div>
                  <div className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
                    {leadMover
                      ? getMarketStance(leadMover.currentPrice)
                      : 'We sample high-volume names and compare them with prior daily history to surface actual repricings.'}
                  </div>
                  {leadMover ? (
                    <div className="mt-4 inline-flex rounded-full bg-teal-700 px-3 py-2 text-sm font-medium text-white">
                      {formatSignedProbabilityChange(
                        getMoverChange(leadMover, activeMoverWindow),
                      )}{' '}
                      over {activeMoverWindow.toUpperCase()}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                    <div className="stat-label">Open names</div>
                    <div className="mt-2 text-3xl font-semibold text-stone-950">
                      {formatCompactNumber(events.length)}
                    </div>
                  </div>
                  <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                    <div className="stat-label">Tracked desks</div>
                    <div className="mt-2 text-3xl font-semibold text-stone-950">
                      {formatCompactNumber(categories.length - 1)}
                    </div>
                  </div>
                  <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                    <div className="stat-label">Lead tempo</div>
                    <div className="mt-2 text-2xl font-semibold text-stone-950">
                      {spotlight ? getTempoLabel(spotlight) : 'Loading'}
                    </div>
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
                        className={`rounded-full px-3 py-2 text-xs font-medium uppercase tracking-[0.22em] transition ${
                          activeMoverWindow === window.id
                            ? 'active-pill'
                            : 'border border-stone-900/10 bg-white text-stone-600 hover:border-stone-900/20'
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
            description: 'Order count is still a rough signal, but it points to stories attracting real participation before we add a deeper sentiment layer.',
            id: 'velocity',
            kicker: 'Velocity desk',
            label: 'Velocity',
            title: 'Crowded conversations',
          },
        ]}
        onTabChange={setActiveTabId}
      />
    </div>
  )
}
