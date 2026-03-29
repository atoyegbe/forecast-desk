import { Link } from '@tanstack/react-router'
import {
  useEffect,
  useState,
} from 'react'
import { useAuth } from '../features/auth/context'
import {
  useAlertSubscriptionsQuery,
  useCreateAlertSubscriptionMutation,
} from '../features/alerts/hooks'
import { BackendRequestError } from '../lib/api-client'
import { getAlertsRoute } from '../lib/routes'

type WalletAlertButtonProps = {
  buttonClassName?: string
  walletAddress: string
  walletLabel?: string | null
}

function getErrorMessage(error: unknown) {
  if (error instanceof BackendRequestError || error instanceof Error) {
    return error.message
  }

  return 'Could not save this alert.'
}

export function WalletAlertButton({
  buttonClassName = 'terminal-button',
  walletAddress,
  walletLabel,
}: WalletAlertButtonProps) {
  const normalizedWalletAddress = walletAddress.trim().toLowerCase()
  const {
    isAuthenticated,
    isHydrating,
    openAuthDialog,
  } = useAuth()
  const alertsQuery = useAlertSubscriptionsQuery()
  const createAlertMutation = useCreateAlertSubscriptionMutation()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [minScore, setMinScore] = useState('70')
  const [minSizeUsd, setMinSizeUsd] = useState('1000')
  const [error, setError] = useState<string | null>(null)
  const existingSubscription = alertsQuery.data?.find(
    (subscription) =>
      subscription.type === 'wallet' &&
      subscription.walletAddress === normalizedWalletAddress,
  )

  useEffect(() => {
    if (createAlertMutation.isSuccess) {
      setError(null)
      setIsDialogOpen(false)
    }
  }, [createAlertMutation.isSuccess])

  const triggerLabel = existingSubscription
    ? 'Manage alert'
    : isAuthenticated
      ? 'Set wallet alert'
      : 'Sign in for alerts'

  return (
    <>
      {existingSubscription ? (
        <Link className={buttonClassName} {...getAlertsRoute()}>
          {triggerLabel}
        </Link>
      ) : (
        <button
          className={buttonClassName}
          disabled={isHydrating || createAlertMutation.isPending}
          onClick={() => {
            if (!isAuthenticated) {
              openAuthDialog()
              return
            }

            createAlertMutation.reset()
            setError(null)
            setIsDialogOpen(true)
          }}
          type="button"
        >
          {createAlertMutation.isPending ? 'Saving...' : triggerLabel}
        </button>
      )}

      {isDialogOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(13,15,16,0.72)] px-4 py-6 backdrop-blur-sm"
          role="dialog"
        >
          <div className="panel w-full max-w-md p-5 sm:p-6">
            <div className="space-y-2">
              <div className="eyebrow">Wallet alert</div>
              <h2 className="section-title">
                Track {walletLabel || normalizedWalletAddress}
              </h2>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                We will email you when this wallet produces a new smart-money
                signal that matches your thresholds.
              </p>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                setError(null)

                void createAlertMutation
                  .mutateAsync({
                    minScore: Number.parseInt(minScore, 10),
                    minSizeUsd: Number.parseFloat(minSizeUsd),
                    type: 'wallet',
                    walletAddress: normalizedWalletAddress,
                  })
                  .catch((mutationError) => {
                    setError(getErrorMessage(mutationError))
                  })
              }}
            >
              <label className="block space-y-2">
                <span className="section-kicker">Minimum wallet score</span>
                <input
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--surface-control-bg)] px-3 py-3 text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand)]"
                  inputMode="numeric"
                  onChange={(event) => setMinScore(event.target.value.replace(/\D+/g, ''))}
                  placeholder="70"
                  value={minScore}
                />
              </label>

              <label className="block space-y-2">
                <span className="section-kicker">Minimum signal size (USD)</span>
                <input
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--surface-control-bg)] px-3 py-3 text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand)]"
                  inputMode="decimal"
                  onChange={(event) => setMinSizeUsd(event.target.value.replace(/[^0-9.]+/g, ''))}
                  placeholder="1000"
                  value={minSizeUsd}
                />
              </label>

              {error ? (
                <div className="rounded-lg border border-[var(--color-down-border)] bg-[var(--color-down-dim)] px-3 py-3 text-sm text-[var(--color-down)]">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  className="terminal-button terminal-button-primary"
                  disabled={createAlertMutation.isPending}
                  type="submit"
                >
                  {createAlertMutation.isPending ? 'Saving...' : 'Save alert'}
                </button>
                <button
                  className="terminal-button"
                  onClick={() => {
                    createAlertMutation.reset()
                    setIsDialogOpen(false)
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
