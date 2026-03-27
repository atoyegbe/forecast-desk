export type BackendApiError = {
  code: string
  message: string
}

export type BackendApiResponse<T> = {
  data: T
  meta: {
    cursor?: string
    timestamp: string
    total?: number
  }
  error?: BackendApiError
}

const BACKEND_API_BASE = import.meta.env.VITE_BACKEND_API_BASE ?? '/api/v1'

export async function fetchBackendJson<T>(
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(`${BACKEND_API_BASE}${path}`, init)

  if (!response.ok) {
    const fallback = `${response.status} ${response.statusText}`

    try {
      const errorBody = (await response.json()) as { error?: BackendApiError }
      throw new Error(errorBody.error?.message ?? fallback)
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }

      throw new Error(fallback)
    }
  }

  return (await response.json()) as BackendApiResponse<T>
}
