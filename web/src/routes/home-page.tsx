import {
  startTransition,
  useDeferredValue,
  useMemo,
  useState,
} from 'react'
import { DeskTabs } from '../components/desk-tabs'
import { Link } from 'react-router-dom'
import { MarketRow } from '../components/market-row'
import { SectionHeader } from '../components/section-header'
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
import { useUrlSelection } from '../lib/url-state'
import type { PulseMoverWindow } from '../features/events/types'

const HOME_TAB_IDS = ['briefing', 'repricing', 'closest', 'velocity'] as const
const MOVER_WINDOW_IDS: readonly PulseMoverWindow[] = ['1h', '6h', '24h']

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
  const deferredSearchTerm = useDeferredValue(searchTerm.trim())
  const eventsQuery = useEventsQuery({
    keyword: deferredSearchTerm.length >= 2 ? deferredSearchTerm : undefined,
    status: 'open',
  })
  const events = eventsQuery.data ?? EMPTY_EVENTS
  const moversQuery = useMoversQuery(events, 16)

  const categories = useMemo(() => {
    return ['All', ...new Set(events.map((event) => event.category).sort())]
  }, [events])

  const filteredEvents = useMemo(() => {
    return events
      .filter((event) => {
        if (activeCategory === 'All') {
          return true
        }

        return event.category === activeCategory
      })
      .sort(sortByVolume)
  }, [activeCategory, events])

  const nigeriaDesk = useMemo(() => {
    return events.filter(isNigeriaRelevant).sort(sortByVolume)
  }, [events])

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
  const highVelocity = [...events].sort(sortByActivityScore).slice(0, 4)
  const categoryDesks = categories
    .filter((category) => category !== 'All')
    .map((category) => {
      const categoryEvents = events
        .filter((event) => event.category === category)
        .sort(sortByActivityScore)

      return {
        category,
        count: categoryEvents.length,
        lead: categoryEvents[0],
      }
    })
    .filter((entry) => entry.lead)
    .slice(0, 4)
  const spotlightPrice = getYesPrice(spotlight)
  const leadMover = rankedMovers[0]

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
            <div className="eyebrow">Front page feature</div>
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
                <div className="stat-label">Total volume</div>
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
                  to={`/events/${spotlight.id}/${spotlight.slug}`}
                >
                  Open lead story
                </Link>
              ) : null}
              {spotlight ? (
                <Link
                  className="inline-flex items-center justify-center rounded-full border border-stone-900/10 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-900/20"
                  to={`/categories/${getCategorySlug(spotlight.category)}`}
                >
                  Browse {spotlight.category} desk
                </Link>
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
            to={`/categories/${getCategorySlug(desk.category)}`}
          >
            <div className="section-kicker">{desk.category} desk</div>
            <div className="mt-4 text-xl font-semibold leading-snug text-stone-950">
              {desk.lead?.title}
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 text-sm text-stone-500">
              <span>{desk.count} events</span>
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
                Search the live board or narrow it to a desk without leaving the
                main scan.
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

              <div className="flex flex-wrap gap-2 xl:max-w-[34rem] xl:justify-end">
                {categories.map((category) => (
                  <button
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      activeCategory === category
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
