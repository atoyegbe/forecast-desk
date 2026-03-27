export async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init)

  if (!response.ok) {
    const fallback = `${response.status} ${response.statusText}`

    try {
      const errorBody = (await response.json()) as { message?: string; error?: string }
      throw new Error(errorBody.message ?? errorBody.error ?? fallback)
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }

      throw new Error(fallback)
    }
  }

  return (await response.json()) as T
}

export function normalizeText(value?: string | null) {
  return (value ?? '').replace(/\r\n/g, '\n').trim()
}

export function toNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

export function isPresent<T>(value: T | null | undefined): value is T {
  return value != null
}

export function parseJsonArray<T>(value: unknown) {
  if (Array.isArray(value)) {
    return value as T[]
  }

  if (typeof value !== 'string' || !value.trim()) {
    return []
  }

  try {
    const parsed = JSON.parse(value) as unknown

    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

export function formatCategory(label: string) {
  return label
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(' ')
}
