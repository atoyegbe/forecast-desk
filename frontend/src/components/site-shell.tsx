import {
  Link,
  Outlet,
  useRouterState,
} from '@tanstack/react-router'
import { useState } from 'react'
import {
  useRuntimeFreshnessLabel,
  useRuntimeLiveConnection,
  type RuntimeConnectionState,
} from '../features/runtime/hooks'
import { LiveTicker } from './live-ticker'

const THEME_STORAGE_KEY = 'quorum-theme'
const LEGACY_THEME_STORAGE_KEY = 'naijapulse-theme'

const primaryNav = [
  { end: true, label: 'Markets', to: '/' },
  { label: 'Divergence', to: '/divergence' },
  { label: 'Politics', to: '/categories/politics' },
  { label: 'Sports', to: '/categories/sports' },
  { label: 'Finance', to: '/categories/finance' },
]

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
  const isActive = isNavItemActive(pathname, item)

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
  const runtimeConnectionStatus = useRuntimeLiveConnection()
  const freshnessLabel = useRuntimeFreshnessLabel()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isSearchRoute = pathname === '/search'

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
          <Link className="flex shrink-0 items-center gap-3" to="/">
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
            <Link
              aria-label="Open search"
              className="shell-icon-button"
              data-active={isSearchRoute ? 'true' : 'false'}
              title="Open search"
              to="/search"
            >
              <SearchIcon />
            </Link>

            <LiveStatusPill
              freshnessLabel={freshnessLabel}
              status={runtimeConnectionStatus}
            />

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
    </div>
  )
}
