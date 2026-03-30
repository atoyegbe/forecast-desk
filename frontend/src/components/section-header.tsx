import type { ReactNode } from 'react'

type SectionHeaderProps = {
  description?: string
  kicker: string
  status?: ReactNode
  title: string
}

type RefreshBadgeProps = {
  label?: string
}

export function RefreshBadge({
  label = 'Updating',
}: RefreshBadgeProps) {
  return (
    <span className="signal-chip terminal-chip inline-flex items-center gap-2 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--color-signal)]">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current"
        style={{ animation: 'nav-status-pulse 2s ease-in-out infinite' }}
      />
      {label}
    </span>
  )
}

export function SectionHeader({
  description,
  kicker,
  status,
  title,
}: SectionHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="section-kicker">{kicker}</div>
        <div className="h-px min-w-8 flex-1 bg-[var(--color-border-subtle)]" />
        {status ? (
          <div className="shrink-0">
            {status}
          </div>
        ) : null}
      </div>
      <div className="space-y-3">
        <h2 className="section-title">{title}</h2>
        {description ? (
          <p className="max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-[15px]">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  )
}
