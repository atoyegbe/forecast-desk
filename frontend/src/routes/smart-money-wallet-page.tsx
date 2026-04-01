import { useMemo } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { SmartMoneyWalletLoadingState } from '../components/loading-state'
import { PriceDisplay } from '../components/price-display'
import { ScoreBadge } from '../components/score-badge'
import {
  RefreshBadge,
  SectionHeader,
} from '../components/section-header'
import { SignalCard } from '../components/signal-card'
import { useToast } from '../components/toast-provider'
import {
  createWalletAlertPropsFromWallet,
  WalletAlertButton,
} from '../components/wallet-alert-button'
import { useDisplayCurrency } from '../features/currency/context'
import {
  useSmartMoneyLiveSignals,
  useSmartMoneyWalletQuery,
} from '../features/smart-money/hooks'
import {
  buildWalletMetadata,
  buildWalletSummary,
} from '../features/smart-money/seo'
import {
  formatCompactNumber,
  formatDate,
  formatSignedPercent,
  formatTimeAgo,
} from '../lib/format'
import { usePageMetadata } from '../lib/page-metadata'
import { getEventRoute, getSmartMoneyLeaderboardRoute } from '../lib/routes'

function ScoreRing({ score }: { score: number }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const offset = circumference - circumference * Math.max(0, Math.min(score, 100)) / 100
  const stroke =
    score >= 80
      ? 'var(--color-up)'
      : score >= 60
        ? 'var(--color-signal)'
        : 'var(--color-text-tertiary)'

  return (
    <svg className="h-20 w-20 sm:h-28 sm:w-28" viewBox="0 0 100 100">
      <circle
        cx="50"
        cy="50"
        fill="none"
        r={radius}
        stroke="var(--color-border-subtle)"
        strokeWidth="8"
      />
      <circle
        cx="50"
        cy="50"
        fill="none"
        r={radius}
        stroke={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        strokeWidth="8"
        transform="rotate(-90 50 50)"
      />
      <text
        fill="currentColor"
        fontFamily="var(--font-mono, 'DM Mono', monospace)"
        fontSize="22"
        fontWeight="700"
        textAnchor="middle"
        x="50"
        y="56"
      >
        {score}
      </text>
    </svg>
  )
}

export function SmartMoneyWalletPage() {
  useSmartMoneyLiveSignals()
  const {
    formatMoney,
    formatMoneyChange,
  } = useDisplayCurrency()
  const { pushToast } = useToast()
  const { walletAddress } = useParams({
    from: '/smart-money/wallets/$walletAddress',
  })
  const walletQuery = useSmartMoneyWalletQuery(walletAddress)
  const walletDetail = walletQuery.data ?? null
  const walletSummary = useMemo(
    () => (walletDetail ? buildWalletSummary(walletDetail) : null),
    [walletDetail],
  )
  const backendOrigin =
    typeof window === 'undefined'
      ? ''
      : (
          import.meta.env.QUORUM_PUBLIC_BACKEND_API_BASE?.replace(/\/api\/v1$/, '') ||
          window.location.origin
        ).replace(/\/$/, '')

  usePageMetadata(
    buildWalletMetadata(walletAddress, walletDetail, {
      backendOrigin,
    }),
  )

  if (walletQuery.isLoading) {
    return <SmartMoneyWalletLoadingState />
  }

  if (walletQuery.error) {
    return (
      <div className="panel p-8 text-[var(--color-down)]">
        {(walletQuery.error as Error).message}
      </div>
    )
  }

  if (!walletDetail) {
    return (
      <div className="panel p-8 text-[var(--color-text-secondary)]">
        Wallet not found.
      </div>
    )
  }

  const { categoryStats, openPositions, recentSignals, wallet } = walletDetail
  const isRefreshing = walletQuery.isFetching && !walletQuery.isLoading
  const walletUrl =
    typeof window === 'undefined'
      ? buildWalletMetadata(walletAddress, walletDetail, {
          backendOrigin,
        }).canonicalPath ?? ''
      : new URL(
          buildWalletMetadata(walletAddress, walletDetail, {
            backendOrigin,
          }).canonicalPath ?? '',
          window.location.origin,
        ).toString()

  return (
    <div className="space-y-6">
      <section className="panel p-5 lg:p-6">
        <div className="space-y-4">
          <Link
            className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-brand)] transition hover:text-[var(--color-text-primary)]"
            {...getSmartMoneyLeaderboardRoute()}
          >
            ← Back to leaderboard
          </Link>

          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="panel-elevated flex flex-col items-center justify-center gap-3 p-5">
              <ScoreRing score={wallet.score} />
              <ScoreBadge score={wallet.score} />
              <WalletAlertButton
                {...createWalletAlertPropsFromWallet(wallet)}
                className="w-full"
                variant="wallet-profile"
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="eyebrow">Wallet profile</div>
                  {isRefreshing ? <RefreshBadge label="Refreshing" /> : null}
                </div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h1 className="text-[24px] font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--color-text-primary)] sm:text-[36px]">
                    {wallet.displayName || wallet.shortAddress}
                  </h1>
                  <button
                    className="terminal-button w-full border-[var(--color-border)] bg-transparent text-[var(--color-text-primary)] hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-dim)] sm:w-auto"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(walletUrl)
                        pushToast({
                          label: 'Wallet Link Copied',
                          message: `Share ${wallet.displayName || wallet.shortAddress} with a clean public URL.`,
                        })
                      } catch {
                        pushToast({
                          label: 'Copy Failed',
                          message: 'Clipboard access was blocked in this browser.',
                        })
                      }
                    }}
                    type="button"
                  >
                    Copy wallet link
                  </button>
                </div>
                <p className="text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                  {walletSummary}
                </p>
                <p className="text-sm leading-7 text-[var(--color-text-tertiary)]">
                  Active {formatTimeAgo(wallet.lastActiveAt)} · source rank {wallet.sourceRank ?? '—'} on the Polymarket monthly leaderboard · public read-only profile on Quorum.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="metric-card">
                  <div className="stat-label">Win rate</div>
                  <strong>{Math.round(wallet.winRate * 100)}%</strong>
                </div>
                <div className="metric-card">
                  <div className="stat-label">ROI</div>
                  <strong>{formatSignedPercent(wallet.roi)}</strong>
                </div>
                <div className="metric-card">
                  <div className="stat-label">Volume</div>
                  <strong>{formatMoney(wallet.totalVolume)}</strong>
                </div>
                <div className="metric-card">
                  <div className="stat-label">Markets</div>
                  <strong>{formatCompactNumber(wallet.marketCount)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <SectionHeader
          description="Category win rate and ROI, ranked by the wallet's strongest historical categories."
          kicker="Performance"
          status={isRefreshing ? <RefreshBadge /> : null}
          title="Performance by category"
        />

        <div className="mt-5 space-y-4">
          {categoryStats.map((categoryStat) => (
            <div className="space-y-2" key={categoryStat.category}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  {categoryStat.category}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="mono-data text-[var(--color-up)]">
                    {Math.round(categoryStat.winRate * 100)}% win rate
                  </span>
                  <span className={`mono-data ${categoryStat.roi >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>
                    {formatSignedPercent(categoryStat.roi)} ROI
                  </span>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-up)]"
                    style={{ width: `${Math.max(4, categoryStat.winRate * 100)}%` }}
                  />
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
                  <div
                    className={`h-full rounded-full ${categoryStat.roi >= 0 ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-down)]'}`}
                    style={{
                      width: `${Math.max(4, Math.min(Math.abs(categoryStat.roi) * 50, 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <SectionHeader
          description="Open positions show entry price, current price, current P&L, and where the market is currently trading."
          kicker="Open positions"
          status={isRefreshing ? <RefreshBadge /> : null}
          title={`Current board (${openPositions.length})`}
        />

        <div className="mt-5 space-y-3 lg:hidden">
          {openPositions.map((position) => (
            <div className="panel-elevated p-4" key={position.conditionId}>
              <div className="min-w-0">
                {position.eventId ? (
                  <Link
                    className="truncate text-sm font-medium text-[var(--color-text-primary)] transition hover:text-[var(--color-brand)]"
                    {...getEventRoute({
                      id: position.eventId,
                      slug: position.eventSlug,
                    })}
                  >
                    {position.marketTitle}
                  </Link>
                ) : (
                  <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                    {position.marketTitle}
                  </div>
                )}
                <div className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
                  {position.category} · closes {position.closingDate ? formatDate(position.closingDate) : 'TBD'}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <div className="stat-label">Entry</div>
                  <div className="mt-1">
                    <PriceDisplay size="sm" value={position.entryPrice} />
                  </div>
                </div>
                <div>
                  <div className="stat-label">Current</div>
                  <div className="mt-1">
                    <PriceDisplay size="sm" value={position.currentPrice} />
                  </div>
                </div>
                <div>
                  <div className="stat-label">P&amp;L</div>
                  <div className={`mono-data mt-1 text-sm ${position.pnl >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>
                    {formatMoneyChange(position.pnl)}
                  </div>
                </div>
                <div>
                  <div className="stat-label">Size</div>
                  <div className="mono-data mt-1 text-sm text-[var(--color-text-primary)]">
                    {formatMoney(position.entryValue)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 hidden overflow-hidden rounded-lg border border-[var(--color-border)] lg:block">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_120px_100px_100px_110px_120px] gap-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)] lg:grid">
            <div>Market</div>
            <div>Outcome</div>
            <div>Entry</div>
            <div>Current</div>
            <div>P&amp;L</div>
            <div>Size</div>
          </div>

          <div className="divide-y divide-[var(--color-border-subtle)]">
            {openPositions.map((position) => (
              <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.6fr)_120px_100px_100px_110px_120px] lg:items-center" key={position.conditionId}>
                <div className="min-w-0">
                  {position.eventId ? (
                    <Link
                      className="truncate text-sm font-medium text-[var(--color-text-primary)] transition hover:text-[var(--color-brand)]"
                      {...getEventRoute({
                        id: position.eventId,
                        slug: position.eventSlug,
                      })}
                    >
                      {position.marketTitle}
                    </Link>
                  ) : (
                    <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                      {position.marketTitle}
                    </div>
                  )}
                  <div className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
                    {position.category} · closes {position.closingDate ? formatDate(position.closingDate) : 'TBD'}
                  </div>
                </div>

                <div className="text-sm text-[var(--color-text-primary)]">
                  {position.outcome}
                </div>

                <div className="text-sm">
                  <PriceDisplay size="sm" value={position.entryPrice} />
                </div>

                <div className="text-sm">
                  <PriceDisplay size="sm" value={position.currentPrice} />
                </div>

                <div className={`mono-data text-sm ${position.pnl >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}`}>
                  {formatMoneyChange(position.pnl)}
                </div>

                <div className="mono-data text-sm text-[var(--color-text-primary)]">
                  {formatMoney(position.entryValue)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          description="Recent qualifying buys from this wallet, pulled from the owned smart money signal store."
          kicker="Recent signals"
          status={isRefreshing ? <RefreshBadge /> : null}
          title="Signal history"
        />

        <div className="space-y-4">
          {recentSignals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      </section>
    </div>
  )
}
