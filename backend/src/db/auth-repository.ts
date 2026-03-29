import { randomUUID } from 'node:crypto'
import { getDbPool } from './pool.js'

type AuthUserRow = {
  created_at: Date | string
  email: string
  id: string
  last_login_at: Date | string | null
}

type AuthSessionRow = {
  created_at: Date | string
  email: string
  expires_at: Date | string
  id: string
  last_login_at: Date | string | null
  session_id: string
  user_id: string
}

export type StoredAuthUser = {
  createdAt: string
  email: string
  id: string
  lastLoginAt: string | null
}

export type StoredAuthSession = {
  expiresAt: string
  id: string
  user: StoredAuthUser
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function mapUser(row: AuthUserRow): StoredAuthUser {
  return {
    createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(),
    email: row.email,
    id: row.id,
    lastLoginAt: toIsoString(row.last_login_at),
  }
}

function mapSession(row: AuthSessionRow): StoredAuthSession {
  return {
    expiresAt: toIsoString(row.expires_at) ?? new Date(0).toISOString(),
    id: row.session_id,
    user: {
      createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(),
      email: row.email,
      id: row.user_id,
      lastLoginAt: toIsoString(row.last_login_at),
    },
  }
}

export async function createAuthChallenge(input: {
  email: string
  expiresAt: string
  resendMessageId?: string | null
  secretHash: string
  userId: string
}) {
  const id = randomUUID()

  await getDbPool().query(
    `
      INSERT INTO pulse_auth_codes (
        id,
        user_id,
        email,
        code_hash,
        expires_at,
        resend_message_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      id,
      input.userId,
      input.email,
      input.secretHash,
      input.expiresAt,
      input.resendMessageId ?? null,
    ],
  )

  return id
}

export async function createSession(input: {
  expiresAt: string
  tokenHash: string
  userId: string
}) {
  const id = randomUUID()
  const result = await getDbPool().query<AuthSessionRow>(
    `
      WITH inserted AS (
        INSERT INTO pulse_auth_sessions (
          id,
          user_id,
          token_hash,
          expires_at
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, user_id, expires_at
      )
      SELECT
        users.id AS user_id,
        users.email,
        users.created_at,
        users.last_login_at,
        inserted.id AS session_id,
        inserted.expires_at
      FROM inserted
      JOIN pulse_users users ON users.id = inserted.user_id
    `,
    [id, input.userId, input.tokenHash, input.expiresAt],
  )

  return mapSession(result.rows[0])
}

export async function createUser(email: string) {
  const result = await getDbPool().query<AuthUserRow>(
    `
      INSERT INTO pulse_users (id, email)
      VALUES ($1, $2)
      ON CONFLICT (email)
      DO UPDATE SET email = EXCLUDED.email
      RETURNING id, email, created_at, last_login_at
    `,
    [randomUUID(), email],
  )

  return mapUser(result.rows[0])
}

export async function getSessionByTokenHash(tokenHash: string) {
  const result = await getDbPool().query<AuthSessionRow>(
    `
      WITH matched AS (
        UPDATE pulse_auth_sessions
        SET last_seen_at = NOW()
        WHERE token_hash = $1
          AND revoked_at IS NULL
          AND expires_at > NOW()
        RETURNING id, user_id, expires_at
      )
      SELECT
        users.id AS user_id,
        users.email,
        users.created_at,
        users.last_login_at,
        matched.id AS session_id,
        matched.expires_at
      FROM matched
      JOIN pulse_users users ON users.id = matched.user_id
    `,
    [tokenHash],
  )

  return result.rows[0] ? mapSession(result.rows[0]) : null
}

export async function markUserLoggedIn(userId: string) {
  const result = await getDbPool().query<AuthUserRow>(
    `
      UPDATE pulse_users
      SET last_login_at = NOW()
      WHERE id = $1
      RETURNING id, email, created_at, last_login_at
    `,
    [userId],
  )

  return result.rows[0] ? mapUser(result.rows[0]) : null
}

export async function revokeSession(tokenHash: string) {
  const result = await getDbPool().query(
    `
      UPDATE pulse_auth_sessions
      SET revoked_at = NOW()
      WHERE token_hash = $1
        AND revoked_at IS NULL
      RETURNING id
    `,
    [tokenHash],
  )

  return (result.rowCount ?? 0) > 0
}

export async function consumeAuthChallenge(email: string, secretHash: string) {
  const result = await getDbPool().query<AuthUserRow>(
    `
      WITH matched AS (
        SELECT id, user_id
        FROM pulse_auth_codes
        WHERE email = $1
          AND code_hash = $2
          AND consumed_at IS NULL
          AND expires_at >= NOW()
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      ),
      consumed AS (
        UPDATE pulse_auth_codes codes
        SET consumed_at = NOW()
        FROM matched
        WHERE codes.id = matched.id
        RETURNING matched.user_id
      )
      SELECT users.id, users.email, users.created_at, users.last_login_at
      FROM consumed
      JOIN pulse_users users ON users.id = consumed.user_id
    `,
    [email, secretHash],
  )

  return result.rows[0] ? mapUser(result.rows[0]) : null
}
