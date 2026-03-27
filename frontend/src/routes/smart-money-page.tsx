import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useMemo } from 'react'
import { SectionHeader } from '../components/section-header'
import { SignalCard } from '../components/signal-card'
import { ScoreBadge } from '../components/score-badge'
import {
  useSmartMoneySignalsQuery,
  useSmartMoneyWalletsQuery,
} from '../features/smart-money/hooks'
import type {
  PulseSmartMoneySignalSort,
  PulseSmartMoneyWallet,
} from '../features/smart-money/types'
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatSignedPercent,
  formatTimeAgo,
} from '../lib/format'
import {
  getSmartMoneyLeaderboardRoute,
  getSmartMoneyWalletRoute,
} from '../lib/routes'
import type { AppSearch } from '../router'

const SORT_OPTIONS: Array<{
  label: string
  value: PulseSmartMoneySignalSort
}> = [
  { label: 'Newest first', value: 'newest' },
  { label: 'Largest first', value: 'largest' },
]

function getSearchValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function RangeFilter({
  label,
  max,
  onChange,
  step,
  value,
}: {
  label: string
  max: number
  onChange: (value: number) => void
  step: number
  value: number
}) {
  return (
    <label className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="section-kicker">{label}</span>
        <span className="mono-data text-xs text-[var(--color-text-primary)]">
          {value}
        </span>
      </div>
      <input
        className="w-full accent-[var(--color-brand)]"
        max={max}
        min={0}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  )
}

function TopWalletRow({ wallet }: { wallet: PulseSmartMoneyWallet }) {
  return (
    <Link
      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-3 transition hover:border-[var(--color-brand)] hover:bg-[var(--color-bg-hover)]"
      {...getSmartMoneyWalletRoute(wallet.address)}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="mono-data text-sm text-[var(--color-text-tertiary)]">
            #{wallet.rank}
          </span>
          <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
            {wallet.displayName || wallet.shortAddress}
          </span>
        </div>
        <div className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
          {formatSignedPercent(wallet.roi)} ROI · {formatTimeAgo(wallet.lastActiveAt)}
        </div>
      </div>

      <ScoreBadge score={wallet.score} />
    </Link>
  )
}

export function SmartMoneyPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const activeCategory = getSearchValue(search.category) || 'All'
  const activeSort = (getSearchValue(search.sort) || 'newest') as PulseSmartMoneySignalSort
  const activeMinScore = Number.parseInt(getSearchValue(search.minScore) || '60', 10)
  const activeMinSize = Number.parseInt(getSearchValue(search.minSize) || '500', 10)
  const signalsQuery = useSmartMoneySignalsQuery({
    category: activeCategory === 'All' ? undefined : activeCategory,
    limit: 40,
    minScore: activeMinScore,
    minSize: activeMinSize,
    sort: activeSort,
  })
  const topWalletsQuery = useSmartMoneyWalletsQuery({ limit: 5, minScore: 60 })
  const signals = signalsQuery.data ?? []
  const topWallets = topWalletsQuery.data ?? []
  const categoryOptions = useMemo(
    () => [
      'All',
      ...new Set(signals.map((signal) => signal.category).filter(Boolean)),
    ],
    [signals],
  )
  const headlineSignal = signals[0]
  const totalSignalSize = signals.reduce((total, signal) => total + signal.size, 0)
  const averageScore =
    signals.length > 0
      ? Math.round(
          signals.reduce((total, signal) => total + signal.walletScore, 0) / signals.length,
        )
      : 0

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
    <div className="space-y-6">
      <section className="panel p-5 lg:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_320px]">
          <div className="space-y-4">
            <div className="eyebrow">Smart money</div>
            <div className="space-y-3">
              <h1 className="display-title">Follow high-conviction wallet moves.</h1>
              <p className="max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                This desk tracks recent qualifying Polymarket buys from the highest-scoring wallets in the owned smart money store. Signals are ranked by wallet quality and refreshed from public wallet data.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="metric-card">
                <div className="stat-label">Recent signals</div>
                <strong>{formatCompactNumber(signals.length)}</strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Tracked flow</div>
                <strong>{formatCompactCurrency(totalSignalSize)}</strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Average wallet score</div>
                <strong>{averageScore || '—'}</strong>
              </div>
            </div>
          </div>

          <div className="panel-elevated p-4">
            <SectionHeader
              description="The full leaderboard lives on its own board. This preview keeps the best wallets visible from the feed."
              kicker="Whale board"
              title="Top wallets"
            />

            <div className="mt-4 space-y-3">
              {topWallets.map((wallet) => (
                <TopWalletRow key={wallet.address} wallet={wallet} />
              ))}
            </div>

            <Link
              className="terminal-button mt-4 w-full justify-center"
              {...getSmartMoneyLeaderboardRoute()}
            >
              Open whale leaderboard
            </Link>
          </div>
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px_260px_auto] lg:items-end">
          <div className="space-y-2">
            <div className="section-kicker">Category</div>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((category) => (
                <button
                  className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
                    activeCategory === category
                      ? 'border-[var(--color-brand)] bg-[rgba(0,197,142,0.15)] text-[var(--color-brand)]'
                      : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                  }`}
                  key={category}
                  onClick={() => updateSearch({ category: category === 'All' ? undefined : category })}
                  type="button"
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <RangeFilter
            label="Minimum position size"
            max={5000}
            onChange={(value) => updateSearch({ minSize: String(value) })}
            step={250}
            value={activeMinSize}
          />

          <RangeFilter
            label="Minimum wallet score"
            max={95}
            onChange={(value) => updateSearch({ minScore: String(value) })}
            step={5}
            value={activeMinScore}
          />

          <div className="space-y-2">
            <div className="section-kicker">Sort</div>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((option) => (
                <button
                  className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
                    activeSort === option.value
                      ? 'border-[var(--color-brand)] bg-[rgba(0,197,142,0.15)] text-[var(--color-brand)]'
                      : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
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
      </section>

      <section className="mx-auto max-w-[840px] space-y-4">
        <SectionHeader
          description={
            headlineSignal
              ? `Lead signal: ${headlineSignal.walletDisplayName || headlineSignal.walletShortAddress} opened ${headlineSignal.outcome} on ${headlineSignal.marketTitle}.`
              : 'No signals are stored for the current filter state.'
          }
          kicker="Feed"
          title="Recent signal flow"
        />

        {signals.length ? (
          <div className="space-y-4">
            {signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        ) : (
          <div className="panel p-6 text-sm leading-7 text-[var(--color-text-secondary)]">
            No signals in the last 24 hours matching the current filters. Tighten the size threshold less aggressively or drop the category filter to widen the board.
          </div>
        )}
      </section>
    </div>
  )
}
