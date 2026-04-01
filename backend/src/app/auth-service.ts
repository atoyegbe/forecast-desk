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
  getUserByEmail,
  markUserLoggedIn,
  revokeSession,
  updateUserEmail,
} from '../db/auth-repository.js'
import {
  getQuorumAuthCodeTtlMinutes,
  getQuorumAuthFrontendBaseUrl,
  getQuorumAuthTestMagicToken,
  getQuorumBaseUrl,
  getQuorumSessionTtlDays,
} from '../db/config.js'
import { sendPasswordlessMagicLinkEmail } from './email-service.js'

const AUTH_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i
const FALLBACK_FRONTEND_BASE_URL = 'http://localhost:5173'
export const SESSION_COOKIE_NAME = 'quorum_session'

type RequestHeaders = {
  authorization?: string
  cookie?: string
}

type PostgresError = Error & {
  code?: string
}

export class AuthEmailInUseError extends Error {
  constructor() {
    super('That email address is already in use.')
  }
}

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function getCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) {
    return null
  }

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValueParts] = part.trim().split('=')

    if (rawName !== name) {
      continue
    }

    const rawValue = rawValueParts.join('=')

    if (!rawValue) {
      return null
    }

    try {
      return decodeURIComponent(rawValue)
    } catch {
      return rawValue
    }
  }

  return null
}

function isSecureSessionCookie() {
  return [getQuorumAuthFrontendBaseUrl(), getQuorumBaseUrl()].some(
    (value) => value?.startsWith('https://'),
  )
}

function serializeCookie(input: {
  expiresAt?: string
  maxAgeSeconds?: number
  name: string
  value: string
}) {
  const parts = [
    `${input.name}=${encodeURIComponent(input.value)}`,
    'HttpOnly',
    'Path=/',
  ]

  if (isSecureSessionCookie()) {
    parts.push('SameSite=None', 'Secure')
  } else {
    parts.push('SameSite=Lax')
  }

  if (input.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(input.maxAgeSeconds))}`)
  }

  if (input.expiresAt) {
    parts.push(`Expires=${new Date(input.expiresAt).toUTCString()}`)
  }

  return parts.join('; ')
}

function toPublicUser(user: {
  authProvider: 'email' | 'telegram'
  createdAt: string
  defaultChannel: 'both' | 'email' | 'telegram'
  email: string | null
  id: string
  lastLoginAt: string | null
  telegramHandle: string | null
}): PulseAuthUser {
  return {
    authProvider: user.authProvider,
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
  const testToken = getQuorumAuthTestMagicToken()

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
  const configuredBaseUrl = getQuorumAuthFrontendBaseUrl()

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

async function issueSessionForUser(userId: string) {
  const sessionToken = generateSessionToken()
  const session = await createSession({
    expiresAt: new Date(
      Date.now() + getQuorumSessionTtlDays() * 24 * 60 * 60 * 1000,
    ).toISOString(),
    tokenHash: buildSessionTokenHash(sessionToken),
    userId,
  })

  return {
    session: {
      expiresAt: session.expiresAt,
      id: session.id,
      token: sessionToken,
    } satisfies PulseAuthSession,
    token: sessionToken,
  }
}

export function buildSessionCookie(token: string, expiresAt: string) {
  return serializeCookie({
    expiresAt,
    maxAgeSeconds: (new Date(expiresAt).getTime() - Date.now()) / 1_000,
    name: SESSION_COOKIE_NAME,
    value: token,
  })
}

export function buildExpiredSessionCookie() {
  return serializeCookie({
    expiresAt: new Date(0).toISOString(),
    maxAgeSeconds: 0,
    name: SESSION_COOKIE_NAME,
    value: '',
  })
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

export function getSessionTokenFromHeaders(headers: RequestHeaders) {
  return (
    getCookieValue(headers.cookie, SESSION_COOKIE_NAME) ||
    getBearerToken(headers.authorization)
  )
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
    Date.now() + getQuorumAuthCodeTtlMinutes() * 60 * 1000,
  ).toISOString()

  await createAuthChallenge({
    email: normalizedEmail,
    expiresAt,
    purpose: 'sign-in',
    resendMessageId: sendResult.providerMessageId,
    secretHash: buildOneTimeSecretHash(normalizedEmail, token),
    userId: user.id,
  })

  return {
    delivered: true,
  }
}

export async function requestEmailLinkForUser(input: {
  email: string
  requestOrigin?: string | null
  returnToPath?: string | null
  userId: string
}): Promise<PulseAuthRequestLinkResult> {
  const normalizedEmail = normalizeEmail(input.email)
  const existingUser = await getUserByEmail(normalizedEmail)

  if (existingUser && existingUser.id !== input.userId) {
    throw new AuthEmailInUseError()
  }

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
    Date.now() + getQuorumAuthCodeTtlMinutes() * 60 * 1000,
  ).toISOString()

  await createAuthChallenge({
    email: normalizedEmail,
    expiresAt,
    purpose: 'link-email',
    resendMessageId: sendResult.providerMessageId,
    secretHash: buildOneTimeSecretHash(normalizedEmail, token),
    userId: input.userId,
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
  const challenge = await consumeAuthChallenge(
    normalizedEmail,
    buildOneTimeSecretHash(normalizedEmail, input.token.trim()),
  )

  if (!challenge) {
    return null
  }

  if (challenge.purpose === 'link-email') {
    try {
      const linkedUser = await updateUserEmail({
        email: challenge.email,
        userId: challenge.user.id,
      })

      if (!linkedUser) {
        return null
      }

      return {
        status: 'email-linked',
        user: toPublicUser(linkedUser),
      }
    } catch (error) {
      if ((error as PostgresError).code === '23505') {
        throw new AuthEmailInUseError()
      }

      throw error
    }
  }

  const nextUser = await markUserLoggedIn(challenge.user.id)
  const nextSession = await issueSessionForUser(challenge.user.id)

  return {
    session: nextSession.session,
    status: 'signed-in',
    user: toPublicUser(nextUser ?? challenge.user),
  }
}

export async function createTelegramSessionForUser(userId: string) {
  const nextUser = await markUserLoggedIn(userId)
  const nextSession = await issueSessionForUser(userId)

  return {
    session: nextSession.session,
    user: nextUser,
  }
}
