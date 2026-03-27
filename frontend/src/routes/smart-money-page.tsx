import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useMemo } from 'react'
import { ScoreBadge } from '../components/score-badge'
import { SmartMoneyFeedCard } from '../components/smart-money-feed-card'
import {
  useSmartMoneySignalsQuery,
  useSmartMoneyWalletsQuery,
} from '../features/smart-money/hooks'
import type {
  PulseSmartMoneySignal,
  PulseSmartMoneySignalSort,
  PulseSmartMoneyWallet,
} from '../features/smart-money/types'
import {
  formatCategory,
  formatCompactCurrency,
  formatSignedPercent,
  formatSignedProbabilityChange,
  formatTimeAgo,
} from '../lib/format'
import {
  getEventRoute,
  getSmartMoneyLeaderboardRoute,
  getSmartMoneyWalletRoute,
} from '../lib/routes'
import type { AppSearch } from '../router'

const SORT_OPTIONS: Array<{
  label: string
  value: PulseSmartMoneySignalSort
}> = [
  { label: 'Newest', value: 'newest' },
  { label: 'Largest', value: 'largest' },
]

const DEFAULT_CATEGORY_OPTIONS = [
  'All',
  'Politics',
  'Sports',
  'Finance',
  'Culture',
  'General',
]

function getSearchValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function parseSearchNumber(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)

  return Number.isFinite(parsed) ? parsed : fallback
}

function formatSignalOutcomeSummary(signal: PulseSmartMoneySignal) {
  if (Math.abs(signal.priceDelta) < 0.0005) {
    return 'still at entry'
  }

  return formatSignedProbabilityChange(signal.priceDelta)
}

