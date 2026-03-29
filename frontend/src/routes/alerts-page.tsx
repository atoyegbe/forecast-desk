import { Link } from '@tanstack/react-router'
import {
  RefreshBadge,
  SectionHeader,
} from '../components/section-header'
import { useAlertSubscriptionsQuery, useDeleteAlertSubscriptionMutation } from '../features/alerts/hooks'
import { useAuth } from '../features/auth/context'
import { formatDate } from '../lib/format'
import { getSmartMoneyWalletRoute } from '../lib/routes'

export function AlertsPage() {
  const {
    isAuthenticated,
    isHydrating,
    openAuthDialog,
    user,
  } = useAuth()
  const alertsQuery = useAlertSubscriptionsQuery()
  const deleteAlertMutation = useDeleteAlertSubscriptionMutation()

  if (isHydrating) {
    return (
      <section className="panel p-6">
        <div className="section-title">Loading alerts…</div>
      </section>
    )
  }

  if (!isAuthenticated) {
    return (
      <section className="panel p-6 sm:p-7">
        <div className="space-y-3">
          <div className="eyebrow">Alerts</div>
          <h1 className="section-title">Sign in to manage wallet alerts</h1>
          <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
            Quorum only needs email auth for alert subscriptions. Markets, divergence,
            and smart-money reading stay public.
          </p>
          <button
            className="terminal-button terminal-button-primary"
            onClick={() => openAuthDialog()}
            type="button"
          >
            Sign in with email
          </button>
        </div>
      </section>
    )
  }

  if (alertsQuery.isLoading) {
    return (
      <section className="panel p-6">
        <div className="section-title">Loading alert subscriptions…</div>
      </section>
    )
  }

  if (alertsQuery.error) {
    return (
      <section className="panel p-6 text-[var(--color-down)]">
        {(alertsQuery.error as Error).message}
      </section>
    )
  }

  const subscriptions = alertsQuery.data ?? []
  const isRefreshing = alertsQuery.isFetching && !alertsQuery.isLoading

  return (
    <div className="space-y-6">
      <section className="panel p-5 sm:p-6">
        <SectionHeader
          description={`Email alerts for ${user?.email ?? 'your account'}. Wallet subscriptions fire when a new smart-money signal matches your score and size filters.`}
          kicker="Alerts"
          status={isRefreshing ? <RefreshBadge /> : null}
          title="Alert subscriptions"
        />

        {subscriptions.length ? (
          <div className="mt-5 space-y-3">
            {subscriptions.map((subscription) => (
              <article
                className="panel-elevated flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                key={subscription.id}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="eyebrow">Wallet</span>
                    <span className="terminal-chip text-[11px] uppercase tracking-[0.18em]">
                      {subscription.channel}
                    </span>
                  </div>
                  <Link
                    className="mono-data text-sm text-[var(--color-text-primary)] transition hover:text-[var(--color-brand)]"
                    {...getSmartMoneyWalletRoute(subscription.walletAddress)}
                  >
                    {subscription.walletAddress}
                  </Link>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Min score: {subscription.minScore ?? 'none'} · Min size:{' '}
                    {subscription.minSizeUsd ?? 'none'} USD · Created{' '}
                    {formatDate(subscription.createdAt)}
                  </p>
                </div>

                <button
                  className="terminal-button"
                  disabled={deleteAlertMutation.isPending}
                  onClick={() => {
                    void deleteAlertMutation.mutateAsync(subscription.id)
                  }}
                  type="button"
                >
                  {deleteAlertMutation.isPending ? 'Removing...' : 'Delete'}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-4 py-5 text-sm leading-7 text-[var(--color-text-secondary)]">
            No wallet alerts yet. Open a wallet profile or signal card and save your
            first alert.
          </div>
        )}
      </section>
    </div>
  )
}
