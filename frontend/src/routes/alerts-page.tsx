import clsx from 'clsx'
import { Link } from '@tanstack/react-router'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useToast } from '../components/toast-provider'
import type { PulseAlertSubscription, PulseAlertTriggerMode } from '../features/alerts/types'
import {
  formatSignedPercent,
  formatTimeAgo,
  formatWalletAddress,
} from '../lib/format'
import {
  getSmartMoneyRoute,
  getSmartMoneyWalletRoute,
} from '../lib/routes'

type DemoAlertSubscription = PulseAlertSubscription & {
  walletLabel?: string | null
  walletRoi?: number | null
  walletScore?: number | null
}

type DemoDelivery = {
  id: string
  marketTitle: string
  sentAt: string
  status: 'delivered' | 'failed'
  walletAddress: string
  walletLabel?: string | null
}

const DEMO_DELIVERY_EMAIL = 'demo@quorum.so'

const demoSubscriptions: DemoAlertSubscription[] = []

const demoDeliveries: DemoDelivery[] = []

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.333 12.6667H10.6663M6.66634 14.0001H9.33301M4.66634 6.66675C4.66634 4.8258 6.15972 3.33341 8.00067 3.33341C9.84162 3.33341 11.335 4.8258 11.335 6.66675V8.2761C11.335 8.65811 11.4814 9.0256 11.744 9.30308L12.5787 10.1848C13.0888 10.7238 12.7068 11.6001 11.9647 11.6001H4.03663C3.29455 11.6001 2.91257 10.7238 3.42263 10.1848L4.25736 9.30308C4.51995 9.0256 4.66634 8.65811 4.66634 8.2761V6.66675Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 16 16"
      width="20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 4L12 12M12 4L4 12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height="16"
      viewBox="0 0 16 16"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="3.25" cy="8" r="1.15" />
      <circle cx="8" cy="8" r="1.15" />
      <circle cx="12.75" cy="8" r="1.15" />
    </svg>
  )
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={clsx('transition-transform duration-150', isOpen ? 'rotate-180' : '')}
      fill="none"
      height="16"
      viewBox="0 0 16 16"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.5 6L8 9.5L11.5 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function getWalletTitle(subscription: DemoAlertSubscription | DemoDelivery) {
  return subscription.walletLabel || formatWalletAddress(subscription.walletAddress)
}

function getTriggerLabel(mode: PulseAlertTriggerMode) {
  return mode === 'winning-moves-only' ? 'Winning moves only' : 'Any new position'
}

function getTriggerDescription(mode: PulseAlertTriggerMode) {
  return mode === 'winning-moves-only'
    ? 'Only alert when the position is already +5 pts or more above entry.'
    : 'Alert whenever this wallet opens a new YES or NO position.'
}

function formatUsdValue(value: number | null) {
  if (value == null) {
    return 'No min'
  }

  return `$${Math.round(value).toLocaleString('en-US')}`
}

function getFilterSummary(subscription: DemoAlertSubscription) {
  const parts = [getTriggerLabel(subscription.triggerMode)]

  if (subscription.minSizeUsd != null) {
    parts.push(`min ${formatUsdValue(subscription.minSizeUsd)}`)
  }

  if (subscription.minScore != null) {
    parts.push(`score ≥ ${subscription.minScore}`)
  }

  return parts.join(' · ')
}

function getWalletMeta(subscription: DemoAlertSubscription) {
  const parts = [
    typeof subscription.walletScore === 'number'
      ? `Score ${subscription.walletScore}`
      : null,
    typeof subscription.walletRoi === 'number'
      ? `${formatSignedPercent(subscription.walletRoi)} ROI`
      : null,
  ].filter(Boolean)

  return parts.join(' · ') || 'Wallet alerts via email'
}

