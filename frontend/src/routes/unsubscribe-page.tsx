import { Link, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { unsubscribeAlertByToken } from '../features/alerts/api'
import { BackendRequestError } from '../lib/api-client'
import { getAlertsRoute, getSmartMoneyRoute } from '../lib/routes'

type UnsubscribeState = 'idle' | 'loading' | 'success' | 'invalid' | 'error'

function MessageBlock({
  eyebrow,
  title,
  body,
  actions,
}: {
  actions?: ReactNode
  body: string
  eyebrow: string
  title: string
}) {
  return (
    <section className="panel mx-auto max-w-[640px] px-4 py-8 text-center md:px-6">
      <div className="section-kicker">{eyebrow}</div>
      <h1 className="mt-4 text-[28px] font-semibold text-[var(--color-text-primary)]">
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-[var(--color-text-secondary)]">
        {body}
      </p>
      {actions ? <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">{actions}</div> : null}
    </section>
  )
}

export function UnsubscribePage() {
  const search = useSearch({ strict: false })
  const token = typeof search.token === 'string' ? search.token.trim() : ''
  const attemptedTokenRef = useRef<string | null>(null)
  const [state, setState] = useState<UnsubscribeState>(() =>
    token ? 'loading' : 'invalid',
  )

  useEffect(() => {
    if (!token) {
      setState('invalid')
      return
    }

    if (attemptedTokenRef.current === token) {
      return
    }

    attemptedTokenRef.current = token
    setState('loading')

    let isCancelled = false

    void unsubscribeAlertByToken(token)
      .then(() => {
        if (!isCancelled) {
          setState('success')
        }
      })
      .catch((error) => {
        if (isCancelled) {
          return
        }

        if (
          error instanceof BackendRequestError &&
          error.code === 'INVALID_UNSUBSCRIBE_TOKEN'
        ) {
          setState('invalid')
          return
        }

        setState('error')
      })

    return () => {
      isCancelled = true
    }
  }, [token])

  if (state === 'loading' || state === 'idle') {
    return (
      <MessageBlock
        body="We’re updating your wallet alert preferences now."
        eyebrow="Alerts"
        title="Processing unsubscribe link"
      />
    )
  }

  if (state === 'success') {
    return (
      <MessageBlock
        actions={
          <>
            <Link
              className="terminal-button terminal-button-primary w-full text-sm font-medium sm:w-auto"
              {...getAlertsRoute()}
            >
              Manage alerts
            </Link>
            <Link
              className="terminal-button w-full text-sm font-medium sm:w-auto"
              {...getSmartMoneyRoute()}
            >
              Back to smart money
            </Link>
          </>
        }
        body="This alert has been paused, so you won’t receive more emails for it unless you turn it back on."
        eyebrow="Alerts"
        title="Alert unsubscribed"
      />
    )
  }

  if (state === 'invalid') {
    return (
      <MessageBlock
        actions={
          <Link
            className="terminal-button w-full text-sm font-medium sm:w-auto"
            {...getSmartMoneyRoute()}
          >
            Browse smart money
          </Link>
        }
        body="This unsubscribe link is missing, expired, or already invalid. You can still manage active alerts from inside Quorum."
        eyebrow="Alerts"
        title="Link not valid"
      />
    )
  }

  return (
    <MessageBlock
      actions={
        <Link
          className="terminal-button w-full text-sm font-medium sm:w-auto"
          {...getAlertsRoute()}
        >
          Open alerts
        </Link>
      }
      body="We couldn’t update this alert right now. Please try the link again in a moment or manage it directly from the alerts page."
      eyebrow="Alerts"
      title="Something went wrong"
    />
  )
}
