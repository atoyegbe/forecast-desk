import { Link } from '@tanstack/react-router'
import type { PulseEvent } from '../features/events/types'
import {
  formatClosingCountdown,
  formatCompactNumber,
  formatProbability,
} from '../lib/format'
import { getEventRoute } from '../lib/routes'
import { PlatformBadge } from './platform-badge'

type MarketCardProps = {
  event: PulseEvent
}

function getClosingLabel(event: PulseEvent) {
  return event.closingDate ?? event.resolutionDate ?? null
}

function getPriceTone(price: number) {
  if (Math.abs(price - 0.5) < 0.001) {
    return 'text-[var(--color-neutral)]'
  }

  return price > 0.5
    ? 'text-[var(--color-up)]'
    : 'text-[var(--color-down)]'
}

export function MarketCard({ event }: MarketCardProps) {
  const primaryMarket = event.markets[0]
  const yesPrice = primaryMarket?.yesOutcome.price ?? 0
  const noPrice = primaryMarket?.noOutcome.price ?? 0

  return (
    <Link
      className="panel-elevated block p-4 transition hover:border-[var(--color-brand)] hover:bg-[var(--color-bg-hover)]"
      {...getEventRoute(event)}
    >
      <div className="flex items-center justify-between gap-3">
        <PlatformBadge platform={event.provider} size="sm" />
        <span className="terminal-chip border-[var(--color-border-subtle)] bg-transparent px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          {event.category}
        </span>
      </div>

      <h3 className="mt-4 line-clamp-2 min-h-[3.5rem] text-[1rem] font-medium leading-7 text-[var(--color-text-primary)]">
        {event.title}
      </h3>

      <div className="subtle-rule mt-4 pt-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div>
            <div className="stat-label">Yes</div>
            <div className={`mono-data mt-1 text-base font-medium ${getPriceTone(yesPrice)}`}>
              {formatProbability(yesPrice)}
            </div>
          </div>
          <div>
            <div className="stat-label">No</div>
            <div className={`mono-data mt-1 text-base font-medium ${getPriceTone(noPrice)}`}>
              {formatProbability(noPrice)}
            </div>
          </div>
          <div>
            <div className="stat-label">Volume</div>
            <div className="mono-data mt-1 text-base font-medium text-[var(--color-text-primary)]">
              {formatCompactNumber(event.totalVolume)}
            </div>
          </div>
          <div>
            <div className="stat-label">Closes</div>
            <div className="mono-data mt-1 text-sm font-medium text-[var(--color-text-secondary)]">
              {formatClosingCountdown(getClosingLabel(event))}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
