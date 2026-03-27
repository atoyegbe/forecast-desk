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
    background: string
    color: string
    label: string
    short: string
  }
> = {
  bayse: {
    background: 'rgba(0, 197, 142, 0.14)',
    color: '#00c58e',
    label: 'Bayse',
    short: 'BY',
  },
  polymarket: {
    background: 'rgba(0, 112, 243, 0.14)',
    color: '#0070f3',
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
      className={clsx(
        'inline-flex items-center rounded-[4px] border-l-2 font-mono font-medium',
        size === 'sm'
          ? 'px-1.5 py-1 text-[11px] tracking-[0.16em]'
          : 'px-2 py-1 text-[12px] tracking-[0.08em]',
      )}
      style={{
        backgroundColor: config.background,
        borderColor: config.color,
        color: config.color,
      }}
    >
      {short ? config.short : config.label}
    </span>
  )
}
