import { formatProbability } from '../lib/format'

type OutcomeStripProps = {
  dense?: boolean
  yesPrice: number
  noPrice: number
}

function clampProbability(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(Math.max(value, 0), 1)
}

export function OutcomeStrip({
  dense = false,
  yesPrice,
  noPrice,
}: OutcomeStripProps) {
  const safeYesPrice = clampProbability(yesPrice)
  const safeNoPrice = clampProbability(noPrice)
  const yesLeads = safeYesPrice >= safeNoPrice
  const yesSurface = yesLeads
    ? 'border-[rgba(34,197,94,0.22)] bg-[var(--color-up-dim)] text-[var(--color-up)]'
    : 'border-[rgba(239,68,68,0.22)] bg-[var(--color-down-dim)] text-[var(--color-down)]'
  const noSurface = yesLeads
    ? 'border-[rgba(239,68,68,0.22)] bg-[var(--color-down-dim)] text-[var(--color-down)]'
    : 'border-[rgba(34,197,94,0.22)] bg-[var(--color-up-dim)] text-[var(--color-up)]'

  return (
    <div className={dense ? 'space-y-2.5' : 'space-y-3.5'}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div
          className={`rounded-lg border text-left ${
            yesSurface
          } ${
            dense ? 'px-3 py-3' : 'px-4 py-4'
          }`}
        >
          <div className="stat-label text-current/70">
            Yes
          </div>
          <div
            className={`mono-data mt-1 font-medium ${
              dense ? 'text-[1.55rem] leading-none' : 'text-[2rem] leading-none'
            }`}
          >
            {formatProbability(safeYesPrice)}
          </div>
        </div>
        <div
          className={`rounded-lg border text-right ${
            noSurface
          } ${
            dense ? 'px-3 py-3' : 'px-4 py-4'
          }`}
        >
          <div className="stat-label text-current/70">
            No
          </div>
          <div
            className={`mono-data mt-1 font-medium ${
              dense ? 'text-[1.55rem] leading-none' : 'text-[2rem] leading-none'
            }`}
          >
            {formatProbability(safeNoPrice)}
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        <div className={`${dense ? 'h-4' : 'h-5'} flex`}>
          <div
            className={`h-full transition-[width] duration-300 ${
              yesLeads ? 'bg-[var(--color-up)]' : 'bg-[var(--color-down)]'
            }`}
            style={{ width: `${safeYesPrice * 100}%` }}
          />
          <div
            className={`h-full transition-[width] duration-300 ${
              yesLeads ? 'bg-[var(--color-down)]' : 'bg-[var(--color-up)]'
            }`}
            style={{ width: `${safeNoPrice * 100}%` }}
          />
        </div>
        <div className="pointer-events-none absolute inset-y-1 left-1/2 w-px -translate-x-1/2 rounded-full bg-[rgba(232,234,235,0.35)]" />
      </div>
    </div>
  )
}
