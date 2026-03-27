import {
  Link,
  useParams,
} from '@tanstack/react-router'
import { DeskTabs } from '../components/desk-tabs'
import { MarketRow } from '../components/market-row'
import { PlatformBadge } from '../components/platform-badge'
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
import { getEventRoute } from '../lib/routes'
import { useUrlSelection } from '../lib/url-state'

const CATEGORY_TAB_IDS = ['summary', 'conviction'] as const

export function CategoryPage() {
  const categorySlug = useParams({
    strict: false,
    select: (params) => ('categorySlug' in params ? params.categorySlug : undefined),
  })
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
      <div className="panel p-8 text-[var(--color-text-secondary)]">
        Loading category desk...
      </div>
    )
  }

  if (!category) {
    return (
      <div className="panel p-8 text-[var(--color-text-secondary)]">
        <p className="text-lg text-[var(--color-down)]">That category desk does not exist yet.</p>
        <Link
          className="terminal-button mt-4 text-sm font-medium"
          to="/"
        >
          Back to markets
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
  const leadPrice = lead ? getYesPrice(lead) : 0

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.15fr)_320px] lg:p-6">
          <div className="space-y-5">
            <Link
              className="section-kicker hover:text-[var(--color-text-primary)]"
              to="/"
            >
              Markets
            </Link>
            <div>
              <h1 className="display-title">{category} desk</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                A focused reading environment for the {category.toLowerCase()} board. The desk emphasizes the most active names, the least settled stories, and the markets carrying the strongest conviction.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="metric-card">
                <div className="stat-label">Open names</div>
                <strong>{formatCompactNumber(categoryEvents.length)}</strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Desk volume</div>
                <strong>{formatCompactNumber(totalVolume)}</strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Lead tempo</div>
                <strong>{lead ? getTempoLabel(lead) : 'Waiting'}</strong>
              </div>
            </div>

            {lead ? (
              <div className="flex flex-wrap items-center gap-3">
                <PlatformBadge platform={lead.provider} />
                <span className="terminal-chip text-sm">{formatProbability(leadPrice)} yes</span>
                <span className="terminal-chip text-sm">Resolves {formatDate(lead.resolutionDate)}</span>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4">
            <div className="panel-elevated relative min-h-[220px] overflow-hidden">
              <div className="absolute inset-0">
                {lead?.imageUrl ? (
                  <img
                    alt={lead.title}
                    className="h-full w-full object-cover object-top opacity-40"
                    src={lead.imageUrl}
                  />
                ) : null}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,15,16,0.18),rgba(13,15,16,0.94))]" />
              </div>
              <div className="relative flex h-full flex-col justify-end p-5">
                <div className="section-kicker">Lead read</div>
                <div className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
                  {lead ? getMarketStance(leadPrice) : 'Loading lead market.'}
                </div>
              </div>
            </div>

            {lead ? (
              <div className="panel-elevated p-4">
                <div className="flex items-center justify-between gap-3">
                  <PlatformBadge platform={lead.provider} size="sm" />
                  <div
                    className={`mono-data text-sm font-medium ${
                      leadPrice >= 0.5
                        ? 'text-[var(--color-up)]'
                        : 'text-[var(--color-down)]'
                    }`}
                  >
                    {formatProbability(leadPrice)}
                  </div>
                </div>
                <div className="mt-3 text-sm leading-6 text-[var(--color-text-primary)]">
                  {lead.title}
                </div>
                <div className="mt-3 text-[12px] leading-6 text-[var(--color-text-secondary)]">
                  {lead.description}
                </div>
                <div className="mt-4">
                  <Link
                    className="terminal-button terminal-button-primary w-full text-sm font-medium"
                    {...getEventRoute(lead)}
                  >
                    Open lead market
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.42fr)_320px]">
        <div className="space-y-6">
          <section className="space-y-4">
            <SectionHeader
              description="Activity-ranked names are the core of the category board. This is where participation is densest, not just where prices happen to be interesting."
              kicker="Most active"
              title="Where order flow is densest"
            />
            <div className="space-y-3">
              {mostActive.map((event) => (
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
                    <div className="panel-elevated p-4 text-sm leading-7 text-[var(--color-text-secondary)]">
                      This desk keeps the category reading tight: one lead story, the most active names up front, then tabs for softer signals like conviction and desk-level summaries.
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="metric-card">
                        <div className="stat-label">Lead price</div>
                        <strong>{lead ? formatProbability(getYesPrice(lead)) : 'TBD'}</strong>
                      </div>
                      <div className="metric-card">
                        <div className="stat-label">Lead tempo</div>
                        <strong>{lead ? getTempoLabel(lead) : 'Waiting'}</strong>
                      </div>
                      <div className="metric-card">
                        <div className="stat-label">Desk volume</div>
                        <strong>{formatCompactNumber(totalVolume)}</strong>
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

        <aside className="space-y-4">
          {lead ? (
            <section className="panel p-4">
              <SectionHeader
                description="Each category desk gets one clear lead story so the page reads like a deliberate vertical, not just another filtered grid."
                kicker="Lead story"
                title={lead.title}
              />
              <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--color-text-secondary)]">
                <p>{lead.description}</p>
                <div className="flex flex-wrap gap-2">
                  <PlatformBadge platform={lead.provider} size="sm" />
                  <span className="terminal-chip text-[11px] uppercase tracking-[0.18em]">
                    {getProviderLabel(lead.provider)}
                  </span>
                  <span className="terminal-chip text-[11px] uppercase tracking-[0.18em]">
                    Resolves {formatDate(lead.resolutionDate)}
                  </span>
                </div>
              </div>
            </section>
          ) : null}

          <section className="panel p-4">
            <SectionHeader
              description="These are the names nearest the middle, where conviction is lowest and the next piece of information matters most."
              kicker="Least settled"
              title="Closest calls"
            />
            <div className="mt-4 space-y-3">
              {closestCalls.map((event) => (
                <MarketRow event={event} key={event.id} />
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
