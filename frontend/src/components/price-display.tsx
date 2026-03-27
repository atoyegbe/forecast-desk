import clsx from 'clsx'
import { formatProbability } from '../lib/format'

type PriceDisplayProps = {
  size?: 'sm' | 'md'
  value: number
}

function getToneClass(value: number) {
  if (Math.abs(value - 0.5) < 0.001) {
    return 'text-[var(--color-neutral)]'
  }

  return value > 0.5
    ? 'text-[var(--color-up)]'
    : 'text-[var(--color-down)]'
}

export function PriceDisplay({
  size = 'md',
  value,
}: PriceDisplayProps) {
  return (
    <span
      className={clsx(
        'mono-data font-medium',
        getToneClass(value),
        size === 'sm' ? 'text-sm' : 'text-base',
      )}
    >
      {formatProbability(value)}
    </span>
  )
}
