import clsx from 'clsx'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useToast } from './toast-provider'
import { useAuth } from '../features/auth/context'
import {
  useAlertSubscriptionsQuery,
  useCreateAlertSubscriptionMutation,
  useDeleteAlertSubscriptionMutation,
  useUpdateAlertSubscriptionMutation,
} from '../features/alerts/hooks'
import type { PulseAlertTriggerMode } from '../features/alerts/types'
import type { PulseSmartMoneySignal, PulseSmartMoneyWallet } from '../features/smart-money/types'
import { BackendRequestError } from '../lib/api-client'
import {
  formatSignedPercent,
  formatTimeAgo,
  formatWalletAddress,
} from '../lib/format'

type WalletAlertButtonVariant = 'feed' | 'leaderboard' | 'wallet-profile'

type WalletAlertButtonProps = {
  className?: string
  tooltip?: string
  variant?: WalletAlertButtonVariant
  walletAddress: string
  walletLabel?: string | null
  walletRoi?: number | null
  walletScore?: number | null
}

function getErrorMessage(error: unknown) {
  if (error instanceof BackendRequestError || error instanceof Error) {
    return error.message
  }

  return 'Could not save this alert.'
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      viewBox="0 0 16 16"
      width="14"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.333 12.6667H10.6663M6.66634 14.0001H9.33301M4.66634 6.66675C4.66634 4.8258 6.15972 3.33341 8.00067 3.33341C9.84162 3.33341 11.335 4.8258 11.335 6.66675V8.2761C11.335 8.65811 11.4814 9.0256 11.744 9.30308L12.5787 10.1848C13.0888 10.7238 12.7068 11.6001 11.9647 11.6001H4.03663C3.29455 11.6001 2.91257 10.7238 3.42263 10.1848L4.25736 9.30308C4.51995 9.0256 4.66634 8.65811 4.66634 8.2761V6.66675Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
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

function getTriggerDescription(mode: PulseAlertTriggerMode) {
  return mode === 'winning-moves-only'
    ? 'Only alert when the position is already +5 pts or more above entry.'
    : 'Alert whenever this wallet opens a new YES or NO position.'
}

function getWalletStatsLabel(input: {
  walletRoi?: number | null
  walletScore?: number | null
}) {
  const parts = [
    typeof input.walletScore === 'number' ? `Score ${input.walletScore}` : null,
    typeof input.walletRoi === 'number'
      ? `${formatSignedPercent(input.walletRoi)} ROI`
      : null,
  ].filter(Boolean)

  return parts.join(' · ') || 'Wallet alerts via email'
}

function formatUsdSliderValue(value: number) {
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function getProfileTriggerLabel(status: 'active' | 'paused' | null) {
  if (status === 'active') {
    return 'Alert active'
  }

  if (status === 'paused') {
    return 'Alert paused'
  }

  return 'Set alert for this wallet'
}

function AlertIconButton({
  isActive,
  onClick,
  showOnHoverOnly = false,
  tooltip,
}: {
  isActive: boolean
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  showOnHoverOnly?: boolean
  tooltip?: string
}) {
  return (
    <div className="relative group/tooltip">
      <button
        aria-label={tooltip ?? 'Set wallet alert'}
        className={clsx(
          'inline-flex h-11 w-11 items-center justify-center rounded-[6px] border border-transparent text-[var(--color-text-tertiary)] transition-[color,background-color,opacity] duration-150 hover:bg-[rgba(0,197,142,0.08)] hover:text-[#00c58e] md:h-7 md:w-7 md:rounded-[4px]',
          isActive ? 'bg-[rgba(0,197,142,0.12)] text-[#00c58e]' : '',
          showOnHoverOnly
            ? 'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:hover:opacity-100 md:focus-visible:opacity-100'
            : '',
        )}
        onClick={onClick}
        type="button"
      >
        <BellIcon />
      </button>

      {tooltip ? (
        <div className="pointer-events-none absolute top-full right-0 z-10 mt-2 min-w-max rounded-md border border-[var(--surface-tooltip-border)] bg-[var(--surface-tooltip-bg)] px-2 py-1 text-[11px] text-[var(--surface-tooltip-text)] opacity-0 shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition-opacity duration-150 delay-[400ms] group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100">
          {tooltip}
        </div>
      ) : null}
    </div>
  )
}

function ProfileAlertButton({
  onClick,
  status,
}: {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  status: 'active' | 'paused' | null
}) {
  const isActive = status === 'active'
  const isPaused = status === 'paused'

  return (
    <button
      className={clsx(
        'inline-flex w-full items-center justify-center gap-2 rounded-[7px] border px-4 py-[10px] text-[13px] font-medium transition-[border-color,color,background-color] duration-150',
        isActive
          ? 'border-[rgba(0,197,142,0.35)] bg-[rgba(0,197,142,0.08)] text-[#00c58e] hover:border-[#00c58e] hover:bg-[rgba(0,197,142,0.12)]'
          : isPaused
            ? 'border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] text-[#f59e0b] hover:border-[#f59e0b] hover:bg-[rgba(245,158,11,0.12)]'
            : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-primary)] hover:border-[#00c58e] hover:bg-[rgba(0,197,142,0.06)] hover:text-[#00c58e]',
      )}
      onClick={onClick}
      type="button"
    >
      {status ? (
        <span
          className={clsx(
            'h-2 w-2 rounded-full',
            isActive ? 'bg-[#00c58e]' : 'bg-[#f59e0b]',
          )}
        />
      ) : null}
      <span>{getProfileTriggerLabel(status)}</span>
    </button>
  )
}

function DrawerActionNote({ message }: { message: string }) {
  return (
    <p className="mt-3 text-center font-mono text-[11px] leading-5 text-[var(--color-text-tertiary)]">
      {message}
    </p>
  )
}

function useWalletSubscription(walletAddress: string) {
  const alertsQuery = useAlertSubscriptionsQuery()

  const subscription = useMemo(
    () =>
      alertsQuery.data?.find(
        (item) =>
          item.type === 'wallet' &&
          item.walletAddress === walletAddress,
      ) ?? null,
    [alertsQuery.data, walletAddress],
  )

  return {
    alertsQuery,
    subscription,
  }
}

export function WalletAlertButton({
  className,
  tooltip = 'Alert me when this wallet moves',
  variant = 'feed',
  walletAddress,
  walletLabel,
  walletRoi,
  walletScore,
}: WalletAlertButtonProps) {
  const normalizedWalletAddress = walletAddress.trim().toLowerCase()
  const { pushToast } = useToast()
  const {
    consumePendingAction,
    isAuthenticated,
    isHydrating,
    openAuthDialog,
    pendingAction,
    user,
  } = useAuth()
  const { subscription: existingSubscription } =
    useWalletSubscription(normalizedWalletAddress)
  const createAlertMutation = useCreateAlertSubscriptionMutation()
  const deleteAlertMutation = useDeleteAlertSubscriptionMutation()
  const updateAlertMutation = useUpdateAlertSubscriptionMutation()
  const [error, setError] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [minScore, setMinScore] = useState(70)
  const [minSizeUsd, setMinSizeUsd] = useState(500)
  const [triggerMode, setTriggerMode] =
    useState<PulseAlertTriggerMode>('any-new-position')
  const currentReturnToPath =
    typeof window === 'undefined'
      ? ''
      : `${window.location.pathname}${window.location.search}${window.location.hash}`
  const headerTitle = walletLabel || formatWalletAddress(normalizedWalletAddress)
  const walletStatsLabel = getWalletStatsLabel({
    walletRoi,
    walletScore,
  })
  const isManageMode = Boolean(existingSubscription)
  const isMutating =
    createAlertMutation.isPending ||
    deleteAlertMutation.isPending ||
    updateAlertMutation.isPending

  useEffect(() => {
    if (!isDrawerOpen) {
      return
    }

    setError(null)
    setTriggerMode(existingSubscription?.triggerMode ?? 'any-new-position')
    setMinScore(existingSubscription?.minScore ?? 70)
    setMinSizeUsd(existingSubscription?.minSizeUsd ?? 500)
  }, [
    existingSubscription?.id,
    existingSubscription?.minScore,
    existingSubscription?.minSizeUsd,
    existingSubscription?.triggerMode,
    isDrawerOpen,
  ])

  useEffect(() => {
    if (!isAuthenticated || !pendingAction) {
      return
    }

    if (
      pendingAction.type !== 'wallet-alert' ||
      pendingAction.walletAddress !== normalizedWalletAddress ||
      pendingAction.returnToPath !== currentReturnToPath
    ) {
      return
    }

    consumePendingAction(pendingAction.id)
    setError(null)
    setIsDrawerOpen(true)
  }, [
    consumePendingAction,
    currentReturnToPath,
    isAuthenticated,
    normalizedWalletAddress,
    pendingAction,
  ])

  const openDrawer = () => {
    if (!isAuthenticated) {
      openAuthDialog({
        pendingAction: {
          type: 'wallet-alert',
          walletAddress: normalizedWalletAddress,
          walletLabel,
        },
      })
      return
    }

    createAlertMutation.reset()
    deleteAlertMutation.reset()
    updateAlertMutation.reset()
    setError(null)
    setIsDrawerOpen(true)
  }

  const closeDrawer = () => {
    if (isMutating) {
      return
    }

    setError(null)
    setIsDrawerOpen(false)
  }

  const deliveryLabel = user?.email ?? 'Sign in to continue'
  const currentSubscriptionStatus = existingSubscription?.status ?? null

  const trigger = (() => {
    if (variant === 'wallet-profile') {
      return (
        <ProfileAlertButton
          onClick={(event) => {
            event.preventDefault()
            openDrawer()
          }}
          status={currentSubscriptionStatus}
        />
      )
    }

    return (
      <AlertIconButton
        isActive={currentSubscriptionStatus === 'active'}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          openDrawer()
        }}
        showOnHoverOnly={variant === 'leaderboard'}
        tooltip={variant === 'feed' ? tooltip : undefined}
      />
    )
  })()

  return (
    <>
      <div className={className}>{trigger}</div>

      {isDrawerOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-stretch bg-[rgba(13,15,16,0.36)] backdrop-blur-sm md:items-stretch md:justify-end"
          role="dialog"
        >
          <button
            aria-label="Close alert drawer"
            className="absolute inset-0"
            onClick={closeDrawer}
            type="button"
          />

          <aside className="relative z-10 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-[16px] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[-24px_0_64px_rgba(0,0,0,0.24)] md:h-full md:max-h-none md:max-w-[360px] md:rounded-t-none md:rounded-l-[12px] md:border-t-0 md:border-r-0">
            <div className="flex justify-center px-4 pt-3 md:hidden">
              <span aria-hidden="true" className="mobile-sheet-handle" />
            </div>
            <header className="border-b border-[var(--color-border)] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <h2 className="truncate text-[14px] font-medium text-[var(--color-text-primary)]">
                    {headerTitle}
                  </h2>
                  <div className="font-mono text-[12px] text-[var(--color-text-tertiary)]">
                    {walletStatsLabel}
                  </div>
                </div>

                <button
                  aria-label="Close alert drawer"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-secondary)] md:h-8 md:w-8"
                  onClick={closeDrawer}
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
                            : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)]',
                          isManageMode ? 'cursor-default opacity-70' : 'hover:border-[#00c58e] hover:text-[#00c58e]',
                        )}
                        disabled={isManageMode}
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
                          {formatUsdSliderValue(minSizeUsd)}
                        </span>
                      </div>
                      <input
                        className="mt-3 w-full accent-[#00c58e]"
                        disabled={isManageMode}
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
                        disabled={isManageMode}
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
                  {deliveryLabel}
                </div>

                <div className="mt-2 font-mono text-[11px] text-[var(--color-text-tertiary)]">
                  Telegram coming soon
                </div>
              </section>

              {error ? (
                <div className="mt-6 rounded-[8px] border border-[var(--color-down-border)] bg-[var(--color-down-dim)] px-3 py-3 text-[13px] text-[var(--color-down)]">
                  {error}
                </div>
              ) : null}
            </div>

            <footer className="border-t border-[var(--color-border)] px-6 py-5 tab-bar-safe md:pb-5">
              {isManageMode ? (
                <>
                  <div className="text-center font-mono text-[11px] text-[var(--color-text-tertiary)]">
                    Last alerted:{' '}
                    {existingSubscription?.lastDeliveredAt
                      ? formatTimeAgo(existingSubscription.lastDeliveredAt)
                      : 'not yet'}
                  </div>

                  <button
                    className="mt-3 inline-flex w-full items-center justify-center rounded-[7px] border border-[var(--color-border)] bg-transparent px-4 py-[11px] text-[14px] font-medium text-[var(--color-text-primary)] transition hover:border-[#00c58e] hover:bg-[rgba(0,197,142,0.06)] hover:text-[#00c58e] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isMutating}
                    onClick={() => {
                      if (!existingSubscription) {
                        return
                      }

                      const nextStatus =
                        existingSubscription.status === 'paused' ? 'active' : 'paused'

                      setError(null)
                      void updateAlertMutation
                        .mutateAsync({
                          subscriptionId: existingSubscription.id,
                          update: { status: nextStatus },
                        })
                        .then(() => {
                          setIsDrawerOpen(false)
                          pushToast({
                            label:
                              nextStatus === 'paused' ? 'Alert paused' : 'Alert resumed',
                            message:
                              nextStatus === 'paused'
                                ? `You won’t receive new emails for ${headerTitle}.`
                                : `You’ll hear when ${headerTitle} moves again.`,
                          })
                        })
                        .catch((mutationError) => {
                          setError(getErrorMessage(mutationError))
                        })
                    }}
                    type="button"
                  >
                    {updateAlertMutation.isPending
                      ? 'Saving...'
                      : existingSubscription?.status === 'paused'
                        ? 'Resume alert'
                        : 'Pause alert'}
                  </button>

                  <button
                    className="mt-3 block w-full text-center text-[13px] text-[var(--color-down)] transition hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isMutating}
                    onClick={() => {
                      if (!existingSubscription) {
                        return
                      }

                      setError(null)
                      void deleteAlertMutation
                        .mutateAsync(existingSubscription.id)
                        .then(() => {
                          setIsDrawerOpen(false)
                          pushToast({
                            label: 'Alert deleted',
                            message: `You’ll stop receiving updates for ${headerTitle}.`,
                          })
                        })
                        .catch((mutationError) => {
                          setError(getErrorMessage(mutationError))
                        })
                    }}
                    type="button"
                  >
                    {deleteAlertMutation.isPending ? 'Deleting...' : 'Delete alert'}
                  </button>

                  <DrawerActionNote
                    message={`You’ll get an email when ${headerTitle} opens a position matching your filters.`}
                  />
                </>
              ) : (
                <>
                  <button
                    className="inline-flex w-full items-center justify-center rounded-[7px] bg-[#00c58e] px-4 py-[11px] text-[14px] font-semibold text-[#0d0f10] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={isHydrating || isMutating}
                    onClick={() => {
                      setError(null)
                      void createAlertMutation
                        .mutateAsync({
                          minScore,
                          minSizeUsd,
                          triggerMode,
                          type: 'wallet',
                          walletAddress: normalizedWalletAddress,
                        })
                        .then(() => {
                          setIsDrawerOpen(false)
                          pushToast({
                            label: 'Alert created',
                            message: `You’ll hear when ${headerTitle} moves.`,
                          })
                        })
                        .catch((mutationError) => {
                          setError(getErrorMessage(mutationError))
                        })
                    }}
                    type="button"
                  >
                    {createAlertMutation.isPending ? 'Creating...' : 'Create alert'}
                  </button>

                  <DrawerActionNote
                    message={`You’ll get an email when ${headerTitle} opens a position matching your filters.`}
                  />
                </>
              )}
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  )
}

export function createWalletAlertPropsFromSignal(signal: PulseSmartMoneySignal) {
  return {
    walletAddress: signal.walletAddress,
    walletLabel: signal.walletDisplayName || signal.walletShortAddress,
    walletScore: signal.walletScore,
  } satisfies Pick<
    WalletAlertButtonProps,
    'walletAddress' | 'walletLabel' | 'walletScore'
  >
}

export function createWalletAlertPropsFromWallet(wallet: PulseSmartMoneyWallet) {
  return {
    walletAddress: wallet.address,
    walletLabel: wallet.displayName || wallet.shortAddress,
    walletRoi: wallet.roi,
    walletScore: wallet.score,
  } satisfies Pick<
    WalletAlertButtonProps,
    'walletAddress' | 'walletLabel' | 'walletRoi' | 'walletScore'
  >
}
