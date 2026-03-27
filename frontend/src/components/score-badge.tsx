import clsx from 'clsx'

type ScoreBadgeProps = {
  score: number
}

function getTone(score: number) {
  if (score >= 80) {
    return 'bg-[var(--color-up)]'
  }

  if (score >= 60) {
    return 'bg-[var(--color-signal)]'
  }

  return 'bg-[var(--color-text-tertiary)]'
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1.5">
      <span className="relative h-1.5 w-7 overflow-hidden rounded-full bg-[var(--color-bg-hover)]">
        <span
          className={clsx('absolute inset-y-0 left-0 rounded-full', getTone(score))}
          style={{ width: `${Math.max(8, Math.min(score, 100))}%` }}
        />
      </span>
      <span className="mono-data text-sm text-[var(--color-text-primary)]">
        {score}
      </span>
    </div>
  )
}
