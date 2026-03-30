function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-[var(--color-bg-elevated)] ${className}`}
    />
  )
}

export function SkeletonText({
  lines,
  rowClassName = 'h-3',
}: {
  lines: string[]
  rowClassName?: string
}) {
  return (
    <div className="space-y-2">
      {lines.map((lineClassName, index) => (
        <SkeletonBlock
          className={`${rowClassName} ${lineClassName}`}
          key={`${lineClassName}-${index}`}
        />
      ))}
    </div>
  )
}

export function RouteLoadingState() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <section className="panel p-5 lg:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_320px]">
          <div className="space-y-5">
            <SkeletonBlock className="h-3 w-32" />
            <SkeletonText lines={['h-10 w-full max-w-[42rem]', 'h-4 w-full max-w-[28rem]']} />
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonBlock className="h-24" key={index} />
              ))}
            </div>
          </div>
          <SkeletonBlock className="h-56" />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_320px]">
        <SkeletonBlock className="h-[24rem]" />
        <div className="space-y-4">
          <SkeletonBlock className="h-40" />
          <SkeletonBlock className="h-40" />
        </div>
      </section>
    </div>
  )
}

export function MarketRowsLoadingState({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      {Array.from({ length: count }).map((_, index) => (
        <div className="panel p-4" key={index}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_120px_120px_120px] lg:items-center">
            <div className="space-y-3">
              <div className="flex gap-2">
                <SkeletonBlock className="h-6 w-16 rounded-full" />
                <SkeletonBlock className="h-6 w-24 rounded-full" />
              </div>
              <SkeletonText lines={['h-5 w-full', 'h-4 w-3/4']} />
            </div>
            <SkeletonBlock className="h-12" />
            <SkeletonBlock className="h-12" />
            <SkeletonBlock className="h-12" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CompactCardsLoadingState({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      {Array.from({ length: count }).map((_, index) => (
        <div className="panel-elevated p-4" key={index}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-5 w-12 rounded-full" />
              <SkeletonBlock className="h-5 w-20 rounded-full" />
            </div>
            <SkeletonText lines={['h-4 w-full', 'h-4 w-2/3']} />
            <div className="grid gap-2 sm:grid-cols-2">
              <SkeletonBlock className="h-10" />
              <SkeletonBlock className="h-10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SignalCardsLoadingState({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      {Array.from({ length: count }).map((_, index) => (
        <div className="panel-elevated p-5" key={index}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <SkeletonBlock className="h-6 w-12 rounded-full" />
              <SkeletonBlock className="h-6 w-20 rounded-full" />
              <SkeletonBlock className="h-6 w-24 rounded-full" />
            </div>
            <SkeletonText lines={['h-10 w-full', 'h-4 w-full', 'h-4 w-5/6']} />
            <div className="grid gap-3 sm:grid-cols-2">
              <SkeletonBlock className="h-20" />
              <SkeletonBlock className="h-20" />
            </div>
            <div className="flex gap-3">
              <SkeletonBlock className="h-11 w-32" />
              <SkeletonBlock className="h-11 w-36" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function TableLoadingState({
  columns = 4,
  rows = 4,
}: {
  columns?: number
  rows?: number
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)]" role="status" aria-live="polite">
      <div
        className="grid gap-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-4 py-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, index) => (
          <SkeletonBlock className="h-3 w-20" key={index} />
        ))}
      </div>
      <div className="divide-y divide-[var(--color-border-subtle)]">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            className="grid gap-4 px-4 py-4"
            key={rowIndex}
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <SkeletonBlock className="h-4 w-full" key={columnIndex} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ChartLoadingState({ heightClass = 'h-[200px]' }: { heightClass?: string }) {
  return (
    <div className={`panel-elevated p-4 ${heightClass}`} role="status" aria-live="polite">
      <div className="flex justify-end">
        <SkeletonBlock className="h-9 w-24" />
      </div>
      <div className="mt-4 grid h-[calc(100%-3.25rem)] grid-rows-[1fr_auto] gap-4">
        <SkeletonBlock className="h-full" />
        <div className="grid grid-cols-4 gap-3">
          <SkeletonBlock className="h-3" />
          <SkeletonBlock className="h-3" />
          <SkeletonBlock className="h-3" />
          <SkeletonBlock className="h-3" />
        </div>
      </div>
    </div>
  )
}

export function TickerLoadingState() {
  return (
    <div className="px-3 py-2.5" role="status" aria-live="polite">
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            className="flex min-h-11 min-w-[15rem] flex-1 items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2.5"
            key={index}
          >
            <SkeletonBlock className="h-5 w-10 rounded-full" />
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-4 flex-1" />
            <SkeletonBlock className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CategoryDeskLoadingState() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <section className="panel p-5 lg:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_360px]">
          <div className="space-y-5">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonText lines={['h-10 w-80', 'h-4 w-full', 'h-4 w-4/5']} />
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonBlock className="h-24" key={index} />
              ))}
            </div>
            <div className="flex gap-3">
              <SkeletonBlock className="h-10 w-28 rounded-full" />
              <SkeletonBlock className="h-10 w-32 rounded-full" />
              <SkeletonBlock className="h-10 w-36 rounded-full" />
            </div>
          </div>
          <SkeletonBlock className="h-56" />
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
        <MarketRowsLoadingState count={4} />
        <div className="space-y-4">
          <CompactCardsLoadingState count={2} />
        </div>
      </div>
    </div>
  )
}

export function DivergenceBoardLoadingState() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <section className="panel p-5 lg:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.18fr)_320px]">
          <div className="space-y-5">
            <SkeletonBlock className="h-3 w-36" />
            <SkeletonText lines={['h-10 w-full max-w-[42rem]', 'h-4 w-full', 'h-4 w-4/5']} />
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonBlock className="h-24" key={index} />
              ))}
            </div>
          </div>
          <SkeletonBlock className="h-64" />
        </div>
      </section>
      <section className="panel p-4 sm:p-5">
        <div className="flex items-end justify-between gap-4">
          <SkeletonText lines={['h-3 w-28', 'h-8 w-64']} />
          <div className="flex gap-2">
            <SkeletonBlock className="h-10 w-28" />
            <SkeletonBlock className="h-10 w-28" />
          </div>
        </div>
        <div className="mt-5">
          <TableLoadingState columns={5} rows={6} />
        </div>
      </section>
    </div>
  )
}

export function EventDetailLoadingState() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <section className="panel p-5 lg:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_340px]">
          <div className="space-y-5">
            <div className="flex gap-2">
              <SkeletonBlock className="h-6 w-24 rounded-full" />
              <SkeletonBlock className="h-6 w-20 rounded-full" />
              <SkeletonBlock className="h-6 w-20 rounded-full" />
            </div>
            <SkeletonText lines={['h-10 w-full', 'h-4 w-full', 'h-4 w-5/6']} />
            <ChartLoadingState />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonBlock className="h-24" key={index} />
              ))}
            </div>
            <SkeletonBlock className="h-28" />
          </div>
          <SkeletonBlock className="h-[32rem]" />
        </div>
      </section>
      <SkeletonBlock className="h-40" />
      <SkeletonBlock className="h-[26rem]" />
      <MarketRowsLoadingState count={3} />
    </div>
  )
}

export function EventCompareLoadingState() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <section className="panel p-5 lg:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_320px]">
          <div className="space-y-5">
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonText lines={['h-10 w-full', 'h-4 w-full', 'h-4 w-4/5']} />
            <div className="flex gap-2">
              <SkeletonBlock className="h-6 w-20 rounded-full" />
              <SkeletonBlock className="h-6 w-20 rounded-full" />
              <SkeletonBlock className="h-6 w-20 rounded-full" />
            </div>
            <SkeletonBlock className="h-24" />
          </div>
          <SkeletonBlock className="h-60" />
        </div>
      </section>
      <section className="panel p-4 sm:p-5">
        <CompactCardsLoadingState count={4} />
      </section>
      <ChartLoadingState heightClass="h-[260px]" />
    </div>
  )
}

export function SmartMoneyDeskLoadingState() {
  return (
    <div className="border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]" role="status" aria-live="polite">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <section className="border-b border-[var(--color-border-subtle)] px-7 py-6">
            <SkeletonBlock className="h-3 w-28" />
            <div className="mt-4 space-y-2">
              <SkeletonText lines={['h-9 w-full max-w-[36rem]', 'h-4 w-full max-w-[28rem]']} />
            </div>
          </section>
          <section className="border-b border-[var(--color-border-subtle)] px-7 py-4">
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonBlock className="h-36" key={index} />
              ))}
            </div>
          </section>
          <section className="border-b border-[var(--color-border-subtle)]">
            <div className="grid md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonBlock className="h-24 rounded-none" key={index} />
              ))}
            </div>
          </section>
          <section className="border-b border-[var(--color-border-subtle)] px-7 py-3">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <SkeletonBlock className="h-10 w-28 rounded-full" key={index} />
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <SkeletonBlock className="h-16" />
                <SkeletonBlock className="h-16" />
                <SkeletonBlock className="h-12 w-36" />
              </div>
            </div>
          </section>
          <div className="px-7 py-6">
            <SignalCardsLoadingState count={3} />
          </div>
        </div>
        <aside className="border-t border-[var(--color-border)] lg:border-l lg:border-t-0">
          <div className="space-y-4 px-[18px] py-4">
            <SkeletonBlock className="h-56" />
            <SkeletonBlock className="h-52" />
          </div>
        </aside>
      </div>
    </div>
  )
}

export function SmartMoneyLeaderboardLoadingState() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <section className="panel p-5 lg:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_320px]">
          <div className="space-y-4">
            <SkeletonBlock className="h-3 w-32" />
            <SkeletonText lines={['h-10 w-full max-w-[34rem]', 'h-4 w-full', 'h-4 w-5/6']} />
          </div>
          <SkeletonBlock className="h-64" />
        </div>
      </section>
      <section className="panel p-4 sm:p-5">
        <SkeletonText lines={['h-3 w-24', 'h-8 w-48']} />
        <div className="mt-5">
          <TableLoadingState columns={8} rows={6} />
        </div>
      </section>
    </div>
  )
}

export function SmartMoneyWalletLoadingState() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <section className="panel p-5 lg:p-6">
        <div className="space-y-4">
          <SkeletonBlock className="h-4 w-40" />
          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <SkeletonBlock className="h-56" />
            <div className="space-y-4">
              <SkeletonText lines={['h-3 w-28', 'h-10 w-80', 'h-4 w-full', 'h-4 w-3/4']} />
              <div className="grid gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <SkeletonBlock className="h-24" key={index} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <SkeletonBlock className="h-72" />
      <section className="panel p-4 sm:p-5">
        <TableLoadingState columns={6} rows={5} />
      </section>
      <SignalCardsLoadingState count={2} />
    </div>
  )
}

export function SearchResultsLoadingState() {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <SkeletonBlock className="h-12 w-48" />
      <MarketRowsLoadingState count={4} />
    </div>
  )
}
