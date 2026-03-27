import {
  Suspense,
  lazy,
} from 'react'
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import {
  RouterProvider,
  createBrowserRouter,
} from 'react-router-dom'
import { SiteShell } from './components/site-shell'

const HomePage = lazy(async () => ({
  default: (await import('./routes/home-page')).HomePage,
}))
const EventPage = lazy(async () => ({
  default: (await import('./routes/event-page')).EventPage,
}))
const CategoryPage = lazy(async () => ({
  default: (await import('./routes/category-page')).CategoryPage,
}))
const NotFoundPage = lazy(async () => ({
  default: (await import('./routes/not-found-page')).NotFoundPage,
}))
const ReactQueryDevtools = lazy(async () => ({
  default: (await import('@tanstack/react-query-devtools')).ReactQueryDevtools,
}))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
})

const router = createBrowserRouter([
  {
    path: '/',
    element: <SiteShell />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<RouteSkeleton />}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: 'events/:eventId/:slug?',
        element: (
          <Suspense fallback={<RouteSkeleton />}>
            <EventPage />
          </Suspense>
        ),
      },
      {
        path: 'categories/:categorySlug',
        element: (
          <Suspense fallback={<RouteSkeleton />}>
            <CategoryPage />
          </Suspense>
        ),
      },
      {
        path: '*',
        element: (
          <Suspense fallback={<RouteSkeleton />}>
            <NotFoundPage />
          </Suspense>
        ),
      },
    ],
  },
])

function RouteSkeleton() {
  return (
    <div className="panel p-8 text-stone-500">
      Loading view...
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {import.meta.env.DEV ? (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      ) : null}
    </QueryClientProvider>
  )
}
