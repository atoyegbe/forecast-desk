type SectionHeaderProps = {
  kicker: string
  title: string
  description?: string
}

export function SectionHeader({
  kicker,
  title,
  description,
}: SectionHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="section-kicker">{kicker}</div>
        <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
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