function StatusPill({ status }: { status: DemoAlertSubscription['status'] }) {
  const isActive = status === 'active'

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-2 rounded-[20px] border px-[10px] py-[4px] font-mono text-[12px]',
        isActive
          ? 'border-[rgba(0,197,142,0.2)] bg-[rgba(0,197,142,0.08)] text-[#00c58e]'
          : 'border-[rgba(85,96,104,0.24)] bg-[rgba(85,96,104,0.08)] text-[var(--color-text-secondary)]',
      )}
    >
      <span
        className={clsx(
          'h-[6px] w-[6px] rounded-full',
          isActive ? 'bg-[#00c58e]' : 'bg-[var(--color-text-tertiary)]',
        )}
      />
      <span>{isActive ? 'Active' : 'Paused'}</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="py-[60px] text-center">
      <div className="mx-auto inline-flex h-10 w-10 items-center justify-center text-[var(--color-border-strong)]">
        <BellIcon className="h-10 w-10" />
      </div>
      <h2 className="mt-3 text-[14px] text-[var(--color-text-secondary)]">
        No alerts set yet
      </h2>
      <p className="mt-[6px] text-[13px] text-[var(--color-text-tertiary)]">
        Set alerts from the Smart Money feed or any wallet profile page.
      </p>
      <Link
        className="mt-5 inline-flex items-center justify-center rounded-[7px] border border-[var(--color-border)] bg-transparent px-4 py-[10px] text-[13px] font-medium text-[var(--color-text-primary)] transition-[border-color,color,background-color] duration-150 hover:border-[#00c58e] hover:bg-[rgba(0,197,142,0.06)] hover:text-[#00c58e]"
        {...getSmartMoneyRoute()}
      >
        Go to Smart Money →
      </Link>
    </div>
  )
}

