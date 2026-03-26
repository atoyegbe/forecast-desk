import { Link } from 'react-router-dom'
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

function TickerTrack() {
  const eventsQuery = useEventsQuery({ status: 'open' })
  const events = eventsQuery.data ?? EMPTY_EVENTS
  const tickerEvents = [...events]
    .filter(isNigeriaRelevant)
    .sort(sortByVolume)
    .slice(0, 8)

  if (!tickerEvents.length) {
    return (
      <div className="px-4 py-3 text-sm text-stone-500">
        Building the live ticker...
      </div>
    )
  }

  const items = [...tickerEvents, ...tickerEvents]

  return (
    <div className="ticker-track flex min-w-max items-center gap-4 px-4 py-4">
      {items.map((event, index) => (
        <Link
          className="flex min-w-[290px] items-center gap-3 rounded-full border border-stone-900/10 bg-white px-4 py-3 text-sm shadow-[0_10px_30px_rgba(28,25,23,0.05)] transition hover:border-stone-900/20 hover:bg-stone-50"
          key={`${event.id}-${index}`}
          to={`/events/${event.id}/${event.slug}`}
        >
          <span className="rounded-full bg-amber-600/10 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-amber-800">
            {event.category}
          </span>
          <span className="truncate text-stone-900">{event.title}</span>
          <span className="ml-auto font-semibold text-teal-700">
            {formatProbability(getYesPrice(event))}
          </span>
          <span className="text-stone-400">
            {formatCompactNumber(event.totalVolume)}
          </span>
        </Link>
      ))}
    </div>
  )
}

export function LiveTicker() {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center gap-3 border-b border-stone-900/10 px-4 py-3 text-xs uppercase tracking-[0.3em] text-stone-500">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-600 shadow-[0_0_16px_rgba(225,29,72,0.35)]" />
        Live tape
        <span className="text-stone-300">Top Nigeria-linked markets</span>
      </div>

      <div className="ticker-mask">
        <TickerTrack />
      </div>
    </section>
  )
}
