import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Link,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import { BottomSheet } from '../components/bottom-sheet'
import { SearchResultsLoadingState } from '../components/loading-state'
import { MarketRow } from '../components/market-row'
import {
  RefreshBadge,
  SectionHeader,
} from '../components/section-header'
import {
  useEventsQuery,
  useSearchEventsQuery,
} from '../features/events/hooks'
import {
  EMPTY_EVENTS,
  getCategorySlug,
  sortByVolume,
} from '../features/events/insights'
import { formatCompactNumber } from '../lib/format'
import {
  getCategoryRoute,
  getMarketsRoute,
} from '../lib/routes'
import type { AppSearch } from '../router'
import type { PulseProvider } from '../features/events/types'

const STATUS_FILTERS = [
  { label: 'All statuses', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
] as const

const PROVIDER_FILTERS: Array<{
  label: string
  value: 'all' | PulseProvider
}> = [
  { label: 'All venues', value: 'all' },
  { label: 'Bayse', value: 'bayse' },
  { label: 'Kalshi', value: 'kalshi' },
  { label: 'Manifold', value: 'manifold' },
  { label: 'Polymarket', value: 'polymarket' },
]

function getSearchValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function SearchFilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: string
  onClick: () => void
}) {
  return (
    <button
      className={`min-h-11 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
        active
          ? 'border-[var(--color-brand)] bg-[rgba(0,197,142,0.15)] text-[var(--color-brand)]'
          : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

export function SearchPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const query = getSearchValue(search.q).trim()
  const activeCategory = getSearchValue(search.category) || 'All'
  const activeProvider = getSearchValue(search.provider) || 'all'
  const activeStatus = getSearchValue(search.status) || 'all'
  const [draftQuery, setDraftQuery] = useState(query)
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)
  const [draftCategory, setDraftCategory] = useState(activeCategory)
  const [draftProvider, setDraftProvider] = useState(activeProvider)
  const [draftStatus, setDraftStatus] = useState(activeStatus)
  const categoriesQuery = useEventsQuery({ status: 'open' })
  const searchResultsQuery = useSearchEventsQuery({
    category: activeCategory === 'All' ? undefined : activeCategory,
    provider: activeProvider === 'all' ? undefined : (activeProvider as PulseProvider),
    q: query || undefined,
    status: activeStatus === 'all' ? undefined : activeStatus,
  })

  useEffect(() => {
    setDraftQuery(query)
  }, [query])

  useEffect(() => {
    if (!isMobileFiltersOpen) {
      return
    }

    setDraftCategory(activeCategory)
    setDraftProvider(activeProvider)
    setDraftStatus(activeStatus)
  }, [activeCategory, activeProvider, activeStatus, isMobileFiltersOpen])

  useEffect(() => {
    const nextQuery = draftQuery.trim()

    if (nextQuery === query) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void navigate({
        resetScroll: false,
        replace: true,
        search: (current): AppSearch => {
          const nextSearch: AppSearch = { ...current }

          if (nextQuery) {
            nextSearch.q = nextQuery
          } else {
            delete nextSearch.q
          }

          return nextSearch
        },
        to: '/search',
      })
    }, 200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [draftQuery, navigate, query])

  const categoryOptions = useMemo(() => {
    const knownEvents = categoriesQuery.data ?? EMPTY_EVENTS
    const resultEvents = searchResultsQuery.data ?? EMPTY_EVENTS

    return [
      'All',
      ...new Set(
        [...knownEvents, ...resultEvents]
          .map((event) => event.category)
          .filter(Boolean)
          .sort(),
      ),
    ]
  }, [categoriesQuery.data, searchResultsQuery.data])

  const suggestedMarkets = useMemo(() => {
    return [...(categoriesQuery.data ?? EMPTY_EVENTS)]
      .sort(sortByVolume)
      .slice(0, 3)
  }, [categoriesQuery.data])

  const hasQuery = query.length >= 2
  const results = searchResultsQuery.data ?? EMPTY_EVENTS
  const isResultsRefreshing =
    searchResultsQuery.isFetching && !searchResultsQuery.isLoading
  const isSuggestionsRefreshing =
    categoriesQuery.isFetching && !categoriesQuery.isLoading
  const activeFilterCount = [
    activeCategory !== 'All',
    activeProvider !== 'all',
    activeStatus !== 'all',
  ].filter(Boolean).length

  const updateFilter = (key: 'category' | 'provider' | 'status', value: string) => {
    void navigate({
      resetScroll: false,
      replace: true,
      search: (current): AppSearch => {
        const nextSearch: AppSearch = { ...current }

        if (
          (key === 'category' && value === 'All') ||
          (key === 'provider' && value === 'all') ||
          (key === 'status' && value === 'all')
        ) {
          delete nextSearch[key]
        } else {
          nextSearch[key] = value
        }

        return nextSearch
      },
      to: '/search',
    })
  }

  const applyMobileFilters = () => {
    void navigate({
      resetScroll: false,
      replace: true,
      search: (current): AppSearch => {
        const nextSearch: AppSearch = { ...current }

        if (draftCategory === 'All') {
          delete nextSearch.category
        } else {
          nextSearch.category = draftCategory
        }

        if (draftProvider === 'all') {
          delete nextSearch.provider
        } else {
          nextSearch.provider = draftProvider
        }

        if (draftStatus === 'all') {
          delete nextSearch.status
        } else {
          nextSearch.status = draftStatus
        }

        return nextSearch
      },
      to: '/search',
    })

    setIsMobileFiltersOpen(false)
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5 lg:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_280px]">
          <div className="space-y-4">
            <div className="eyebrow">Search</div>
            <div className="space-y-3">
              <h1 className="display-title">Search the market archive.</h1>
              <p className="max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                Move beyond the homepage board. Search across stored event titles and descriptions, then narrow the tape by venue, status, or desk.
              </p>
            </div>
          </div>

          <div className="panel-elevated p-4">
            <SectionHeader
              description="The query always lives in the URL so searches can be shared and reopened later."
              kicker="Query state"
              status={hasQuery && isResultsRefreshing ? <RefreshBadge /> : null}
              title={query ? `“${query}”` : 'Waiting for a search'}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="metric-card">
                <div className="stat-label">Results</div>
                <strong>
                  {hasQuery ? formatCompactNumber(results.length) : '—'}
                </strong>
              </div>
              <div className="metric-card">
                <div className="stat-label">Active filters</div>
                <strong>{formatCompactNumber(activeFilterCount)}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="panel hidden h-fit p-4 sm:p-5 xl:block">
          <div className="space-y-5">
            <SectionHeader
              description="Search updates the result list immediately while keeping the current filter state in the URL."
              kicker="Filters"
              title="Refine results"
            />

            <label className="terminal-input">
              <span className="section-kicker !tracking-[0.14em]">Query</span>
              <input
                onChange={(event) => {
                  setDraftQuery(event.target.value)
                }}
                placeholder="Election, AFCON, rate cut..."
                value={draftQuery}
              />
            </label>

            <div className="space-y-2">
              <div className="section-kicker">Status</div>
              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((statusFilter) => (
                  <SearchFilterButton
                    active={activeStatus === statusFilter.value}
                    key={statusFilter.value}
                    onClick={() => updateFilter('status', statusFilter.value)}
                  >
                    {statusFilter.label}
                  </SearchFilterButton>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="section-kicker">Venue</div>
              <div className="flex flex-wrap gap-2">
                {PROVIDER_FILTERS.map((providerFilter) => (
                  <SearchFilterButton
                    active={activeProvider === providerFilter.value}
                    key={providerFilter.value}
                    onClick={() => updateFilter('provider', providerFilter.value)}
                  >
                    {providerFilter.label}
                  </SearchFilterButton>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="section-kicker">Category</div>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((category) => (
                  <SearchFilterButton
                    active={activeCategory === category}
                    key={category}
                    onClick={() => updateFilter('category', category)}
                  >
                    {category}
                  </SearchFilterButton>
                ))}
              </div>
            </div>

            <button
              className="terminal-button w-full justify-center text-sm font-medium"
              onClick={() => {
                setDraftQuery('')
                void navigate({
                  resetScroll: false,
                  replace: true,
                  search: {},
                  to: '/search',
                })
              }}
              type="button"
            >
              Clear search
            </button>
          </div>
        </aside>

        <div className="space-y-4">
          <div className="space-y-3 xl:hidden">
            <label className="terminal-input h-12">
              <span className="section-kicker !tracking-[0.14em]">Query</span>
              <input
                className="text-[16px]"
                onChange={(event) => {
                  setDraftQuery(event.target.value)
                }}
                placeholder="Election, AFCON, rate cut..."
                value={draftQuery}
              />
            </label>

            <button
              className="terminal-button w-full justify-center text-sm font-medium"
              onClick={() => {
                setIsMobileFiltersOpen(true)
              }}
              type="button"
            >
              {activeFilterCount > 0 ? `Filters · ${activeFilterCount} active` : 'Filters'}
            </button>
          </div>

          <SectionHeader
            description={
              hasQuery
                ? `${formatCompactNumber(results.length)} stored market matches for the current query and filter state.`
                : 'Start with at least two characters to search the stored event archive.'
            }
            kicker="Results"
            status={hasQuery && isResultsRefreshing ? <RefreshBadge /> : null}
            title={hasQuery ? 'Market matches' : 'Search results'}
          />

          {!hasQuery ? (
            <div className="panel p-5 sm:p-6">
              <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
                Start typing above to search markets, events, and categories. The first pass is focused on market results from the owned event store.
              </p>

              {suggestedMarkets.length ? (
                <div className="mt-5 space-y-3">
                  <div className="section-kicker">Popular right now</div>
                  {suggestedMarkets.map((event) => (
                    <MarketRow event={event} key={event.id} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {hasQuery && searchResultsQuery.isLoading ? (
            <SearchResultsLoadingState />
          ) : null}

          {hasQuery && searchResultsQuery.error ? (
            <div className="panel p-6 text-[var(--color-down)]">
              {(searchResultsQuery.error as Error).message}
            </div>
          ) : null}

          {hasQuery &&
          !searchResultsQuery.isLoading &&
          !searchResultsQuery.error &&
          !results.length ? (
            <div className="space-y-4">
              <div className="panel p-6">
                <p className="text-lg font-medium text-[var(--color-text-primary)]">
                  No markets found for “{query}”.
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
                  Try broadening the query, switching the status filter back to all, or jumping into one of the active desks below.
                </p>
              </div>

              {suggestedMarkets.length ? (
                <div className="panel p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <SectionHeader
                      description="The public board stays useful even when the current query misses."
                      kicker="Suggested markets"
                      status={isSuggestionsRefreshing ? <RefreshBadge /> : null}
                      title="Popular names to open instead"
                    />
                    <Link
                      className="terminal-button text-sm font-medium"
                      {...getMarketsRoute()}
                    >
                      Back to markets
                    </Link>
                  </div>

                  <div className="mt-4 space-y-3">
                    {suggestedMarkets.map((event) => (
                      <MarketRow event={event} key={event.id} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {hasQuery && results.length ? (
            <div className="space-y-3">
              {results.map((event) => (
                <MarketRow event={event} key={event.id} />
              ))}
            </div>
          ) : null}

          {categoryOptions.length > 1 ? (
            <div className="panel-muted p-4">
              <div className="section-kicker">Browse desks</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {categoryOptions
                  .filter((category) => category !== 'All')
                  .map((category) => (
                    <Link
                      className="terminal-chip min-h-11 border-[var(--color-border)] bg-transparent px-3 py-1.5 text-[13px] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
                      key={category}
                      {...getCategoryRoute(getCategorySlug(category))}
                    >
                      {category}
                    </Link>
                  ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <BottomSheet
        footer={
          <div className="flex items-center gap-3">
            <button
              className="terminal-button terminal-button-primary flex-1 justify-center text-sm font-medium"
              onClick={applyMobileFilters}
              type="button"
            >
              Apply filters
            </button>
            <button
              className="min-h-11 text-sm text-[var(--color-text-secondary)]"
              onClick={() => {
                setDraftCategory('All')
                setDraftProvider('all')
                setDraftStatus('all')
              }}
              type="button"
            >
              Reset
            </button>
          </div>
        }
        isOpen={isMobileFiltersOpen}
        onClose={() => {
          setIsMobileFiltersOpen(false)
        }}
        title="Filters"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="section-kicker">Status</div>
            <div className="flex gap-2">
              {STATUS_FILTERS.map((statusFilter) => (
                <button
                  className="venue-filter-pill flex-1 justify-center"
                  data-active={draftStatus === statusFilter.value ? 'true' : 'false'}
                  key={statusFilter.value}
                  onClick={() => setDraftStatus(statusFilter.value)}
                  type="button"
                >
                  {statusFilter.label.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="section-kicker">Platform</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {PROVIDER_FILTERS.map((providerFilter) => (
                <button
                  className="venue-filter-pill shrink-0"
                  data-active={draftProvider === providerFilter.value ? 'true' : 'false'}
                  key={providerFilter.value}
                  onClick={() => setDraftProvider(providerFilter.value)}
                  type="button"
                >
                  {providerFilter.label.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="section-kicker">Category</div>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((category) => (
                <button
                  className="venue-filter-pill"
                  data-active={draftCategory === category ? 'true' : 'false'}
                  key={category}
                  onClick={() => setDraftCategory(category)}
                  type="button"
                >
                  {category.toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
