import type { PulseComparedEvent } from '../features/events/types'
import {
  formatProbability,
  formatProbabilityPoints,
} from '../lib/format'
import { PlatformBadge } from './platform-badge'

type DivergenceBarProps = {
  items: PulseComparedEvent[]
}

const PROVIDER_PALETTE = {
  bayse: {
    dot: 'var(--color-bayse)',
    glow: 'rgba(0, 197, 142, 0.18)',
  },
  kalshi: {
    dot: 'var(--color-kalshi)',
    glow: 'rgba(255, 139, 45, 0.18)',
  },
  manifold: {
    dot: 'var(--color-manifold)',
    glow: 'rgba(236, 72, 153, 0.18)',
  },
  polymarket: {
    dot: 'var(--color-polymarket)',
    glow: 'rgba(0, 112, 243, 0.18)',
  },
} as const

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
    <div className="panel-elevated p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-text-secondary)]">
        <span>Cross-platform spread</span>
        <span className="mono-data text-base font-medium text-[var(--color-text-primary)]">
          {formatProbabilityPoints(maxDivergence)}
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>

      <div className="relative mt-3 h-20">
        <div className="absolute inset-x-0 top-8 h-2 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,var(--color-down-dim),rgba(100,116,139,0.08),var(--color-up-dim))]" />
        {sortedItems.map((item, index) => {
          const isUpperTrack = index % 2 === 0
          const providerPalette = PROVIDER_PALETTE[item.event.provider]

          return (
            <div
              className="absolute -translate-x-1/2"
              key={item.event.id}
              style={{
                left: `${clampPercentage(item.yesPrice)}%`,
                top: isUpperTrack ? '0.25rem' : '2.5rem',
              }}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="mono-data text-xs text-[var(--color-text-primary)]">
                  {formatProbability(item.yesPrice)}
                </div>
                <div
                  className="h-3.5 w-3.5 rounded-full border-2 border-[var(--color-bg-surface)]"
                  style={{
                    backgroundColor: providerPalette.dot,
                    boxShadow: `0 0 0 4px ${providerPalette.glow}`,
                  }}
                />
                <PlatformBadge platform={item.event.provider} short size="sm" />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {sortedItems.map((item) => (
          <div
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3"
            key={item.event.id}
          >
            <div className="flex items-center justify-between gap-3">
              <PlatformBadge platform={item.event.provider} short size="sm" />
              <div className="mono-data text-sm font-medium text-[var(--color-text-primary)]">
                {formatProbability(item.yesPrice)}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0 text-sm text-[var(--color-text-secondary)]">
                <div className="truncate font-medium text-[var(--color-text-primary)]">{item.marketTitle}</div>
                <div className="truncate">{item.event.title}</div>
              </div>
              <div className="stat-label shrink-0">Yes</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
