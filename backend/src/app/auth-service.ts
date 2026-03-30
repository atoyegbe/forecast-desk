import { createHash, randomBytes } from 'node:crypto'
import type {
  PulseAuthCurrentSession,
  PulseAuthRequestLinkResult,
  PulseAuthSession,
  PulseAuthUser,
  PulseAuthVerifyLinkResult,
} from '../contracts/pulse-auth.js'
import {
  consumeAuthChallenge,
  createAuthChallenge,
  createSession,
  createUser,
  getSessionByTokenHash,
  markUserLoggedIn,
  revokeSession,
} from '../db/auth-repository.js'
import {
  getPulseAuthCodeTtlMinutes,
  getPulseAuthFrontendBaseUrl,
  getPulseAuthTestMagicToken,
  getPulseSessionTtlDays,
} from '../db/config.js'
import { sendPasswordlessMagicLinkEmail } from './email-service.js'

const AUTH_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i
const FALLBACK_FRONTEND_BASE_URL = 'http://localhost:5173'

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function toPublicUser(user: {
  createdAt: string
  defaultChannel: 'both' | 'email' | 'telegram'
  email: string
  id: string
  lastLoginAt: string | null
  telegramHandle: string | null
}): PulseAuthUser {
  return {
    createdAt: user.createdAt,
    defaultChannel: user.defaultChannel,
    email: user.email,
    id: user.id,
    lastLoginAt: user.lastLoginAt,
    telegramHandle: user.telegramHandle,
  }
}

function buildOneTimeSecretHash(email: string, secret: string) {
  return hashValue(`${email}:${secret}`)
}

function buildSessionTokenHash(token: string) {
  return hashValue(token)
}

function generateSessionToken() {
  return randomBytes(32).toString('hex')
}

function generateMagicToken() {
  const testToken = getPulseAuthTestMagicToken()

  if (testToken) {
    return testToken
  }

  return randomBytes(24).toString('base64url')
}

function sanitizeReturnToPath(value?: string | null) {
  if (!value) {
    return '/'
  }

  const trimmed = value.trim()

  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '/'
  }

  return trimmed
}

function getFrontendBaseUrl(requestOrigin?: string | null) {
  const configuredBaseUrl = getPulseAuthFrontendBaseUrl()

  if (configuredBaseUrl) {
    return configuredBaseUrl
  }

  if (requestOrigin?.trim()) {
    return requestOrigin.trim()
  }

  return FALLBACK_FRONTEND_BASE_URL
}

function buildMagicLinkUrl(input: {
  email: string
  requestOrigin?: string | null
  returnToPath?: string | null
  token: string
}) {
  const url = new URL(
    sanitizeReturnToPath(input.returnToPath),
    getFrontendBaseUrl(input.requestOrigin),
  )

  url.searchParams.set('auth_email', input.email)
  url.searchParams.set('auth_token', input.token)

  return url.toString()
}

export function isValidEmail(email: string) {
  return AUTH_EMAIL_PATTERN.test(email.trim())
}

export function getBearerToken(authorizationHeader?: string) {
  if (!authorizationHeader) {
    return null
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2)

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}

export async function getCurrentSession(
  token: string,
): Promise<PulseAuthCurrentSession | null> {
  const session = await getSessionByTokenHash(buildSessionTokenHash(token))

  if (!session) {
    return null
  }

  return {
    session: {
      expiresAt: session.expiresAt,
      id: session.id,
    },
    user: toPublicUser(session.user),
  }
}

export async function logoutSession(token: string) {
  const revoked = await revokeSession(buildSessionTokenHash(token))

  return {
    revoked: revoked || true,
  }
}

export async function requestPasswordlessLink(input: {
  email: string
  requestOrigin?: string | null
  returnToPath?: string | null
}): Promise<PulseAuthRequestLinkResult> {
  const normalizedEmail = normalizeEmail(input.email)
  const user = await createUser(normalizedEmail)
  const token = generateMagicToken()
  const magicLinkUrl = buildMagicLinkUrl({
    email: normalizedEmail,
    requestOrigin: input.requestOrigin,
    returnToPath: input.returnToPath,
    token,
  })
  const sendResult = await sendPasswordlessMagicLinkEmail({
    email: normalizedEmail,
    magicLinkUrl,
  })
  const expiresAt = new Date(
    Date.now() + getPulseAuthCodeTtlMinutes() * 60 * 1000,
  ).toISOString()

  await createAuthChallenge({
    email: normalizedEmail,
    expiresAt,
    resendMessageId: sendResult.providerMessageId,
    secretHash: buildOneTimeSecretHash(normalizedEmail, token),
    userId: user.id,
  })

  return {
    delivered: true,
  }
}

export async function verifyPasswordlessLink(input: {
  email: string
  token: string
}): Promise<PulseAuthVerifyLinkResult | null> {
  const normalizedEmail = normalizeEmail(input.email)
  const user = await consumeAuthChallenge(
    normalizedEmail,
    buildOneTimeSecretHash(normalizedEmail, input.token.trim()),
  )

  if (!user) {
    return null
  }

  const nextUser = await markUserLoggedIn(user.id)
  const sessionToken = generateSessionToken()
  const session = await createSession({
    expiresAt: new Date(
      Date.now() + getPulseSessionTtlDays() * 24 * 60 * 60 * 1000,
    ).toISOString(),
    tokenHash: buildSessionTokenHash(sessionToken),
    userId: user.id,
  })

  return {
    session: {
      expiresAt: session.expiresAt,
      id: session.id,
      token: sessionToken,
    } satisfies PulseAuthSession,
    user: toPublicUser(nextUser ?? user),
  }
}
