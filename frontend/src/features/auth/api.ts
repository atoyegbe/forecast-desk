import { fetchBackendJson } from '../../lib/api-client'
import type {
  PulseAuthCurrentSession,
  PulseAuthVerifyCodeResult,
} from './types'

function buildAuthHeaders(token?: string) {
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : undefined
}

export async function requestLoginCode(email: string) {
  const response = await fetchBackendJson<{ delivered: true }>('/auth/request-code', {
    body: JSON.stringify({
      email,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  return response.data
}

export async function verifyLoginCode(email: string, code: string) {
  const response = await fetchBackendJson<PulseAuthVerifyCodeResult>('/auth/verify-code', {
    body: JSON.stringify({
      code,
      email,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  return response.data
}

export async function getCurrentSession(token: string) {
  const response = await fetchBackendJson<PulseAuthCurrentSession>('/auth/me', {
    headers: buildAuthHeaders(token),
  })

  return response.data
}

export async function logoutSession(token: string) {
  const response = await fetchBackendJson<{ revoked: true }>('/auth/logout', {
    headers: buildAuthHeaders(token),
    method: 'POST',
  })

  return response.data
}
