import {
  useEffect,
  useState,
} from 'react'
import {
  Link,
  useParams,
  useSearch,
} from '@tanstack/react-router'
import { CompactMarketCard } from '../components/compact-market-card'
import { DeskTabs } from '../components/desk-tabs'
import {
  CategoryDeskLoadingState,
  CompactCardsLoadingState,
  MarketRowsLoadingState,
  TableLoadingState,
} from '../components/loading-state'
import { MarketCard } from '../components/market-card'
import { MarketRow } from '../components/market-row'
import { MarketRowCard } from '../components/market-row-card'
import { PlatformBadge } from '../components/platform-badge'
import { SectionHeader } from '../components/section-header'
import { useEventsQuery } from '../features/events/hooks'
import {
  EMPTY_EVENTS,
  getCategoryLabelFromSlug,
  getTempoLabel,
  getYesPrice,
  sortByActivityScore,
  sortByTightRace,
  sortByVolume,
} from '../features/events/insights'
import {
  formatCategory,
  formatCompactNumber,
  formatDate,
  formatProbability,
} from '../lib/format'
import { getEventRoute } from '../lib/routes'
import { useUrlSelection } from '../lib/url-state'
import type {
  PulseEvent,
  PulseProvider,
} from '../features/events/types'

const CATEGORY_TAB_IDS = ['summary', 'conviction'] as const
const INITIAL_VISIBLE_MARKETS = 6
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function getEventClosingTimestamp(event: PulseEvent) {
  const closeAt = event.closingDate ?? event.resolutionDate

  if (!closeAt) {
    return null
  }

  const timestamp = new Date(closeAt).getTime()

  return Number.isNaN(timestamp) ? null : timestamp
}

function getEventResolvedTimestamp(event: PulseEvent) {
  const resolvedAt = event.resolutionDate ?? event.closingDate ?? event.createdAt
  const timestamp = new Date(resolvedAt).getTime()

  return Number.isNaN(timestamp) ? 0 : timestamp
}

function getResolutionLabel(event: PulseEvent) {
  const primaryMarket = event.markets[0]
  const yesPrice = primaryMarket?.yesOutcome.price ?? 0
  const noPrice = primaryMarket?.noOutcome.price ?? 0

  return yesPrice >= noPrice ? 'YES' : 'NO'
}

function getProviderFilter(value: unknown): PulseProvider | undefined {
  if (
    value === 'bayse' ||
    value === 'kalshi' ||
    value === 'manifold' ||
    value === 'polymarket'
  ) {
    return value
  }

  return undefined
}

