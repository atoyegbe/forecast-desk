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
    <section className="panel p-5 sm:p-6">
      <div
        aria-label={activeItem.title}
        className="flex flex-wrap gap-2 rounded-[1.3rem] border border-stone-900/10 bg-stone-950/[0.03] p-2"
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
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? 'active-pill'
                  : 'bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-950'
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

      <div className="mt-6">
        <SectionHeader
          description={activeItem.description}
          kicker={activeItem.kicker}
          title={activeItem.title}
        />
        <div
          aria-labelledby={`${tabsId}-tab-${activeItem.id}`}
          className="mt-6"
          id={`${tabsId}-panel-${activeItem.id}`}
          role="tabpanel"
        >
          {activeItem.content}
        </div>
      </div>
    </section>
  )
}
