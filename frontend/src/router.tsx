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
import { SiteShell } from './components/site-shell'

export type AppSearch = Record<string, string | undefined>

const HomePage = lazy(async () => ({
  default: (await import('./routes/home-page')).HomePage,
}))
const EventPage = lazy(async () => ({
  default: (await import('./routes/event-page')).EventPage,
}))
const CategoryPage = lazy(async () => ({
  default: (await import('./routes/category-page')).CategoryPage,
}))
const DivergencePage = lazy(async () => ({
  default: (await import('./routes/divergence-page')).DivergencePage,
}))
const NotFoundPage = lazy(async () => ({
  default: (await import('./routes/not-found-page')).NotFoundPage,
}))

function RouteSkeleton() {
  return (
    <div className="panel p-8 text-[var(--color-text-secondary)]">
      Loading view...
    </div>
  )
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
  component: withSuspense(HomePage),
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

const routeTree = rootRoute.addChildren([
  homeRoute,
  eventRoute,
  eventSlugRoute,
  categoryRoute,
  divergenceRoute,
])

export const router = createRouter({
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
