import clsx from 'clsx'
import { Link } from '@tanstack/react-router'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react'
import { BackendRequestError } from '../lib/api-client'
import { useToast } from '../components/toast-provider'
import {
  useAlertSubscriptionsQuery,
  useDeleteAlertSubscriptionMutation,
  useRecentAlertDeliveriesQuery,
  useUpdateAlertSubscriptionMutation,
} from '../features/alerts/hooks'
import type {
  PulseAlertSubscription,
  PulseAlertTriggerMode,
} from '../features/alerts/types'
import {
  connectTelegramChannel,
  disconnectTelegramChannel,
  requestEmailLink,
  updateUserPreferences,
} from '../features/auth/api'
import { useAuth } from '../features/auth/context'
import type {
  PulseUserDefaultChannel,
} from '../features/auth/types'
import {
  formatTimeAgo,
  formatWalletAddress,
} from '../lib/format'
import {
  getSmartMoneyWalletRoute,
  getSmartMoneyRoute,
} from '../lib/routes'

type TelegramFlowStep = 'enter-code' | 'hidden' | 'open-bot'

function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.333 4.333h11.334c.736 0 1.333.597 1.333 1.334v4.666c0 .737-.597 1.334-1.333 1.334H2.333A1.333 1.333 0 0 1 1 10.333V5.667c0-.737.597-1.334 1.333-1.334Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="m2 5 5.151 3.434a1.5 1.5 0 0 0 1.698 0L14 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13.86 2.408c.438-.172.86.25.688.688l-2.1 9.196c-.126.55-.812.665-1.1.185L9.2 9.467 7.12 11.52a.666.666 0 0 1-1.12-.452l-.133-2.346 6.214-5.614-7.717 4.81-2.62-.87c-.553-.183-.59-.954-.06-1.19l11.176-4.45Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
    </svg>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.86 2.193a1.5 1.5 0 0 1 2.121 0l.826.826a1.5 1.5 0 0 1 0 2.121l-7.4 7.4L3 13l.46-3.347 7.4-7.46Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path
        d="M9.667 3.333 12.667 6.333"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
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

function getWalletTitle(item: {
  walletAddress: string
  walletLabel?: string | null
}) {
  return item.walletLabel || formatWalletAddress(item.walletAddress)
}

function formatUsdValue(value: number | null) {
  if (value == null) {
    return null
  }

  return `$${Math.round(value).toLocaleString('en-US')}`
}

function getTriggerLabel(mode: PulseAlertTriggerMode) {
  return mode === 'winning-moves-only' ? 'Winning moves only' : 'Any new position'
}

function getFilterSummary(subscription: PulseAlertSubscription) {
  const parts = [getTriggerLabel(subscription.triggerMode)]

  if (subscription.minSizeUsd != null) {
    parts.push(`min ${formatUsdValue(subscription.minSizeUsd)}`)
  }

  if (subscription.minScore != null) {
    parts.push(`score ≥ ${subscription.minScore}`)
  }

  return parts.join(' · ')
}

function getDeliveryLine(subscription: PulseAlertSubscription) {
  if (
    subscription.lastDeliveryStatus === 'failed' &&
    subscription.lastDeliveryAttemptAt
  ) {
    return {
      label: `Last failed: ${formatTimeAgo(subscription.lastDeliveryAttemptAt)}`,
      tone: 'failed' as const,
    }
  }

  if (subscription.lastDeliveredAt) {
    return {
      label: `Last alert: ${formatTimeAgo(subscription.lastDeliveredAt)}`,
      tone: 'delivered' as const,
    }
  }

  if (
    subscription.lastDeliveryStatus === 'pending' &&
    subscription.lastDeliveryAttemptAt
  ) {
    return {
      label: `Pending since ${formatTimeAgo(subscription.lastDeliveryAttemptAt)}`,
      tone: 'pending' as const,
    }
  }

  return {
    label: 'No alerts sent yet',
    tone: 'idle' as const,
  }
}

function DeliveryStatusDot({
  tone,
}: {
  tone: 'delivered' | 'failed' | 'idle' | 'pending'
}) {
  return (
    <span
      className={clsx(
        'mt-[5px] h-[6px] w-[6px] rounded-full',
        tone === 'delivered' && 'bg-[#00c58e]',
        tone === 'failed' && 'bg-[#ef4444]',
        tone === 'pending' && 'bg-[var(--color-text-tertiary)]',
        tone === 'idle' && 'bg-transparent',
      )}
    />
  )
}

function ChannelStatusPill({
  children,
}: {
  children: string
}) {
  return (
    <span className="inline-flex items-center rounded-[20px] border border-[rgba(0,197,142,0.2)] bg-[rgba(0,197,142,0.08)] px-[10px] py-[3px] font-mono text-[11px] text-[#00c58e]">
      {children}
    </span>
  )
}

