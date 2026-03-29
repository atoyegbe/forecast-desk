import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  Link,
  useParams,
} from '@tanstack/react-router'
import { ComparisonHistoryChart } from '../components/comparison-history-chart'
import { DivergenceBar } from '../components/divergence-bar'
import { EventCompareLoadingState } from '../components/loading-state'
import { PlatformBadge } from '../components/platform-badge'
import { PriceDisplay } from '../components/price-display'
import { SectionHeader } from '../components/section-header'
import { useDisplayCurrency } from '../features/currency/context'
import { getEventMoneyUnit } from '../features/currency/money'
import { getProviderLabel } from '../features/events/provider-ids'
import {
  useEventCompareQuery,
  useEventQuery,
} from '../features/events/hooks'
import { getPriceHistory } from '../features/events/api'
import {
  formatCompactNumber,
  formatDate,
  formatProbabilityPoints,
  formatRelativeTime,
} from '../lib/format'
import {
  getEventCompareRoute,
  getEventRoute,
} from '../lib/routes'
import { useUrlSelection } from '../lib/url-state'
import type { PulseProvider } from '../features/events/types'

const HISTORY_INTERVAL_IDS = ['1d', '1w', '1m', 'all'] as const

function getComparisonExplainer(providers: PulseProvider[]) {
  const platformSet = new Set(providers)

  if (platformSet.has('bayse')) {
    return 'Bayse is the only prediction market platform built specifically for African markets. Divergences against global venues can reflect a different regional perspective, different local information, or a crowd with distinct liquidity conditions.'
  }

  if (platformSet.has('kalshi')) {
    return 'Kalshi is a regulated US exchange with a crowd composition that often differs from crypto-native venues. A spread against Kalshi can reflect different regulation, liquidity, and trader mix rather than a bad match.'
  }

  if (platformSet.has('manifold')) {
    return 'Manifold is a play-money forecasting venue. When it diverges from cash or crypto-native venues, that often reflects a different forecaster crowd and weaker capital constraints rather than a simple pricing error.'
  }

  if (platformSet.has('polymarket')) {
    return 'Polymarket is priced by a global crypto-native crowd. Differences across venues can reflect genuinely different trader compositions, information sets, and incentives rather than a simple data mismatch.'
  }

  return 'Cross-platform spreads usually come from different crowd compositions, liquidity profiles, and resolution framing. The wider the spread, the more useful it is to inspect the rules and venue mix directly.'
}

