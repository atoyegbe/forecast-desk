import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useEventsQuery } from '../features/events/hooks'
import { useSmartMoneySignalsQuery } from '../features/smart-money/hooks'
import { formatCompactNumber } from '../lib/format'

function StatCell({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="bg-[var(--color-bg-surface)] px-[14px] py-4 text-left">
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
        {label}
      </div>
      <div className="text-[13px] text-[var(--color-text-primary)]">
        {value}
      </div>
    </div>
  )
}

export function LandingPage() {
  const navigate = useNavigate()
  const eventsQuery = useEventsQuery({ status: 'open' })
  const smartMoneySignalsQuery = useSmartMoneySignalsQuery({
    limit: 250,
    sort: 'newest',
  })

  const liveMarketCount = useMemo(() => {
    if (!eventsQuery.data) {
      return '—'
    }

    const openMarketCount = eventsQuery.data.reduce((count, event) => {
      return (
        count +
        event.markets.filter((market) => market.status.toLowerCase() === 'open').length
      )
    }, 0)

    return formatCompactNumber(openMarketCount)
  }, [eventsQuery.data])

  const signalCountToday = useMemo(() => {
    if (!smartMoneySignalsQuery.data) {
      return '—'
    }

    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    const todayCount = smartMoneySignalsQuery.data.filter((signal) => {
      return new Date(signal.signalAt).getTime() >= cutoff
    }).length

    return `${formatCompactNumber(todayCount)} signals today`
  }, [smartMoneySignalsQuery.data])

  return (
    <section className="w-full max-w-[600px] text-center">
      <img
        alt=""
        aria-hidden="true"
        className="mx-auto mb-8 h-12 w-12"
        height="48"
        src="/logo-symbol-consensus-q-transparent.svg"
        width="48"
      />

      <div className="mb-5 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
        Prediction market intelligence
      </div>

      <h1 className="mx-auto text-[36px] font-semibold leading-[1.15] tracking-[-0.01em] text-[var(--color-text-primary)]">
        What the crowd thinks, across{' '}
        <span className="text-[#00c58e]">every market</span>.
      </h1>

      <p className="mx-auto mt-5 mb-9 max-w-[480px] text-[15px] leading-[1.6] text-[var(--color-text-secondary)]">
        Quorum aggregates Polymarket, Kalshi, Manifold, and Bayse into one
        feed. See where platforms agree, where they diverge, and what the
        highest-conviction wallets are doing right now.
      </p>

      <button
        className="inline-flex items-center justify-center rounded-[7px] bg-[#00c58e] px-6 py-[11px] text-[14px] font-semibold text-[#0d0f10] transition-opacity duration-150 hover:opacity-[0.88]"
        onClick={() => {
          void navigate({ to: '/markets' })
        }}
        type="button"
      >
        Open the board →
      </button>

      <div className="mt-12 grid w-full gap-px overflow-hidden rounded-[8px] bg-[#1f2528] text-left sm:grid-cols-2 lg:grid-cols-4">
        <StatCell label="Platforms" value="PM · KL · MF · BY" />
        <StatCell label="Markets live" value={liveMarketCount} />
        <StatCell label="Smart money" value={signalCountToday} />
        <StatCell label="Read only" value="No account needed" />
      </div>
    </section>
  )
}
