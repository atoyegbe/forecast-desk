import { Link } from '@tanstack/react-router'
import type { PulseEvent } from '../features/events/types'
import {
  formatCompactNumber,
  formatDate,
  formatProbability,
  formatSignedProbabilityChange,
} from '../lib/format'
import { getEventRoute } from '../lib/routes'
import { PlatformBadge } from './platform-badge'

type MarketRowProps = {
  accent?: 'neutral' | 'positive' | 'negative'
  change?: number
  event: PulseEvent
}

const accentStyles = {
  negative: 'border-l-[var(--color-down)]',
  neutral: 'border-l-[var(--color-border-strong)]',
  positive: 'border-l-[var(--color-up)]',
}

export function MarketRow({
  accent = 'neutral',
  change,
  event,
}: MarketRowProps) {
  const market = event.markets[0]
  const secondaryMetricLabel =
    event.totalOrders > 0 ? 'Orders' : 'Liquidity'
  const secondaryMetricValue =
    event.totalOrders > 0 ? event.totalOrders : event.liquidity
  const yesPrice = market?.yesOutcome.price ?? 0
  const noPrice = market?.noOutcome.price ?? 0
  const meterLeftClass =
    yesPrice >= noPrice ? 'bg-[var(--color-up)]' : 'bg-[var(--color-down)]'
  const meterRightClass =
    yesPrice >= noPrice ? 'bg-[var(--color-down)]' : 'bg-[var(--color-up)]'
  const changeChipClass =
    change === undefined
      ? ''
      : change > 0
        ? 'good-chip'
        : change < 0
          ? 'bad-chip'
          : 'border-[var(--color-border-subtle)] bg-transparent text-[var(--color-text-tertiary)]'

  return (
    <Link
      aria-label={`${event.title}. ${formatProbability(yesPrice)} yes price on ${event.provider}.`}
      className={`panel group block border-l-2 px-4 py-4 transition duration-200 hover:border-[var(--color-brand)] hover:bg-[var(--color-bg-hover)] sm:px-5 ${accentStyles[accent]}`}
      role="article"
      {...getEventRoute(event)}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_84px_84px_124px_124px] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PlatformBadge platform={event.provider} short size="sm" />
            <span className="terminal-chip border-[var(--color-border-subtle)] bg-transparent px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              {event.category}
            </span>
            <span className="terminal-chip border-[var(--color-border-subtle)] bg-transparent px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              {event.engine}
            </span>
            {change !== undefined ? (
              <span
                className={`terminal-chip px-2 py-1 text-[10px] ${changeChipClass}`}
              >
                {formatSignedProbabilityChange(change)}
              </span>
            ) : null}
          </div>

          <h3 className="mt-3 max-w-4xl text-[1.05rem] font-medium leading-snug text-[var(--color-text-primary)] sm:text-[1.2rem]">
            {event.title}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-[var(--color-text-secondary)]">
            <span>Resolves {formatDate(event.resolutionDate)}</span>
            <span className="text-[var(--color-text-tertiary)]">•</span>
            <span className="capitalize">{event.status}</span>
          </div>

          <div className="mt-3 overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
            <div className="flex h-1.5">
              <div
                className={meterLeftClass}
                style={{ width: `${yesPrice * 100}%` }}
              />
              <div
                className={meterRightClass}
                style={{ width: `${noPrice * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm xl:contents">
          <div className="rounded-lg border border-[var(--color-up-border)] bg-[var(--color-up-dim)] px-3 py-3 text-left xl:rounded-none xl:border-0 xl:bg-transparent xl:px-0 xl:py-0 xl:text-right">
            <div className="stat-label">Yes</div>
            <div
              className={`mono-data mt-1 text-[1.1rem] font-medium ${
                yesPrice >= noPrice
                  ? 'text-[var(--color-up)]'
                  : 'text-[var(--color-down)]'
              }`}
            >
              {formatProbability(yesPrice)}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--color-down-border)] bg-[var(--color-down-dim)] px-3 py-3 text-left xl:rounded-none xl:border-0 xl:bg-transparent xl:px-0 xl:py-0 xl:text-right">
            <div className="stat-label">No</div>
            <div
              className={`mono-data mt-1 text-[1.1rem] font-medium ${
                noPrice > yesPrice
                  ? 'text-[var(--color-up)]'
                  : 'text-[var(--color-down)]'
              }`}
            >
              {formatProbability(noPrice)}
            </div>
          </div>

          <div className="text-left xl:text-right">
            <div className="stat-label">Total volume</div>
            <div className="mono-data mt-1 text-base font-medium text-[var(--color-text-primary)]">
              {formatCompactNumber(event.totalVolume)}
            </div>
          </div>

          <div className="text-left xl:text-right">
            <div className="stat-label">{secondaryMetricLabel}</div>
            <div className="mono-data mt-1 text-base font-medium text-[var(--color-text-primary)]">
              {formatCompactNumber(secondaryMetricValue)}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
