import { Link } from '@tanstack/react-router'
import { PlatformBadge } from '../components/platform-badge'
import { SectionHeader } from '../components/section-header'
import { useDivergenceQuery } from '../features/events/hooks'
import {
  formatCompactNumber,
  formatDate,
  formatProbability,
  formatProbabilityPoints,
} from '../lib/format'
import { getEventRoute } from '../lib/routes'
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
      <div className="panel p-8 text-[var(--color-text-secondary)]">
        Loading divergence board...
      </div>
    )
  }

  if (divergenceQuery.error) {
    return (
      <div className="panel p-8 text-[var(--color-text-secondary)]">
        <p className="text-lg text-[var(--color-down)]">
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
  const maxSpread = divergenceItems.reduce(
    (largest, entry) => Math.max(largest, entry.maxDivergence),
    0,
  )

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.18fr)_320px] lg:p-6">
          <div className="space-y-5">
            <div className="eyebrow">Cross-platform spread</div>
            <div>
              <h1 className="display-title">
                Where Bayse and Polymarket are furthest apart.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                This board ranks the linked events with the widest current price gaps. It is the fastest read on where local and global crowds may be processing the same story differently.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="metric-card">
                <div className="stat-label">Linked events</div>
                <strong>{formatCompactNumber(divergenceItems.length)}</strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Linked venues</div>
                <strong>{formatCompactNumber(totalLinkedVenues)}</strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Widest spread</div>
                <strong>{leadEntry ? formatProbabilityPoints(leadEntry.maxDivergence) : '0 pts'}</strong>
              </div>
            </div>
          </div>

          <div className="panel-elevated p-4">
            <SectionHeader
              description="The lead row is the sharpest disagreement on the board right now."
              kicker="Lead divergence"
              title={leadEntry?.title ?? 'Waiting for linked events'}
            />

            {leadEntry ? (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {leadEntry.events.map((item) => (
                    <PlatformBadge
                      key={item.event.id}
                      platform={item.event.provider}
                      short
                      size="sm"
                    />
                  ))}
                  <span className="signal-chip terminal-chip">
                    {formatProbabilityPoints(leadEntry.maxDivergence)}
                  </span>
                </div>
                <div className="space-y-2">
                  {leadEntry.events.map((item) => (
                    <div
                      className="flex items-center justify-between gap-3 text-sm"
                      key={item.event.id}
                    >
                      <span className="text-[var(--color-text-secondary)]">
                        {item.event.provider}
                      </span>
                      <span className="mono-data text-[var(--color-text-primary)]">
                        {formatProbability(item.yesPrice)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-[12px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
                  {leadEntry.matchMethod === 'exact' ? 'Exact link' : 'Fuzzy link'} ·{' '}
                  {Math.round(leadEntry.confidence * 100)}% confidence
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">
                No stored cross-platform links are available yet.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            description="Click any row to jump into the compare view for that event."
            kicker="Leaderboard"
            title="Top divergence names"
          />

          <div className="flex flex-wrap gap-2">
            {DIVERGENCE_SORT_IDS.map((sortId) => (
              <button
                className={`terminal-chip px-3 py-2 text-[11px] uppercase tracking-[0.18em] ${
                  activeSortId === sortId
                    ? 'terminal-chip-active'
                    : 'border-[var(--color-border-subtle)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
                }`}
                key={sortId}
                onClick={() => setActiveSortId(sortId)}
                type="button"
              >
                {sortId === 'divergence' ? 'Sort by spread' : 'Sort by volume'}
              </button>
            ))}
          </div>
        </div>

        {divergenceItems.length ? (
          <div className="mt-5 overflow-hidden rounded-lg border border-[var(--color-border)]">
            <div className="hidden grid-cols-[minmax(0,1.45fr)_220px_140px_140px_120px] gap-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)] md:grid">
              <div>Event</div>
              <div>Platforms</div>
              <div>Divergence</div>
              <div>Lead volume</div>
              <div>Category</div>
            </div>

            <div className="divide-y divide-[var(--color-border-subtle)]">
              {divergenceItems.map((entry) => {
                const leadEvent = entry.events[0]?.event
                const spreadWidth =
                  maxSpread > 0
                    ? `${Math.max((entry.maxDivergence / maxSpread) * 100, 6)}%`
                    : '0%'

                return (
                  <Link
                    className="block transition hover:bg-[var(--color-bg-hover)]"
                    key={entry.linkId}
                    search={{
                      tab: 'compare',
                    }}
                    {...getEventRoute(entry.events[0].event)}
                  >
                    <div className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1.45fr)_220px_140px_140px_120px] md:items-center">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {entry.title}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]">
                          <span>
                            {entry.matchMethod === 'exact' ? 'Exact link' : 'Fuzzy link'}
                          </span>
                          <span className="text-[var(--color-text-tertiary)]">•</span>
                          <span>{Math.round(entry.confidence * 100)}% confidence</span>
                          {leadEvent?.resolutionDate ? (
                            <>
                              <span className="text-[var(--color-text-tertiary)]">•</span>
                              <span>Resolves {formatDate(leadEvent.resolutionDate)}</span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {entry.events.map((item) => (
                          <PlatformBadge
                            key={item.event.id}
                            platform={item.event.provider}
                            short
                            size="sm"
                          />
                        ))}
                      </div>

                      <div>
                        <div className="mono-data text-sm font-medium text-[var(--color-text-primary)]">
                          {formatProbabilityPoints(entry.maxDivergence)}
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-signal),var(--color-brand))]"
                            style={{ width: spreadWidth }}
                          />
                        </div>
                      </div>

                      <div className="mono-data text-sm text-[var(--color-text-primary)]">
                        {formatCompactNumber(
                          entry.events.reduce(
                            (total, item) => Math.max(total, item.totalVolume),
                            0,
                          ),
                        )}
                      </div>

                      <div className="text-sm text-[var(--color-text-secondary)]">
                        {entry.category}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="panel-elevated mt-5 p-6 text-sm leading-7 text-[var(--color-text-secondary)]">
            No linked cross-platform events are available yet. The matcher only promotes links when title overlap and timing are strong enough to avoid fake divergence.
          </div>
        )}
      </section>
    </div>
  )
}
