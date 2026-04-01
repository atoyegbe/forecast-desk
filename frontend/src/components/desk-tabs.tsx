import {
  type ReactNode,
  useId,
  useMemo,
  useState,
} from 'react'
import { SectionHeader } from './section-header'

type DeskTab<T extends string> = {
  content: ReactNode
  description?: string
  id: T
  kicker: string
  label: string
  title: string
}

type DeskTabsProps<T extends string> = {
  activeTabId?: T
  defaultTabId?: T
  items: DeskTab<T>[]
  onTabChange?: (tabId: T) => void
}

export function DeskTabs<T extends string>({
  activeTabId,
  defaultTabId,
  items,
  onTabChange,
}: DeskTabsProps<T>) {
  const initialTabId = defaultTabId ?? items[0]?.id ?? ''
  const [uncontrolledTabId, setUncontrolledTabId] = useState(initialTabId)
  const tabsId = useId()
  const resolvedTabId = activeTabId ?? uncontrolledTabId
  const activeItem = useMemo(() => {
    return items.find((item) => item.id === resolvedTabId) ?? items[0]
  }, [items, resolvedTabId])

  if (!activeItem) {
    return null
  }

  return (
    <section className="panel p-4 sm:p-5">
      <div
        aria-label={activeItem.title}
        className="flex gap-2 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-1.5"
        role="tablist"
      >
        {items.map((item) => {
          const isActive = item.id === activeItem.id
          const tabId = `${tabsId}-tab-${item.id}`
          const panelId = `${tabsId}-panel-${item.id}`

          return (
            <button
              aria-controls={panelId}
              aria-selected={isActive}
              className={`min-h-11 shrink-0 rounded-md border px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'terminal-chip terminal-chip-active'
                  : 'border-transparent bg-transparent text-[var(--color-text-tertiary)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
              }`}
              id={tabId}
              key={item.id}
              onClick={() => {
                onTabChange?.(item.id)
                setUncontrolledTabId(item.id)
              }}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="mt-5">
        <SectionHeader
          description={activeItem.description}
          kicker={activeItem.kicker}
          title={activeItem.title}
        />
        <div
          aria-labelledby={`${tabsId}-tab-${activeItem.id}`}
          className="mt-5"
          id={`${tabsId}-panel-${activeItem.id}`}
          role="tabpanel"
        >
          {activeItem.content}
        </div>
      </div>
    </section>
  )
}