function AlertSubscriptionDrawer({
  onClose,
  onDelete,
  onSave,
  onToggleStatus,
  subscription,
}: {
  onClose: () => void
  onDelete: (subscriptionId: string) => void
  onSave: (input: DemoAlertSubscription) => void
  onToggleStatus: (subscriptionId: string) => void
  subscription: DemoAlertSubscription
}) {
  const { pushToast } = useToast()
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [minScore, setMinScore] = useState(subscription.minScore ?? 70)
  const [minSizeUsd, setMinSizeUsd] = useState(subscription.minSizeUsd ?? 500)
  const [triggerMode, setTriggerMode] = useState<PulseAlertTriggerMode>(
    subscription.triggerMode,
  )

  useEffect(() => {
    setTriggerMode(subscription.triggerMode)
    setMinSizeUsd(subscription.minSizeUsd ?? 500)
    setMinScore(subscription.minScore ?? 70)
  }, [subscription])

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-stretch bg-[rgba(13,15,16,0.36)] backdrop-blur-sm md:items-stretch md:justify-end"
      role="dialog"
    >
      <button
        aria-label="Close alert drawer"
        className="absolute inset-0"
        onClick={onClose}
        type="button"
      />

      <aside className="relative z-10 flex max-h-[min(92vh,48rem)] w-full flex-col overflow-hidden rounded-t-[12px] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[-24px_0_64px_rgba(0,0,0,0.24)] md:h-full md:max-h-none md:max-w-[360px] md:rounded-t-none md:rounded-l-[12px] md:border-t-0 md:border-r-0">
        <header className="border-b border-[var(--color-border)] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <h2 className="truncate text-[14px] font-medium text-[var(--color-text-primary)]">
                {getWalletTitle(subscription)}
              </h2>
              <div className="font-mono text-[12px] text-[var(--color-text-tertiary)]">
                {getWalletMeta(subscription)}
              </div>
            </div>

            <button
              aria-label="Close alert drawer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-secondary)]"
              onClick={onClose}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <section>
            <div className="mb-[10px] font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              Trigger
            </div>

            <div className="flex flex-wrap gap-2">
              {([
                {
                  label: 'Any new position',
                  mode: 'any-new-position',
                },
                {
                  label: 'Winning moves only',
                  mode: 'winning-moves-only',
                },
              ] as const).map((option) => {
                const isActive = triggerMode === option.mode

                return (
                  <button
                    className={clsx(
                      'rounded-[20px] border px-[14px] py-[6px] text-[13px] transition-colors duration-150',
                      isActive
                        ? 'border-[#00c58e] bg-[rgba(0,197,142,0.1)] text-[#00c58e]'
                        : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:border-[#00c58e] hover:text-[#00c58e]',
                    )}
                    key={option.mode}
                    onClick={() => setTriggerMode(option.mode)}
                    type="button"
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            <p className="mt-3 text-[12px] leading-5 text-[var(--color-text-secondary)]">
              {getTriggerDescription(triggerMode)}
            </p>
          </section>

          <section className="mt-7">
            <button
              className="flex w-full items-center justify-between gap-3 text-left"
              onClick={() => setIsFiltersOpen((current) => !current)}
              type="button"
            >
              <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
                Filters
              </span>
              <span className="text-[var(--color-text-tertiary)]">
                <ChevronIcon isOpen={isFiltersOpen} />
              </span>
            </button>

            {isFiltersOpen ? (
              <div className="mt-4 space-y-4">
                <label className="block">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-[var(--color-text-secondary)]">
                      Minimum position size
                    </span>
                    <span className="font-mono text-[12px] text-[var(--color-text-primary)]">
                      {formatUsdValue(minSizeUsd)}
                    </span>
                  </div>
                  <input
                    className="mt-3 w-full accent-[#00c58e]"
                    max={10_000}
                    min={0}
                    onChange={(event) => {
                      setMinSizeUsd(Number(event.target.value))
                    }}
                    step={100}
                    type="range"
                    value={minSizeUsd}
                  />
                </label>

                <label className="block">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-[var(--color-text-secondary)]">
                      Minimum wallet score
                    </span>
                    <span className="font-mono text-[12px] text-[var(--color-text-primary)]">
                      {minScore}
                    </span>
                  </div>
                  <input
                    className="mt-3 w-full accent-[#00c58e]"
                    max={100}
                    min={60}
                    onChange={(event) => {
                      setMinScore(Number(event.target.value))
                    }}
                    step={1}
                    type="range"
                    value={minScore}
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section className="mt-7">
            <div className="mb-[10px] font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              Delivery
            </div>

            <div className="rounded-[20px] border border-[var(--color-border)] bg-transparent px-[14px] py-[7px] text-[13px] text-[var(--color-text-secondary)]">
              {DEMO_DELIVERY_EMAIL}
            </div>

            <div className="mt-2 font-mono text-[11px] text-[var(--color-text-tertiary)]">
              Telegram coming soon
            </div>
          </section>
        </div>

        <footer className="border-t border-[var(--color-border)] px-6 py-5">
          <div className="text-center font-mono text-[11px] text-[var(--color-text-tertiary)]">
            Last alerted:{' '}
            {subscription.lastDeliveredAt ? formatTimeAgo(subscription.lastDeliveredAt) : 'not yet'}
          </div>

          <button
            className="mt-3 inline-flex w-full items-center justify-center rounded-[7px] bg-[#00c58e] px-4 py-[11px] text-[14px] font-semibold text-[#0d0f10] transition-opacity hover:opacity-90"
            onClick={() => {
              onSave({
                ...subscription,
                minScore,
                minSizeUsd,
                triggerMode,
                updatedAt: new Date().toISOString(),
              })
              pushToast({
                label: 'Alert updated',
                message: `Saved filters for ${getWalletTitle(subscription)}.`,
              })
              onClose()
            }}
            type="button"
          >
            Save changes
          </button>

          <button
            className="mt-3 inline-flex w-full items-center justify-center rounded-[7px] border border-[var(--color-border)] bg-transparent px-4 py-[11px] text-[14px] font-medium text-[var(--color-text-primary)] transition hover:border-[#00c58e] hover:bg-[rgba(0,197,142,0.06)] hover:text-[#00c58e]"
            onClick={() => {
              onToggleStatus(subscription.id)
              pushToast({
                label: subscription.status === 'paused' ? 'Alert resumed' : 'Alert paused',
                message:
                  subscription.status === 'paused'
                    ? `You’ll hear when ${getWalletTitle(subscription)} moves again.`
                    : `You won’t receive new emails for ${getWalletTitle(subscription)}.`,
              })
              onClose()
            }}
            type="button"
          >
            {subscription.status === 'paused' ? 'Resume alert' : 'Pause alert'}
          </button>

          <button
            className="mt-3 block w-full text-center text-[13px] text-[var(--color-down)] transition hover:underline"
            onClick={() => {
              onDelete(subscription.id)
              pushToast({
                label: 'Alert deleted',
                message: `You’ll stop receiving updates for ${getWalletTitle(subscription)}.`,
              })
              onClose()
            }}
            type="button"
          >
            Delete alert
          </button>

          <p className="mt-3 text-center font-mono text-[11px] leading-5 text-[var(--color-text-tertiary)]">
            You&apos;ll get an email when {getWalletTitle(subscription)} opens a
            position matching your filters.
          </p>
        </footer>
      </aside>
    </div>
  )
}

export function AlertsPage() {
  const { pushToast } = useToast()
  const [subscriptions, setSubscriptions] =
    useState<DemoAlertSubscription[]>(demoSubscriptions)
  const [deliveries] = useState<DemoDelivery[]>(demoDeliveries)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [drawerSubscriptionId, setDrawerSubscriptionId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRootRef = useRef<HTMLDivElement | null>(null)

  const drawerSubscription = useMemo(
    () =>
      subscriptions.find((subscription) => subscription.id === drawerSubscriptionId) ??
      null,
    [drawerSubscriptionId, subscriptions],
  )

  useEffect(() => {
    if (!deleteConfirmId) {
      return
    }

    const timer = window.setTimeout(() => {
      setDeleteConfirmId(null)
    }, 3_000)

    return () => window.clearTimeout(timer)
  }, [deleteConfirmId])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRootRef.current?.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuId(null)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleDelete = (subscriptionId: string) => {
    setSubscriptions((current) =>
      current.filter((subscription) => subscription.id !== subscriptionId),
    )
    setDeleteConfirmId(null)
    setOpenMenuId(null)
  }

  const handleStatusToggle = (subscriptionId: string) => {
    setSubscriptions((current) =>
      current.map((subscription) =>
        subscription.id === subscriptionId
          ? {
              ...subscription,
              status: subscription.status === 'paused' ? 'active' : 'paused',
              updatedAt: new Date().toISOString(),
            }
          : subscription,
      ),
    )
    setOpenMenuId(null)
  }

  return (
    <>
      <div className="mx-auto max-w-[680px] px-6 py-10">
        <header>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
            Alerts
          </div>
          <h1 className="mt-2 text-[24px] font-semibold text-[var(--color-text-primary)]">
            Your subscriptions
          </h1>
          <p className="mt-2 text-[14px] text-[var(--color-text-secondary)]">
            You&apos;ll get an email when these wallets move.
          </p>
        </header>

        {subscriptions.length ? (
          <section className="mt-8" ref={menuRootRef}>
            {subscriptions.map((subscription) =>
              deleteConfirmId === subscription.id ? (
                <div
                  className="mb-2 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-4"
                  key={subscription.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-[14px] font-medium text-[var(--color-text-primary)]">
                      Delete this alert?
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        className="text-[13px] text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]"
                        onClick={() => setDeleteConfirmId(null)}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className="rounded-[6px] bg-[var(--color-down)] px-3 py-[7px] text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                        onClick={() => {
                          handleDelete(subscription.id)
                          pushToast({
                            label: 'Alert deleted',
                            message: `Removed ${getWalletTitle(subscription)} from your alerts.`,
                          })
                        }}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <article
                  className="mb-2 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-4"
                  key={subscription.id}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link
                        className="block truncate text-[14px] font-medium text-[var(--color-text-primary)] transition hover:text-[#00c58e]"
                        {...getSmartMoneyWalletRoute(subscription.walletAddress)}
                      >
                        {getWalletTitle(subscription)}
                      </Link>
                      <div className="mt-1 font-mono text-[12px] text-[var(--color-text-tertiary)]">
                        {getFilterSummary(subscription)}
                      </div>
                      <div className="mt-1 font-mono text-[12px] text-[var(--color-text-tertiary)]">
                        {subscription.lastDeliveredAt
                          ? `Last alerted: ${formatTimeAgo(subscription.lastDeliveredAt)}`
                          : 'No alerts sent yet'}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                      <StatusPill status={subscription.status} />

                      <div className="relative">
                        <button
                          aria-expanded={openMenuId === subscription.id}
                          aria-haspopup="menu"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-transparent text-[var(--color-text-tertiary)] transition hover:border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                          onClick={() => {
                            setOpenMenuId((current) =>
                              current === subscription.id ? null : subscription.id,
                            )
                          }}
                          type="button"
                        >
                          <DotsIcon />
                        </button>

                        {openMenuId === subscription.id ? (
                          <div
                            className="absolute top-full right-0 z-20 mt-1 min-w-[148px] rounded-[6px] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] py-1 shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                            role="menu"
                          >
                            <button
                              className="block w-full px-[14px] py-[8px] text-left text-[13px] text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-hover)]"
                              onClick={() => {
                                setDrawerSubscriptionId(subscription.id)
                                setOpenMenuId(null)
                              }}
                              type="button"
                            >
                              Edit
                            </button>
                            <button
                              className="block w-full px-[14px] py-[8px] text-left text-[13px] text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-hover)]"
                              onClick={() => {
                                handleStatusToggle(subscription.id)
                                pushToast({
                                  label:
                                    subscription.status === 'paused'
                                      ? 'Alert resumed'
                                      : 'Alert paused',
                                  message:
                                    subscription.status === 'paused'
                                      ? `You’ll hear when ${getWalletTitle(subscription)} moves again.`
                                      : `Paused email alerts for ${getWalletTitle(subscription)}.`,
                                })
                              }}
                              type="button"
                            >
                              {subscription.status === 'paused' ? 'Resume' : 'Pause'}
                            </button>
                            <button
                              className="block w-full px-[14px] py-[8px] text-left text-[13px] text-[#ef4444] transition hover:bg-[var(--color-bg-hover)]"
                              onClick={() => {
                                setDeleteConfirmId(subscription.id)
                                setOpenMenuId(null)
                              }}
                              type="button"
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              ),
            )}

            {deliveries.length ? (
              <section className="mt-8">
                <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                  Recent deliveries
                </div>

                <div>
                  {deliveries.slice(0, 10).map((delivery) => (
                    <div
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-[var(--color-border-subtle)] py-3 text-[12px] sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)_auto_auto] sm:items-center sm:gap-3"
                      key={delivery.id}
                    >
                      <Link
                        className="truncate text-[var(--color-text-primary)] transition hover:text-[#00c58e]"
                        {...getSmartMoneyWalletRoute(delivery.walletAddress)}
                      >
                        {getWalletTitle(delivery)}
                      </Link>
                      <div className="truncate text-[var(--color-text-secondary)] sm:order-none sm:block">
                        {delivery.marketTitle}
                      </div>
                      <div className="font-mono text-[var(--color-text-tertiary)] sm:text-right">
                        {formatTimeAgo(delivery.sentAt)}
                      </div>
                      <div
                        className={clsx(
                          'font-mono sm:text-right',
                          delivery.status === 'delivered'
                            ? 'text-[#00c58e]'
                            : 'text-[#ef4444]',
                        )}
                      >
                        {delivery.status === 'delivered' ? 'Delivered' : 'Failed'}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </section>
        ) : (
          <EmptyState />
        )}
      </div>

      {drawerSubscription ? (
        <AlertSubscriptionDrawer
          onClose={() => setDrawerSubscriptionId(null)}
          onDelete={handleDelete}
          onSave={(updatedSubscription) => {
            setSubscriptions((current) =>
              current.map((subscription) =>
                subscription.id === updatedSubscription.id
                  ? updatedSubscription
                  : subscription,
              ),
            )
          }}
          onToggleStatus={handleStatusToggle}
          subscription={drawerSubscription}
        />
      ) : null}
    </>
  )
}
