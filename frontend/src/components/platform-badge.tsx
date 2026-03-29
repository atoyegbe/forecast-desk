import clsx from 'clsx'
import type { PulseProvider } from '../features/events/types'

type PlatformBadgeProps = {
  platform: PulseProvider
  short?: boolean
  size?: 'sm' | 'md'
}

const PLATFORM_CONFIG: Record<
  PulseProvider,
  {
    className: string
    label: string
    short: string
  }
> = {
  bayse: {
    className: 'platform-badge-bayse',
    label: 'Bayse',
    short: 'BY',
  },
  kalshi: {
    className: 'platform-badge-kalshi',
    label: 'Kalshi',
    short: 'KL',
  },
  manifold: {
    className: 'platform-badge-manifold',
    label: 'Manifold',
    short: 'MF',
  },
  polymarket: {
    className: 'platform-badge-polymarket',
    label: 'Polymarket',
    short: 'PM',
  },
}

export function PlatformBadge({
  platform,
  short = false,
  size = 'md',
}: PlatformBadgeProps) {
  const config = PLATFORM_CONFIG[platform]

  return (
    <span
      aria-label={config.label}
      className={clsx(
        'platform-badge inline-flex items-center rounded-[4px] border-l-2 font-mono font-medium',
        config.className,
        size === 'sm'
          ? 'px-1.5 py-1 text-[11px] tracking-[0.16em]'
          : 'px-2 py-1 text-[12px] tracking-[0.08em]',
      )}
      title={config.label}
    >
      {short ? config.short : config.label}
    </span>
  )
}
