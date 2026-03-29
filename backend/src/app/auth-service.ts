import { createHash, randomBytes } from 'node:crypto'
import type {
  PulseAuthCurrentSession,
  PulseAuthRequestCodeResult,
  PulseAuthSession,
  PulseAuthUser,
  PulseAuthVerifyCodeResult,
} from '../contracts/pulse-auth.js'
import {
  createAuthCode,
  createSession,
  createUser,
  getSessionByTokenHash,
  markUserLoggedIn,
  revokeSession,
  useAuthCode,
} from '../db/auth-repository.js'
import {
  getPulseAuthCodeTtlMinutes,
  getPulseAuthTestCode,
  getPulseSessionTtlDays,
} from '../db/config.js'
import { sendPasswordlessCodeEmail } from './email-service.js'

const AUTH_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function toPublicUser(user: {
  createdAt: string
  email: string
  id: string
  lastLoginAt: string | null
}): PulseAuthUser {
  return {
    createdAt: user.createdAt,
    email: user.email,
    id: user.id,
    lastLoginAt: user.lastLoginAt,
  }
}

function buildCodeHash(email: string, code: string) {
  return hashValue(`${email}:${code}`)
}

function buildSessionTokenHash(token: string) {
  return hashValue(token)
}

function generateSessionToken() {
  return randomBytes(32).toString('hex')
}

function generateVerificationCode() {
  const testCode = getPulseAuthTestCode()

  if (testCode) {
    return testCode
  }

  return String(Math.floor(100000 + Math.random() * 900000))
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

export async function requestPasswordlessCode(
  email: string,
): Promise<PulseAuthRequestCodeResult> {
  const normalizedEmail = normalizeEmail(email)
  const user = await createUser(normalizedEmail)
  const code = generateVerificationCode()
  const sendResult = await sendPasswordlessCodeEmail({
    code,
    email: normalizedEmail,
  })
  const expiresAt = new Date(
    Date.now() + getPulseAuthCodeTtlMinutes() * 60 * 1000,
  ).toISOString()

  await createAuthCode({
    codeHash: buildCodeHash(normalizedEmail, code),
    email: normalizedEmail,
    expiresAt,
    resendMessageId: sendResult.providerMessageId,
    userId: user.id,
  })

  return {
    delivered: true,
  }
}

export async function verifyPasswordlessCode(input: {
  code: string
  email: string
}): Promise<PulseAuthVerifyCodeResult | null> {
  const normalizedEmail = normalizeEmail(input.email)
  const user = await useAuthCode(
    normalizedEmail,
    buildCodeHash(normalizedEmail, input.code.trim()),
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
