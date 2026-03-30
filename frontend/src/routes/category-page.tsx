import { useEffect, useState } from 'react'
import {
  Link,
  useParams,
  useSearch,
} from '@tanstack/react-router'
import { CompactMarketCard } from '../components/compact-market-card'
import { CategoryDeskLoadingState } from '../components/loading-state'
import { MarketCard } from '../components/market-card'
import { PlatformBadge } from '../components/platform-badge'
import { SectionHeader } from '../components/section-header'
import {
  useEventsQuery,
  useMoversQuery,
} from '../features/events/hooks'
import {
  EMPTY_EVENTS,
  getCategoryLabelFromSlug,
  getTempoLabelFromPriceChanges,
  getYesPrice,
  sortByVolume,
} from '../features/events/insights'
import { formatCategory, formatCompactNumber, formatProbability } from '../lib/format'
import { getMarketsRoute } from '../lib/routes'
import type {
  PulseEvent,
  PulseProvider,
} from '../features/events/types'

const INITIAL_VISIBLE_MARKETS = 6
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const SECTION_LABEL_CLASSNAME =
  'font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]'

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Finance: 'Markets on rates, indices, commodities, and macro events.',
  Politics: 'Live odds on elections, policy, and geopolitical events worldwide.',
  Sports: 'Match outcomes, player props, and tournament winners across all venues.',
}

function getEventClosingTimestamp(event: PulseEvent) {
  const closeAt = event.closingDate ?? event.resolutionDate

  if (!closeAt) {
    return null
  }

  const timestamp = new Date(closeAt).getTime()

  return Number.isNaN(timestamp) ? null : timestamp
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

function getCategoryDescription(category: string) {
  return (
    CATEGORY_DESCRIPTIONS[category] ??
    `Live odds and active names across the ${category.toLowerCase()} board.`
  )
}

function getPriceTone(price: number) {
  if (Math.abs(price - 0.5) < 0.001) {
    return 'text-[var(--color-neutral)]'
  }

  return price > 0.5
    ? 'text-[var(--color-up)]'
    : 'text-[var(--color-down)]'
}

export function CategoryPage() {
  const categorySlug = useParams({
    strict: false,
    select: (params) => ('categorySlug' in params ? params.categorySlug : undefined),
  })
  const search = useSearch({ strict: false })
  const [showAllMostActive, setShowAllMostActive] = useState(false)
  const activeProvider = getProviderFilter(search.provider)
  const eventsQuery = useEventsQuery({
    provider: activeProvider,
    status: 'open',
  })
  const events = eventsQuery.data ?? EMPTY_EVENTS
  const category = categorySlug
    ? (
        getCategoryLabelFromSlug(events, categorySlug) ??
        formatCategory(categorySlug)
      )
    : null

  useEffect(() => {
    setShowAllMostActive(false)
  }, [categorySlug])

  const categoryEvents = category
    ? events
        .filter((event) => formatCategory(event.category) === category)
        .sort(sortByVolume)
    : EMPTY_EVENTS
  const categoryMoversQuery = useMoversQuery(
    categoryEvents,
    Math.min(categoryEvents.length, 24),
  )

  if (eventsQuery.isLoading) {
    return <CategoryDeskLoadingState />
  }

  if (!category) {
    return (
      <div className="panel p-8 text-[var(--color-text-secondary)]">
        <p className="text-lg text-[var(--color-down)]">That category desk does not exist yet.</p>
        <Link className="terminal-button mt-4 text-sm font-medium" {...getMarketsRoute()}>
          Back to markets
        </Link>
      </div>
    )
  }

  const lead = categoryEvents[0]
  const leadPrice = lead ? getYesPrice(lead) : 0
  const totalVolume = categoryEvents.reduce(
    (sum, event) => sum + event.totalVolume,
    0,
  )
  const now = Date.now()
  const closingSoon = [...categoryEvents]
    .filter((event) => {
      const closeAt = getEventClosingTimestamp(event)

      return closeAt !== null && closeAt >= now && closeAt <= now + SEVEN_DAYS_MS
    })
    .sort((leftEvent, rightEvent) => {
      const leftCloseAt = getEventClosingTimestamp(leftEvent) ?? Number.MAX_SAFE_INTEGER
      const rightCloseAt = getEventClosingTimestamp(rightEvent) ?? Number.MAX_SAFE_INTEGER

      return leftCloseAt - rightCloseAt
    })
  const visibleMostActive = showAllMostActive
    ? categoryEvents
    : categoryEvents.slice(0, INITIAL_VISIBLE_MARKETS)
  const hasMoreMostActive = categoryEvents.length > INITIAL_VISIBLE_MARKETS
  const leadTempo = getTempoLabelFromPriceChanges(
    categoryMoversQuery.data?.[0]?.changesByWindow['24h'].priceChanges ?? 0,
  )
  const emptyDeskMessage = `No ${category.toLowerCase()} markets are active on the desk yet.`

  return (
    <div className="space-y-6">
      <section className="panel p-5 lg:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_360px]">
          <div className="space-y-6">
            <div className="space-y-1">
              <div className={SECTION_LABEL_CLASSNAME}>Markets</div>
              <h1 className="text-[28px] font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--color-text-primary)]">
                {category} desk
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
                {getCategoryDescription(category)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="metric-card">
                <div className="stat-label">Open markets</div>
                <strong>{formatCompactNumber(categoryEvents.length)}</strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Total volume</div>
                <strong>{formatCompactNumber(totalVolume)}</strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Lead tempo</div>
                <strong>{leadTempo}</strong>
              </div>
            </div>
          </div>

          <aside className="panel-elevated p-4">
            <SectionHeader
              description="Each category desk gets one clear lead so the vertical has an obvious anchor."
              kicker="Lead story"
              title={lead?.title ?? `${category} lead`}
            />
            {lead ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3">
                  <PlatformBadge platform={lead.provider} size="sm" />
                  <span className={`mono-data text-[20px] leading-none ${getPriceTone(leadPrice)}`}>
                    {formatProbability(leadPrice)}
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
          </aside>
        </div>
      </section>

      <section className="space-y-4">
        <div className={SECTION_LABEL_CLASSNAME}>Most active</div>
        {visibleMostActive.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleMostActive.map((event) => (
              <MarketCard event={event} key={event.id} />
            ))}
          </div>
        ) : (
          <div className="panel-elevated p-4 text-sm text-[var(--color-text-secondary)]">
            {emptyDeskMessage}
          </div>
        )}

        {hasMoreMostActive ? (
          <div className="flex justify-center">
            <button
              className="text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
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

      {closingSoon.length ? (
        <section className="space-y-4">
          <div className={SECTION_LABEL_CLASSNAME}>Closing soon</div>
          <div className="-mx-1 overflow-x-auto pb-2">
            <div className="flex gap-3 px-1">
              {closingSoon.map((event) => (
                <CompactMarketCard event={event} key={event.id} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
