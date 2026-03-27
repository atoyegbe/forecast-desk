import {
  Link,
  Outlet,
  useRouterState,
} from '@tanstack/react-router'
import {
  useEffect,
  useState,
} from 'react'
import { useBackendHealthQuery } from '../features/runtime/hooks'
import { LiveTicker } from './live-ticker'

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

export function SiteShell() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const backendHealthQuery = useBackendHealthQuery()

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('naija-pulse-theme')
    const nextTheme = storedTheme === 'light' ? 'light' : 'dark'
    setTheme(nextTheme)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('naija-pulse-theme', theme)
  }, [theme])

  const backendConnectionState = backendHealthQuery.isSuccess
    ? 'connected'
    : backendHealthQuery.isError
      ? 'offline'
      : 'connecting'
  const backendContractLabel =
    backendConnectionState === 'connected'
      ? 'Backend live'
      : backendConnectionState === 'offline'
        ? 'Backend offline'
        : 'Checking backend'

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--color-border-subtle)] bg-[rgba(13,15,16,0.88)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1380px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            className="shrink-0 font-mono text-[0.98rem] font-medium uppercase tracking-[0.28em]"
            to="/"
          >
            <span className="text-[var(--color-text-primary)]">Naija</span>
            <span className="text-[var(--color-brand)]">Pulse</span>
          </Link>

          <nav className="hidden items-center gap-5 md:flex">
            {primaryNav.map((item) => (
              <ShellNavLink item={item} key={item.to} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 lg:flex">
              <span
                className={`live-dot ${
                  backendConnectionState === 'offline'
                    ? 'offline'
                    : backendConnectionState === 'connecting'
                      ? 'warn'
                      : ''
                }`}
              />
              <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                {backendContractLabel}
              </span>
            </div>

            <button
              className="terminal-button px-3 py-2 text-[11px] uppercase tracking-[0.16em]"
              onClick={() => {
                setTheme((currentTheme) =>
                  currentTheme === 'dark' ? 'light' : 'dark',
                )
              }}
              type="button"
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1380px] px-4 py-3 sm:px-6 sm:py-4">
        <LiveTicker />

        <main className="pb-24 pt-4">
          <Outlet />
        </main>

        <footer className="mt-6 flex flex-col gap-2 border-t border-[var(--color-border-subtle)] px-1 pt-4 text-sm text-[var(--color-text-secondary)] sm:flex-row sm:items-center sm:justify-between">
          <p>Owned market API, stored history, compare, and backend live fan-out.</p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
            NaijaPulse is for reading public markets, not placing trades.
          </p>
        </footer>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[rgba(13,15,16,0.94)] px-3 py-2 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-[1380px] items-center gap-1">
          {primaryNav.map((item) => (
            <ShellNavLink item={item} key={item.to} mobile />
          ))}
        </div>
      </nav>
    </div>
  )
}