function truncateMarketTitle(title: string, limit = 40) {
  if (title.length <= limit) {
    return title
  }

  return `${title.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}

function getValueToneClass(value: number, threshold = 80) {
  if (!Number.isFinite(value)) {
    return 'text-[var(--color-text-primary)]'
  }

  return value >= threshold ? 'text-[var(--color-up)]' : 'text-[#f59e0b]'
}

function RangeFilter({
  formatValue = (value) => String(value),
  label,
  max,
  min = 0,
  onChange,
  step,
  value,
}: {
  formatValue?: (value: number) => string
  label: string
  max: number
  min?: number
  onChange: (value: number) => void
  step: number
  value: number
}) {
  return (
    <label className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-[var(--color-text-secondary)]">
          {label}
        </span>
        <span className="mono-data text-xs text-[var(--color-text-primary)]">
          {formatValue(value)}
        </span>
      </div>
      <input
        className="w-full accent-[var(--color-brand)]"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  )
}

function WhaleBoardRow({ wallet }: { wallet: PulseSmartMoneyWallet }) {
  const roiClassName =
    wallet.roi > 0
      ? 'text-[var(--color-up)]'
      : wallet.roi < 0
        ? 'text-[var(--color-down)]'
        : 'text-[var(--color-text-tertiary)]'

  return (
    <Link
      className="block border-b border-[var(--color-border-subtle)] py-3 last:border-b-0 hover:bg-[var(--color-bg-hover)]"
      {...getSmartMoneyWalletRoute(wallet.address)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="mono-data text-[11px] text-[var(--color-text-tertiary)]">
              #{wallet.rank}
            </span>
            <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
              {wallet.displayName || wallet.shortAddress}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-text-tertiary)]">
            <span className={`mono-data ${roiClassName}`}>
              {formatSignedPercent(wallet.roi)} ROI
            </span>
            <span>·</span>
            <span className="mono-data">
              {wallet.lastActiveAt ? formatTimeAgo(wallet.lastActiveAt) : 'Awaiting signal'}
            </span>
          </div>
        </div>

        <ScoreBadge score={wallet.score} />
      </div>
    </Link>
  )
}

function LatestActivityRow({ signal }: { signal: PulseSmartMoneySignal }) {
  const summaryTone =
    signal.priceDelta > 0
      ? 'text-[var(--color-up)]'
      : signal.priceDelta < 0
        ? 'text-[var(--color-down)]'
        : 'text-[var(--color-text-tertiary)]'

  return (
    <Link
      className="block py-3 text-[12px] leading-6 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      {...(signal.eventId
        ? getEventRoute({
            id: signal.eventId,
            slug: signal.eventSlug,
          })
        : getSmartMoneyWalletRoute(signal.walletAddress))}
    >
      <span className="font-medium text-[var(--color-text-primary)]">
        {signal.walletDisplayName || signal.walletShortAddress}
      </span>{' '}
      opened{' '}
      <span
        className={
          signal.outcome === 'YES'
            ? 'mono-data text-[var(--color-up)]'
            : 'mono-data text-[var(--color-down)]'
        }
      >
        {signal.outcome}
      </span>{' '}
      on {truncateMarketTitle(signal.marketTitle)}{' '}
      <span className={summaryTone}>— {formatSignalOutcomeSummary(signal)}</span>
    </Link>
  )
}

export function SmartMoneyPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const activeCategory = getSearchValue(search.category) || 'All'
  const activeSort = (getSearchValue(search.sort) || 'newest') as PulseSmartMoneySignalSort
  const activeMinScore = parseSearchNumber(getSearchValue(search.minScore), 60)
  const activeMinSize = parseSearchNumber(getSearchValue(search.minSize), 500)
  const signalsQuery = useSmartMoneySignalsQuery({
    category: activeCategory === 'All' ? undefined : activeCategory,
    limit: 40,
    minScore: activeMinScore,
    minSize: activeMinSize,
    sort: activeSort,
  })
  const signalOverviewQuery = useSmartMoneySignalsQuery({
    limit: 24,
    sort: 'newest',
  })
  const topWalletsQuery = useSmartMoneyWalletsQuery({ limit: 5, minScore: 60 })
  const signals = signalsQuery.data ?? []
  const signalOverview = signalOverviewQuery.data ?? []
  const topWallets = topWalletsQuery.data ?? []
  const categoryOptions = useMemo(() => {
    const discoveredCategories = new Set<string>(DEFAULT_CATEGORY_OPTIONS)

    for (const signal of signalOverview) {
      if (signal.category) {
        discoveredCategories.add(formatCategory(signal.category))
      }
    }

    if (activeCategory && activeCategory !== 'All') {
      discoveredCategories.add(formatCategory(activeCategory))
    }

    return [...discoveredCategories]
  }, [activeCategory, signalOverview])
  const todaySignals = useMemo(() => {
    const today = new Date().toDateString()

    return signals.filter(
      (signal) => new Date(signal.signalAt).toDateString() === today,
    )
  }, [signals])
  const topSignal = useMemo(() => {
    const candidateSignals = todaySignals.length ? todaySignals : signals

    return [...candidateSignals].sort((leftSignal, rightSignal) => {
      if (leftSignal.walletRank !== rightSignal.walletRank) {
        return leftSignal.walletRank - rightSignal.walletRank
      }

      if (leftSignal.walletScore !== rightSignal.walletScore) {
        return rightSignal.walletScore - leftSignal.walletScore
      }

      return rightSignal.size - leftSignal.size
    })[0]
  }, [signals, todaySignals])
  const totalSignalSize = signals.reduce((total, signal) => total + signal.size, 0)
  const averageScore =
    signals.length > 0
      ? Math.round(
          signals.reduce((total, signal) => total + signal.walletScore, 0) / signals.length,
        )
      : 0
  const latestActivitySignals = signalOverview.slice(0, 3)

  const updateSearch = (patch: Partial<AppSearch>) => {
    void navigate({
      replace: true,
      search: (current): AppSearch => ({
        ...current,
        ...patch,
      }),
      to: '/smart-money',
    })
  }

  if (signalsQuery.isLoading && !signals.length) {
    return (
      <div className="panel p-8 text-[var(--color-text-secondary)]">
        Loading smart money feed...
      </div>
    )
  }

  if (signalsQuery.error) {
    return (
      <div className="panel p-8 text-[var(--color-down)]">
        {(signalsQuery.error as Error).message}
      </div>
    )
  }

  return (
    <div className="border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <section className="border-b border-[var(--color-border-subtle)] px-7 py-6">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[#00c58e]">
              <span
                aria-hidden="true"
                className="h-[7px] w-[7px] rounded-full bg-[#00c58e]"
                style={{ animation: 'nav-status-pulse 2s ease-in-out infinite' }}
              />
              <span className="mono-data">Smart Money</span>
            </div>

            <div className="mt-4 space-y-2">
              <h1 className="text-[28px] font-semibold leading-[1.2] text-[var(--color-text-primary)]">
                High-conviction moves, as they happen.
              </h1>
              <p className="max-w-2xl text-[13px] text-[var(--color-text-secondary)]">
                Ranked Polymarket wallets. Every new position surfaces here within 5 minutes.
              </p>
            </div>
          </section>

          <section className="border-b border-[var(--color-border-subtle)]">
            <div className="grid md:grid-cols-2 xl:grid-cols-4">
              <div className="border-b border-[var(--color-border-subtle)] px-[18px] py-[14px] md:border-b-0 xl:border-r xl:border-[var(--color-border-subtle)]">
                <div className="mono-data text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
                  Signals (24h)
                </div>
                <div className="mono-data mt-2 text-[22px] font-medium text-[var(--color-up)]">
                  {signals.length}
                </div>
                <div className="mono-data mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                  Visible after filters
                </div>
              </div>

              <div className="border-b border-[var(--color-border-subtle)] px-[18px] py-[14px] md:border-b-0 md:border-l md:border-[var(--color-border-subtle)] xl:border-r">
                <div className="mono-data text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
                  Capital tracked
                </div>
                <div className="mono-data mt-2 text-[22px] font-medium text-[var(--color-text-primary)]">
                  {formatCompactCurrency(totalSignalSize)}
                </div>
                <div className="mono-data mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                  Across visible signals
                </div>
              </div>

              <div className="border-b border-[var(--color-border-subtle)] px-[18px] py-[14px] md:border-b-0 xl:border-r xl:border-[var(--color-border-subtle)]">
                <div className="mono-data text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
                  Avg wallet score
                </div>
                <div className={`mono-data mt-2 text-[22px] font-medium ${getValueToneClass(averageScore)}`}>
                  {averageScore || '—'}
                </div>
                <div className="mono-data mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                  Wallet quality on board
                </div>
              </div>

              <div className="px-[18px] py-[14px] md:border-l md:border-[var(--color-border-subtle)]">
                <div className="mono-data text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
                  Top signal
                </div>
                <div className="mono-data mt-2 truncate text-base font-medium text-[var(--color-text-primary)] sm:text-[22px]">
                  {topSignal
                    ? topSignal.walletDisplayName || topSignal.walletShortAddress
                    : '—'}
                </div>
                <div className="mono-data mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                  {topSignal
                    ? `${formatCompactCurrency(topSignal.size)} · score ${topSignal.walletScore}`
                    : 'No active signal yet'}
                </div>
              </div>
            </div>
          </section>

          <section className="border-b border-[var(--color-border-subtle)] px-7 py-3">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((category) => (
                  <button
                    className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                      activeCategory === category
                        ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                    }`}
                    key={category}
                    onClick={() =>
                      updateSearch({
                        category: category === 'All' ? undefined : category,
                      })}
                    type="button"
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                <RangeFilter
                  formatValue={(value) => formatCompactCurrency(value)}
                  label="Min position size"
                  max={5000}
                  onChange={(value) => updateSearch({ minSize: String(value) })}
                  step={250}
                  value={activeMinSize}
                />

                <RangeFilter
                  label="Min wallet score"
                  max={95}
                  onChange={(value) => updateSearch({ minScore: String(value) })}
                  step={5}
                  value={activeMinScore}
                />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {SORT_OPTIONS.map((option) => (
                      <button
                        className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                          activeSort === option.value
                            ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                            : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                        }`}
                        key={option.value}
                        onClick={() => updateSearch({ sort: option.value })}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {signals.length ? (
            <section>
              {signals.map((signal) => (
                <SmartMoneyFeedCard key={signal.id} signal={signal} />
              ))}
            </section>
          ) : (
            <section className="px-7 py-6 text-sm leading-7 text-[var(--color-text-secondary)]">
              No signals match the current board filters. Lower the wallet score or position-size threshold to widen the feed.
            </section>
          )}
        </div>

        <aside className="border-t border-[var(--color-border)] lg:border-t-0 lg:border-l">
          <section className="border-b border-[var(--color-border-subtle)] px-[18px] py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="section-kicker">Whale board</div>
                <h2 className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">
                  Ranked wallets
                </h2>
              </div>
              <Link
                className="mono-data text-[11px] text-[var(--color-brand)] hover:text-[var(--color-text-primary)]"
                {...getSmartMoneyLeaderboardRoute()}
              >
                Open board
              </Link>
            </div>

            <div className="mt-3">
              {topWallets.map((wallet) => (
                <WhaleBoardRow key={wallet.address} wallet={wallet} />
              ))}
            </div>
          </section>

          <section className="px-[18px] py-4">
            <div className="section-kicker">Latest activity</div>
            <h2 className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">
              What just hit the tape
            </h2>

            <div className="mt-3 divide-y divide-[var(--color-border-subtle)]">
              {latestActivitySignals.length ? (
                latestActivitySignals.map((signal) => (
                  <LatestActivityRow key={signal.id} signal={signal} />
                ))
              ) : (
                <p className="py-3 text-[12px] text-[var(--color-text-secondary)]">
                  Latest wallet activity will appear here after the next sync.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
