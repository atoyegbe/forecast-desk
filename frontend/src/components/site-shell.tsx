import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
  useSearch,
} from '@tanstack/react-router'
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAlertSubscriptionsQuery } from '../features/alerts/hooks'
import { useAuth } from '../features/auth/context'
import {
  useRuntimeFreshnessLabel,
  useRuntimeLiveConnection,
  type RuntimeConnectionState,
} from '../features/runtime/hooks'
import type { AppSearch } from '../router'
import {
  getAlertsRoute,
} from '../lib/routes'
import { AuthDialog } from './auth-dialog'
import { LiveTicker } from './live-ticker'

const THEME_STORAGE_KEY = 'quorum-theme'
const LEGACY_THEME_STORAGE_KEY = 'naijapulse-theme'

const primaryNav = [
  { label: 'Markets', to: '/markets' },
  { label: 'Divergence', to: '/divergence' },
  { label: 'Smart Money', to: '/smart-money' },
  { label: 'Politics', to: '/categories/politics' },
  { label: 'Sports', to: '/categories/sports' },
  { label: 'Finance', to: '/categories/finance' },
]

const footerNav = [
  { label: 'Markets', to: '/markets' },
  { label: 'Divergence', to: '/divergence' },
  { label: 'Smart Money', to: '/smart-money' },
  { label: 'About', to: '/' },
] as const

const venueNav = [
  { id: 'all', label: 'All venues' },
  { id: 'bayse', label: 'Bayse' },
  { id: 'kalshi', label: 'Kalshi' },
  { id: 'manifold', label: 'Manifold' },
  { id: 'polymarket', label: 'Polymarket' },
] as const

type VenueFilterId = (typeof venueNav)[number]['id']

function isVenueFilterId(value: string | null | undefined): value is VenueFilterId {
  return venueNav.some((item) => item.id === value)
}

function shouldShowVenueFilter(pathname: string) {
  return pathname === '/markets' || pathname === '/search' || pathname.startsWith('/categories/')
}

function applyProviderSearch(
  current: AppSearch,
  provider: VenueFilterId | undefined,
): AppSearch {
  const nextSearch: AppSearch = { ...current }

  if (!provider || provider === 'all') {
    delete nextSearch.provider
  } else {
    nextSearch.provider = provider
  }

  return nextSearch
}

function isNavItemActive(
  pathname: string,
  item: (typeof primaryNav)[number],
) {
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

function getInitialTheme() {
  const currentTheme = document.documentElement.dataset.theme

  if (currentTheme === 'light' || currentTheme === 'dark') {
    return currentTheme
  }

  const storedTheme =
    window.localStorage.getItem(THEME_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)

  return storedTheme === 'light' ? 'light' : 'dark'
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="15"
      viewBox="0 0 16 16"
      width="15"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="7"
        cy="7"
        r="4.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
        x1="10.5"
        x2="14"
        y1="10.5"
        y2="14"
      />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="15"
      viewBox="0 0 16 16"
      width="15"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.333 12.6667H10.6663M6.66634 14.0001H9.33301M4.66634 6.66675C4.66634 4.8258 6.15972 3.33341 8.00067 3.33341C9.84162 3.33341 11.335 4.8258 11.335 6.66675V8.2761C11.335 8.65811 11.4814 9.0256 11.744 9.30308L12.5787 10.1848C13.0888 10.7238 12.7068 11.6001 11.9647 11.6001H4.03663C3.29455 11.6001 2.91257 10.7238 3.42263 10.1848L4.25736 9.30308C4.51995 9.0256 4.66634 8.65811 4.66634 8.2761V6.66675Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      viewBox="0 0 16 16"
      width="14"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        x1="8"
        x2="8"
        y1="1"
        y2="3"
      />
      <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        x1="8"
        x2="8"
        y1="13"
        y2="15"
      />
      <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        x1="1"
        x2="3"
        y1="8"
        y2="8"
      />
      <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        x1="13"
        x2="15"
        y1="8"
        y2="8"
      />
      <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        x1="3.05"
        x2="4.45"
        y1="3.05"
        y2="4.45"
      />
      <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        x1="11.55"
        x2="12.95"
        y1="11.55"
        y2="12.95"
      />
      <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        x1="11.55"
        x2="12.95"
        y1="4.45"
        y2="3.05"
      />
      <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        x1="3.05"
        x2="4.45"
        y1="12.95"
        y2="11.55"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height="14"
      viewBox="0 0 16 16"
      width="14"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M13 8A5 5 0 1 1 6 3a4 4 0 0 0 7 5z" />
    </svg>
  )
}

function ShellNavLink({ item }: { item: (typeof primaryNav)[number] }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const search = useSearch({ strict: false })
  const isActive = isNavItemActive(pathname, item)
  const routeProvider =
    typeof search.provider === 'string' ? search.provider : undefined
  const currentProvider = isVenueFilterId(routeProvider)
    ? routeProvider
    : undefined
  const preserveProvider = shouldShowVenueFilter(item.to)

  return (
    <Link
      aria-current={isActive ? 'page' : undefined}
      className="nav-link"
      data-active={isActive ? 'true' : 'false'}
      search={
        preserveProvider
          ? (current): AppSearch => applyProviderSearch(current, currentProvider)
          : undefined
      }
      to={item.to}
    >
      <span>{item.label}</span>
    </Link>
  )
}

