export type BackendApiError = {
  code: string
  message: string
}

type FastifyErrorResponse = {
  error?: string
  message?: string
  statusCode?: number
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

const BACKEND_API_BASE = import.meta.env.QUORUM_PUBLIC_BACKEND_API_BASE ?? '/api/v1'

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

async function readResponseBody(response: Response) {
  const text = await response.text()

  if (!text.trim()) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export async function fetchBackendJson<T>(
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(`${BACKEND_API_BASE}${path}`, {
    credentials: 'include',
    ...init,
  })
  const body = await readResponseBody(response)

  if (!response.ok) {
    const fallback = `${response.status} ${response.statusText}`
    const errorBody =
      body && typeof body === 'object'
        ? (body as { error?: BackendApiError })
        : null
    const fastifyErrorBody =
      body && typeof body === 'object'
        ? (body as FastifyErrorResponse)
        : null

    throw new BackendRequestError({
      code: errorBody?.error?.code,
      message:
        errorBody?.error?.message ??
        fastifyErrorBody?.message ??
        (typeof body === 'string' && body.trim() ? body.trim() : fallback),
      status: response.status,
    })
  }

  if (response.status === 204 || body === null) {
    return {
      data: null as T,
      meta: {
        timestamp: new Date().toISOString(),
      },
    }
  }

  if (typeof body === 'string') {
    throw new BackendRequestError({
      message: 'The server returned an invalid response.',
      status: response.status,
    })
  }

  return body as BackendApiResponse<T>
}
