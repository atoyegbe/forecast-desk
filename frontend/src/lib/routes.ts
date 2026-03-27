import type { PulseEvent } from '../features/events/types'

export function getCategoryRoute(categorySlug: string) {
  return {
    params: {
      categorySlug,
    },
    to: '/categories/$categorySlug' as const,
  }
}

export function getEventRoute(event: Pick<PulseEvent, 'id' | 'slug'>) {
  return {
    params: {
      eventId: event.id,
      slug: event.slug,
    },
    to: '/events/$eventId/$slug' as const,
  }
}

export function getEventCompareRoute(event: Pick<PulseEvent, 'id' | 'slug'>) {
  return {
    params: {
      eventId: event.id,
      slug: event.slug,
    },
    to: '/events/$eventId/$slug/compare' as const,
  }
}

export function getSearchRoute(query?: string) {
  return {
    search: query?.trim()
      ? {
          q: query.trim(),
        }
      : {},
    to: '/search' as const,
  }
}
