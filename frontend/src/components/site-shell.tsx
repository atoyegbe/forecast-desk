import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
  useSearch,
} from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '../features/auth/context'
import { useDisplayCurrency } from '../features/currency/context'
import type { PulseDisplayCurrency } from '../features/currency/types'
import {
  useRuntimeFreshnessLabel,
  useRuntimeLiveConnection,
  type RuntimeConnectionState,
} from '../features/runtime/hooks'
import type { AppSearch } from '../router'
import { getAlertsRoute } from '../lib/routes'
import { AuthDialog } from './auth-dialog'
import { LiveTicker } from './live-ticker'

const THEME_STORAGE_KEY = 'quorum-theme'
const LEGACY_THEME_STORAGE_KEY = 'naijapulse-theme'

const primaryNav = [
  { end: true, label: 'Markets', to: '/' },
  { label: 'Divergence', to: '/divergence' },
  { label: 'Smart Money', to: '/smart-money' },
  { label: 'Politics', to: '/categories/politics' },
  { label: 'Sports', to: '/categories/sports' },
  { label: 'Finance', to: '/categories/finance' },
]

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
  return pathname === '/' || pathname === '/search' || pathname.startsWith('/categories/')
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
  if (item.end) {
    return pathname === item.to
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

function ShellNavLink({
  item,
  mobile = false,
}: {
  item: (typeof primaryNav)[number]
  mobile?: boolean
}) {
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
      className={
        mobile
          ? `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs transition ${
              isActive
                ? 'bg-[var(--color-brand-dim)] text-[var(--color-brand)]'
                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
            }`
          : 'nav-link'
      }
      data-active={!mobile && isActive ? 'true' : 'false'}
      key={item.to}
      search={
        preserveProvider
          ? (current): AppSearch => applyProviderSearch(current, currentProvider)
          : undefined
      }
      to={item.to}
    >
      <span>{item.label}</span>
      {mobile ? null : null}
    </Link>
  )
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

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 16 16"
      width="16"
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
      height="16"
      viewBox="0 0 16 16"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M13 8A5 5 0 1 1 6 3a4 4 0 0 0 7 5z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 16 16"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="7"
        cy="7"
        r="4.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <line
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        x1="10.5"
        x2="14"
        y1="10.5"
        y2="14"
      />
    </svg>
  )
}

function LiveStatusPill({
  freshnessLabel,
  status,
}: {
  freshnessLabel: string
  status: RuntimeConnectionState
}) {
  const label =
    status === 'connected'
      ? freshnessLabel
      : status === 'reconnecting'
        ? 'Reconnecting'
        : 'Offline'

  return (
    <div
      className="nav-status-pill"
      data-state={status}
      role="status"
    >
      <span className="nav-status-dot" />
      <span className="nav-status-label">{label}</span>
    </div>
  )
}

export function SiteShell() {
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme)
  const navigate = useNavigate()
  const {
    isAuthenticated,
    openAuthDialog,
    signOut,
    user,
  } = useAuth()
  const {
    availableCurrencies,
    displayCurrency,
    setDisplayCurrency,
  } = useDisplayCurrency()
  const runtimeConnectionStatus = useRuntimeLiveConnection()
  const freshnessLabel = useRuntimeFreshnessLabel()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const search = useSearch({ strict: false })
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

  return (
    <div className="min-h-screen">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--color-bg-elevated)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--color-text-primary)]"
        href="#main-content"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b border-[var(--color-border-subtle)] bg-[var(--surface-shell-bg)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1380px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            className="flex shrink-0 items-center gap-3"
            search={(current): AppSearch =>
              applyProviderSearch(current, currentProvider)
            }
            to="/"
          >
            <img
              alt=""
              aria-hidden="true"
              className="h-8 w-8 shrink-0"
              height="32"
              src="/logo-symbol-consensus-q-transparent.svg"
              width="32"
            />
            <span className="font-mono text-[0.98rem] font-medium uppercase tracking-[0.28em] text-[var(--color-text-primary)]">
              Quorum
            </span>
          </Link>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-5 md:flex"
          >
            {primaryNav.map((item) => (
              <ShellNavLink item={item} key={item.to} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <label className="shell-select-wrapper" htmlFor="display-currency">
              <span className="sr-only">Display currency</span>
              <select
                className="shell-select"
                id="display-currency"
                onChange={(event) => {
                  setDisplayCurrency(event.target.value as PulseDisplayCurrency)
                }}
                title="Display currency"
                value={displayCurrency}
              >
                {availableCurrencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>

            <Link
              className={`hidden sm:inline-flex ${
                isAlertsRoute
                  ? 'terminal-button terminal-button-primary text-sm font-medium'
                  : 'terminal-button text-sm font-medium'
              }`}
              {...getAlertsRoute()}
            >
              Alerts
            </Link>

            <Link
              aria-label="Open search"
              className="shell-icon-button"
              data-active={isSearchRoute ? 'true' : 'false'}
              search={(current): AppSearch =>
                applyProviderSearch(current, currentProvider)
              }
              title="Open search"
              to="/search"
            >
              <SearchIcon />
            </Link>

            <LiveStatusPill
              freshnessLabel={freshnessLabel}
              status={runtimeConnectionStatus}
            />

            {isAuthenticated ? (
              <>
                <span className="hidden rounded-lg border border-[var(--color-border)] bg-[var(--surface-control-bg)] px-3 py-2 text-sm text-[var(--color-text-secondary)] lg:inline-flex">
                  {user?.email}
                </span>
                <button
                  className="terminal-button text-sm font-medium"
                  onClick={() => {
                    void signOut()
                  }}
                  type="button"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                className="terminal-button text-sm font-medium"
                onClick={() => openAuthDialog()}
                type="button"
              >
                Sign in
              </button>
            )}

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
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              type="button"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>

        {showVenueFilter ? (
          <div className="border-t border-[var(--color-border-subtle)]">
            <div className="mx-auto flex max-w-[1380px] items-center gap-3 overflow-x-auto px-4 py-2 sm:px-6">
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

      <div className="mx-auto max-w-[1380px] px-4 py-3 sm:px-6 sm:py-4">
        <LiveTicker />

        <main className="pb-24 pt-4" id="main-content">
          <Outlet />
        </main>

        <footer className="mt-6 flex flex-col gap-2 border-t border-[var(--color-border-subtle)] px-1 pt-4 text-sm text-[var(--color-text-secondary)] sm:flex-row sm:items-center sm:justify-between">
          <p>Owned market API, stored history, compare, and backend live fan-out.</p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
            Quorum is for reading public markets, not placing trades.
          </p>
        </footer>
      </div>

      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--surface-shell-mobile-bg)] px-3 py-2 backdrop-blur-md md:hidden"
      >
        <div className="mx-auto flex max-w-[1380px] items-center gap-1">
          {primaryNav.map((item) => (
            <ShellNavLink item={item} key={item.to} mobile />
          ))}
        </div>
      </nav>

      <AuthDialog />
    </div>
  )
}
