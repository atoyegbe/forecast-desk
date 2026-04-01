import {
  useEffect,
  useMemo,
  useState,
} from 'react'
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

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span>Sending</span>
      {[0, 160, 320].map((delay) => (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current animate-[pulse_1s_ease-in-out_infinite]"
          key={delay}
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
}

export function AuthDialog() {
  const {
    authDialog,
    closeAuthDialog,
    requestMagicLink,
    resendMagicLink,
    resetAuthDialogToEmailEntry,
  } = useAuth()
  const [email, setEmail] = useState(authDialog.email)
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const emailError = useMemo(() => {
    if (!hasAttemptedSubmit) {
      return null
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email.trim())
      ? null
      : 'Enter a valid email address.'
  }, [email, hasAttemptedSubmit])

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
      {authDialog.step === 'email' ? (
        <>
          <img
            alt=""
            aria-hidden="true"
            className="mx-auto mb-5 h-8 w-8 sm:h-8 sm:w-8"
            height="32"
            src="/logo-symbol-consensus-q-transparent.svg"
            width="32"
          />

          <h2 className="text-center text-[20px] font-semibold text-[var(--color-text-primary)] sm:text-[20px]">
            Get alerts when whales move.
          </h2>
          <p className="mt-2 mb-6 text-center text-[13px] leading-5 text-[var(--color-text-secondary)]">
            Enter your email to continue. No password needed.
          </p>

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
            <input
              autoComplete="email"
              className="h-12 w-full rounded-[7px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-[14px] py-[11px] text-[16px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#00c58e] focus:shadow-[0_0_0_3px_rgba(0,197,142,0.1)]"
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
              className="mt-[10px] inline-flex min-h-12 w-full items-center justify-center rounded-[7px] bg-[#00c58e] px-4 py-[11px] text-[14px] font-semibold text-[#0d0f10] transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
              disabled={authDialog.isSubmitting}
              type="submit"
            >
              {authDialog.isSubmitting ? <LoadingDots /> : 'Send magic link'}
            </button>
          </form>

          <p className="mt-4 text-center font-mono text-[11px] leading-5 text-[var(--color-text-tertiary)]">
            By continuing you agree this is a read-only market intelligence tool.
          </p>
        </>
      ) : (
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
                setEmail('')
                setHasAttemptedSubmit(false)
                resetAuthDialogToEmailEntry()
              }}
              type="button"
            >
              Use a different email
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
