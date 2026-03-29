import clsx from 'clsx'
import { Link } from '@tanstack/react-router'
import { useDisplayCurrency } from '../features/currency/context'
import { PlatformBadge } from './platform-badge'
import { WalletAlertButton } from './wallet-alert-button'
import type { PulseSmartMoneySignal } from '../features/smart-money/types'
import {
  formatDate,
  formatProbability,
  formatSignedProbabilityChange,
  formatTimeAgo,
} from '../lib/format'
import {
  getEventRoute,
  getSmartMoneyWalletRoute,
} from '../lib/routes'

type SmartMoneyFeedCardProps = {
  signal: PulseSmartMoneySignal
}

type SignalTemperature = 'cool' | 'hot' | 'warm'

function getScoreTone(score: number) {
  if (score >= 80) {
    return {
      barClassName: 'bg-[#00c58e]',
      textClassName: 'text-[#00c58e]',
    }
  }

  if (score >= 70) {
    return {
      barClassName: 'bg-[#f59e0b]',
      textClassName: 'text-[#f59e0b]',
    }
  }

  return {
    barClassName: 'bg-[#556068]',
    textClassName: 'text-[#556068]',
  }
}

function getSignalTemperature(signal: PulseSmartMoneySignal): SignalTemperature {
  const signalAgeMs = Date.now() - new Date(signal.signalAt).getTime()

  if (
    signalAgeMs > 12 * 60 * 60 * 1000 ||
    signal.walletScore < 70 ||
    signal.size < 1_000
  ) {
    return 'cool'
  }

  if (signal.walletScore >= 80 && signal.size >= 5_000) {
    return 'hot'
  }

  if (
    (signal.walletScore >= 70 && signal.walletScore <= 79) ||
    (signal.size >= 1_000 && signal.size < 5_000)
  ) {
    return 'warm'
  }

  return 'cool'
}

function getTemperatureStyles(temperature: SignalTemperature) {
  if (temperature === 'hot') {
    return {
      borderClassName: 'border-l-[#00c58e]',
      opacity: 1,
    }
  }

  if (temperature === 'warm') {
    return {
      borderClassName: 'border-l-[#f59e0b]',
      opacity: 0.85,
    }
  }

  return {
    borderClassName: 'border-l-[var(--color-border)]',
    opacity: 0.7,
  }
}

function getPnlValue(signal: PulseSmartMoneySignal) {
  if (
    !Number.isFinite(signal.currentPrice) ||
    !Number.isFinite(signal.entryPrice) ||
    signal.entryPrice <= 0
  ) {
    return null
  }

  const approximateShareCount = signal.size / signal.entryPrice

  return (signal.currentPrice - signal.entryPrice) * approximateShareCount
}

function getDeltaClassName(delta: number) {
  if (delta > 0) {
    return 'text-[var(--color-up)]'
  }

  if (delta < 0) {
    return 'text-[var(--color-down)]'
  }

  return 'text-[var(--color-text-tertiary)]'
}

