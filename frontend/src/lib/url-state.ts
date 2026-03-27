import {
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import type { AppSearch } from '../router'

type UrlSelectionOptions<T extends string> = {
  fallback: T
  key: string
  values: readonly T[]
}

function isValidSelection<T extends string>(
  value: string | null,
  values: readonly T[],
): value is T {
  if (!value) {
    return false
  }

  return values.includes(value as T)
}

export function useUrlSelection<T extends string>({
  fallback,
  key,
  values,
}: UrlSelectionOptions<T>) {
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const rawValue = search[key]
  const valueFromUrl = typeof rawValue === 'string' ? rawValue : null
  const activeValue: T = isValidSelection(valueFromUrl, values)
    ? valueFromUrl
    : fallback

  const setActiveValue = (nextValue: T) => {
    const value = values.includes(nextValue) ? nextValue : fallback

    void navigate({
      replace: true,
      search: (current): AppSearch => {
        const next = {
          ...current,
        } as AppSearch

        if (value === fallback) {
          delete next[key]
        } else {
          next[key] = value
        }

        return next
      },
      to: '.',
    })
  }

  return [activeValue, setActiveValue] as const
}
