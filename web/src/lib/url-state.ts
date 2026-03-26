import { useSearchParams } from 'react-router-dom'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const valueFromUrl = searchParams.get(key)
  const activeValue: T = isValidSelection(valueFromUrl, values)
    ? valueFromUrl
    : fallback

  const setActiveValue = (nextValue: T) => {
    const value = values.includes(nextValue) ? nextValue : fallback

    setSearchParams((current) => {
      const next = new URLSearchParams(current)

      if (value === fallback) {
        next.delete(key)
      } else {
        next.set(key, value)
      }

      return next
    })
  }

  return [activeValue, setActiveValue] as const
}