export function SmartMoneyFeedCard({ signal }: SmartMoneyFeedCardProps) {
  const {
    formatMoney,
    formatMoneyChange,
  } = useDisplayCurrency()
  const walletLabel = signal.walletDisplayName || signal.walletShortAddress
  const temperature = getSignalTemperature(signal)
  const temperatureStyles = getTemperatureStyles(temperature)
  const scoreTone = getScoreTone(signal.walletScore)
  const pnlValue = getPnlValue(signal)
  const isNoOutcome = signal.outcome === 'NO'

  return (
    <article
      className={clsx(
        'border-b border-[var(--color-border-subtle)] border-l-2 bg-[var(--color-bg-surface)] px-7 py-5 transition-colors hover:bg-[var(--color-bg-hover)]',
        temperatureStyles.borderClassName,
      )}
      style={{ opacity: temperatureStyles.opacity }}
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="mono-data text-[11px] text-[var(--color-text-tertiary)]">
              Rank #{signal.walletRank}
            </span>
            <Link
              className="truncate text-sm font-medium text-[var(--color-text-primary)] transition hover:text-[var(--color-brand)]"
              {...getSmartMoneyWalletRoute(signal.walletAddress)}
            >
              {walletLabel}
            </Link>
            <span className="mono-data text-[11px] text-[var(--color-text-secondary)]">
              {formatTimeAgo(signal.signalAt)}
            </span>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="relative h-[3px] w-7 overflow-hidden rounded-[2px] bg-[var(--color-border)]">
              <span
                className={clsx('absolute inset-y-0 left-0 rounded-[2px]', scoreTone.barClassName)}
                style={{ width: `${Math.max(0, Math.min(signal.walletScore, 100))}%` }}
              />
            </span>
            <span className={clsx('mono-data text-[11px]', scoreTone.textClassName)}>
              {signal.walletScore}
            </span>
          </div>
        </div>

        <div>
          {signal.eventId ? (
            <Link
              className="mb-1.5 block text-[15px] font-medium leading-6 text-[var(--color-text-primary)] transition hover:text-[var(--color-brand)]"
              {...getEventRoute({
                id: signal.eventId,
                slug: signal.eventSlug,
              })}
            >
              {signal.marketTitle}
            </Link>
          ) : (
            <h2 className="mb-1.5 text-[15px] font-medium leading-6 text-[var(--color-text-primary)]">
              {signal.marketTitle}
            </h2>
          )}

          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={clsx(
                  'mono-data text-[12px] font-medium',
                  isNoOutcome ? 'text-[var(--color-down)]' : 'text-[var(--color-up)]',
                )}
              >
                {signal.outcome}
              </span>
              <span className="text-[var(--color-text-secondary)]">Opened</span>
              <span className="mono-data font-medium text-[var(--color-text-primary)]">
                @ {formatProbability(signal.entryPrice)}
              </span>
              <span className="text-[var(--color-text-tertiary)]">·</span>
              <span className="mono-data font-medium text-[var(--color-text-primary)]">
                {formatMoney(signal.size)}
              </span>
            </div>

            <PlatformBadge platform={signal.provider} short size="sm" />
          </div>
        </div>

        <div
          className={clsx(
            'grid gap-3',
            signal.closingDate ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
          )}
        >
          <div className="border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-3">
            <div className="section-kicker">Current market</div>
            <div className="mt-2 flex items-center gap-2">
              <span className="mono-data text-lg font-medium text-[var(--color-text-primary)]">
                {Number.isFinite(signal.currentPrice) ? formatProbability(signal.currentPrice) : '—'}
              </span>
              <span className={clsx('mono-data text-xs', getDeltaClassName(signal.priceDelta))}>
                {Number.isFinite(signal.currentPrice)
                  ? formatSignedProbabilityChange(signal.priceDelta)
                  : '—'}
              </span>
            </div>
          </div>

          <div className="border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-3">
            <div className="section-kicker">Unrealised P&amp;L</div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={clsx(
                  'mono-data text-lg font-medium',
                  pnlValue === null
                    ? 'text-[var(--color-text-tertiary)]'
                    : pnlValue > 0
                      ? 'text-[var(--color-up)]'
                      : pnlValue < 0
                        ? 'text-[var(--color-down)]'
                        : 'text-[var(--color-text-secondary)]',
                )}
              >
                {pnlValue === null ? '—' : formatMoneyChange(pnlValue)}
              </span>
            </div>
          </div>

          {signal.closingDate ? (
            <div className="border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-3">
              <div className="section-kicker">Closes</div>
              <div className="mt-2 mono-data text-sm text-[var(--color-text-primary)]">
                {formatDate(signal.closingDate)}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
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
            <Link className="terminal-button" {...getSmartMoneyWalletRoute(signal.walletAddress)}>
              View wallet
            </Link>
          )}

          <WalletAlertButton
            buttonClassName="terminal-button border-[var(--color-border)] bg-transparent text-[var(--color-text-primary)] hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-dim)]"
            walletAddress={signal.walletAddress}
            walletLabel={walletLabel}
          />
        </div>
      </div>
    </article>
  )
}
