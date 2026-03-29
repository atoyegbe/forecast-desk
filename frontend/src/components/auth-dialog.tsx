import {
  useEffect,
  useState,
} from 'react'
import { useAuth } from '../features/auth/context'

export function AuthDialog() {
  const {
    authDialog,
    closeAuthDialog,
    requestCode,
    verifyCode,
  } = useAuth()
  const [email, setEmail] = useState(authDialog.email)
  const [code, setCode] = useState('')

  useEffect(() => {
    if (!authDialog.isOpen) {
      setCode('')
      return
    }

    setEmail(authDialog.email)
  }, [authDialog.email, authDialog.isOpen])

  if (!authDialog.isOpen) {
    return null
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(13,15,16,0.72)] px-4 py-6 backdrop-blur-sm"
      role="dialog"
    >
      <div className="panel w-full max-w-md p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="eyebrow">
              {authDialog.step === 'request' ? 'Email sign in' : 'Verify code'}
            </div>
            <h2 className="section-title">
              {authDialog.step === 'request'
                ? 'Sign in to manage wallet alerts'
                : 'Enter your login code'}
            </h2>
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
              {authDialog.step === 'request'
                ? 'We will send a one-time code through email. No password needed.'
                : `A 6-digit code was sent to ${authDialog.email}.`}
            </p>
          </div>

          <button
            aria-label="Close sign in dialog"
            className="shell-icon-button"
            onClick={closeAuthDialog}
            type="button"
          >
            ×
          </button>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()

            if (authDialog.step === 'request') {
              void requestCode(email)
              return
            }

            void verifyCode(code)
          }}
        >
          {authDialog.step === 'request' ? (
            <label className="block space-y-2">
              <span className="section-kicker">Email</span>
              <input
                autoComplete="email"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--surface-control-bg)] px-3 py-3 text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand)]"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="reader@example.com"
                type="email"
                value={email}
              />
            </label>
          ) : (
            <label className="block space-y-2">
              <span className="section-kicker">6-digit code</span>
              <input
                autoComplete="one-time-code"
                className="mono-data w-full rounded-lg border border-[var(--color-border)] bg-[var(--surface-control-bg)] px-3 py-3 text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand)]"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setCode(event.target.value.replace(/\D+/g, ''))}
                placeholder="123456"
                value={code}
              />
            </label>
          )}

          {authDialog.error ? (
            <div className="rounded-lg border border-[var(--color-down-border)] bg-[var(--color-down-dim)] px-3 py-3 text-sm text-[var(--color-down)]">
              {authDialog.error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              className="terminal-button terminal-button-primary min-w-[150px]"
              disabled={authDialog.isSubmitting}
              type="submit"
            >
              {authDialog.isSubmitting
                ? authDialog.step === 'request'
                  ? 'Sending...'
                  : 'Verifying...'
                : authDialog.step === 'request'
                  ? 'Send code'
                  : 'Verify and sign in'}
            </button>

            {authDialog.step === 'verify' ? (
              <button
                className="terminal-button"
                onClick={() => void requestCode(authDialog.email)}
                type="button"
              >
                Resend code
              </button>
            ) : null}

            {authDialog.step === 'verify' ? (
              <button
                className="terminal-button"
                onClick={() => setCode('')}
                type="button"
              >
                Clear
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}
