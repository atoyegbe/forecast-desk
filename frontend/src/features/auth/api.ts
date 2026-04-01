import { fetchBackendJson } from '../../lib/api-client'
import type {
  PulseAuthCurrentSession,
  PulseAuthEmailLinkResult,
  PulseAuthTelegramInitResult,
  PulseAuthTelegramStatusResult,
  PulseAuthVerifyLinkResult,
  PulseTelegramConnectResult,
  PulseUserPreferencesUpdateInput,
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

export async function requestEmailLink(email: string) {
  const response = await fetchBackendJson<PulseAuthEmailLinkResult>('/auth/email-link', {
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

export async function initTelegramAuth() {
  const response = await fetchBackendJson<PulseAuthTelegramInitResult>('/auth/telegram/init', {
    method: 'POST',
  })

  return response.data
}

export async function getTelegramAuthStatus(token: string) {
  const response = await fetchBackendJson<PulseAuthTelegramStatusResult>(
    `/auth/telegram/status?token=${encodeURIComponent(token)}`,
  )

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

export async function getCurrentSession(token?: string) {
  const response = await fetchBackendJson<PulseAuthCurrentSession>('/auth/me', {
    headers: buildAuthHeaders(token),
  })

  return response.data
}

export async function logoutSession(token?: string) {
  const response = await fetchBackendJson<{ revoked: true }>('/auth/logout', {
    headers: buildAuthHeaders(token),
    method: 'POST',
  })

  return response.data
}

export async function updateUserPreferences(
  input: PulseUserPreferencesUpdateInput,
  token?: string,
) {
  const response = await fetchBackendJson<PulseAuthCurrentSession['user']>(
    '/user/preferences',
    {
      body: JSON.stringify(input),
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(token),
      },
      method: 'PATCH',
    },
  )

  return response.data
}

export async function connectTelegramChannel(code: string, token?: string) {
  const response = await fetchBackendJson<PulseTelegramConnectResult>(
    '/telegram/connect',
    {
      body: JSON.stringify({
        code,
      }),
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(token),
      },
      method: 'POST',
    },
  )

  return response.data
}

export async function disconnectTelegramChannel(token?: string) {
  await fetchBackendJson<null>('/telegram/connect', {
    headers: buildAuthHeaders(token),
    method: 'DELETE',
  })
}