function DeliveryChannelButton({
  isActive,
  isFirst,
  isLast,
  label,
  onClick,
}: {
  isActive: boolean
  isFirst?: boolean
  isLast?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={clsx(
        'flex-1 px-[12px] py-[10px] text-[13px]',
        isFirst && 'rounded-l-[6px]',
        isLast && 'rounded-r-[6px]',
        isActive
          ? 'bg-[var(--color-bg-elevated)] font-medium text-[var(--color-text-primary)]'
          : 'bg-transparent text-[var(--color-text-secondary)]',
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

function TriggerPill({
  isActive,
  label,
  onClick,
}: {
  isActive: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={clsx(
        'min-h-11 rounded-[20px] border px-[14px] py-[8px] text-[13px]',
        isActive
          ? 'border-[#00c58e] bg-[rgba(0,197,142,0.1)] text-[#00c58e]'
          : 'border-[var(--color-border)] text-[var(--color-text-secondary)]',
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

function DrawerFieldLabel({ children }: { children: string }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
      {children}
    </div>
  )
}

function AlertSubscriptionDrawer({
  isBusy,
  onClose,
  onDelete,
  onSave,
  onToggleStatus,
  subscription,
}: {
  isBusy: boolean
  onClose: () => void
  onDelete: (subscriptionId: string) => void
  onSave: (input: PulseAlertSubscription) => void
  onToggleStatus: (subscriptionId: string) => void
  subscription: PulseAlertSubscription
}) {
  const [minScore, setMinScore] = useState(subscription.minScore ?? 70)
  const [minSizeUsd, setMinSizeUsd] = useState(subscription.minSizeUsd ?? 500)
  const [triggerMode, setTriggerMode] = useState<PulseAlertTriggerMode>(
    subscription.triggerMode,
  )

  useEffect(() => {
    setMinScore(subscription.minScore ?? 70)
    setMinSizeUsd(subscription.minSizeUsd ?? 500)
    setTriggerMode(subscription.triggerMode)
  }, [subscription])

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close alert drawer"
        className="absolute inset-0 bg-[rgba(0,0,0,0.34)]"
        onClick={onClose}
        type="button"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-[16px] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-4 md:inset-y-0 md:right-0 md:left-auto md:w-[360px] md:max-h-none md:rounded-none md:rounded-l-[12px] md:border-l md:border-t-0 md:border-r-0 md:border-b-0 md:px-6 md:py-6">
        <div className="mobile-sheet-handle md:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[14px] font-medium text-[var(--color-text-primary)]">
              {getWalletTitle(subscription)}
            </div>
            <div className="mt-1 text-[12px] font-mono text-[var(--color-text-tertiary)]">
              {getFilterSummary(subscription)}
            </div>
          </div>
          <button
            aria-label="Close alert drawer"
            className="flex h-11 w-11 items-center justify-center rounded-[8px] text-[var(--color-text-tertiary)] transition-colors duration-150 hover:bg-[var(--color-bg-hover)]"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <section>
            <DrawerFieldLabel>Trigger</DrawerFieldLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              <TriggerPill
                isActive={triggerMode === 'any-new-position'}
                label="Any new position"
                onClick={() => setTriggerMode('any-new-position')}
              />
              <TriggerPill
                isActive={triggerMode === 'winning-moves-only'}
                label="Winning moves only"
                onClick={() => setTriggerMode('winning-moves-only')}
              />
            </div>
          </section>

          <section>
            <DrawerFieldLabel>Filters</DrawerFieldLabel>
            <div className="mt-4 space-y-4">
              <div>
                <div className="flex items-center justify-between text-[13px] text-[var(--color-text-secondary)]">
                  <span>Minimum position size</span>
                  <span className="font-mono text-[12px] text-[var(--color-text-tertiary)]">
                    {formatUsdValue(minSizeUsd) ?? '$0'}
                  </span>
                </div>
                <input
                  className="mt-2 w-full accent-[#00c58e]"
                  max={10000}
                  min={0}
                  onChange={(event) => setMinSizeUsd(Number(event.target.value))}
                  step={100}
                  type="range"
                  value={minSizeUsd}
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[13px] text-[var(--color-text-secondary)]">
                  <span>Minimum wallet score</span>
                  <span className="font-mono text-[12px] text-[var(--color-text-tertiary)]">
                    {minScore}
                  </span>
                </div>
                <input
                  className="mt-2 w-full accent-[#00c58e]"
                  max={100}
                  min={60}
                  onChange={(event) => setMinScore(Number(event.target.value))}
                  step={1}
                  type="range"
                  value={minScore}
                />
              </div>
            </div>
          </section>
        </div>

        <div className="mt-8 border-t border-[var(--color-border)] pt-5">
          <button
            className="min-h-11 w-full rounded-[7px] bg-[#00c58e] px-4 py-[11px] text-[14px] font-semibold text-[#0d0f10] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy}
            onClick={() =>
              onSave({
                ...subscription,
                minScore,
                minSizeUsd,
                triggerMode,
              })
            }
            type="button"
          >
            {isBusy ? 'Saving…' : 'Save changes'}
          </button>

          <button
            className="mt-3 min-h-11 w-full rounded-[7px] border border-[var(--color-border)] px-4 py-[10px] text-[13px] text-[var(--color-text-primary)]"
            onClick={() => onToggleStatus(subscription.id)}
            type="button"
          >
            {subscription.status === 'paused' ? 'Resume alert' : 'Pause alert'}
          </button>

          <button
            className="mt-3 block min-h-11 w-full text-center text-[12px] text-[#ef4444]"
            onClick={() => onDelete(subscription.id)}
            type="button"
          >
            Delete alert
          </button>
        </div>
      </div>
    </div>
  )
}

function AlertsLoadingState() {
  return (
    <div className="mx-auto max-w-[600px] px-4 py-12 md:px-6">
      <div className="h-3 w-16 rounded-full bg-[var(--color-bg-hover)]" />
      <div className="mt-4 h-8 w-48 rounded-full bg-[var(--color-bg-hover)]" />
      <div className="mt-8 space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            className="h-[58px] rounded-[10px] border border-[var(--color-border-subtle)] bg-[rgba(255,255,255,0.02)]"
            key={index}
          />
        ))}
      </div>
    </div>
  )
}

function AlertsAuthRequiredState({
  onSignIn,
}: {
  onSignIn: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col px-4 py-12 md:px-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
        Alerts
      </div>
      <h1 className="mt-2 text-[28px] font-semibold text-[var(--color-text-primary)]">
        Your alerts
      </h1>
      <p className="mt-5 max-w-[520px] text-[14px] leading-7 text-[var(--color-text-secondary)]">
        Sign in to manage delivery channels, review wallet subscriptions, and
        see recent alert history.
      </p>
      <button
        className="mt-8 inline-flex min-h-11 w-full items-center justify-center rounded-[7px] border border-[var(--color-border)] px-4 py-[10px] text-[13px] font-medium text-[var(--color-text-primary)] transition-colors duration-150 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)] sm:w-fit"
        onClick={onSignIn}
        type="button"
      >
        Sign in to continue
      </button>
    </div>
  )
}

export function AlertsPage() {
  const { pushToast } = useToast()
  const {
    openAuthDialog,
    isAuthenticated,
    isHydrating,
    replaceUser,
    signOut,
    user,
  } = useAuth()
  const subscriptionsQuery = useAlertSubscriptionsQuery()
  const deliveriesQuery = useRecentAlertDeliveriesQuery()
  const updateAlertMutation = useUpdateAlertSubscriptionMutation()
  const deleteAlertMutation = useDeleteAlertSubscriptionMutation()
  const authPromptedRef = useRef(false)
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')
  const [isSavingEmail, setIsSavingEmail] = useState(false)
  const [isSendingEmailLink, setIsSendingEmailLink] = useState(false)
  const [emailLinkSent, setEmailLinkSent] = useState(false)
  const [showEmailSaved, setShowEmailSaved] = useState(false)
  const [showAllDeliveries, setShowAllDeliveries] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [collapsingIds, setCollapsingIds] = useState<string[]>([])
  const [activeDrawerId, setActiveDrawerId] = useState<string | null>(null)
  const [telegramFlowStep, setTelegramFlowStep] = useState<TelegramFlowStep>('hidden')
  const [telegramCodeDigits, setTelegramCodeDigits] = useState<string[]>(
    () => Array.from({ length: 6 }, () => ''),
  )
  const [telegramCodeError, setTelegramCodeError] = useState<string | null>(null)
  const [telegramCodeShake, setTelegramCodeShake] = useState(false)
  const [isVerifyingTelegram, setIsVerifyingTelegram] = useState(false)
  const [telegramDisconnectConfirm, setTelegramDisconnectConfirm] = useState(false)
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([])
  const emailSavedTimeoutRef = useRef<number | null>(null)
  const deleteConfirmTimeoutRef = useRef<number | null>(null)
  const telegramErrorTimeoutRef = useRef<number | null>(null)

  const activeUser = user
  const subscriptions = subscriptionsQuery.data ?? []
  const deliveries = deliveriesQuery.data ?? []
  const telegramHandle = activeUser?.telegramHandle ?? null
  const defaultChannel = activeUser?.defaultChannel ?? 'email'
  const hasEmail = Boolean(activeUser?.email)
  const visibleSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => !collapsingIds.includes(subscription.id)),
    [collapsingIds, subscriptions],
  )
  const visibleDeliveries = useMemo(
    () => (showAllDeliveries ? deliveries : deliveries.slice(0, 5)),
    [deliveries, showAllDeliveries],
  )
  const activeDrawerSubscription = visibleSubscriptions.find(
    (subscription) => subscription.id === activeDrawerId,
  ) ?? null

  useEffect(() => {
    if (!editingEmail) {
      setEmailDraft(activeUser?.email ?? '')
    }
  }, [activeUser?.email, editingEmail])

  useEffect(() => {
    if (activeUser?.email) {
      setEmailLinkSent(false)
    }
  }, [activeUser?.email])

  useEffect(() => {
    if (isHydrating) {
      return
    }

    if (isAuthenticated) {
      authPromptedRef.current = false
      return
    }

    if (authPromptedRef.current) {
      return
    }

    authPromptedRef.current = true
    openAuthDialog({
      pendingAction: {
        type: 'alerts-route',
      },
    })
  }, [isAuthenticated, isHydrating, openAuthDialog])

  useEffect(() => {
    if (telegramFlowStep === 'enter-code') {
      codeInputRefs.current[0]?.focus()
    }
  }, [telegramFlowStep])

  useEffect(() => {
    return () => {
      if (emailSavedTimeoutRef.current) {
        window.clearTimeout(emailSavedTimeoutRef.current)
      }

      if (deleteConfirmTimeoutRef.current) {
        window.clearTimeout(deleteConfirmTimeoutRef.current)
      }

      if (telegramErrorTimeoutRef.current) {
        window.clearTimeout(telegramErrorTimeoutRef.current)
      }
    }
  }, [])

  if (isHydrating) {
    return <AlertsLoadingState />
  }

  if (!isAuthenticated || !activeUser) {
    return (
      <AlertsAuthRequiredState
        onSignIn={() =>
          openAuthDialog({
            pendingAction: {
              type: 'alerts-route',
            },
          })
        }
      />
    )
  }

  const clearDeleteConfirmation = () => {
    if (deleteConfirmTimeoutRef.current) {
      window.clearTimeout(deleteConfirmTimeoutRef.current)
      deleteConfirmTimeoutRef.current = null
    }

    setDeleteConfirmId(null)
  }

  const resetTelegramFlow = () => {
    setTelegramFlowStep('hidden')
    setTelegramCodeDigits(Array.from({ length: 6 }, () => ''))
    setTelegramCodeError(null)
    setTelegramCodeShake(false)
    setIsVerifyingTelegram(false)
  }

  const flashEmailSavedState = () => {
    if (emailSavedTimeoutRef.current) {
      window.clearTimeout(emailSavedTimeoutRef.current)
    }

    setShowEmailSaved(true)
    emailSavedTimeoutRef.current = window.setTimeout(() => {
      setShowEmailSaved(false)
    }, 1200)
  }

  const requestEmailAddressLink = async () => {
    const normalizedEmail = emailDraft.trim().toLowerCase()

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      pushToast({
        label: 'Could not send magic link',
        message: 'Enter a valid email address.',
      })
      return
    }

    setIsSendingEmailLink(true)

    try {
      await requestEmailLink(normalizedEmail)
      setEditingEmail(false)
      setEmailLinkSent(true)
      pushToast({
        label: 'Check your inbox',
        message: `We sent a verification link to ${normalizedEmail}.`,
      })
    } catch (error) {
      const message =
        error instanceof BackendRequestError || error instanceof Error
          ? error.message
          : 'Could not send the email link.'

      pushToast({
        label: 'Could not send magic link',
        message,
      })
    } finally {
      setIsSendingEmailLink(false)
    }
  }

  const saveEmail = async () => {
    if (!hasEmail) {
      await requestEmailAddressLink()
      return
    }

    const normalizedEmail = emailDraft.trim().toLowerCase()

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      pushToast({
        label: 'Could not save email',
        message: 'Enter a valid email address.',
      })
      return
    }

    if (normalizedEmail === activeUser?.email) {
      setEditingEmail(false)
      return
    }

    setIsSavingEmail(true)

    try {
      const updatedUser = await updateUserPreferences({
        email: normalizedEmail,
      })

      replaceUser(updatedUser)

      setEditingEmail(false)
      flashEmailSavedState()
    } catch (error) {
      const message =
        error instanceof BackendRequestError || error instanceof Error
          ? error.message
          : 'Could not update the email address.'

      pushToast({
        label: 'Could not save email',
        message,
      })
    } finally {
      setIsSavingEmail(false)
    }
  }

  const handlePreferenceChange = async (
    nextPreference: PulseUserDefaultChannel,
  ) => {
    if (nextPreference === defaultChannel) {
      return
    }

    try {
      const updatedUser = await updateUserPreferences({
        defaultChannel: nextPreference,
      })

      replaceUser(updatedUser)
    } catch (error) {
      const message =
        error instanceof BackendRequestError || error instanceof Error
          ? error.message
          : 'Could not update the default channel.'

      pushToast({
        label: 'Preference not saved',
        message,
      })
    }
  }

  const showTelegramCodeError = (message: string) => {
    if (telegramErrorTimeoutRef.current) {
      window.clearTimeout(telegramErrorTimeoutRef.current)
    }

    setTelegramCodeError(message)
    setTelegramCodeShake(true)
    telegramErrorTimeoutRef.current = window.setTimeout(() => {
      setTelegramCodeDigits(Array.from({ length: 6 }, () => ''))
      setTelegramCodeError(null)
      setTelegramCodeShake(false)
      codeInputRefs.current[0]?.focus()
    }, 1000)
  }

  const submitTelegramCode = async (code: string) => {
    setIsVerifyingTelegram(true)

    try {
      const result = await connectTelegramChannel(code)

      replaceUser({
        ...activeUser,
        telegramHandle: result.handle,
      })

      resetTelegramFlow()
      setTelegramDisconnectConfirm(false)
      pushToast({
        label: 'Telegram connected',
        message: 'Instant alerts are now available on Telegram.',
      })
    } catch (error) {
      const message =
        error instanceof BackendRequestError && error.code === 'invalid_code'
          ? 'Invalid code. Try again.'
          : error instanceof Error
            ? error.message
            : 'Could not connect Telegram.'

      showTelegramCodeError(message)
    } finally {
      setIsVerifyingTelegram(false)
    }
  }

  const handleTelegramDigitChange = (index: number, value: string) => {
    const nextValue = value.replace(/\D/g, '').slice(-1)
    const nextDigits = [...telegramCodeDigits]

    nextDigits[index] = nextValue
    setTelegramCodeDigits(nextDigits)
    setTelegramCodeError(null)
    setTelegramCodeShake(false)

    if (nextValue && index < nextDigits.length - 1) {
      codeInputRefs.current[index + 1]?.focus()
    }

    const nextCode = nextDigits.join('')

    if (nextCode.length === 6 && !nextDigits.includes('')) {
      void submitTelegramCode(nextCode)
    }
  }

  const handleTelegramDigitKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Backspace' && !telegramCodeDigits[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus()
    }
  }

  const handleTelegramDigitPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pastedValue = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)

    if (!pastedValue) {
      return
    }

    event.preventDefault()
    const nextDigits = Array.from({ length: 6 }, (_, index) => pastedValue[index] ?? '')

    setTelegramCodeDigits(nextDigits)

    if (pastedValue.length === 6) {
      void submitTelegramCode(pastedValue)
      return
    }

    codeInputRefs.current[Math.min(pastedValue.length, 5)]?.focus()
  }

  const handleDisconnectTelegram = async () => {
    try {
      await disconnectTelegramChannel()
      replaceUser({
        ...activeUser,
        defaultChannel: 'email',
        telegramHandle: null,
      })

      setTelegramDisconnectConfirm(false)
      resetTelegramFlow()
      pushToast({
        label: 'Telegram disconnected',
        message: 'Alerts will default back to email.',
      })
    } catch (error) {
      const message =
        error instanceof BackendRequestError || error instanceof Error
          ? error.message
          : 'Could not disconnect Telegram.'

      pushToast({
        label: 'Disconnect failed',
        message,
      })
    }
  }

  const handleSaveSubscription = async (nextSubscription: PulseAlertSubscription) => {
    try {
      await updateAlertMutation.mutateAsync({
        subscriptionId: nextSubscription.id,
        update: {
          minScore: nextSubscription.minScore ?? undefined,
          minSizeUsd: nextSubscription.minSizeUsd ?? undefined,
          status: nextSubscription.status,
          triggerMode: nextSubscription.triggerMode,
        },
      })

      await subscriptionsQuery.refetch()

      setActiveDrawerId(null)
      pushToast({
        label: 'Alert updated',
        message: `Saved changes for ${getWalletTitle(nextSubscription)}.`,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not save the alert.'

      pushToast({
        label: 'Save failed',
        message,
      })
    }
  }

  const handleToggleSubscriptionStatus = async (subscriptionId: string) => {
    const currentSubscription = subscriptions.find(
      (subscription) => subscription.id === subscriptionId,
    )

    if (!currentSubscription) {
      return
    }

    const nextStatus = currentSubscription.status === 'paused' ? 'active' : 'paused'

    try {
      await updateAlertMutation.mutateAsync({
        subscriptionId,
        update: {
          status: nextStatus,
        },
      })

      pushToast({
        label: nextStatus === 'paused' ? 'Alert paused' : 'Alert resumed',
        message:
          nextStatus === 'paused'
            ? `Paused alerts for ${getWalletTitle(currentSubscription)}.`
            : `Watching ${getWalletTitle(currentSubscription)} again.`,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not update the alert.'

      pushToast({
        label: 'Update failed',
        message,
      })
    }
  }

  const handleDeleteSubscription = async (subscriptionId: string) => {
    const currentSubscription = subscriptions.find(
      (subscription) => subscription.id === subscriptionId,
    )

    if (!currentSubscription) {
      return
    }

    setCollapsingIds((current) => [...current, subscriptionId])

    window.setTimeout(async () => {
      try {
        await deleteAlertMutation.mutateAsync(subscriptionId)

        setActiveDrawerId((current) => (current === subscriptionId ? null : current))
        pushToast({
          label: 'Alert deleted',
          message: `Removed ${getWalletTitle(currentSubscription)} from your watchlist.`,
        })
      } catch (error) {
        setCollapsingIds((current) => current.filter((id) => id !== subscriptionId))
        const message =
          error instanceof Error ? error.message : 'Could not delete the alert.'

        pushToast({
          label: 'Delete failed',
          message,
        })
        return
      }

      setCollapsingIds((current) => current.filter((id) => id !== subscriptionId))
      clearDeleteConfirmation()
    }, 160)
  }

  const beginDeleteConfirmation = (subscriptionId: string) => {
    clearDeleteConfirmation()
    setOpenMenuId(null)
    setDeleteConfirmId(subscriptionId)
    deleteConfirmTimeoutRef.current = window.setTimeout(() => {
      setDeleteConfirmId((current) => (current === subscriptionId ? null : current))
    }, 3000)
  }

  const renderTelegramConnectPanel = !telegramHandle && telegramFlowStep !== 'hidden'

  return (
    <>
      <div className="mx-auto flex w-full max-w-[600px] flex-col px-4 py-12 md:px-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          Alerts
        </div>
        <h1 className="mt-2 text-[28px] font-semibold text-[var(--color-text-primary)]">
          Your alerts
        </h1>

        <section className="mt-8">
          <div className="font-mono text-[12px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
            Deliver to
          </div>

          <div className="mt-3 border-t border-[var(--color-border-subtle)]">
            <div className="flex flex-col gap-3 border-b border-[var(--color-border-subtle)] py-[14px] sm:flex-row sm:items-center">
              <div className="flex w-5 justify-center text-[var(--color-text-secondary)]">
                <EnvelopeIcon className="h-[14px] w-[14px]" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium text-[var(--color-text-primary)]">
                  {hasEmail ? 'Email' : 'Email (optional)'}
                </div>
                <div className="mt-1 flex min-h-[20px] items-center gap-2 font-mono text-[13px] text-[var(--color-text-secondary)]">
                  {editingEmail ? (
                    <div className="w-full">
                      <input
                        autoFocus
                        className="min-h-11 w-full rounded-[7px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-[16px] text-[var(--color-text-primary)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#00c58e] focus:shadow-[0_0_0_3px_rgba(0,197,142,0.1)]"
                        onChange={(event) => setEmailDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void saveEmail()
                          }

                          if (event.key === 'Escape') {
                            setEditingEmail(false)
                            setEmailDraft(activeUser?.email ?? '')
                          }
                        }}
                        placeholder="you@example.com"
                        value={emailDraft}
                      />
                      <div className="mt-2 flex items-center gap-3 text-[12px]">
                        <button
                          className="min-h-11 text-[#00c58e] transition hover:underline"
                          disabled={isSavingEmail || isSendingEmailLink}
                          onClick={() => void saveEmail()}
                          type="button"
                        >
                          {hasEmail
                            ? isSavingEmail
                              ? 'Saving...'
                              : 'Save'
                            : isSendingEmailLink
                              ? 'Sending...'
                              : 'Send magic link'}
                        </button>
                        <button
                          className="min-h-11 text-[var(--color-text-tertiary)] transition hover:underline"
                          onClick={() => {
                            setEditingEmail(false)
                            setEmailDraft(activeUser?.email ?? '')
                          }}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    hasEmail ? (
                      <>
                        <span className="truncate">{activeUser?.email}</span>
                        <button
                          className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] text-[var(--color-text-tertiary)] transition-colors duration-150 hover:bg-[var(--color-bg-hover)] hover:text-[#00c58e]"
                          onClick={() => setEditingEmail(true)}
                          type="button"
                        >
                          <PencilIcon className="h-3 w-3" />
                        </button>
                        {showEmailSaved ? (
                          <span className="inline-flex h-4 w-4 items-center justify-center text-[#00c58e]">
                            <CheckIcon className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span>Add an email to also receive alerts there.</span>
                        <button
                          className="text-[#00c58e] transition hover:underline"
                          onClick={() => setEditingEmail(true)}
                          type="button"
                        >
                          Add email
                        </button>
                        {emailLinkSent ? (
                          <span className="text-[var(--color-text-tertiary)]">
                            Link sent
                          </span>
                        ) : null}
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="shrink-0 self-start sm:self-auto">
                <ChannelStatusPill>
                  {hasEmail
                    ? isSavingEmail
                      ? 'Saving'
                      : 'Verified'
                    : isSendingEmailLink
                      ? 'Sending'
                      : emailLinkSent
                        ? 'Pending'
                        : 'Optional'}
                </ChannelStatusPill>
              </div>
            </div>

            <div className="border-b border-[var(--color-border-subtle)] py-[14px]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div
                  className={clsx(
                    'flex w-5 justify-center',
                    telegramHandle ? 'text-[#00c58e]' : 'text-[var(--color-text-tertiary)]',
                  )}
                >
                  <TelegramIcon className="h-[14px] w-[14px]" />
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className={clsx(
                      'text-[15px] font-medium',
                      telegramHandle
                        ? 'text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-secondary)]',
                    )}
                  >
                    Telegram
                  </div>
                  <div className="mt-1 text-[13px] font-mono text-[var(--color-text-secondary)]">
                    {telegramHandle ?? 'Connect to get instant alerts.'}
                  </div>
                </div>

                <div className="shrink-0 sm:self-auto">
                  {telegramHandle ? (
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                      <ChannelStatusPill>Connected</ChannelStatusPill>
                      {telegramDisconnectConfirm ? (
                        <div className="flex flex-wrap items-center gap-2 text-[12px]">
                          <span className="text-[var(--color-text-tertiary)]">
                            Disconnect Telegram?
                          </span>
                          <button
                            className="min-h-11 text-[var(--color-text-tertiary)]"
                            onClick={() => setTelegramDisconnectConfirm(false)}
                            type="button"
                          >
                            Cancel
                          </button>
                          <button
                            className="min-h-11 text-[#ef4444]"
                            onClick={() => void handleDisconnectTelegram()}
                            type="button"
                          >
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <button
                          className="min-h-11 text-[12px] text-[var(--color-text-tertiary)] transition-colors duration-150 hover:text-[#ef4444]"
                          onClick={() => setTelegramDisconnectConfirm(true)}
                          type="button"
                        >
                          Disconnect
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      className={clsx(
                        'min-h-11 w-full rounded-[6px] border px-3 py-[9px] text-[13px] font-medium transition-colors duration-150 sm:w-auto',
                        telegramFlowStep === 'hidden'
                          ? 'border-[rgba(0,197,142,0.3)] bg-[rgba(0,197,142,0.06)] text-[#00c58e] hover:border-[#00c58e] hover:bg-[rgba(0,197,142,0.12)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-tertiary)]',
                      )}
                      onClick={() => {
                        if (telegramFlowStep === 'hidden') {
                          setTelegramFlowStep('open-bot')
                        } else {
                          resetTelegramFlow()
                        }
                      }}
                      type="button"
                    >
                      {telegramFlowStep === 'hidden' ? 'Connect' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>

              {renderTelegramConnectPanel ? (
                <div className="mt-3 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[12px]">
                    <div
                      className={clsx(
                        'inline-flex items-center gap-2',
                        telegramFlowStep === 'open-bot'
                          ? 'text-[var(--color-text-primary)]'
                          : 'text-[#00c58e]',
                      )}
                    >
                      <span
                        className={clsx(
                          'h-[6px] w-[6px] rounded-full border',
                          telegramFlowStep === 'open-bot'
                            ? 'border-[#00c58e] bg-[#00c58e]'
                            : 'border-[#00c58e] bg-transparent',
                        )}
                      />
                      <span>Open bot</span>
                    </div>
                    <span className="text-[var(--color-text-tertiary)]">→</span>
                    <div
                      className={clsx(
                        'inline-flex items-center gap-2',
                        telegramFlowStep === 'enter-code'
                          ? 'text-[var(--color-text-primary)]'
                          : 'text-[var(--color-text-tertiary)]',
                      )}
                    >
                      <span
                        className={clsx(
                          'h-[6px] w-[6px] rounded-full border',
                          telegramFlowStep === 'enter-code'
                            ? 'border-[#00c58e] bg-[#00c58e]'
                            : 'border-[var(--color-text-tertiary)] bg-transparent',
                        )}
                      />
                      <span>Enter code</span>
                    </div>
                  </div>

                  {telegramFlowStep === 'open-bot' ? (
                    <>
                      <p className="mt-3 text-[13px] leading-6 text-[var(--color-text-secondary)]">
                        Open our Telegram bot and press Start.
                      </p>
                      <a
                        className="mt-3 flex min-h-11 w-full items-center justify-center rounded-[7px] border border-[var(--color-border)] px-4 py-[10px] text-[13px] font-medium text-[var(--color-text-primary)] transition-colors duration-150 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)]"
                        href="https://t.me/QuorumSignalsBot"
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open @QuorumSignalsBot →
                      </a>
                      <div className="mt-3 text-[12px] font-mono text-[var(--color-text-tertiary)]">
                        The bot will give you a 6-digit code.
                      </div>
                      <button
                        className="mt-4 min-h-11 text-[13px] text-[#00c58e] hover:underline"
                        onClick={() => setTelegramFlowStep('enter-code')}
                        type="button"
                      >
                        I have my code →
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="mt-3 text-[13px] text-[var(--color-text-secondary)]">
                        Enter the 6-digit code from the bot.
                      </p>
                      <div
                        className={clsx(
                          'mt-4 flex gap-2',
                          telegramCodeShake && 'telegram-code-shake',
                        )}
                      >
                        {telegramCodeDigits.map((digit, index) => (
                          <input
                            className={clsx(
                              'h-[52px] w-11 rounded-[8px] border bg-[var(--color-bg-base)] text-center font-mono text-[24px] font-medium text-[var(--color-text-primary)] outline-none transition-[border-color,box-shadow,opacity] duration-150',
                              telegramCodeError
                                ? 'border-[#ef4444]'
                                : 'border-[var(--color-border)] focus:border-[#00c58e] focus:shadow-[0_0_0_3px_rgba(0,197,142,0.1)]',
                              isVerifyingTelegram && 'opacity-50',
                            )}
                            disabled={isVerifyingTelegram}
                            inputMode="numeric"
                            key={index}
                            maxLength={1}
                            onChange={(event) => handleTelegramDigitChange(index, event.target.value)}
                            onKeyDown={(event) => handleTelegramDigitKeyDown(index, event)}
                            onPaste={handleTelegramDigitPaste}
                            ref={(node) => {
                              codeInputRefs.current[index] = node
                            }}
                            value={digit}
                          />
                        ))}
                      </div>
                      {telegramCodeError ? (
                        <div className="mt-3 font-mono text-[12px] text-[#ef4444]">
                          {telegramCodeError}
                        </div>
                      ) : null}
                      {isVerifyingTelegram ? (
                        <div className="mt-3 font-mono text-[12px] text-[var(--color-text-tertiary)]">
                          Verifying…
                        </div>
                      ) : null}
                      <button
                        className="mt-3 min-h-11 text-[12px] text-[var(--color-text-tertiary)] hover:underline"
                        onClick={() => {
                          setTelegramFlowStep('open-bot')
                          setTelegramCodeDigits(Array.from({ length: 6 }, () => ''))
                          setTelegramCodeError(null)
                          setTelegramCodeShake(false)
                        }}
                        type="button"
                      >
                        Use a different code
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>

            {telegramHandle ? (
              <div className="flex flex-col gap-3 border-b border-[var(--color-border-subtle)] py-[14px] sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[14px] text-[var(--color-text-secondary)]">
                  Default channel
                </div>

                {hasEmail ? (
                  <div className="w-full overflow-hidden rounded-[6px] border border-[var(--color-border)] sm:w-auto">
                    <div className="flex items-stretch">
                      <DeliveryChannelButton
                        isActive={defaultChannel === 'email'}
                        isFirst
                        label="Email"
                        onClick={() => void handlePreferenceChange('email')}
                      />
                      <DeliveryChannelButton
                        isActive={defaultChannel === 'telegram'}
                        label="Telegram"
                        onClick={() => void handlePreferenceChange('telegram')}
                      />
                      <DeliveryChannelButton
                        isActive={defaultChannel === 'both'}
                        isLast
                        label="Both"
                        onClick={() => void handlePreferenceChange('both')}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <ChannelStatusPill>Telegram</ChannelStatusPill>
                    <span className="text-[12px] font-mono text-[var(--color-text-tertiary)]">
                      Add email to enable Both.
                    </span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-8">
          <div className="font-mono text-[12px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
            Watching
          </div>

          {isAuthenticated && subscriptionsQuery.isPending ? (
            <div className="mt-3 border-t border-[var(--color-border-subtle)]">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  className="h-[66px] border-b border-[var(--color-border-subtle)]"
                  key={index}
                />
              ))}
            </div>
          ) : visibleSubscriptions.length > 0 ? (
            <div className="mt-3 border-t border-[var(--color-border-subtle)]">
              {visibleSubscriptions.map((subscription) => {
                const deliveryLine = getDeliveryLine(subscription)
                const isDeleteConfirming = deleteConfirmId === subscription.id
                const isMenuOpen = openMenuId === subscription.id
                const isCollapsing = collapsingIds.includes(subscription.id)

                return (
                  <div
                    className={clsx(
                      'border-b border-[var(--color-border-subtle)] transition-all duration-200',
                      isCollapsing ? 'max-h-0 overflow-hidden py-0 opacity-0' : 'py-[14px] opacity-100',
                    )}
                    key={subscription.id}
                  >
                    {isDeleteConfirming ? (
                      <div className="flex flex-col gap-3 text-[13px] sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-[var(--color-text-secondary)]">
                          Delete this alert?
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            className="min-h-11 text-[var(--color-text-tertiary)]"
                            onClick={clearDeleteConfirmation}
                            type="button"
                          >
                            Cancel
                          </button>
                          <button
                            className="min-h-11 text-[#ef4444]"
                            onClick={() => void handleDeleteSubscription(subscription.id)}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <Link
                            className="inline-flex text-[16px] font-semibold text-[var(--color-text-primary)] transition-colors duration-150 hover:text-[var(--color-brand)]"
                            {...getSmartMoneyWalletRoute(subscription.walletAddress)}
                          >
                            {getWalletTitle(subscription)}
                          </Link>
                          <div className="mt-1 text-[13px] font-mono text-[var(--color-text-tertiary)]">
                            {getFilterSummary(subscription)}
                          </div>
                          <div className="mt-2 flex items-start gap-2 text-[13px] font-mono text-[var(--color-text-tertiary)]">
                            <DeliveryStatusDot tone={deliveryLine.tone} />
                            <span>{deliveryLine.label}</span>
                          </div>
                        </div>

                        <div className="relative flex shrink-0 items-center gap-3 self-start">
                          <span
                            className={clsx(
                              'font-mono text-[13px] font-medium',
                              subscription.status === 'active'
                                ? 'text-[#00c58e]'
                                : 'text-[var(--color-text-tertiary)]',
                            )}
                          >
                            {subscription.status === 'active' ? 'Active' : 'Paused'}
                          </span>

                          <button
                            className="flex h-11 w-11 items-center justify-center rounded-[8px] text-[var(--color-text-tertiary)] transition-colors duration-150 hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                            onClick={() =>
                              setOpenMenuId((current) =>
                                current === subscription.id ? null : subscription.id,
                              )
                            }
                            type="button"
                          >
                            <DotsIcon />
                          </button>

                          {isMenuOpen ? (
                            <div className="absolute top-[32px] right-0 z-10 min-w-[148px] rounded-[6px] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-1 shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
                              <button
                                className="block min-h-11 w-full rounded-[5px] px-[14px] py-[8px] text-left text-[13px] hover:bg-[var(--color-bg-hover)]"
                                onClick={() => {
                                  setActiveDrawerId(subscription.id)
                                  setOpenMenuId(null)
                                }}
                                type="button"
                              >
                                Edit
                              </button>
                              <button
                                className="block min-h-11 w-full rounded-[5px] px-[14px] py-[8px] text-left text-[13px] hover:bg-[var(--color-bg-hover)]"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  void handleToggleSubscriptionStatus(subscription.id)
                                }}
                                type="button"
                              >
                                {subscription.status === 'paused' ? 'Resume' : 'Pause'}
                              </button>
                              <div className="my-1 h-px bg-[var(--color-border)]" />
                              <button
                                className="block min-h-11 w-full rounded-[5px] px-[14px] py-[8px] text-left text-[13px] text-[#ef4444] hover:bg-[var(--color-bg-hover)]"
                                onClick={() => beginDeleteConfirmation(subscription.id)}
                                type="button"
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="border-t border-[var(--color-border-subtle)] py-8">
              <div className="text-[15px] font-medium text-[var(--color-text-secondary)]">
                Nothing here yet.
              </div>
              <p className="mt-[6px] text-[13px] text-[var(--color-text-tertiary)]">
                Add alerts from the Smart Money feed or any wallet page.
              </p>
              <Link
                className="mt-[14px] inline-flex text-[13px] text-[#00c58e]"
                {...getSmartMoneyRoute()}
              >
                Go to Smart Money →
              </Link>
            </div>
          )}
        </section>

        {deliveries.length > 0 ? (
          <section className="mt-8">
            <div className="font-mono text-[12px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
              Recent deliveries
            </div>
            <div className="mt-3 border-t border-[var(--color-border-subtle)]">
              {visibleDeliveries.map((delivery) => (
                <div
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 border-b border-[var(--color-border-subtle)] py-[10px] text-[12px] sm:flex sm:flex-row sm:items-center"
                  key={delivery.id}
                >
                  <Link
                    className="truncate font-mono text-[13px] text-[var(--color-text-secondary)] transition-colors duration-150 hover:text-[var(--color-brand)] sm:w-[110px]"
                    {...getSmartMoneyWalletRoute(delivery.walletAddress)}
                  >
                    {getWalletTitle(delivery)}
                  </Link>
                  <div className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-text-primary)]">
                    {delivery.marketTitle.length > 45
                      ? `${delivery.marketTitle.slice(0, 45)}…`
                      : delivery.marketTitle}
                  </div>
                  <div className="hidden w-[80px] shrink-0 text-left font-mono text-[12px] text-[var(--color-text-tertiary)] sm:block sm:text-right">
                    {formatTimeAgo(delivery.occurredAt)}
                  </div>
                  <div
                    className={clsx(
                      'col-span-2 flex items-center gap-1 font-mono text-[12px] font-medium sm:col-span-1 sm:w-[80px] sm:shrink-0 sm:justify-end',
                      delivery.status === 'delivered' && 'text-[#00c58e]',
                      delivery.status === 'failed' && 'text-[#ef4444]',
                      delivery.status === 'pending' && 'text-[var(--color-text-tertiary)]',
                    )}
                  >
                    {delivery.channel === 'telegram' ? (
                      <TelegramIcon className="h-[10px] w-[10px]" />
                    ) : (
                      <EnvelopeIcon className="h-[10px] w-[10px]" />
                    )}
                    <span>
                      {delivery.status === 'delivered'
                        ? 'Delivered'
                        : delivery.status === 'failed'
                          ? 'Failed'
                          : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {deliveries.length > 5 ? (
              <button
                className="mt-3 min-h-11 text-[13px] text-[var(--color-text-tertiary)] transition-colors duration-150 hover:text-[var(--color-text-secondary)]"
                onClick={() => setShowAllDeliveries((current) => !current)}
                type="button"
              >
                {showAllDeliveries ? 'Show less' : 'View all deliveries'}
              </button>
            ) : null}
          </section>
        ) : null}

        <button
          className="mt-10 min-h-11 self-start text-[12px] text-[var(--color-text-tertiary)] transition-colors duration-150 hover:text-[var(--color-text-secondary)]"
          onClick={() => void signOut()}
          type="button"
        >
          Sign out
        </button>
      </div>

      {activeDrawerSubscription ? (
        <AlertSubscriptionDrawer
          isBusy={updateAlertMutation.isPending || deleteAlertMutation.isPending}
          onClose={() => setActiveDrawerId(null)}
          onDelete={(subscriptionId) => {
            setActiveDrawerId(null)
            void handleDeleteSubscription(subscriptionId)
          }}
          onSave={(nextSubscription) => void handleSaveSubscription(nextSubscription)}
          onToggleStatus={(subscriptionId) => void handleToggleSubscriptionStatus(subscriptionId)}
          subscription={activeDrawerSubscription}
        />
      ) : null}
    </>
  )
}
