export type ApiError = {
  code: string
  message: string
}

export type ApiResponse<T> = {
  data: T
  meta: {
    cursor?: string
    timestamp: string
    total?: number
  }
  error?: ApiError
}

export function createApiErrorResponse(
  code: string,
  message: string,
  meta: Partial<ApiResponse<null>['meta']> = {},
): ApiResponse<null> {
  return {
    data: null,
    error: {
      code,
      message,
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  }
}

export function createApiResponse<T>(
  data: T,
  meta: Partial<ApiResponse<T>['meta']> = {},
): ApiResponse<T> {
  return {
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  }
}