export function EventComparePage() {
  const { formatMoney } = useDisplayCurrency()
  const eventId = useParams({
    strict: false,
    select: (params) => ('eventId' in params ? params.eventId : undefined),
  })
  const [activeHistoryInterval, setActiveHistoryInterval] = useUrlSelection({
    fallback: '1d',
    key: 'range',
    values: HISTORY_INTERVAL_IDS,
  })
  const eventQuery = useEventQuery(eventId)
  const compareQuery = useEventCompareQuery(eventId)
  const comparedEvents = compareQuery.data?.events ?? []
  const historyQueries = useQueries({
    queries: comparedEvents.map((item) => ({
      enabled: Boolean(compareQuery.data),
      queryFn: () => getPriceHistory(item.event.id, 'all'),
      queryKey: ['events', 'compare-history', item.event.id, 'all'] as const,
      staleTime: 120_000,
    })),
  })

  const historySeries = useMemo(() => {
    return comparedEvents.map((item, index) => ({
      eventId: item.event.id,
      label: getProviderLabel(item.event.provider),
      platform: item.event.provider,
      points: historyQueries[index]?.data?.points ?? [],
    }))
  }, [comparedEvents, historyQueries])

  if (eventQuery.isLoading || compareQuery.isLoading) {
    return <EventCompareLoadingState />
  }

  if (eventQuery.error || compareQuery.error) {
    return (
      <div className="panel p-8 text-[var(--color-text-secondary)]">
        <p className="text-lg text-[var(--color-down)]">
          {((eventQuery.error ?? compareQuery.error) as Error).message}
        </p>
      </div>
    )
  }

  const event = eventQuery.data
  const comparison = compareQuery.data

  if (!event || !comparison) {
    return (
      <div className="panel p-8 text-[var(--color-text-secondary)]">
        <p className="text-lg text-[var(--color-text-primary)]">
          No dedicated cross-platform comparison is available for this event yet.
        </p>
        <p className="mt-3 text-sm leading-7">
          The matcher only promotes standalone compare desks when the stored link is strong enough to avoid false positives across venues.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            className="terminal-button text-sm font-medium"
            {...getEventRoute(eventQuery.data ?? { id: eventId ?? '', slug: '' })}
          >
            Back to event
          </Link>
          <Link
            className="terminal-button terminal-button-primary text-sm font-medium"
            to="/divergence"
          >
            Open divergence board
          </Link>
        </div>
      </div>
    )
  }

  const compareFreshnessLabel = formatRelativeTime(
    new Date(comparison.comparedAt).getTime(),
  )
  const historyIsLoading = historyQueries.some((query) => query.isLoading)
  const providers = comparison.events.map((item) => item.event.provider)
  const maxVolume = comparison.events.reduce(
    (volume, item) => Math.max(volume, item.totalVolume),
    0,
  )

  return (
    <div className="space-y-6">
      <section className="panel p-5 lg:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_320px]">
          <div className="space-y-5">
            <Link
              className="section-kicker hover:text-[var(--color-text-primary)]"
              {...getEventRoute(event)}
            >
              Back to market
            </Link>
            <div className="eyebrow">Cross-platform comparison</div>
            <div className="space-y-3">
              <h1 className="display-title">{comparison.title}</h1>
              <p className="max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                Read the same event across every linked venue in one place: current odds, spread, venue mix, and stored history lines plotted together.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {comparison.events.map((item) => (
                <PlatformBadge
                  key={item.event.id}
                  platform={item.event.provider}
                  short
                  size="sm"
                />
              ))}
              <span className="terminal-chip text-sm">
                Compared {compareFreshnessLabel}
              </span>
            </div>

            <DivergenceBar items={comparison.events} />
          </div>

          <div className="panel-elevated p-4">
            <SectionHeader
              description="The dedicated compare desk isolates the highest-signal cross-venue facts first."
              kicker="Spread summary"
              title="Comparison at a glance"
            />

            <div className="mt-4 grid gap-3">
              <div className="metric-card">
                <div className="stat-label">Max divergence</div>
                <strong>{formatProbabilityPoints(comparison.maxDivergence)}</strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Weighted divergence</div>
                <strong>{formatProbabilityPoints(comparison.weightedDivergence)}</strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Linked venues</div>
                <strong>{formatCompactNumber(comparison.events.length)}</strong>
              </div>
            </div>

            <div className="mt-4 text-[12px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
              {comparison.matchMethod === 'exact' ? 'Exact link' : 'Fuzzy link'} ·{' '}
              {Math.round(comparison.confidence * 100)}% confidence
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <SectionHeader
          description="Each venue keeps its own crowd, liquidity, and engine. Read them side by side before deciding whether the spread matters."
          kicker="Venue cards"
          title="How each platform is pricing it"
        />

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {comparison.events.map((item) => (
            <article
              className="panel-elevated p-4"
              key={item.event.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <PlatformBadge platform={item.event.provider} />
                <span className="terminal-chip text-sm">
                  {item.event.engine}
                </span>
              </div>

              <h2 className="mt-4 text-xl font-semibold leading-tight text-[var(--color-text-primary)]">
                {item.event.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                {item.marketTitle}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[var(--color-up-border)] bg-[var(--color-up-dim)] p-4">
                  <div className="stat-label">Yes</div>
                  <div className="mt-1">
                    <PriceDisplay value={item.yesPrice} />
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--color-down-border)] bg-[var(--color-down-dim)] p-4">
                  <div className="stat-label">No</div>
                  <div className="mt-1">
                    <PriceDisplay value={item.noPrice} />
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div>
                  <div className="stat-label">Volume</div>
                  <div className="mono-data mt-1 text-sm text-[var(--color-text-primary)]">
                    {formatMoney(item.totalVolume, getEventMoneyUnit(item.event))}
                  </div>
                </div>
                <div>
                  <div className="stat-label">Liquidity</div>
                  <div className="mono-data mt-1 text-sm text-[var(--color-text-primary)]">
                    {formatMoney(item.liquidity, getEventMoneyUnit(item.event))}
                  </div>
                </div>
                <div>
                  <div className="stat-label">Resolution</div>
                  <div className="mono-data mt-1 text-sm text-[var(--color-text-primary)]">
                    {formatDate(item.event.resolutionDate)}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {item.event.sourceUrl ? (
                  <a
                    className="terminal-button terminal-button-primary text-sm font-medium"
                    href={item.event.sourceUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open on {getProviderLabel(item.event.provider)}
                  </a>
                ) : null}
                <Link
                  className="terminal-button text-sm font-medium"
                  {...getEventRoute(item.event)}
                >
                  Open event page
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            description="Stored history lines are overlaid by venue so you can see whether the spread is persistent or just a current snapshot."
            kicker="History overlay"
            title="How the spread evolved"
          />

          <div className="flex flex-wrap gap-2">
            {HISTORY_INTERVAL_IDS.map((intervalId) => (
              <button
                className={`min-h-11 border-b-2 px-2 pb-2 pt-2 text-[12px] font-medium uppercase tracking-[0.18em] transition ${
                  activeHistoryInterval === intervalId
                    ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
                key={intervalId}
                onClick={() => setActiveHistoryInterval(intervalId)}
                type="button"
              >
                {intervalId.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <ComparisonHistoryChart
            histories={historySeries}
            isLoading={historyIsLoading}
            range={activeHistoryInterval}
          />
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-3">
            <SectionHeader
              description="Static context, not an AI summary. The point is to explain why venue differences can be real."
              kicker="Explainer"
              title="What might explain this divergence?"
            />
            <p className="text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
              {getComparisonExplainer(providers)}
            </p>
          </div>

          <div className="panel-elevated p-4">
            <div className="stat-label">Lead venue volume</div>
            <div className="mono-data mt-2 text-2xl text-[var(--color-text-primary)]">
              {formatCompactNumber(maxVolume)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                className="terminal-button text-sm font-medium"
                to="/divergence"
              >
                Divergence board
              </Link>
              <Link
                className="terminal-button terminal-button-primary text-sm font-medium"
                {...getEventCompareRoute(event)}
              >
                Refresh compare desk
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
