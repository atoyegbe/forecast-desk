import type { CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import { useDisplayCurrency } from '../features/currency/context'
import { getEventMoneyUnit } from '../features/currency/money'
import { useEventsQuery } from '../features/events/hooks'
import {
  EMPTY_EVENTS,
  getYesPrice,
  sortByVolume,
} from '../features/events/insights'
import {
  formatCompactNumber,
  formatProbability,
} from '../lib/format'
import { getEventRoute } from '../lib/routes'
import { TickerLoadingState } from './loading-state'
import { PlatformBadge } from './platform-badge'

type LiveTickerVariant = 'marquee' | 'rail'

function truncateTitle(title: string, maxLength = 40) {
  if (title.length <= maxLength) {
    return title
  }

  return `${title.slice(0, maxLength - 1).trimEnd()}…`
}

function TickerItem({
  event,
  variant,
}: {
  event: (typeof EMPTY_EVENTS)[number]
  variant: LiveTickerVariant
}) {
  const { formatMoney } = useDisplayCurrency()
  const yesPrice = getYesPrice(event)

  if (variant === 'rail') {
    return (
      <Link
        className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-3 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)]"
        {...getEventRoute(event)}
      >
        <div className="flex items-center gap-2">
          <PlatformBadge platform={event.provider} short size="sm" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            {event.category}
          </span>
        </div>

        <div
          className="mt-2 line-clamp-2 text-[13px] leading-5 text-[var(--color-text-primary)]"
          title={event.title}
        >
          {event.title}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span
            className={`mono-data text-sm font-medium ${
              yesPrice >= 0.5
                ? 'text-[var(--color-up)]'
                : 'text-[var(--color-down)]'
            }`}
          >
            {formatProbability(yesPrice)}
          </span>
          <span className="mono-data text-[11px] text-[var(--color-text-secondary)]">
            {formatMoney(event.totalVolume, getEventMoneyUnit(event))}
          </span>
        </div>
      </Link>
    )
  }

  return (
    <Link
      className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-2 text-[11px] whitespace-nowrap transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)] sm:min-h-11 sm:h-auto sm:gap-3 sm:px-3.5 sm:py-2.5 sm:text-sm"
      {...getEventRoute(event)}
    >
      <PlatformBadge platform={event.provider} short size="sm" />
      <span className="hidden text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)] sm:inline">
        {event.category}
      </span>
      <span
        className="max-w-[160px] truncate text-[11px] text-[var(--color-text-primary)] sm:max-w-[260px] sm:text-[13px]"
        title={event.title}
      >
        {truncateTitle(event.title, 30)}
      </span>
      <span
        className={`mono-data text-[11px] font-medium ${
          yesPrice >= 0.5
            ? 'text-[var(--color-up)]'
            : 'text-[var(--color-down)]'
        } sm:text-sm`}
      >
        {formatProbability(yesPrice)}
      </span>
      <span className="hidden mono-data text-[11px] text-[var(--color-text-secondary)] sm:inline">
        {formatMoney(event.totalVolume, getEventMoneyUnit(event))}
      </span>
    </Link>
  )
}

function TickerTrack({
  events,
  isLoading,
  variant,
}: {
  events: typeof EMPTY_EVENTS
  isLoading: boolean
  variant: LiveTickerVariant
}) {
  const tickerEvents = [...events].sort(sortByVolume).slice(0, 8)

  if (isLoading && !tickerEvents.length) {
    return <TickerLoadingState />
  }

  if (!tickerEvents.length) {
    return (
      <div className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
        Building the live ticker...
      </div>
    )
  }

  const marqueeStyle = {
    '--ticker-duration': `${Math.max(tickerEvents.length * 5, 40)}s`,
    '--ticker-duration-mobile': `${Math.max(tickerEvents.length * 7.5, 60)}s`,
  } as CSSProperties

  if (variant === 'rail') {
    return (
      <div className="space-y-2 px-3 py-3">
        {tickerEvents.slice(0, 5).map((event) => (
          <TickerItem event={event} key={event.id} variant={variant} />
        ))}
      </div>
    )
  }

  return (
    <div
      className="ticker-marquee"
      style={marqueeStyle}
    >
      <div className="ticker-lane px-2 py-1.5 sm:px-3 sm:py-2.5">
        {tickerEvents.map((event) => (
          <TickerItem event={event} key={event.id} variant={variant} />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="ticker-lane px-2 py-1.5 sm:px-3 sm:py-2.5"
      >
        {tickerEvents.map((event) => (
          <TickerItem event={event} key={`${event.id}-copy`} variant={variant} />
        ))}
      </div>
    </div>
  )
}

export function LiveTicker({ variant = 'marquee' }: { variant?: LiveTickerVariant }) {
  const eventsQuery = useEventsQuery({ status: 'open' })
  const events = eventsQuery.data ?? EMPTY_EVENTS

  return (
    <section className="panel overflow-hidden">
      <div className="flex h-10 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] px-4 py-2 sm:h-auto sm:py-2.5">
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="section-kicker">Live tape</span>
        </div>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)] sm:text-[11px]">
          {formatCompactNumber(events.length)} markets live
        </span>
      </div>

      {variant === 'rail' ? (
        <div>
          <TickerTrack events={events} isLoading={eventsQuery.isLoading} variant={variant} />
        </div>
      ) : (
        <div className="ticker-mask">
          <TickerTrack events={events} isLoading={eventsQuery.isLoading} variant={variant} />
        </div>
      )}
    </section>
  )
}