function MobileNavLink({
  currentProvider,
  item,
  pathname,
}: {
  currentProvider: VenueFilterId | undefined
  item: (typeof primaryNav)[number]
  pathname: string
}) {
  const isActive = isNavItemActive(pathname, item)

  return (
    <Link
      className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs transition ${
        isActive
          ? 'bg-[var(--color-brand-dim)] text-[var(--color-brand)]'
          : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
      }`}
      search={
        shouldShowVenueFilter(item.to)
          ? (current): AppSearch => applyProviderSearch(current, currentProvider)
          : undefined
      }
      to={item.to}
    >
      <span>{item.label}</span>
    </Link>
  )
}

function LiveStatusPill({
  status,
  updatedLabel,
}: {
  status: RuntimeConnectionState
  updatedLabel: string
}) {
  const label =
    status === 'connected'
      ? updatedLabel
      : status === 'reconnecting'
        ? 'Reconnecting'
        : 'Offline'

  return (
    <div className="nav-status-pill" data-state={status} role="status">
      <span className="nav-status-dot" />
      <span className="nav-status-label">{label}</span>
    </div>
  )
}

function Divider() {
  return <span aria-hidden="true" className="shell-divider" />
}

function IconButtonTooltip({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <div className="relative group/tooltip">
      {children}
      <div className="pointer-events-none absolute top-full right-0 z-20 mt-2 min-w-max rounded-md border border-[var(--surface-tooltip-border)] bg-[var(--surface-tooltip-bg)] px-2 py-1 text-[11px] text-[var(--surface-tooltip-text)] opacity-0 shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition-opacity duration-150 delay-[400ms] group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100">
        {label}
      </div>
    </div>
  )
}

function UserAvatar({ email }: { email: string }) {
  return (
    <span className="shell-avatar">
      {email[0]?.toUpperCase() ?? 'Q'}
    </span>
  )
}

function getLiveFreshnessLabel(freshnessLabel: string) {
  return freshnessLabel.replace(/^Updated\s+/i, '')
}

function GlobalFooter() {
  return (
    <footer className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-5 py-4 md:px-10 md:py-0">
      <div className="mx-auto flex min-h-[52px] max-w-[1380px] flex-col justify-center gap-[10px] md:flex-row md:items-center md:justify-between">
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-5">
          {footerNav.map((item) => (
            <Link
              className="text-[12px] text-[var(--color-text-tertiary)] transition-colors duration-150 hover:text-[var(--color-text-secondary)]"
              key={item.to}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <p className="font-mono text-[11px] text-[color:rgba(85,96,104,0.7)]">
          Quorum is for reading public markets, not placing trades.
        </p>
      </div>
    </footer>
  )
}

export function SiteShell() {
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const navigate = useNavigate()
  const {
    consumePendingAction,
    isAuthenticated,
    openAuthDialog,
    pendingAction,
    signOut,
    user,
  } = useAuth()
  const alertsQuery = useAlertSubscriptionsQuery()
  const runtimeConnectionStatus = useRuntimeLiveConnection()
  const freshnessLabel = useRuntimeFreshnessLabel()
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const search = useSearch({ strict: false })
  const isLandingRoute = pathname === '/'
  const isAlertsRoute = pathname === '/alerts'
  const isSearchRoute = pathname === '/search'
  const showVenueFilter = shouldShowVenueFilter(pathname)
  const routeProvider =
    typeof search.provider === 'string' ? search.provider : undefined
  const currentProvider = isVenueFilterId(routeProvider)
    ? routeProvider
    : undefined
  const activeVenueFilter: VenueFilterId = isVenueFilterId(currentProvider)
    ? currentProvider
    : 'all'
  const hasActiveAlerts = Boolean(
    alertsQuery.data?.some((subscription) => subscription.status === 'active'),
  )
  const bellTooltip = isAuthenticated
    ? hasActiveAlerts
      ? 'Manage alerts'
      : 'Set up alerts'
    : 'Sign in to get alerts'

  useEffect(() => {
    if (!isAuthenticated || pendingAction?.type !== 'alerts-route') {
      return
    }

    consumePendingAction(pendingAction.id)
    void navigate(getAlertsRoute())
  }, [consumePendingAction, isAuthenticated, navigate, pendingAction])

  useEffect(() => {
    if (!isUserMenuOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isUserMenuOpen])

  return (
    <div className="flex min-h-screen flex-col">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--color-bg-elevated)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--color-text-primary)]"
        href="#main-content"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]">
        <div className="mx-auto flex h-[52px] max-w-[1380px] items-center px-6">
          <Link
            className="mr-8 flex shrink-0 items-center gap-[10px]"
            to="/"
          >
            <img
              alt=""
              aria-hidden="true"
              className="h-[22px] w-[22px] shrink-0"
              height="22"
              src="/logo-symbol-consensus-q-transparent.svg"
              width="22"
            />
            <span className="text-[14px] font-semibold tracking-[0.06em] text-[var(--color-text-primary)]">
              Quorum
            </span>
          </Link>

          <nav
            aria-label="Primary"
            className="hidden min-w-0 flex-1 items-center md:flex"
          >
            {primaryNav.map((item) => (
              <ShellNavLink item={item} key={item.to} />
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-[6px]">
            <LiveStatusPill
              status={runtimeConnectionStatus}
              updatedLabel={getLiveFreshnessLabel(freshnessLabel)}
            />

            <Divider />

            <Link
              aria-label="Open search"
              className="shell-icon-button"
              data-active={isSearchRoute ? 'true' : 'false'}
              search={(current): AppSearch =>
                applyProviderSearch(current, currentProvider)
              }
              to="/search"
            >
              <SearchIcon />
            </Link>

            <IconButtonTooltip label={bellTooltip}>
              {isAuthenticated ? (
                <Link
                  aria-label={bellTooltip}
                  className="shell-icon-button relative"
                  data-active={isAlertsRoute ? 'true' : 'false'}
                  {...getAlertsRoute()}
                >
                  <BellIcon />
                  {hasActiveAlerts ? <span className="shell-alert-dot" /> : null}
                </Link>
              ) : (
                <button
                  aria-label={bellTooltip}
                  className="shell-icon-button relative"
                  onClick={() => {
                    openAuthDialog({
                      pendingAction: {
                        type: 'alerts-route',
                      },
                    })
                  }}
                  type="button"
                >
                  <BellIcon />
                </button>
              )}
            </IconButtonTooltip>

            <button
              aria-label={
                theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
              }
              className="shell-icon-button"
              onClick={() => {
                setTheme((currentTheme) => {
                  const nextTheme =
                    currentTheme === 'dark' ? 'light' : 'dark'

                  document.documentElement.dataset.theme = nextTheme
                  window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)

                  return nextTheme
                })
              }}
              type="button"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            <Divider />

            {isAuthenticated ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="menu"
                  className="rounded-full"
                  onClick={() => {
                    setIsUserMenuOpen((current) => !current)
                  }}
                  type="button"
                >
                  <UserAvatar email={user?.email ?? 'q'} />
                </button>

                {isUserMenuOpen ? (
                  <div className="absolute top-full right-0 z-30 mt-1 min-w-[180px] rounded-[8px] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-[6px] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                    <div className="px-3 py-2 font-mono text-[12px] text-[var(--color-text-tertiary)]">
                      {user?.email}
                    </div>
                    <div className="mx-1 my-1 h-px bg-[var(--color-border-subtle)]" />
                    <Link
                      className="block rounded-[5px] px-3 py-2 text-[13px] text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-hover)]"
                      onClick={() => {
                        setIsUserMenuOpen(false)
                      }}
                      {...getAlertsRoute()}
                    >
                      Manage alerts
                    </Link>
                    <button
                      className="mt-1 block w-full rounded-[5px] px-3 py-2 text-left text-[13px] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-hover)]"
                      onClick={() => {
                        setIsUserMenuOpen(false)
                        void signOut()
                      }}
                      type="button"
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                className="shell-sign-in-button"
                onClick={() => openAuthDialog()}
                type="button"
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        {showVenueFilter ? (
          <div className="border-t border-[var(--color-border-subtle)]">
            <div className="mx-auto flex max-w-[1380px] items-center gap-3 overflow-x-auto px-6 py-2">
              <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                Venue
              </span>
              <div className="flex min-w-max gap-2">
                {venueNav.map((item) => (
                  <button
                    className={`terminal-chip px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] ${
                      activeVenueFilter === item.id
                        ? 'terminal-chip-active'
                        : 'border-[var(--color-border-subtle)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
                    }`}
                    key={item.id}
                    onClick={() => {
                      void navigate({
                        replace: true,
                        resetScroll: false,
                        search: (current): AppSearch => {
                          const nextSearch: AppSearch = { ...current }

                          if (item.id === 'all') {
                            delete nextSearch.provider
                          } else {
                            nextSearch.provider = item.id
                          }

                          return nextSearch
                        },
                        to: pathname,
                      })
                    }}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col">
        {isLandingRoute ? (
          <main
            className="flex flex-1 items-center justify-center px-6 py-10"
            id="main-content"
          >
            <Outlet />
          </main>
        ) : (
          <div className="mx-auto flex w-full max-w-[1380px] flex-1 flex-col px-4 py-3 sm:px-6 sm:py-4">
            <LiveTicker />

            <main className="flex-1 pb-24 pt-4" id="main-content">
              <Outlet />
            </main>
          </div>
        )}

        <GlobalFooter />
      </div>

      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--surface-shell-mobile-bg)] px-3 py-2 backdrop-blur-md md:hidden"
      >
        <div className="mx-auto flex max-w-[1380px] items-center gap-1">
          {primaryNav.map((item) => (
            <MobileNavLink
              currentProvider={currentProvider}
              item={item}
              key={item.to}
              pathname={pathname}
            />
          ))}
        </div>
      </nav>

      <AuthDialog />
    </div>
  )
}
