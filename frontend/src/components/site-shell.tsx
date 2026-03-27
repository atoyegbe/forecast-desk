import {
  NavLink,
  Outlet,
} from 'react-router-dom'
import { useBackendHealthQuery } from '../features/runtime/hooks'
import { LiveTicker } from './live-ticker'

const primaryNav = [
  { end: true, label: 'Front Page', to: '/' },
  { label: 'Politics', to: '/categories/politics' },
  { label: 'Culture', to: '/categories/culture' },
  { label: 'Sports', to: '/categories/sports' },
  { label: 'Finance', to: '/categories/finance' },
]

function getNavItemClass(isActive: boolean) {
  return [
    'flex items-center justify-between rounded-full border px-4 py-2 text-sm transition',
    isActive
      ? 'active-pill border-teal-800/10'
      : 'border-stone-900/10 bg-white text-stone-700 hover:border-stone-900/20 hover:bg-stone-950/[0.03] hover:text-stone-950',
  ].join(' ')
}

function getNavMetaClass(isActive: boolean) {
  return [
    'text-[0.66rem] uppercase tracking-[0.24em]',
    isActive ? 'opacity-70' : 'text-stone-500',
  ].join(' ')
}

export function SiteShell() {
  const backendHealthQuery = useBackendHealthQuery()
  const backendContractLabel = backendHealthQuery.isSuccess
    ? 'Backend online'
    : backendHealthQuery.isError
      ? 'Backend contract offline'
      : 'Checking backend contract'

  return (
    <div className="min-h-screen px-3 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-[1460px] lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-5">
        <aside className="hidden lg:block">
          <div className="sidebar-panel sticky top-5 space-y-6 p-5">
            <div>
              <div className="section-kicker">Edition 01</div>
              <h1 className="display-title mt-4 text-[2.7rem] leading-[0.95] text-stone-950">
                Pulse Markets
              </h1>
              <p className="mt-4 text-sm leading-7 text-stone-600">
                A newsroom-style interface for reading live public prediction
                markets without the noise of a trading terminal.
              </p>
            </div>

            <nav className="space-y-2">
              {primaryNav.map((item) => (
                <NavLink
                  className={({ isActive }) => getNavItemClass(isActive)}
                  end={item.end}
                  key={item.to}
                  to={item.to}
                >
                  {({ isActive }) => (
                    <>
                      <span>{item.label}</span>
                      <span className={getNavMetaClass(isActive)}>Edit</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="rounded-[1.45rem] border border-stone-900/10 bg-stone-950/[0.03] p-4">
              <div className="section-kicker">Method</div>
              <p className="mt-3 text-sm leading-7 text-stone-600">
                Read the board like a desk: lead story first, then repricings,
                closest calls, and the densest order flow.
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <header className="panel flex flex-col gap-4 p-4 sm:p-5 lg:hidden">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="section-kicker">Edition 01</div>
                <div className="display-title mt-3 text-3xl text-stone-950">
                  Pulse Markets
                </div>
              </div>
              <div className="rounded-full border border-stone-900/10 bg-stone-950 px-3 py-2 text-xs uppercase tracking-[0.24em] text-white">
                Live
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {primaryNav.map((item) => (
                <NavLink
                  className={({ isActive }) => getNavItemClass(isActive)}
                  end={item.end}
                  key={item.to}
                  to={item.to}
                >
                  {({ isActive }) => (
                    <span className={isActive ? 'text-white' : 'text-stone-700'}>
                      {item.label}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </header>

          <div className="panel flex flex-col gap-4 px-4 py-4 sm:px-5 sm:py-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="section-kicker">Live edition</div>
              <div className="display-title mt-3 text-3xl text-stone-950 sm:text-[2.7rem] sm:leading-[0.95]">
                Public prediction markets, arranged like a front page.
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm text-stone-700">
                Nigeria-first desk
              </div>
              <div className="rounded-full border border-stone-900/10 bg-stone-950 px-4 py-2 text-sm text-white">
                Live market radar
              </div>
            </div>
          </div>

          <LiveTicker />

          <main className="pb-14">
            <Outlet />
          </main>

          <footer className="panel flex flex-col gap-3 px-5 py-4 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between">
            <p>Built for market discovery, not order placement.</p>
            <div className="flex flex-col gap-2 sm:items-end">
              <p>Public Bayse and Polymarket data flow through the `/api` layer where needed.</p>
              <p
                className={
                  backendHealthQuery.isSuccess
                    ? 'text-teal-700'
                    : backendHealthQuery.isError
                      ? 'text-rose-700'
                      : 'text-stone-500'
                }
              >
                {backendContractLabel}
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
