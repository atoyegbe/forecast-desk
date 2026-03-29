import { fetchBackendJson } from '../../lib/api-client'
import type {
  PulseAuthCurrentSession,
  PulseAuthVerifyLinkResult,
} from './types'

function buildAuthHeaders(token?: string) {
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : undefined
}

export async function requestMagicLink(email: string, returnToPath?: string) {
  const response = await fetchBackendJson<{ delivered: true }>('/auth/request-link', {
    body: JSON.stringify({
      email,
      returnToPath,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  return response.data
}

export async function verifyMagicLink(email: string, token: string) {
  const response = await fetchBackendJson<PulseAuthVerifyLinkResult>('/auth/verify-link', {
    body: JSON.stringify({
      email,
      token,
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
