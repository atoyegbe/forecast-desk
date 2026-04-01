import { Link, useNavigate } from '@tanstack/react-router'
import { useDisplayCurrency } from '../features/currency/context'
import { PlatformBadge } from './platform-badge'
import { PriceDisplay } from './price-display'
import { ScoreBadge } from './score-badge'
import {
  createWalletAlertPropsFromSignal,
  WalletAlertButton,
} from './wallet-alert-button'
import type { PulseSmartMoneySignal } from '../features/smart-money/types'
import {
  formatSignedProbabilityChange,
  formatTimeAgo,
} from '../lib/format'
import {
  getEventRoute,
  getSmartMoneyWalletRoute,
} from '../lib/routes'

type SignalCardProps = {
  signal: PulseSmartMoneySignal
}

export function SignalCard({ signal }: SignalCardProps) {
  const navigate = useNavigate()
  const { formatMoney } = useDisplayCurrency()
  const walletLabel = signal.walletDisplayName || signal.walletShortAddress
  const deltaClass =
    signal.priceDelta > 0
      ? 'text-[var(--color-up)]'
        : signal.priceDelta < 0
          ? 'text-[var(--color-down)]'
          : 'text-[var(--color-text-secondary)]'
  const accentClass =
    signal.walletScore >= 80
      ? 'border-l-[var(--color-up)]'
      : signal.walletScore >= 70
        ? 'border-l-[var(--color-signal)]'
        : 'border-l-[var(--color-border-strong)]'

  return (
    <article
      className={`panel cursor-pointer border-l-2 p-4 sm:p-5 ${accentClass} ${signal.isNew ? 'border-[var(--color-signal)] bg-[var(--color-signal-dim)]/70' : ''}`}
      onClick={(event) => {
        const target = event.target as HTMLElement

        if (target.closest('a,button,input,select,textarea')) {
          return
        }

        if (signal.eventId) {
          void navigate({
            params: {
              eventId: signal.eventId,
              slug: signal.eventSlug,
            },
            to: '/events/$eventId/$slug',
          })
        }
      }}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement

        if (target.closest('a,button,input,select,textarea')) {
          return
        }

        if ((event.key === 'Enter' || event.key === ' ') && signal.eventId) {
          event.preventDefault()
          void navigate({
            params: {
              eventId: signal.eventId,
              slug: signal.eventSlug,
            },
            to: '/events/$eventId/$slug',
          })
        }
      }}
      role={signal.eventId ? 'link' : undefined}
      tabIndex={signal.eventId ? 0 : undefined}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-[var(--color-text-secondary)]">
          <span className="mono-data text-[var(--color-text-tertiary)]">
            Rank #{signal.walletRank}
          </span>
          <Link
            className="font-medium text-[var(--color-text-primary)] transition hover:text-[var(--color-brand)]"
            {...getSmartMoneyWalletRoute(signal.walletAddress)}
          >
            {walletLabel}
          </Link>
          <ScoreBadge score={signal.walletScore} />
          <span className="text-[var(--color-text-tertiary)]">
            {formatTimeAgo(signal.signalAt)}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <PlatformBadge platform="polymarket" short size="sm" />
              <span className="hidden terminal-chip border-[var(--color-border)] bg-transparent px-2 py-1 text-[11px] text-[var(--color-text-secondary)] sm:inline-flex">
                {signal.category}
              </span>
            </div>

            <WalletAlertButton
              {...createWalletAlertPropsFromSignal(signal)}
              variant="feed"
            />
          </div>

          <h2 className="line-clamp-2 text-[15px] font-semibold leading-6 text-[var(--color-text-primary)] sm:text-xl sm:leading-tight">
            {signal.marketTitle}
          </h2>

          <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
            <span>
              Opened: <strong className="text-[var(--color-text-primary)]">{signal.outcome}</strong>{' '}
              @ <PriceDisplay size="sm" value={signal.entryPrice} />
            </span>
            <span className="text-[var(--color-text-tertiary)]">·</span>
            <span>
              Position: <span className="mono-data text-[var(--color-text-primary)]">{formatMoney(signal.size)}</span>
            </span>
          </div>
        </div>

        <div className="hidden gap-3 sm:grid sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-3">
            <div className="section-kicker">Current market</div>
            <div className="mt-2 flex items-center gap-2">
              <PriceDisplay value={signal.currentPrice} />
              <span className={`mono-data text-sm ${deltaClass}`}>
                {formatSignedProbabilityChange(signal.priceDelta)}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-3">
            <div className="section-kicker">Closes</div>
            <div className="mt-2 mono-data text-sm text-[var(--color-text-primary)]">
              {signal.closingDate ? formatTimeAgo(signal.closingDate) : 'Awaiting schedule'}
            </div>
          </div>
        </div>

        <div className="hidden flex-wrap gap-3 sm:flex">
          {signal.eventId ? (
            <Link
              className="terminal-button"
              {...getEventRoute({
                id: signal.eventId,
                slug: signal.eventSlug,
              })}
            >
              View market
            </Link>
          ) : (
            <span className="terminal-button pointer-events-none opacity-60">
              Market unavailable
            </span>
          )}

          <Link
            className="terminal-button border-[var(--color-border)] bg-transparent text-[var(--color-text-primary)] hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-dim)]"
            {...getSmartMoneyWalletRoute(signal.walletAddress)}
          >
            View wallet profile
          </Link>
        </div>
      </div>
    </article>
  )
}
