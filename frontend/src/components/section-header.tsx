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
      <div className="section-kicker">{kicker}</div>
      <div className="border-t border-stone-900/10 pt-4">
        <h2 className="section-title">{title}</h2>
        {description ? (
          <p className="mt-3 max-w-3xl text-base leading-7 text-stone-600">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  )
}
