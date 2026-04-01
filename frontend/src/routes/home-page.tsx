import {
  startTransition,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Link,
  useNavigate,
} from '@tanstack/react-router'
import { BottomSheet } from '../components/bottom-sheet'
import { CompactMarketCard } from '../components/compact-market-card'
import { DeskTabs } from '../components/desk-tabs'
import {
  CompactCardsLoadingState,
  MarketRowsLoadingState,
  SignalCardsLoadingState,
} from '../components/loading-state'
import { MarketCard } from '../components/market-card'
import { MarketRow } from '../components/market-row'
import { PlatformBadge } from '../components/platform-badge'
import { ScoreBadge } from '../components/score-badge'
import {
  RefreshBadge,
  SectionHeader,
} from '../components/section-header'
import { SignalCard } from '../components/signal-card'
import { useDisplayCurrency } from '../features/currency/context'
import { getEventMoneyUnit } from '../features/currency/money'
import { getProviderLabel } from '../features/events/provider-ids'
import {
  useDivergenceQuery,
  useEventsQuery,
  useMoversQuery,
} from '../features/events/hooks'
import {
  useSmartMoneySignalsQuery,
  useSmartMoneyLiveSignals,
  useSmartMoneyWalletsQuery,
} from '../features/smart-money/hooks'
import {
  EMPTY_EVENTS,
  MOVER_WINDOWS,
  getCategorySlug,
  getMoverChange,
  getMarketStance,
  getTempoLabel,
  getTopMoverWindow,
  isNigeriaRelevant,
  sortByActivityScore,
  sortByTightRace,
  sortByVolume,
} from '../features/events/insights'
import {
  formatCompactNumber,
  formatProbabilityPoints,
  formatSignedProbabilityChange,
  formatTimeAgo,
} from '../lib/format'
import {
  getCategoryRoute,
  getEventCompareRoute,
  getSmartMoneyLeaderboardRoute,
  getSmartMoneyRoute,
  getSmartMoneyWalletRoute,
} from '../lib/routes'
import type { AppSearch } from '../router'
import { useUrlSelection } from '../lib/url-state'
import type {
  PulseMoverWindow,
  PulseProvider,
} from '../features/events/types'
import type {
  PulseSmartMoneySignal,
  PulseSmartMoneyWallet,
} from '../features/smart-money/types'

const HOME_TAB_IDS = ['briefing', 'repricing', 'closest', 'velocity'] as const
const MOVER_WINDOW_IDS: readonly PulseMoverWindow[] = ['1h', '6h', '24h']
const BOARD_STATUS_IDS = ['open', 'closed', 'all'] as const
const BOARD_SORT_IDS = ['volume', 'activity', 'tight'] as const
const PROVIDER_FILTER_IDS = ['all', 'bayse', 'kalshi', 'manifold', 'polymarket'] as const
const BOARD_CATEGORY_MERGE_MAP: Record<string, string> = {
  Starmer: 'Politics',
  Trump: 'Politics',
}

