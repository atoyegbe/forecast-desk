import { randomUUID } from 'node:crypto'
import { getDbPool } from './pool.js'

type AuthUserRow = {
  created_at: Date | string
  default_channel: 'both' | 'email' | 'telegram'
  email: string
  id: string
  last_login_at: Date | string | null
  telegram_chat_id: string | null
  telegram_handle: string | null
}

type AuthSessionRow = {
  created_at: Date | string
  default_channel: 'both' | 'email' | 'telegram'
  email: string
  expires_at: Date | string
  id: string
  last_login_at: Date | string | null
  session_id: string
  telegram_chat_id: string | null
  telegram_handle: string | null
  user_id: string
}

export type StoredAuthUser = {
  createdAt: string
  defaultChannel: 'both' | 'email' | 'telegram'
  email: string
  id: string
  lastLoginAt: string | null
  telegramChatId?: string | null
  telegramHandle: string | null
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
    defaultChannel: row.default_channel,
    email: row.email,
    id: row.id,
    lastLoginAt: toIsoString(row.last_login_at),
    telegramChatId: row.telegram_chat_id,
    telegramHandle: row.telegram_handle,
  }
}

function mapSession(row: AuthSessionRow): StoredAuthSession {
  return {
    expiresAt: toIsoString(row.expires_at) ?? new Date(0).toISOString(),
    id: row.session_id,
    user: {
      createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(),
      defaultChannel: row.default_channel,
      email: row.email,
      id: row.user_id,
      lastLoginAt: toIsoString(row.last_login_at),
      telegramChatId: row.telegram_chat_id,
      telegramHandle: row.telegram_handle,
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
        users.telegram_handle,
        users.telegram_chat_id,
        users.default_channel,
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
      RETURNING
        id,
        email,
        telegram_handle,
        telegram_chat_id,
        default_channel,
        created_at,
        last_login_at
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
        users.telegram_handle,
        users.telegram_chat_id,
        users.default_channel,
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
      RETURNING
        id,
        email,
        telegram_handle,
        telegram_chat_id,
        default_channel,
        created_at,
        last_login_at
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
      SELECT
        users.id,
        users.email,
        users.telegram_handle,
        users.telegram_chat_id,
        users.default_channel,
        users.created_at,
        users.last_login_at
      FROM consumed
      JOIN pulse_users users ON users.id = consumed.user_id
    `,
    [email, secretHash],
  )

  return result.rows[0] ? mapUser(result.rows[0]) : null
}

export async function getUserById(userId: string) {
  const result = await getDbPool().query<AuthUserRow>(
    `
      SELECT
        id,
        email,
        telegram_handle,
        telegram_chat_id,
        default_channel,
        created_at,
        last_login_at
      FROM pulse_users
      WHERE id = $1
    `,
    [userId],
  )

  return result.rows[0] ? mapUser(result.rows[0]) : null
}

export async function updateUserPreferences(input: {
  defaultChannel?: 'both' | 'email' | 'telegram'
  email?: string
  userId: string
}) {
  const result = await getDbPool().query<AuthUserRow>(
    `
      UPDATE pulse_users
      SET
        email = COALESCE($2, email),
        default_channel = COALESCE($3, default_channel)
      WHERE id = $1
      RETURNING
        id,
        email,
        telegram_handle,
        telegram_chat_id,
        default_channel,
        created_at,
        last_login_at
    `,
    [
      input.userId,
      input.email ?? null,
      input.defaultChannel ?? null,
    ],
  )

  return result.rows[0] ? mapUser(result.rows[0]) : null
}

export async function updateUserTelegramConnection(input: {
  telegramChatId: string | null
  telegramHandle: string | null
  userId: string
}) {
  const result = await getDbPool().query<AuthUserRow>(
    `
      UPDATE pulse_users
      SET
        telegram_chat_id = $2,
        telegram_handle = $3
      WHERE id = $1
      RETURNING
        id,
        email,
        telegram_handle,
        telegram_chat_id,
        default_channel,
        created_at,
        last_login_at
    `,
    [input.userId, input.telegramChatId, input.telegramHandle],
  )

  return result.rows[0] ? mapUser(result.rows[0]) : null
}

export async function getTelegramUpdatesCursor(streamKey: string) {
  const result = await getDbPool().query<{ last_update_id: number }>(
    `
      SELECT last_update_id
      FROM pulse_telegram_updates_state
      WHERE stream_key = $1
    `,
    [streamKey],
  )

  return result.rows[0]?.last_update_id ?? 0
}

export async function saveTelegramUpdatesCursor(input: {
  lastUpdateId: number
  streamKey: string
}) {
  await getDbPool().query(
    `
      INSERT INTO pulse_telegram_updates_state (
        stream_key,
        last_update_id
      )
      VALUES ($1, $2)
      ON CONFLICT (stream_key)
      DO UPDATE SET
        last_update_id = EXCLUDED.last_update_id,
        updated_at = NOW()
    `,
    [input.streamKey, input.lastUpdateId],
  )
}

type TelegramConnectCodeRow = {
  chat_id: string
  code: string
  telegram_handle: string
}

export async function findActiveTelegramConnectCodeByChatId(chatId: string) {
  const result = await getDbPool().query<TelegramConnectCodeRow>(
    `
      SELECT code, chat_id, telegram_handle
      FROM pulse_telegram_connect_codes
      WHERE chat_id = $1
        AND claimed_at IS NULL
        AND expires_at >= NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [chatId],
  )

  return result.rows[0] ?? null
}

export async function createTelegramConnectCode(input: {
  chatId: string
  code: string
  expiresAt: string
  telegramHandle: string
}) {
  const result = await getDbPool().query<TelegramConnectCodeRow>(
    `
      INSERT INTO pulse_telegram_connect_codes (
        code,
        chat_id,
        telegram_handle,
        expires_at
      )
      VALUES ($1, $2, $3, $4)
      RETURNING code, chat_id, telegram_handle
    `,
    [input.code, input.chatId, input.telegramHandle, input.expiresAt],
  )

  return result.rows[0] ?? null
}

export async function claimTelegramConnectCode(input: {
  code: string
  userId: string
}) {
  const result = await getDbPool().query<AuthUserRow>(
    `
      WITH matched AS (
        SELECT code, chat_id, telegram_handle
        FROM pulse_telegram_connect_codes
        WHERE code = $1
          AND claimed_at IS NULL
          AND expires_at >= NOW()
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      ),
      claimed AS (
        UPDATE pulse_telegram_connect_codes codes
        SET
          claimed_at = NOW(),
          claimed_by_user_id = $2
        FROM matched
        WHERE codes.code = matched.code
        RETURNING matched.chat_id, matched.telegram_handle
      )
      UPDATE pulse_users users
      SET
        telegram_chat_id = claimed.chat_id,
        telegram_handle = claimed.telegram_handle
      FROM claimed
      WHERE users.id = $2
      RETURNING
        users.id,
        users.email,
        users.telegram_handle,
        users.telegram_chat_id,
        users.default_channel,
        users.created_at,
        users.last_login_at
    `,
    [input.code, input.userId],
  )

  return result.rows[0] ? mapUser(result.rows[0]) : null
}
