import { Link } from '@tanstack/react-router'
import { useDisplayCurrency } from '../features/currency/context'
import { getEventMoneyUnit } from '../features/currency/money'
import type { PulseEvent } from '../features/events/types'
import {
  formatClosingCountdown,
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
  const { formatMoney } = useDisplayCurrency()
  const primaryMarket = event.markets[0]
  const yesPrice = primaryMarket?.yesOutcome.price ?? 0
  const noPrice = primaryMarket?.noOutcome.price ?? 0

  return (
    <Link
      className="panel-elevated block min-h-[90px] p-4 transition hover:border-[var(--color-brand)] hover:bg-[var(--color-bg-hover)]"
      {...getEventRoute(event)}
    >
      <div className="flex items-center justify-between gap-3">
        <PlatformBadge platform={event.provider} size="sm" />
        <span className="terminal-chip hidden border-[var(--color-border-subtle)] bg-transparent px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)] sm:inline-flex">
          {event.category}
        </span>
      </div>

      <h3 className="mt-3 line-clamp-2 min-h-[2.6rem] text-[14px] font-medium leading-5 text-[var(--color-text-primary)] sm:mt-4 sm:min-h-[3.5rem] sm:text-[1rem] sm:leading-7">
        {event.title}
      </h3>

      <div className="subtle-rule mt-3 pt-3 sm:mt-4 sm:pt-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-x-4 gap-y-3 sm:grid-cols-4">
          <div>
            <div className="stat-label">Yes</div>
            <div className={`mono-data mt-1 text-[18px] font-medium ${getPriceTone(yesPrice)} sm:text-base`}>
              {formatProbability(yesPrice)}
            </div>
          </div>
          <div className="hidden sm:block">
            <div className="stat-label">No</div>
            <div className={`mono-data mt-1 text-base font-medium ${getPriceTone(noPrice)}`}>
              {formatProbability(noPrice)}
            </div>
          </div>
          <div>
            <div className="stat-label">Volume</div>
            <div className="mono-data mt-1 text-[12px] font-medium text-[var(--color-text-primary)] sm:text-base">
              {formatMoney(event.totalVolume, getEventMoneyUnit(event))}
            </div>
          </div>
          <div>
            <div className="stat-label">Closes</div>
            <div className="mono-data mt-1 text-[12px] font-medium text-[var(--color-text-secondary)] sm:text-sm">
              {formatClosingCountdown(getClosingLabel(event))}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
