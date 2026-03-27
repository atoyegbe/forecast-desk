import { Link } from '@tanstack/react-router'
import type { PulseEvent } from '../features/events/types'
import {
  formatCompactNumber,
  formatDate,
  formatSignedProbabilityChange,
} from '../lib/format'
import { getEventRoute } from '../lib/routes'
import { OutcomeStrip } from './outcome-strip'
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

  return (
    <Link
      className={`panel group block border-l-2 px-4 py-4 transition duration-200 hover:border-[var(--color-brand)] hover:bg-[var(--color-bg-hover)] sm:px-5 ${accentStyles[accent]}`}
      {...getEventRoute(event)}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(240px,0.9fr)_176px] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PlatformBadge platform={event.provider} size="sm" />
            <span className="terminal-chip border-[var(--color-border-subtle)] bg-transparent px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              {event.category}
            </span>
            <span className="terminal-chip border-[var(--color-border-subtle)] bg-transparent px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              {event.engine}
            </span>
            {change !== undefined ? (
              <span
                className={`terminal-chip px-2 py-1 text-[11px] ${
                  change > 0
                    ? 'good-chip'
                    : change < 0
                      ? 'bad-chip'
                      : 'border-[var(--color-border-subtle)] bg-transparent text-[var(--color-text-tertiary)]'
                }`}
              >
                {formatSignedProbabilityChange(change)}
              </span>
            ) : null}
          </div>

          <h3 className="mt-3 max-w-3xl text-lg font-medium leading-snug text-[var(--color-text-primary)] sm:text-[1.28rem]">
            {event.title}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-[var(--color-text-secondary)]">
            <span>Resolves {formatDate(event.resolutionDate)}</span>
            <span className="text-[var(--color-text-tertiary)]">•</span>
            <span className="capitalize">{event.status}</span>
          </div>
        </div>

        <div>
          <OutcomeStrip dense noPrice={noPrice} yesPrice={yesPrice} />
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-x-5 gap-y-3 text-sm text-[var(--color-text-secondary)] xl:grid-cols-1 xl:justify-items-end">
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
