import { getProviderLabel } from '../features/events/provider-ids'
import type { PulseComparedEvent } from '../features/events/types'
import {
  formatProbability,
  formatProbabilityPoints,
} from '../lib/format'

type DivergenceBarProps = {
  items: PulseComparedEvent[]
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value * 100))
}

export function DivergenceBar({ items }: DivergenceBarProps) {
  const sortedItems = [...items].sort((leftItem, rightItem) => leftItem.yesPrice - rightItem.yesPrice)
  const maxDivergence =
    sortedItems.length >= 2
      ? sortedItems[sortedItems.length - 1].yesPrice - sortedItems[0].yesPrice
      : 0

  return (
    <div className="rounded-[1.4rem] border border-stone-900/10 bg-stone-950/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-stone-600">
        <span>Cross-platform spread</span>
        <span className="font-medium text-stone-900">
          {formatProbabilityPoints(maxDivergence)}
        </span>
      </div>

      <div className="relative mt-5 h-14">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-stone-200" />
        {sortedItems.map((item, index) => {
          const isUpperTrack = index % 2 === 0

          return (
            <div
              className="absolute -translate-x-1/2"
              key={item.event.id}
              style={{
                left: `${clampPercentage(item.yesPrice)}%`,
                top: isUpperTrack ? '0.25rem' : '1.9rem',
              }}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="rounded-full border border-stone-900/10 bg-white px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-stone-700 shadow-[0_8px_16px_rgba(28,25,23,0.08)]">
                  {getProviderLabel(item.event.provider)}
                </div>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-white bg-teal-700 shadow-[0_0_0_4px_rgba(20,184,166,0.12)]" />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {sortedItems.map((item) => (
          <div
            className="rounded-[1.2rem] border border-stone-900/10 bg-white px-4 py-3"
            key={item.event.id}
          >
            <div className="text-[0.68rem] uppercase tracking-[0.22em] text-stone-500">
              {getProviderLabel(item.event.provider)}
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="min-w-0 text-sm text-stone-600">
                <div className="truncate font-medium text-stone-900">{item.marketTitle}</div>
                <div className="truncate">{item.event.title}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-lg font-semibold text-teal-700">
                  {formatProbability(item.yesPrice)}
                </div>
                <div className="text-xs text-stone-500">Yes</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
