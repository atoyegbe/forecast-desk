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

  return (
    <div className={dense ? 'space-y-3' : 'space-y-4'}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div
          className={`rounded-[1.2rem] border border-teal-800/10 bg-teal-700/[0.08] text-left ${
            dense ? 'px-3 py-3' : 'px-4 py-4'
          }`}
        >
          <div className="text-[0.68rem] uppercase tracking-[0.26em] text-teal-800/70">
            Yes
          </div>
          <div
            className={`mt-1 font-semibold text-teal-800 ${
              dense ? 'text-[1.9rem] leading-none' : 'text-[2.35rem] leading-none'
            }`}
          >
            {formatProbability(safeYesPrice)}
          </div>
        </div>
        <div
          className={`rounded-[1.2rem] border border-stone-900/10 bg-white text-right ${
            dense ? 'px-3 py-3' : 'px-4 py-4'
          }`}
        >
          <div className="text-[0.68rem] uppercase tracking-[0.26em] text-stone-500">
            No
          </div>
          <div
            className={`mt-1 font-semibold text-stone-900 ${
              dense ? 'text-[1.9rem] leading-none' : 'text-[2.35rem] leading-none'
            }`}
          >
            {formatProbability(safeNoPrice)}
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-full border border-stone-900/10 bg-stone-200/80">
        <div className={`${dense ? 'h-4' : 'h-5'} flex`}>
          <div
            className="h-full bg-teal-700/82 transition-[width] duration-300"
            style={{ width: `${safeYesPrice * 100}%` }}
          />
          <div
            className="h-full bg-stone-900/72 transition-[width] duration-300"
            style={{ width: `${safeNoPrice * 100}%` }}
          />
        </div>
        <div className="pointer-events-none absolute inset-y-1 left-1/2 w-px -translate-x-1/2 rounded-full bg-white/60" />
      </div>
    </div>
  )
}
