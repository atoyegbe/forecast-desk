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

export class BackendRequestError extends Error {
  code?: string
  status: number

  constructor(input: {
    code?: string
    message: string
    status: number
  }) {
    super(input.message)
    this.code = input.code
    this.name = 'BackendRequestError'
    this.status = input.status
  }
}

export async function fetchBackendJson<T>(
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(`${BACKEND_API_BASE}${path}`, init)

  if (!response.ok) {
    const fallback = `${response.status} ${response.statusText}`

    try {
      const errorBody = (await response.json()) as { error?: BackendApiError }
      throw new BackendRequestError({
        code: errorBody.error?.code,
        message: errorBody.error?.message ?? fallback,
        status: response.status,
      })
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }

      throw new BackendRequestError({
        message: fallback,
        status: response.status,
      })
    }
  }

  if (response.status === 204) {
    return {
      data: null as T,
      meta: {
        timestamp: new Date().toISOString(),
      },
    }
  }

  return (await response.json()) as BackendApiResponse<T>
}
