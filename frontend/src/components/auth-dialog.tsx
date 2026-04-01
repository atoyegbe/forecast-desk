import { useEffect, useState } from 'react'
import { useAuth } from '../features/auth/context'
import { Modal } from './modal'

function CheckIcon() {
  return (
    <div className="mx-auto mb-5 flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(0,197,142,0.3)] bg-[rgba(0,197,142,0.12)]">
      <svg
        aria-hidden="true"
        fill="none"
        height="16"
        viewBox="0 0 16 16"
        width="16"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3.5 8.25L6.5 11.25L12.5 5.25"
          stroke="#00c58e"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  )
}

function TelegramIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="#0d0f10"
      height="16"
      viewBox="0 0 24 24"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19.96 4.04C19.29 3.41 18.35 3.2 17.49 3.48L5.36 7.49C3.79 8 3.75 10.2 5.29 10.77L7.88 11.73L9.02 16.19C9.38 17.57 11.12 17.98 12.04 16.93L13.85 14.84L17.56 17.47C18.75 18.31 20.42 17.64 20.66 16.19L22.02 7.96C22.2 6.94 21.84 5.87 20.99 5.21L19.96 4.04ZM18.67 7.02L11.52 13.41C11.34 13.57 11.22 13.79 11.18 14.03L10.75 16.58L9.98 12.98C9.91 12.65 9.68 12.37 9.36 12.25L6.74 11.28L18.12 7.52C18.55 7.38 18.86 6.98 18.92 6.54L18.67 7.02Z" />
    </svg>
  )
}

function WaitingTelegramState({
  onRetry,
}: {
  onRetry: () => void
}) {
  return (
    <div className="mb-4 rounded-[8px] border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.08)] px-4 py-4">
      <div className="flex items-center justify-center gap-2 font-mono text-[13px] text-[var(--color-text-primary)]">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-full bg-amber-400"
          style={{ animation: 'pulse 1.4s ease-in-out infinite' }}
        />
        <span>Waiting for Telegram approval...</span>
      </div>
      <p className="mt-3 text-center text-[12px] leading-5 text-[var(--color-text-tertiary)]">
        Opened Telegram. Approve the request to continue.
      </p>
      <button
        className="mt-2 block w-full text-center text-[12px] text-[#00c58e] transition hover:underline"
        onClick={onRetry}
        type="button"
      >
        Didn&apos;t open?
      </button>
    </div>
  )
}

export function AuthDialog() {
  const {
    authDialog,
    closeAuthDialog,
    requestMagicLink,
    resendMagicLink,
    reopenTelegramAuth,
    resetAuthDialogToEmailEntry,
    startTelegramAuth,
  } = useAuth()
  const [email, setEmail] = useState(authDialog.email)
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const emailError = hasAttemptedSubmit &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email.trim())
    ? 'Enter a valid email address.'
    : null

  useEffect(() => {
    if (!authDialog.isOpen) {
      setHasAttemptedSubmit(false)
      return
    }

    setEmail(authDialog.email)
  }, [authDialog.email, authDialog.isOpen])

  useEffect(() => {
    if (!authDialog.resendCooldownEndsAt) {
      setSecondsRemaining(0)
      return
    }

    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((authDialog.resendCooldownEndsAt! - Date.now()) / 1_000),
      )

      setSecondsRemaining(remaining)
    }

    update()
    const interval = window.setInterval(update, 250)

    return () => {
      window.clearInterval(interval)
    }
  }, [authDialog.resendCooldownEndsAt])

  if (!authDialog.isOpen) {
    return null
  }

  return (
    <Modal
      className="min-h-[60vh] sm:min-h-0"
      isOpen={authDialog.isOpen}
      onClose={closeAuthDialog}
    >
      {authDialog.step === 'check-email' ? (
        <>
          <CheckIcon />

          <h2 className="text-center text-[20px] font-semibold text-[var(--color-text-primary)]">
            Check your inbox.
          </h2>
          <p className="mt-3 mb-6 text-center text-[13px] leading-5 text-[var(--color-text-secondary)]">
            We sent a link to {authDialog.email}. Click it to sign in, it expires
            in 15 minutes.
          </p>

          {authDialog.error ? (
            <div className="mb-4 text-center text-[13px] text-[var(--color-down)]">
              {authDialog.error}
            </div>
          ) : null}

          <div className="flex items-center justify-center gap-5 text-[13px]">
            <button
              className="text-[#00c58e] transition hover:underline disabled:cursor-not-allowed disabled:text-[var(--color-text-tertiary)] disabled:no-underline"
              disabled={authDialog.isSubmitting || secondsRemaining > 0}
              onClick={() => {
                void resendMagicLink()
              }}
              type="button"
            >
              {authDialog.resentState === 'resent'
                ? 'Resent'
                : secondsRemaining > 0
                  ? `Resend in ${secondsRemaining}s`
                  : 'Resend link'}
            </button>
            <button
              className="text-[#00c58e] transition hover:underline"
              onClick={() => {
                setHasAttemptedSubmit(false)
                resetAuthDialogToEmailEntry()
              }}
              type="button"
            >
              Use a different email
            </button>
          </div>
        </>
      ) : (
        <>
          <img
            alt=""
            aria-hidden="true"
            className="mx-auto mb-5 h-8 w-8"
            height="32"
            src="/logo-symbol-consensus-q-transparent.svg"
            width="32"
          />

          <h2 className="text-center text-[20px] font-semibold text-[var(--color-text-primary)]">
            Get alerts when whales move.
          </h2>
          <p className="mt-2 mb-6 text-center text-[13px] leading-5 text-[var(--color-text-secondary)]">
            Sign in to track wallets and receive alerts when they make moves.
          </p>

          {authDialog.step === 'telegram-waiting' ? (
            <WaitingTelegramState onRetry={reopenTelegramAuth} />
          ) : (
            <button
              className="mb-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[7px] bg-[#00c58e] px-4 text-[14px] font-semibold text-[#0d0f10] transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
              disabled={authDialog.isSubmitting}
              onClick={() => {
                void startTelegramAuth()
              }}
              type="button"
            >
              {authDialog.isSubmitting ? (
                <>
                  <LoadingSpinner />
                  <span>Opening Telegram...</span>
                </>
              ) : (
                <>
                  <TelegramIcon />
                  <span>Continue with Telegram</span>
                </>
              )}
            </button>
          )}

          <div className="mb-4 flex items-center">
            <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
            <span className="px-3 text-[12px] text-[var(--color-text-tertiary)]">or</span>
            <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              setHasAttemptedSubmit(true)

              if (emailError) {
                return
              }

              void requestMagicLink(email)
            }}
          >
            <label
              className="mb-[6px] block text-left font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]"
              htmlFor="auth-dialog-email"
            >
              Email
            </label>
            <input
              autoComplete="email"
              className="h-11 w-full rounded-[7px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-[14px] text-[16px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#00c58e] focus:shadow-[0_0_0_3px_rgba(0,197,142,0.1)]"
              id="auth-dialog-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />

            {emailError || authDialog.error ? (
              <div className="mt-3 text-[13px] text-[var(--color-down)]">
                {emailError ?? authDialog.error}
              </div>
            ) : null}

            <button
              className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-[7px] border border-[var(--color-border)] bg-transparent px-4 text-[14px] font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={authDialog.isSubmitting}
              type="submit"
            >
              Send magic link
            </button>
          </form>

          <p className="mt-5 text-center font-mono text-[11px] leading-5 text-[var(--color-text-tertiary)]">
            Quorum reads public markets. No trading or funds involved.
          </p>
        </>
      )}
    </Modal>
  )
}
