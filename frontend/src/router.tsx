import {
  type ComponentType,
  type LazyExoticComponent,
  Suspense,
  lazy,
} from 'react'
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { RouteLoadingState } from './components/loading-state'
import { SiteShell } from './components/site-shell'
import { HomePage } from './routes/home-page'

export type AppSearch = Record<string, string | undefined>

const EventPage = lazy(async () => ({
  default: (await import('./routes/event-page')).EventPage,
}))
const CategoryPage = lazy(async () => ({
  default: (await import('./routes/category-page')).CategoryPage,
}))
const DivergencePage = lazy(async () => ({
  default: (await import('./routes/divergence-page')).DivergencePage,
}))
const AlertsPage = lazy(async () => ({
  default: (await import('./routes/alerts-page')).AlertsPage,
}))
const EventComparePage = lazy(async () => ({
  default: (await import('./routes/event-compare-page')).EventComparePage,
}))
const SearchPage = lazy(async () => ({
  default: (await import('./routes/search-page')).SearchPage,
}))
const SmartMoneyPage = lazy(async () => ({
  default: (await import('./routes/smart-money-page')).SmartMoneyPage,
}))
const SmartMoneyLeaderboardPage = lazy(async () => ({
  default: (await import('./routes/smart-money-leaderboard-page')).SmartMoneyLeaderboardPage,
}))
const SmartMoneyWalletPage = lazy(async () => ({
  default: (await import('./routes/smart-money-wallet-page')).SmartMoneyWalletPage,
}))
const NotFoundPage = lazy(async () => ({
  default: (await import('./routes/not-found-page')).NotFoundPage,
}))

function RouteSkeleton() {
  return <RouteLoadingState />
}

function withSuspense(Component: LazyExoticComponent<ComponentType>) {
  return function SuspendedRouteComponent() {
    return (
      <Suspense fallback={<RouteSkeleton />}>
        <Component />
      </Suspense>
    )
  }
}

const rootRoute = createRootRoute({
  component: SiteShell,
  notFoundComponent: withSuspense(NotFoundPage),
  validateSearch: (search): AppSearch => {
    const normalizedSearch: AppSearch = {}

    for (const [key, value] of Object.entries(search)) {
      if (typeof value === 'string') {
        normalizedSearch[key] = value
      } else if (value !== null && value !== undefined) {
        normalizedSearch[key] = String(value)
      }
    }

    return normalizedSearch
  },
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const eventRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'events/$eventId',
  component: withSuspense(EventPage),
})

const eventSlugRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'events/$eventId/$slug',
  component: withSuspense(EventPage),
})

const eventCompareRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'events/$eventId/compare',
  component: withSuspense(EventComparePage),
})

const eventCompareSlugRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'events/$eventId/$slug/compare',
  component: withSuspense(EventComparePage),
})

const categoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'categories/$categorySlug',
  component: withSuspense(CategoryPage),
})

const divergenceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'divergence',
  component: withSuspense(DivergencePage),
})

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'search',
  component: withSuspense(SearchPage),
})

const alertsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'alerts',
  component: withSuspense(AlertsPage),
})

const smartMoneyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'smart-money',
  component: withSuspense(SmartMoneyPage),
})

const smartMoneyLeaderboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'smart-money/leaderboard',
  component: withSuspense(SmartMoneyLeaderboardPage),
})

const smartMoneyWalletRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'smart-money/wallets/$walletAddress',
  component: withSuspense(SmartMoneyWalletPage),
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  eventRoute,
  eventSlugRoute,
  eventCompareRoute,
  eventCompareSlugRoute,
  categoryRoute,
  divergenceRoute,
  searchRoute,
  alertsRoute,
  smartMoneyRoute,
  smartMoneyLeaderboardRoute,
  smartMoneyWalletRoute,
])

export const router = createRouter({
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 60_000,
  routeTree,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />
}