export function CategoryPage() {
  const categorySlug = useParams({
    strict: false,
    select: (params) => ('categorySlug' in params ? params.categorySlug : undefined),
  })
  const search = useSearch({ strict: false })
  const [showAllMostActive, setShowAllMostActive] = useState(false)
  const [activeTabId, setActiveTabId] = useUrlSelection({
    fallback: 'summary',
    key: 'tab',
    values: CATEGORY_TAB_IDS,
  })
  const activeProvider = getProviderFilter(search.provider)
  const eventsQuery = useEventsQuery({
    provider: activeProvider,
    status: 'open',
  })
  const requestedCategory = categorySlug ? formatCategory(categorySlug) : ''
  const resolvedEventsQuery = useEventsQuery({
    category: categorySlug === 'sports' ? requestedCategory : '__none__',
    provider: activeProvider,
    status: 'closed',
  })
  const events = eventsQuery.data ?? EMPTY_EVENTS
  const category = getCategoryLabelFromSlug(events, categorySlug)

  useEffect(() => {
    setShowAllMostActive(false)
  }, [categorySlug])

  if (eventsQuery.isLoading) {
    return <CategoryDeskLoadingState />
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
  const isSportsDesk = category === 'Sports'
  const sportsMostActive = [...categoryEvents].sort(sortByVolume)
  const now = Date.now()
  const sportsClosingSoon = [...categoryEvents]
    .filter((event) => {
      const closeAt = getEventClosingTimestamp(event)

      return closeAt !== null && closeAt >= now && closeAt <= now + SEVEN_DAYS_MS
    })
    .sort((leftEvent, rightEvent) => {
      const leftCloseAt = getEventClosingTimestamp(leftEvent) ?? Number.MAX_SAFE_INTEGER
      const rightCloseAt = getEventClosingTimestamp(rightEvent) ?? Number.MAX_SAFE_INTEGER

      return leftCloseAt - rightCloseAt
    })
  const sportsResolved = [...(resolvedEventsQuery.data ?? EMPTY_EVENTS)]
    .sort((leftEvent, rightEvent) =>
      getEventResolvedTimestamp(rightEvent) - getEventResolvedTimestamp(leftEvent))
    .slice(0, 10)
  const visibleSportsMostActive = showAllMostActive
    ? sportsMostActive
    : sportsMostActive.slice(0, INITIAL_VISIBLE_MARKETS)

  return (
    <div className="space-y-6">
      <section className="panel p-5 lg:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_360px]">
          <div className="space-y-5">
            <Link
              className="section-kicker hover:text-[var(--color-text-primary)]"
              to="/"
            >
              Markets
            </Link>
            <div className="space-y-3">
              <h1 className="display-title">{category} desk</h1>
              <p className="max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                A focused reading environment for the {category.toLowerCase()} board. This desk keeps the feed tight: active names first, least-settled stories nearby, and high-conviction markets easy to isolate.
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
                <Link
                  className="terminal-button terminal-button-primary text-sm font-medium"
                  {...getEventRoute(lead)}
                >
                  Open lead market
                </Link>
              </div>
            ) : null}
          </div>

          <div className="panel-elevated p-4">
            <SectionHeader
              description="Each category desk gets one clear lead so the vertical has an obvious anchor."
              kicker="Lead story"
              title={lead?.title ?? `${category} lead`}
            />
            {lead ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <PlatformBadge platform={lead.provider} size="sm" />
                  <span className="terminal-chip text-[11px] uppercase tracking-[0.18em]">
                    {formatProbability(leadPrice)} yes
                  </span>
                </div>
                <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
                  {lead.description}
                </p>
              </div>
            ) : (
              <div className="mt-4 text-sm text-[var(--color-text-secondary)]">
                Waiting for the desk lead.
              </div>
            )}
          </div>
        </div>
      </section>

      {isSportsDesk ? (
        <div className="space-y-6">
          <section className="space-y-4">
            <SectionHeader
              kicker="Markets"
              title="Most active"
            />

            {visibleSportsMostActive.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleSportsMostActive.map((event) => (
                  <MarketCard event={event} key={event.id} />
                ))}
              </div>
            ) : (
              <div className="panel-elevated p-4 text-sm text-[var(--color-text-secondary)]">
                No open sports markets are active on the desk yet.
              </div>
            )}

            {sportsMostActive.length > INITIAL_VISIBLE_MARKETS ? (
              <div className="flex justify-center">
                <button
                  className="terminal-button text-sm font-medium"
                  onClick={() => {
                    setShowAllMostActive((currentValue) => !currentValue)
                  }}
                  type="button"
                >
                  {showAllMostActive ? 'Show less' : 'Show more'}
                </button>
              </div>
            ) : null}
          </section>

          <section className="space-y-4">
            <SectionHeader
              kicker="Markets"
              title="Closing soon"
            />

            {sportsClosingSoon.length ? (
              <div className="-mx-1 overflow-x-auto pb-2">
                <div className="flex gap-3 px-1">
                  {sportsClosingSoon.map((event) => (
                    <MarketRowCard event={event} key={event.id} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="panel-elevated p-4 text-sm text-[var(--color-text-secondary)]">
                No open sports markets are closing in the next 7 days.
              </div>
            )}
          </section>

          <section className="space-y-4">
            <SectionHeader
              kicker="Markets"
              title="Recently resolved"
            />

            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-border-subtle)]">
                      <th className="px-4 py-3 text-left">
                        <span className="stat-label">Title</span>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <span className="stat-label">Platform</span>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <span className="stat-label">Resolution</span>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <span className="stat-label">Resolved date</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolvedEventsQuery.isLoading ? (
                      <tr>
                        <td className="p-0" colSpan={4}>
                          <TableLoadingState columns={4} rows={4} />
                        </td>
                      </tr>
                    ) : sportsResolved.length ? (
                      sportsResolved.map((event) => {
                        const resolution = getResolutionLabel(event)

                        return (
                          <tr
                            className="border-b border-[var(--color-border-subtle)] last:border-b-0"
                            key={event.id}
                          >
                            <td className="px-4 py-4 text-sm font-medium text-[var(--color-text-primary)]">
                              {event.title}
                            </td>
                            <td className="px-4 py-4">
                              <PlatformBadge platform={event.provider} short size="sm" />
                            </td>
                            <td className="px-4 py-4">
                              <span className={`terminal-chip px-2 py-1 text-[10px] ${resolution === 'YES' ? 'good-chip' : 'bad-chip'}`}>
                                {resolution}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">
                              {formatDate(event.resolutionDate ?? event.closingDate)}
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td
                          className="px-4 py-4 text-sm text-[var(--color-text-secondary)]"
                          colSpan={4}
                        >
                          No resolved sports markets are available yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      ) : (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
        <div className="space-y-6">
          <section className="space-y-4">
            <SectionHeader
              description="Activity-ranked names are the core of the category board. This is where participation is densest, not just where prices happen to be interesting."
              kicker="Most active"
              title="Where order flow is densest"
            />
            <div className="space-y-3">
              {mostActive.length ? (
                mostActive.map((event) => (
                  <MarketRow event={event} key={event.id} />
                ))
              ) : (
                <MarketRowsLoadingState count={4} />
              )}
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
          <section className="panel p-4">
            <SectionHeader
              description="These are the names nearest the middle, where conviction is lowest and the next piece of information matters most."
              kicker="Least settled"
              title="Closest calls"
            />
            <div className="mt-4 space-y-3">
              {closestCalls.length ? (
                closestCalls.map((event) => (
                  <CompactMarketCard event={event} key={event.id} />
                ))
              ) : (
                <CompactCardsLoadingState count={3} />
              )}
            </div>
          </section>

          <section className="panel p-4">
            <SectionHeader
              description="Names already leaning hard in one direction."
              kicker="Conviction"
              title="Strongest current lean"
            />
            <div className="mt-4 space-y-3">
              {convictionBoard.length ? (
                convictionBoard.map((event) => (
                  <CompactMarketCard event={event} key={event.id} />
                ))
              ) : (
                <CompactCardsLoadingState count={3} />
              )}
            </div>
          </section>
        </aside>
      </div>
      )}
    </div>
  )
}
