import { DeskTabs } from '../components/desk-tabs'
import { Link, useParams } from 'react-router-dom'
import { MarketRow } from '../components/market-row'
import { SectionHeader } from '../components/section-header'
import { getProviderLabel } from '../features/events/provider-ids'
import { useEventsQuery } from '../features/events/hooks'
import {
  EMPTY_EVENTS,
  getCategoryLabelFromSlug,
  getMarketStance,
  getTempoLabel,
  getYesPrice,
  sortByActivityScore,
  sortByTightRace,
  sortByVolume,
} from '../features/events/insights'
import {
  formatCompactNumber,
  formatDate,
  formatProbability,
} from '../lib/format'
import { useUrlSelection } from '../lib/url-state'

const CATEGORY_TAB_IDS = ['summary', 'conviction'] as const

export function CategoryPage() {
  const { categorySlug } = useParams()
  const [activeTabId, setActiveTabId] = useUrlSelection({
    fallback: 'summary',
    key: 'tab',
    values: CATEGORY_TAB_IDS,
  })
  const eventsQuery = useEventsQuery({ status: 'open' })
  const events = eventsQuery.data ?? EMPTY_EVENTS
  const category = getCategoryLabelFromSlug(events, categorySlug)

  if (eventsQuery.isLoading) {
    return (
      <div className="panel p-8 text-stone-500">
        Loading category desk...
      </div>
    )
  }

  if (!category) {
    return (
      <div className="panel p-8 text-stone-600">
        <p className="text-lg text-rose-700">That category desk does not exist yet.</p>
        <Link
          className="mt-4 inline-flex rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm text-stone-900"
          to="/"
        >
          Back to front page
        </Link>
      </div>
    )
  }

  const categoryEvents = events
    .filter((event) => event.category === category)
    .sort(sortByVolume)
  const lead = categoryEvents[0]
  const mostActive = [...categoryEvents].sort(sortByActivityScore).slice(0, 5)
  const closestCalls = [...categoryEvents].sort(sortByTightRace).slice(0, 3)
  const convictionBoard = categoryEvents
    .filter((event) => {
      const price = getYesPrice(event)

      return price >= 0.7 || price <= 0.3
    })
    .slice(0, 3)
  const totalVolume = categoryEvents.reduce(
    (sum, event) => sum + event.totalVolume,
    0,
  )

  return (
    <div className="space-y-8">
      <section className="panel overflow-hidden">
        <div className="grid 2xl:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.22fr)]">
          <div className="relative min-h-[420px] bg-stone-950">
            {lead?.imageUrl ? (
              <img
                alt={lead.title}
                className="absolute inset-0 h-full w-full object-cover object-top opacity-82"
                src={lead.imageUrl}
              />
            ) : null}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.76))]" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-stone-50 sm:p-7">
              <div className="section-kicker text-stone-300">Lead read</div>
              <div className="mt-3 max-w-sm text-sm leading-7 text-stone-200">
                {lead ? getMarketStance(getYesPrice(lead)) : 'Loading lead market.'}
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            <Link
              className="section-kicker text-stone-500 hover:text-stone-900"
              to="/"
            >
              Front page
            </Link>
            <h1 className="display-title mt-4 text-5xl leading-[0.95] text-stone-950 sm:text-6xl">
              {category} desk
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
              A focused reading environment for the {category.toLowerCase()}{' '}
              category. This desk emphasizes the most active names, the least
              settled stories, and the markets carrying the strongest current
              conviction.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.4rem] border border-stone-900/10 bg-white p-4">
                <div className="stat-label">Open names</div>
                <div className="mt-2 text-3xl font-semibold text-stone-950">
                  {formatCompactNumber(categoryEvents.length)}
                </div>
              </div>
              <div className="rounded-[1.4rem] border border-stone-900/10 bg-white p-4">
                <div className="stat-label">Desk volume</div>
                <div className="mt-2 text-3xl font-semibold text-stone-950">
                  {formatCompactNumber(totalVolume)}
                </div>
              </div>
              <div className="rounded-[1.4rem] border border-stone-900/10 bg-white p-4">
                <div className="stat-label">Lead tempo</div>
                <div className="mt-2 text-2xl font-semibold text-teal-700">
                  {lead ? getTempoLabel(lead) : 'Loading'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        {lead ? (
          <section className="panel p-6 sm:p-8">
            <SectionHeader
              description="Each category desk gets one clear lead story so the page reads like a deliberate vertical, not just another filtered grid."
              kicker="Lead story"
              title={lead.title}
            />
            <p className="mt-5 max-w-3xl text-base leading-8 text-stone-600">
              {lead.description}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm text-stone-700">
                {formatProbability(getYesPrice(lead))} yes
              </span>
              <span className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm text-stone-700">
                {getProviderLabel(lead.provider)}
              </span>
              <span className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm text-stone-700">
                Resolves {formatDate(lead.resolutionDate)}
              </span>
              <Link
                className="dark-pill px-4 py-2 text-sm"
                to={`/events/${lead.id}/${lead.slug}`}
              >
                Open event page
              </Link>
            </div>
          </section>
        ) : null}

        <section className="space-y-4">
          <SectionHeader
            description="Activity-ranked names are the core of the category board. This is where participation is densest, not just where prices happen to be interesting."
            kicker="Most active"
            title="Where order flow is densest"
          />
          {mostActive.map((event) => (
            <MarketRow event={event} key={event.id} />
          ))}
        </section>

        <section className="panel p-6">
          <SectionHeader
            description="These are the names nearest the middle, where conviction is lowest and the next piece of information matters most."
            kicker="Least settled"
            title="Closest calls"
          />
          <div className="mt-6 space-y-4">
            {closestCalls.map((event) => (
              <MarketRow event={event} key={event.id} />
            ))}
          </div>
        </section>

        <DeskTabs
          activeTabId={activeTabId}
          defaultTabId="summary"
          items={[
            {
              content: (
                <div className="space-y-5">
                  <div className="max-w-3xl text-base leading-8 text-stone-600">
                    This desk keeps the category reading tight: one lead story,
                    the most active names up front, then tabs for softer
                    signals like conviction and desk-level summaries.
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                      <div className="stat-label">Lead price</div>
                      <div className="mt-2 text-3xl font-semibold text-stone-950">
                        {lead ? formatProbability(getYesPrice(lead)) : 'TBD'}
                      </div>
                    </div>
                    <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                      <div className="stat-label">Lead tempo</div>
                      <div className="mt-2 text-2xl font-semibold text-stone-950">
                        {lead ? getTempoLabel(lead) : 'Loading'}
                      </div>
                    </div>
                    <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                      <div className="stat-label">Desk volume</div>
                      <div className="mt-2 text-3xl font-semibold text-stone-950">
                        {formatCompactNumber(totalVolume)}
                      </div>
                    </div>
                  </div>
                </div>
              ),
              description: 'A quick overview of where the desk sits before you drill into individual markets.',
              id: 'summary',
              kicker: 'Desk summary',
              label: 'Summary',
              title: `What stands out in ${category.toLowerCase()} right now`,
            },
            {
              content: (
                <div className="space-y-4">
                  {convictionBoard.map((event) => (
                    <MarketRow event={event} key={event.id} />
                  ))}
                </div>
              ),
              description: 'High-conviction names give you the opposite read: markets already leaning sharply in one direction.',
              id: 'conviction',
              kicker: 'Conviction board',
              label: 'Conviction',
              title: 'Strongest current lean',
            },
          ]}
          onTabChange={setActiveTabId}
        />
      </div>
    </div>
  )
}
