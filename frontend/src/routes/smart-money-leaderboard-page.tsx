import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { SmartMoneyLeaderboardLoadingState } from '../components/loading-state'
import { ScoreBadge } from '../components/score-badge'
import {
  RefreshBadge,
  SectionHeader,
} from '../components/section-header'
import {
  createWalletAlertPropsFromWallet,
  WalletAlertButton,
} from '../components/wallet-alert-button'
import { useDisplayCurrency } from '../features/currency/context'
import {
  useSmartMoneyLiveSignals,
  useSmartMoneyWalletsQuery,
} from '../features/smart-money/hooks'
import {
  formatCompactNumber,
  formatSignedPercent,
  formatTimeAgo,
} from '../lib/format'
import { getSmartMoneyWalletRoute } from '../lib/routes'
import type { AppSearch } from '../router'

function getSearchValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function SmartMoneyLeaderboardPage() {
  useSmartMoneyLiveSignals()
  const { formatMoney } = useDisplayCurrency()
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const minScore = Number.parseInt(getSearchValue(search.minScore) || '50', 10)
  const minVolume = Number.parseInt(getSearchValue(search.minVolume) || '0', 10)
  const walletsQuery = useSmartMoneyWalletsQuery({
    limit: 50,
    minScore,
    minVolume,
  })
  const wallets = walletsQuery.data ?? []
  const isRefreshing = walletsQuery.isFetching && !walletsQuery.isLoading

  const updateSearch = (patch: Partial<AppSearch>) => {
    void navigate({
      resetScroll: false,
      replace: true,
      search: (current): AppSearch => ({
        ...current,
        ...patch,
      }),
      to: '/smart-money/leaderboard',
    })
  }

  if (walletsQuery.isLoading && !wallets.length) {
    return <SmartMoneyLeaderboardLoadingState />
  }

  if (walletsQuery.error) {
    return (
      <div className="panel p-8 text-[var(--color-down)]">
        {(walletsQuery.error as Error).message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5 lg:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_320px]">
          <div className="space-y-4">
            <div className="eyebrow">Whale leaderboard</div>
            <div className="space-y-3">
              <h1 className="display-title">The most accurate wallets on the board.</h1>
              <p className="max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                Rank is computed from closed-position hit rate, ROI, category breadth, and recency. This first pass is Polymarket-only because wallet-level public data is available there.
              </p>
            </div>
          </div>

          <div className="panel-elevated p-4">
            <SectionHeader
              description="Filter the board by score and volume without leaving the leaderboard."
              kicker="Filters"
              status={isRefreshing ? <RefreshBadge /> : null}
              title="Tighten the board"
            />

            <div className="mt-4 space-y-4">
              <label className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="section-kicker">Minimum score</span>
                  <span className="mono-data text-xs text-[var(--color-text-primary)]">
                    {minScore}
                  </span>
                </div>
                <input
                  className="w-full accent-[var(--color-brand)]"
                  max={95}
                  min={0}
                  onChange={(event) => updateSearch({ minScore: event.target.value })}
                  step={5}
                  type="range"
                  value={minScore}
                />
              </label>

              <label className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="section-kicker">Minimum volume</span>
                  <span className="mono-data text-xs text-[var(--color-text-primary)]">
                    {formatMoney(minVolume)}
                  </span>
                </div>
                <input
                  className="w-full accent-[var(--color-brand)]"
                  max={500000}
                  min={0}
                  onChange={(event) => updateSearch({ minVolume: event.target.value })}
                  step={25000}
                  type="range"
                  value={minVolume}
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <SectionHeader
          description={`${formatCompactNumber(wallets.length)} wallets met the current score and volume floor.`}
          kicker="Rankings"
          status={isRefreshing ? <RefreshBadge /> : null}
          title="Leaderboard"
        />

        <div className="mt-5 space-y-0 lg:hidden">
          {wallets.map((wallet) => (
            <div
              className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] py-[14px]"
              key={wallet.address}
            >
              <div className="mono-data w-7 shrink-0 text-[13px] text-[var(--color-text-tertiary)]">
                #{wallet.rank}
              </div>

              <Link
                className="min-w-0 flex-1"
                {...getSmartMoneyWalletRoute(wallet.address)}
              >
                <div className="truncate text-[14px] font-medium text-[var(--color-text-primary)]">
                  {wallet.displayName || wallet.shortAddress}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-[var(--color-text-tertiary)]">
                  <span className={wallet.roi >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}>
                    {formatSignedPercent(wallet.roi)} ROI
                  </span>
                  <span>·</span>
                  <span>{formatTimeAgo(wallet.lastActiveAt)}</span>
                </div>
              </Link>

              <div className="flex shrink-0 items-center gap-2">
                <span className="relative h-[3px] w-7 overflow-hidden rounded-[2px] bg-[var(--color-border)]">
                  <span
                    className="absolute inset-y-0 left-0 rounded-[2px] bg-[#00c58e]"
                    style={{ width: `${Math.max(8, Math.min(wallet.score, 100))}%` }}
                  />
                </span>
                <span className="mono-data text-[13px] text-[var(--color-text-primary)]">
                  {wallet.score}
                </span>
                <WalletAlertButton
                  {...createWalletAlertPropsFromWallet(wallet)}
                  variant="leaderboard"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 hidden overflow-hidden rounded-lg border border-[var(--color-border)] lg:block">
          <div className="hidden grid-cols-[84px_minmax(0,1.4fr)_110px_120px_120px_140px_100px_120px] gap-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)] lg:grid">
            <div>Rank</div>
            <div>Wallet</div>
            <div>Score</div>
            <div>Win rate</div>
            <div>ROI</div>
            <div>Volume</div>
            <div>Markets</div>
            <div>Last active</div>
          </div>

          <div className="divide-y divide-[var(--color-border-subtle)]">
            {wallets.map((wallet) => (
              <div
                className="group relative transition hover:bg-[var(--color-bg-hover)]"
                key={wallet.address}
              >
                <Link
                  className="block pr-12"
                  {...getSmartMoneyWalletRoute(wallet.address)}
                >
                  <div className="grid gap-4 px-4 py-4 lg:grid-cols-[84px_minmax(0,1.4fr)_110px_120px_120px_140px_100px_120px] lg:items-center">
                    <div className="mono-data text-sm text-[var(--color-text-primary)]">
                      #{wallet.rank}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                        {wallet.displayName || wallet.shortAddress}
                      </div>
                      <div className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
                        {wallet.shortAddress}
                      </div>
                    </div>

                    <ScoreBadge score={wallet.score} />

                    <div className={`mono-data text-sm ${wallet.winRate >= 0.75 ? 'text-[var(--color-up)]' : wallet.winRate < 0.6 ? 'text-[var(--color-down)]' : 'text-[var(--color-text-primary)]'}`}>
                      {Math.round(wallet.winRate * 100)}%
                    </div>

                    <div className={`mono-data text-sm ${wallet.roi >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>
                      {formatSignedPercent(wallet.roi)}
                    </div>

                    <div className="mono-data text-sm text-[var(--color-text-primary)]">
                      {formatMoney(wallet.totalVolume)}
                    </div>

                    <div className="mono-data text-sm text-[var(--color-text-primary)]">
                      {formatCompactNumber(wallet.marketCount)}
                    </div>

                    <div className="text-sm text-[var(--color-text-secondary)]">
                      {formatTimeAgo(wallet.lastActiveAt)}
                    </div>
                  </div>
                </Link>

                <div className="absolute top-1/2 right-4 -translate-y-1/2">
                  <WalletAlertButton
                    {...createWalletAlertPropsFromWallet(wallet)}
                    variant="leaderboard"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
