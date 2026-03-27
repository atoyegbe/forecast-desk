import { Link } from '@tanstack/react-router'
import { useEventsQuery } from '../features/events/hooks'
import {
  EMPTY_EVENTS,
  getYesPrice,
  isNigeriaRelevant,
  sortByVolume,
} from '../features/events/insights'
import {
  formatCompactNumber,
  formatProbability,
} from '../lib/format'
import { getEventRoute } from '../lib/routes'
import { PlatformBadge } from './platform-badge'

function TickerTrack() {
  const eventsQuery = useEventsQuery({ status: 'open' })
  const events = eventsQuery.data ?? EMPTY_EVENTS
  const tickerEvents = [...events]
    .filter(isNigeriaRelevant)
    .sort(sortByVolume)
    .slice(0, 8)

  if (!tickerEvents.length) {
    return (
      <div className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
        Building the live ticker...
      </div>
    )
  }

  const items = [...tickerEvents, ...tickerEvents]

  return (
    <div className="ticker-track flex min-w-max items-center gap-3 px-3 py-2.5">
      {items.map((event, index) => (
        <Link
          className="flex min-w-[280px] items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3.5 py-2.5 text-sm transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)]"
          key={`${event.id}-${index}`}
          {...getEventRoute(event)}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <PlatformBadge platform={event.provider} short size="sm" />
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                {event.category}
              </span>
            </div>
            <div className="mt-1 truncate text-[13px] text-[var(--color-text-primary)]">
              {event.title}
            </div>
          </div>

          <div className="text-right">
            <div
              className={`mono-data text-sm font-medium ${
                getYesPrice(event) >= 0.5
                  ? 'text-[var(--color-up)]'
                  : 'text-[var(--color-down)]'
              }`}
            >
              {formatProbability(getYesPrice(event))}
            </div>
            <div className="mono-data mt-1 text-[11px] text-[var(--color-text-secondary)]">
              {formatCompactNumber(event.totalVolume)}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

export function LiveTicker() {
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="section-kicker">Live tape</span>
        </div>
        <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
          Top Nigeria-linked markets
        </span>
      </div>

      <div className="ticker-mask">
        <TickerTrack />
      </div>
    </section>
  )
}
