import { Link } from 'react-router-dom'
import { getProviderLabel } from '../features/events/provider-ids'
import type { PulseEvent } from '../features/events/types'
import {
  formatCompactNumber,
  formatSignedProbabilityChange,
} from '../lib/format'
import { OutcomeStrip } from './outcome-strip'

type MarketRowProps = {
  accent?: 'neutral' | 'positive' | 'negative'
  change?: number
  event: PulseEvent
}

const accentStyles = {
  negative: 'border-l-rose-600',
  neutral: 'border-l-stone-300',
  positive: 'border-l-teal-700',
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
      className={`panel group block border-l-4 p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(28,25,23,0.12)] sm:p-5 ${accentStyles[accent]}`}
      to={`/events/${event.id}/${event.slug}`}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">
            <span>{event.category}</span>
            <span className="text-stone-300">/</span>
            <span>{getProviderLabel(event.provider)}</span>
            <span className="text-stone-300">/</span>
            <span>{event.engine}</span>
            {change !== undefined ? (
              <>
                <span className="text-stone-300">/</span>
                <span
                  className={
                    change > 0
                      ? 'text-teal-700'
                      : change < 0
                        ? 'text-rose-700'
                        : 'text-stone-500'
                  }
                >
                  {formatSignedProbabilityChange(change)}
                </span>
              </>
            ) : null}
          </div>

          <h3 className="mt-3 max-w-3xl text-[1.9rem] font-semibold leading-[1.05] text-stone-900 sm:text-[2.1rem]">
            {event.title}
          </h3>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-x-5 gap-y-3 text-sm text-stone-500 xl:min-w-[11rem] xl:justify-items-end">
          <div>
            <div className="stat-label">Total volume</div>
            <div className="mt-1 text-lg font-semibold text-stone-900">
              {formatCompactNumber(event.totalVolume)}
            </div>
          </div>
          <div>
            <div className="stat-label">{secondaryMetricLabel}</div>
            <div className="mt-1 text-lg font-semibold text-stone-900">
              {formatCompactNumber(secondaryMetricValue)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <OutcomeStrip dense noPrice={noPrice} yesPrice={yesPrice} />
      </div>
    </Link>
  )
}
