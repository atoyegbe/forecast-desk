import { Link } from 'react-router-dom'
import { DivergenceBar } from '../components/divergence-bar'
import { SectionHeader } from '../components/section-header'
import { getProviderLabel } from '../features/events/provider-ids'
import { useDivergenceQuery } from '../features/events/hooks'
import {
  formatCompactNumber,
  formatDate,
  formatProbability,
  formatProbabilityPoints,
} from '../lib/format'
import { useUrlSelection } from '../lib/url-state'

const DIVERGENCE_SORT_IDS = ['divergence', 'volume'] as const

export function DivergencePage() {
  const [activeSortId, setActiveSortId] = useUrlSelection({
    fallback: 'divergence',
    key: 'sort',
    values: DIVERGENCE_SORT_IDS,
  })
  const divergenceQuery = useDivergenceQuery({
    limit: 24,
    sort: activeSortId,
  })

  if (divergenceQuery.isLoading) {
    return (
      <div className="panel p-8 text-stone-500">
        Loading divergence board...
      </div>
    )
  }

  if (divergenceQuery.error) {
    return (
      <div className="panel p-8 text-stone-600">
        <p className="text-lg text-rose-700">
          {(divergenceQuery.error as Error).message}
        </p>
      </div>
    )
  }

  const divergenceItems = divergenceQuery.data ?? []
  const leadEntry = divergenceItems[0]
  const totalLinkedVenues = divergenceItems.reduce(
    (total, entry) => total + entry.events.length,
    0,
  )

  return (
    <div className="space-y-8">
      <section className="panel overflow-hidden">
        <div className="grid 2xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
          <div className="relative min-h-[360px] bg-stone-950">
            {leadEntry?.events[0]?.event.imageUrl ? (
              <img
                alt={leadEntry.title}
                className="absolute inset-0 h-full w-full object-cover object-top opacity-80"
                src={leadEntry.events[0].event.imageUrl}
              />
            ) : null}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.8))]" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-stone-50 sm:p-7">
              <div className="section-kicker text-stone-300">Divergence board</div>
              <div className="mt-3 max-w-sm text-sm leading-7 text-stone-200">
                The sharpest cross-platform disagreement on the desk right now.
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            <div className="eyebrow">Cross-platform spread</div>
            <h1 className="display-title mt-6 text-5xl leading-[0.92] text-stone-950 sm:text-6xl">
              Where Bayse and Polymarket are furthest apart.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
              This board ranks the linked events with the widest current price gaps.
              It is the first clean read on where the local and global crowds may
              be processing the same story differently.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                <div className="stat-label">Linked events</div>
                <div className="mt-2 text-3xl font-semibold text-stone-950">
                  {formatCompactNumber(divergenceItems.length)}
                </div>
              </div>
              <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                <div className="stat-label">Linked venues</div>
                <div className="mt-2 text-3xl font-semibold text-stone-950">
                  {formatCompactNumber(totalLinkedVenues)}
                </div>
              </div>
              <div className="rounded-[1.35rem] border border-stone-900/10 bg-white p-4">
                <div className="stat-label">Widest spread</div>
                <div className="mt-2 text-3xl font-semibold text-stone-950">
                  {leadEntry
                    ? formatProbabilityPoints(leadEntry.maxDivergence)
                    : '0.0 pts'}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {DIVERGENCE_SORT_IDS.map((sortId) => (
                <button
                  className={
                    activeSortId === sortId
                      ? 'dark-pill px-4 py-2 text-sm'
                      : 'rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm font-semibold text-stone-700'
                  }
                  key={sortId}
                  onClick={() => setActiveSortId(sortId)}
                  type="button"
                >
                  {sortId === 'divergence' ? 'Sort by spread' : 'Sort by volume'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          description="Each card is a linked cross-platform event. The spectrum bar shows where each venue sits now, then the card breaks out the underlying prices and volumes."
          kicker="Leaderboard"
          title="Top divergence names"
        />

        {divergenceItems.length ? divergenceItems.map((entry) => {
          const leadEvent = entry.events[0]?.event

          return (
            <article
              className="panel space-y-5 p-6 sm:p-7"
              key={entry.linkId}
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">
                    <span>{entry.category}</span>
                    <span className="text-stone-300">/</span>
                    <span>{entry.matchMethod === 'exact' ? 'Exact match' : 'Fuzzy match'}</span>
                    <span className="text-stone-300">/</span>
                    <span>{Math.round(entry.confidence * 100)}% confidence</span>
                  </div>

                  <h2 className="mt-3 text-[2rem] font-semibold leading-[1.02] text-stone-950 sm:text-[2.4rem]">
                    {entry.title}
                  </h2>
                </div>

                <div className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-3 text-sm text-stone-600 xl:min-w-[18rem]">
                  <div>
                    <div className="stat-label">Max spread</div>
                    <div className="mt-1 text-lg font-semibold text-stone-950">
                      {formatProbabilityPoints(entry.maxDivergence)}
                    </div>
                  </div>
                  <div>
                    <div className="stat-label">Weighted spread</div>
                    <div className="mt-1 text-lg font-semibold text-stone-950">
                      {formatProbabilityPoints(entry.weightedDivergence)}
                    </div>
                  </div>
                  <div>
                    <div className="stat-label">Lead resolution</div>
                    <div className="mt-1 text-lg font-semibold text-stone-950">
                      {formatDate(leadEvent?.resolutionDate)}
                    </div>
                  </div>
                  <div>
                    <div className="stat-label">Lead venue</div>
                    <div className="mt-1 text-lg font-semibold text-stone-950">
                      {leadEvent ? getProviderLabel(leadEvent.provider) : 'TBD'}
                    </div>
                  </div>
                </div>
              </div>

              <DivergenceBar items={entry.events} />

              <div className="grid gap-4 xl:grid-cols-2">
                {entry.events.map((comparedEvent) => (
                  <div
                    className="rounded-[1.4rem] border border-stone-900/10 bg-white p-5"
                    key={comparedEvent.event.id}
                  >
                    <div className="section-kicker">
                      {getProviderLabel(comparedEvent.event.provider)}
                    </div>
                    <h3 className="mt-3 text-xl font-semibold leading-tight text-stone-950">
                      {comparedEvent.event.title}
                    </h3>

                    <div className="mt-5 grid grid-cols-2 gap-4 text-sm text-stone-600">
                      <div>
                        <div className="stat-label">Yes price</div>
                        <div className="mt-1 text-lg font-semibold text-teal-700">
                          {formatProbability(comparedEvent.yesPrice)}
                        </div>
                      </div>
                      <div>
                        <div className="stat-label">Volume</div>
                        <div className="mt-1 text-lg font-semibold text-stone-950">
                          {formatCompactNumber(comparedEvent.totalVolume)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5">
                      <Link
                        className="dark-pill px-4 py-2 text-sm"
                        to={`/events/${comparedEvent.event.id}/${comparedEvent.event.slug}?tab=compare`}
                      >
                        Open compare view
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )
        }) : (
          <div className="panel p-8 text-sm leading-7 text-stone-600">
            No linked cross-platform events are available yet. The matcher only
            promotes links when title overlap and timing are strong enough to avoid
            fake divergence.
          </div>
        )}
      </section>
    </div>
  )
}
