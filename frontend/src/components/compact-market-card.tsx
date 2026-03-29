import { Link } from '@tanstack/react-router'
import { useDisplayCurrency } from '../features/currency/context'
import { getEventMoneyUnit } from '../features/currency/money'
import type { PulseEvent } from '../features/events/types'
import {
  formatDate,
  formatProbability,
} from '../lib/format'
import { getEventRoute } from '../lib/routes'
import { PlatformBadge } from './platform-badge'

type CompactMarketCardProps = {
  event: PulseEvent
}

export function CompactMarketCard({ event }: CompactMarketCardProps) {
  const { formatMoney } = useDisplayCurrency()
  const yesPrice = event.markets[0]?.yesOutcome.price ?? 0
  const noPrice = event.markets[0]?.noOutcome.price ?? 0

  return (
    <Link
      className="panel-elevated block p-4 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)]"
      {...getEventRoute(event)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PlatformBadge platform={event.provider} short size="sm" />
          <span className="terminal-chip border-[var(--color-border-subtle)] bg-transparent px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            {event.category}
          </span>
        </div>
        <div
          className={`mono-data text-sm font-medium ${
            yesPrice >= noPrice
              ? 'text-[var(--color-up)]'
              : 'text-[var(--color-down)]'
          }`}
        >
          {formatProbability(yesPrice)}
        </div>
      </div>

      <div className="mt-3 line-clamp-3 text-[0.98rem] leading-7 text-[var(--color-text-primary)]">
        {event.title}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-[12px] text-[var(--color-text-secondary)]">
        <span>Resolves {formatDate(event.resolutionDate)}</span>
        <span className="mono-data">
          {formatMoney(event.totalVolume, getEventMoneyUnit(event))}
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        <div className="flex h-1.5">
          <div
            className={yesPrice >= noPrice ? 'bg-[var(--color-up)]' : 'bg-[var(--color-down)]'}
            style={{ width: `${yesPrice * 100}%` }}
          />
          <div
            className={yesPrice >= noPrice ? 'bg-[var(--color-down)]' : 'bg-[var(--color-up)]'}
            style={{ width: `${noPrice * 100}%` }}
          />
        </div>
      </div>
    </Link>
  )
}
