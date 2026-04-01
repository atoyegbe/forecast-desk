import { Link } from '@tanstack/react-router'
import type { PulseEvent } from '../features/events/types'
import {
  formatClosingCountdown,
  formatProbability,
} from '../lib/format'
import { getEventRoute } from '../lib/routes'
import { PlatformBadge } from './platform-badge'

type MarketRowCardProps = {
  event: PulseEvent
}

function getClosingLabel(event: PulseEvent) {
  return event.closingDate ?? event.resolutionDate ?? null
}

export function MarketRowCard({ event }: MarketRowCardProps) {
  const yesPrice = event.markets[0]?.yesOutcome.price ?? 0

  return (
    <Link
      className="panel-elevated flex w-full max-w-full items-center gap-3 px-4 py-3 transition hover:border-[var(--color-brand)] hover:bg-[var(--color-bg-hover)]"
      {...getEventRoute(event)}
    >
      <PlatformBadge platform={event.provider} short size="sm" />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
          {event.title}
        </div>
      </div>

      <div className="mono-data shrink-0 text-sm font-medium text-[var(--color-up)]">
        {formatProbability(yesPrice)}
      </div>

      <div className="mono-data shrink-0 text-xs text-[var(--color-text-secondary)]">
        {formatClosingCountdown(getClosingLabel(event))}
      </div>
    </Link>
  )
}
