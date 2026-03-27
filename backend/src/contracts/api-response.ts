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