function TopWhaleHomeRow({
  signal,
  wallet,
}: {
  signal?: PulseSmartMoneySignal
  wallet: PulseSmartMoneyWallet
}) {
  return (
    <Link
      className="panel-elevated block p-4 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)]"
      {...getSmartMoneyWalletRoute(wallet.address)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="mono-data text-sm text-[var(--color-text-tertiary)]">
              #{wallet.rank}
            </span>
            <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
              {wallet.displayName || wallet.shortAddress}
            </span>
            {wallet.isLive ? (
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-[var(--color-up)]"
              />
            ) : null}
          </div>
          <div className="mt-2 line-clamp-2 text-[12px] leading-5 text-[var(--color-text-secondary)]">
            {signal
              ? `${signal.outcome} ${signal.marketTitle}`
              : 'No qualifying signal in the current homepage feed.'}
          </div>
          <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
            Active {formatTimeAgo(wallet.lastActiveAt)}
          </div>
        </div>

        <ScoreBadge score={wallet.score} />
      </div>
    </Link>
  )
}

function getVenueSummaryLabel(providers: PulseProvider[]) {
  if (!providers.length) {
    return 'No venues'
  }

  if (providers.length === 1) {
    return getProviderLabel(providers[0])
  }

  return 'Mixed venues'
}

function getBoardCategory(category: string) {
  return BOARD_CATEGORY_MERGE_MAP[category] ?? category
}

export function HomePage() {
  useSmartMoneyLiveSignals()
  const navigate = useNavigate()
  const { formatMoney } = useDisplayCurrency()
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)
  const [activeBoardCategory, setActiveBoardCategory] = useState('All')
  const [activeTabId, setActiveTabId] = useUrlSelection({
    fallback: 'briefing',
    key: 'tab',
    values: HOME_TAB_IDS,
  })
  const [activeMoverWindow, setActiveMoverWindow] = useUrlSelection({
    fallback: '24h',
    key: 'window',
    values: MOVER_WINDOW_IDS,
  })
  const [activeProviderId] = useUrlSelection({
    fallback: 'all',
    key: 'provider',
    values: PROVIDER_FILTER_IDS,
  })
  const [activeBoardStatus, setActiveBoardStatus] = useUrlSelection({
    fallback: 'open',
    key: 'status',
    values: BOARD_STATUS_IDS,
  })
  const [activeBoardSort, setActiveBoardSort] = useUrlSelection({
    fallback: 'volume',
    key: 'sort',
    values: BOARD_SORT_IDS,
  })
  const eventsQuery = useEventsQuery({
    status: 'open',
  })
  const boardEventsQuery = useEventsQuery({
    provider: activeProviderId === 'all' ? undefined : activeProviderId,
    status: activeBoardStatus === 'all' ? undefined : activeBoardStatus,
  })
  const events = eventsQuery.data ?? EMPTY_EVENTS
  const boardEvents = boardEventsQuery.data ?? EMPTY_EVENTS
  const [draftProviderId, setDraftProviderId] = useState<typeof PROVIDER_FILTER_IDS[number]>(activeProviderId)
  const [draftBoardCategory, setDraftBoardCategory] = useState(activeBoardCategory)
  const [draftBoardStatus, setDraftBoardStatus] = useState<typeof BOARD_STATUS_IDS[number]>(activeBoardStatus)
  const [draftBoardSort, setDraftBoardSort] = useState<typeof BOARD_SORT_IDS[number]>(activeBoardSort)
  const providerFilteredEvents = useMemo(() => {
    if (activeProviderId === 'all') {
      return events
    }

    return events.filter((event) => event.provider === activeProviderId)
  }, [activeProviderId, events])

  const categories = useMemo(() => {
    return [
      'All',
      ...new Set(providerFilteredEvents.map((event) => event.category).sort()),
    ]
  }, [providerFilteredEvents])
  const boardCategories = useMemo(() => {
    return [
      'All',
      ...new Set(
        boardEvents.map((event) => getBoardCategory(event.category)).sort(),
      ),
    ]
  }, [boardEvents])
  const effectiveCategory = boardCategories.includes(activeBoardCategory)
    ? activeBoardCategory
    : 'All'

  const filteredEvents = useMemo(() => {
    const categoryFilteredEvents = boardEvents
      .filter((event) => {
        if (effectiveCategory === 'All') {
          return true
        }

        return getBoardCategory(event.category) === effectiveCategory
      })
    if (activeBoardSort === 'activity') {
      return categoryFilteredEvents.sort(sortByActivityScore)
    }

    if (activeBoardSort === 'tight') {
      return categoryFilteredEvents.sort(sortByTightRace)
    }

    return categoryFilteredEvents.sort(sortByVolume)
  }, [activeBoardSort, boardEvents, effectiveCategory])
  const moversQuery = useMoversQuery(filteredEvents, 16)
  const divergenceQuery = useDivergenceQuery({
    limit: 3,
    sort: 'divergence',
  })
  const smartMoneySignalsQuery = useSmartMoneySignalsQuery({
    limit: 4,
    minScore: 60,
    minSize: 500,
    sort: 'newest',
  })
  const smartMoneyWalletsQuery = useSmartMoneyWalletsQuery({
    limit: 5,
    minScore: 60,
  })

  const nigeriaDesk = useMemo(() => {
    return providerFilteredEvents.filter(isNigeriaRelevant).sort(sortByVolume)
  }, [providerFilteredEvents])

  const rankedMovers = useMemo(() => {
    return getTopMoverWindow(moversQuery.data ?? [], activeMoverWindow)
  }, [activeMoverWindow, moversQuery.data])
  const moversUp = rankedMovers
    .filter((mover) => getMoverChange(mover, activeMoverWindow) > 0)
    .slice(0, 3)
  const moversDown = rankedMovers
    .filter((mover) => getMoverChange(mover, activeMoverWindow) < 0)
    .slice(0, 3)
  const spotlight = nigeriaDesk[0] ?? filteredEvents[0]
  const volumeLeaders = filteredEvents.slice(0, 6)
  const tightRaces = [...filteredEvents].sort(sortByTightRace).slice(0, 3)
  const highVelocity = [...filteredEvents].sort(sortByActivityScore).slice(0, 4)
  const categoryDesks = categories
    .filter((category) => category !== 'All')
    .map((category) => {
      const categoryEvents = providerFilteredEvents
        .filter((event) => event.category === category)
        .sort(sortByActivityScore)
      const venueMix = Array.from(
        new Set(categoryEvents.map((event) => event.provider)),
      ) as PulseProvider[]

      return {
        category,
        count: categoryEvents.length,
        lead: categoryEvents[0],
        venueLabel: getVenueSummaryLabel(venueMix),
      }
    })
    .filter((entry) => entry.lead)
    .slice(0, 4)
  const leadMover = rankedMovers[0]
  const hasBoardResults = filteredEvents.length > 0
  const topDivergences = divergenceQuery.data ?? []
  const trendingSidebarEvents = volumeLeaders.slice(0, 3)
  const smartMoneySignals = smartMoneySignalsQuery.data ?? []
  const topWhales = smartMoneyWalletsQuery.data ?? []
  const isEventsRefreshing = eventsQuery.isFetching && !eventsQuery.isLoading
  const isBoardRefreshing =
    boardEventsQuery.isFetching && !boardEventsQuery.isLoading
  const isDivergenceRefreshing =
    divergenceQuery.isFetching && !divergenceQuery.isLoading
  const isSignalsRefreshing =
    smartMoneySignalsQuery.isFetching && !smartMoneySignalsQuery.isLoading
  const isWalletsRefreshing =
    smartMoneyWalletsQuery.isFetching && !smartMoneyWalletsQuery.isLoading
  const smartMoneyFlow = smartMoneySignals.reduce(
    (totalSize, signal) => totalSize + signal.size,
    0,
  )
  const latestSignalByWallet = useMemo(() => {
    const signalMap = new Map<string, PulseSmartMoneySignal>()

    for (const signal of smartMoneySignals) {
      if (!signalMap.has(signal.walletAddress)) {
        signalMap.set(signal.walletAddress, signal)
      }
    }

    return signalMap
  }, [smartMoneySignals])

  useEffect(() => {
    if (!isMobileFiltersOpen) {
      return
    }

    setDraftProviderId(activeProviderId)
    setDraftBoardCategory(activeBoardCategory)
    setDraftBoardStatus(activeBoardStatus)
    setDraftBoardSort(activeBoardSort)
  }, [
    activeBoardCategory,
    activeBoardSort,
    activeBoardStatus,
    activeProviderId,
    isMobileFiltersOpen,
  ])

  const mobileActiveFilterCount = [
    activeProviderId !== 'all',
    activeBoardCategory !== 'All',
    activeBoardStatus !== 'open',
    activeBoardSort !== 'volume',
  ].filter(Boolean).length

  const applyMobileFilters = () => {
    startTransition(() => {
      setActiveBoardCategory(draftBoardCategory)
      setActiveBoardStatus(draftBoardStatus)
      setActiveBoardSort(draftBoardSort)
    })

    void navigate({
      replace: true,
      resetScroll: false,
      search: (current): AppSearch => {
        const nextSearch: AppSearch = { ...current }

        if (draftProviderId === 'all') {
          delete nextSearch.provider
        } else {
          nextSearch.provider = draftProviderId
        }

        return nextSearch
      },
      to: '.',
    })

    setIsMobileFiltersOpen(false)
  }

  const resetMobileFilters = () => {
    setDraftProviderId('all')
    setDraftBoardCategory('All')
    setDraftBoardStatus('open')
    setDraftBoardSort('volume')
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5 lg:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_360px]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Signal feed</span>
              {isSignalsRefreshing ? (
                <RefreshBadge label="Refreshing" />
              ) : null}
              <span className="terminal-chip text-[11px] uppercase tracking-[0.18em]">
                Polymarket wallets
              </span>
              <span className="terminal-chip text-[11px] uppercase tracking-[0.18em]">
                {formatCompactNumber(smartMoneySignals.length)} recent signals
              </span>
              <span className="terminal-chip text-[11px] uppercase tracking-[0.18em]">
                {formatMoney(smartMoneyFlow)} tracked size
              </span>
            </div>

            <div>
              <div className="section-kicker">What the crowd is saying now</div>
              <h1 className="mt-3 text-[24px] font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--color-text-primary)] sm:text-[28px] lg:text-[40px]">
                High-score wallets are opening fresh positions.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base sm:leading-7">
                The homepage now leads with owned Smart Money flow. These are recent qualifying positions from the highest-scoring wallets in the stored Polymarket snapshot, with current pricing context carried alongside each entry.
              </p>
            </div>

            {smartMoneySignalsQuery.isLoading && !smartMoneySignals.length ? (
              <SignalCardsLoadingState count={2} />
            ) : null}

            {smartMoneySignalsQuery.error ? (
              <div className="panel-elevated p-6 text-[var(--color-down)]">
                {(smartMoneySignalsQuery.error as Error).message}
              </div>
            ) : null}

            {!smartMoneySignalsQuery.isLoading &&
            !smartMoneySignalsQuery.error &&
            !smartMoneySignals.length ? (
              <div className="panel-elevated p-6 text-sm leading-7 text-[var(--color-text-secondary)]">
                No qualifying Smart Money signals are stored yet. The wallet snapshot has loaded, but no recent buys currently clear the homepage threshold.
              </div>
            ) : null}

            {smartMoneySignals.length ? (
              <div className="space-y-4">
                {smartMoneySignals.map((signal) => (
                  <SignalCard key={signal.id} signal={signal} />
                ))}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                className="terminal-button terminal-button-primary w-full text-sm font-medium sm:w-auto"
                {...getSmartMoneyRoute()}
              >
                Open signal feed
              </Link>
              <Link
                className="terminal-button w-full text-sm font-medium sm:w-auto"
                {...getSmartMoneyLeaderboardRoute()}
              >
                View whale leaderboard
              </Link>
            </div>
          </div>

          <div className="hidden space-y-4 lg:block">
            <section className="panel-elevated p-4">
              <SectionHeader
                description="Compact reads on the heaviest names in the book."
                kicker="Trending"
                status={isEventsRefreshing ? <RefreshBadge /> : null}
                title="High-volume markets"
              />
              <div className="mt-4 space-y-3">
                {eventsQuery.isLoading && !trendingSidebarEvents.length ? (
                  <CompactCardsLoadingState count={3} />
                ) : (
                  trendingSidebarEvents.map((event) => (
                    <CompactMarketCard event={event} key={event.id} />
                  ))
                )}
              </div>
            </section>

            <section className="panel-elevated p-4">
              <SectionHeader
                description="The widest stored cross-platform spreads."
                kicker="Top divergence"
                status={isDivergenceRefreshing ? <RefreshBadge /> : null}
                title="Where venues disagree"
              />
              <div className="mt-4 space-y-3">
                {divergenceQuery.isLoading && !topDivergences.length ? (
                  <CompactCardsLoadingState count={2} />
                ) : topDivergences.length ? topDivergences.map((entry) => (
                  <Link
                    className="panel-elevated block p-4 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)]"
                    key={entry.linkId}
                    {...getEventCompareRoute(entry.events[0].event)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {entry.events.map((item) => (
                          <PlatformBadge
                            key={item.event.id}
                            platform={item.event.provider}
                            short
                            size="sm"
                          />
                        ))}
                      </div>
                      <div className="mono-data text-sm text-[var(--color-signal)]">
                        {formatProbabilityPoints(entry.maxDivergence)}
                      </div>
                    </div>
                    <div className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--color-text-primary)]">
                      {entry.title}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-[var(--color-text-secondary)]">
                      <span>{entry.category}</span>
                      <span>{Math.round(entry.confidence * 100)}% confidence</span>
                    </div>
                  </Link>
                )) : (
                  <div className="panel-elevated p-4 text-sm leading-6 text-[var(--color-text-secondary)]">
                    Divergence matches are still being computed for this board.
                  </div>
                )}
              </div>
            </section>

            <section className="panel-elevated p-4">
              <SectionHeader
                description="Highest-ranked wallets plus a one-line read on their most recent qualifying signal."
                kicker="Top whales"
                status={isWalletsRefreshing ? <RefreshBadge /> : null}
                title="Wallets to watch"
              />
              <div className="mt-4 space-y-3">
                {smartMoneyWalletsQuery.isLoading && !topWhales.length ? (
                  <CompactCardsLoadingState count={3} />
                ) : null}

                {smartMoneyWalletsQuery.error ? (
                  <div className="panel-elevated p-4 text-sm leading-6 text-[var(--color-down)]">
                    {(smartMoneyWalletsQuery.error as Error).message}
                  </div>
                ) : null}

                {topWhales.map((wallet) => (
                  <TopWhaleHomeRow
                    key={wallet.address}
                    signal={latestSignalByWallet.get(wallet.address)}
                    wallet={wallet}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
        <div className="space-y-6">
          <section className="panel p-4 sm:p-5">
            <SectionHeader
              description="Use the shell venue tabs and category desks to tighten the main board without leaving the homepage feed."
              kicker="Discovery"
              status={isBoardRefreshing ? <RefreshBadge /> : null}
              title="Scan the board"
            />

            <div className="mt-5 hidden flex-col gap-3 lg:flex lg:flex-row lg:flex-wrap lg:items-start">
              <div className="space-y-2 lg:min-w-[18rem] lg:flex-1">
                <div className="section-kicker">Category</div>
                <div className="flex flex-wrap gap-2">
                  {boardCategories.map((category) => (
                    <button
                      className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
                        effectiveCategory === category
                          ? 'border-[var(--color-brand)] bg-[rgba(0,197,142,0.15)] text-[var(--color-brand)]'
                          : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                      }`}
                      key={category}
                      onClick={() => {
                        startTransition(() => {
                          setActiveBoardCategory(category)
                        })
                      }}
                      type="button"
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 lg:hidden">
              <button
                className="terminal-button w-full justify-center text-sm font-medium"
                onClick={() => {
                  setIsMobileFiltersOpen(true)
                }}
                type="button"
              >
                {mobileActiveFilterCount > 0
                  ? `Filters · ${mobileActiveFilterCount} active`
                  : 'Filters'}
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader
              description="The main board ranks the open market tape by traded volume. Start here before moving into divergence or a vertical desk."
              kicker="Main board"
              status={isBoardRefreshing ? <RefreshBadge /> : null}
              title="Where order flow is thickest"
            />

            {boardEventsQuery.isLoading ? (
              <MarketRowsLoadingState count={4} />
            ) : null}

            {boardEventsQuery.error ? (
              <div className="panel p-6 text-[var(--color-down)]">
                {(boardEventsQuery.error as Error).message}
              </div>
            ) : null}

            {!boardEventsQuery.isLoading && !boardEventsQuery.error && !hasBoardResults ? (
              <div className="panel p-6 text-[var(--color-text-secondary)]">
                No markets matched this venue and desk combination.
              </div>
            ) : null}

            <div className="grid gap-4 md:hidden">
              {volumeLeaders.map((event) => (
                <MarketCard event={event} key={event.id} />
              ))}
            </div>

            <div className="hidden space-y-3 md:block">
              {volumeLeaders.map((event) => (
                <MarketRow event={event} key={event.id} />
              ))}
            </div>
          </section>

          <DeskTabs
            activeTabId={activeTabId}
            defaultTabId="briefing"
            items={[
              {
                content: (
                  <div className="space-y-5">
                    <div className="panel-elevated p-4">
                      <div className="stat-label">Largest repricing sampled</div>
                      <div className="mt-3 text-xl font-medium leading-snug text-[var(--color-text-primary)]">
                        {leadMover?.event.title ?? 'Waiting for mover data'}
                      </div>
                      <div className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)]">
                        {leadMover
                          ? getMarketStance(leadMover.currentPrice)
                          : 'We sample high-volume names and compare them with prior daily history to surface actual repricings.'}
                      </div>
                      {leadMover ? (
                        <div className="signal-chip terminal-chip mt-4">
                          {formatSignedProbabilityChange(
                            getMoverChange(leadMover, activeMoverWindow),
                          )}{' '}
                          over {activeMoverWindow.toUpperCase()}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="metric-card">
                        <div className="stat-label">Open names</div>
                        <strong>{formatCompactNumber(events.length)}</strong>
                      </div>
                      <div className="metric-card">
                        <div className="stat-label">Tracked desks</div>
                        <strong>{formatCompactNumber(categories.length - 1)}</strong>
                      </div>
                      <div className="metric-card">
                        <div className="stat-label">Lead tempo</div>
                        <strong>{spotlight ? getTempoLabel(spotlight) : 'Loading'}</strong>
                      </div>
                    </div>
                  </div>
                ),
                description: 'A quick read on what is moving, how broad the board is, and how much tempo sits in the current lead story.',
                id: 'briefing',
                kicker: 'Morning briefing',
                label: 'Briefing',
                title: 'What the board is doing now',
              },
              {
                content: (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {MOVER_WINDOWS.map((window) => (
                          <button
                            className={`terminal-chip px-3 py-2 text-[11px] uppercase tracking-[0.18em] ${
                              activeMoverWindow === window.id
                                ? 'terminal-chip-active'
                                : 'border-[var(--color-border-subtle)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
                            }`}
                            key={window.id}
                            onClick={() => setActiveMoverWindow(window.id)}
                            type="button"
                          >
                            {window.label}
                          </button>
                        ))}
                      </div>
                      <div className="section-kicker">Moving up</div>
                      {moversUp.map((mover) => (
                        <MarketRow
                          accent="positive"
                          change={getMoverChange(mover, activeMoverWindow)}
                          event={mover.event}
                          key={`${mover.event.id}-up-${activeMoverWindow}`}
                        />
                      ))}
                    </div>
                    <div className="space-y-4">
                      <div className="section-kicker">Moving down</div>
                      {moversDown.map((mover) => (
                        <MarketRow
                          accent="negative"
                          change={getMoverChange(mover, activeMoverWindow)}
                          event={mover.event}
                          key={`${mover.event.id}-down-${activeMoverWindow}`}
                        />
                      ))}
                    </div>
                  </div>
                ),
                description: 'Repricing is now window-aware. Switch between one hour, six hours, and one day to separate fresh shocks from slower drifts.',
                id: 'repricing',
                kicker: 'Repricing',
                label: 'Repricing',
                title: 'Biggest moves',
              },
              {
                content: (
                  <div className="space-y-4">
                    {tightRaces.map((event) => (
                      <MarketRow event={event} key={event.id} />
                    ))}
                  </div>
                ),
                description: 'These are the names nearest the middle, where conviction is weakest and new information can still swing the board.',
                id: 'closest',
                kicker: 'Closest calls',
                label: 'Closest Calls',
                title: 'Markets that can still flip',
              },
              {
                content: (
                  <div className="space-y-4">
                    {highVelocity.map((event) => (
                      <MarketRow event={event} key={event.id} />
                    ))}
                  </div>
                ),
                description: 'Velocity blends traded volume, liquidity, and order count so the desk can surface names that are heating up before they become obvious by volume alone.',
                id: 'velocity',
                kicker: 'Velocity',
                label: 'Velocity',
                title: 'Fast tape names',
              },
            ]}
            onTabChange={setActiveTabId}
          />
        </div>

        <aside className="hidden space-y-4 xl:block">
          <section className="panel p-4">
            <SectionHeader
              description="Quick entry points into the busiest desks."
              kicker="Desks"
              title="Verticals to follow"
            />
            <div className="mt-4 space-y-3">
              {categoryDesks.map((desk) => (
                <Link
                  className="panel-elevated block p-4 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)]"
                  key={desk.category}
                  {...getCategoryRoute(getCategorySlug(desk.category))}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="section-kicker">{desk.category}</div>
                    <div className="mono-data text-sm text-[var(--color-text-secondary)]">
                      {formatCompactNumber(desk.count)}
                    </div>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-[var(--color-text-primary)]">
                    {desk.lead?.title}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-[var(--color-text-secondary)]">
                    <span>{desk.venueLabel}</span>
                    <span className="mono-data">
                      {desk.lead
                        ? formatMoney(desk.lead.totalVolume, getEventMoneyUnit(desk.lead))
                        : '—'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>

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
              onClick={resetMobileFilters}
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
            <div className="section-kicker">Platform</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {PROVIDER_FILTER_IDS.map((providerId) => (
                <button
                  className={`venue-filter-pill shrink-0 ${draftProviderId === providerId ? '' : ''}`}
                  data-active={draftProviderId === providerId ? 'true' : 'false'}
                  key={providerId}
                  onClick={() => {
                    setDraftProviderId(providerId)
                  }}
                  type="button"
                >
                  {providerId === 'all' ? 'all venues' : providerId}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="section-kicker">Category</div>
            <div className="flex flex-wrap gap-2">
              {boardCategories.map((category) => (
                <button
                  className={`venue-filter-pill ${draftBoardCategory === category ? '' : ''}`}
                  data-active={draftBoardCategory === category ? 'true' : 'false'}
                  key={category}
                  onClick={() => {
                    setDraftBoardCategory(category)
                  }}
                  type="button"
                >
                  {category.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="section-kicker">Status</div>
            <div className="flex gap-2">
              {BOARD_STATUS_IDS.map((statusId) => (
                <button
                  className="venue-filter-pill flex-1 justify-center"
                  data-active={draftBoardStatus === statusId ? 'true' : 'false'}
                  key={statusId}
                  onClick={() => {
                    setDraftBoardStatus(statusId)
                  }}
                  type="button"
                >
                  {statusId}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="section-kicker" htmlFor="markets-sort-select">
              Sort
            </label>
            <select
              className="h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 text-[14px] text-[var(--color-text-primary)]"
              id="markets-sort-select"
              onChange={(event) => {
                setDraftBoardSort(event.target.value as (typeof BOARD_SORT_IDS)[number])
              }}
              value={draftBoardSort}
            >
              <option value="volume">Highest volume</option>
              <option value="activity">Fastest tape</option>
              <option value="tight">Closest calls</option>
            </select>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
