import { randomUUID } from 'node:crypto'
import type { PulseTelegramAuthInitResult } from '../contracts/pulse-auth.js'
import { getQuorumTelegramBotUsername } from '../db/config.js'
import { createOrUpdateTelegramUser } from '../db/auth-repository.js'
import { getRedisClient } from '../lib/redis.js'
import { createTelegramSessionForUser } from './auth-service.js'

const TELEGRAM_AUTH_TTL_SECONDS = 5 * 60
const TELEGRAM_AUTH_APPROVED_TTL_SECONDS = 60

type PendingTelegramAuthState = {
  createdAt: number
  status: 'pending'
}

type ApprovedTelegramAuthState = {
  createdAt: number
  sessionExpiresAt: string
  sessionToken: string
  status: 'approved'
  username: string | null
}

type TelegramAuthState = ApprovedTelegramAuthState | PendingTelegramAuthState

type ExpiringValue = {
  expiresAt: number
  value: string
}

type KeyValueStore = {
  del: (key: string) => Promise<void>
  get: (key: string) => Promise<string | null>
  setEx: (key: string, ttlSeconds: number, value: string) => Promise<void>
}

class MemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, ExpiringValue>()

  private prune(key: string) {
    const current = this.values.get(key)

    if (current && current.expiresAt <= Date.now()) {
      this.values.delete(key)
    }
  }

  async del(key: string) {
    this.values.delete(key)
  }

  async get(key: string) {
    this.prune(key)
    return this.values.get(key)?.value ?? null
  }

  async setEx(key: string, ttlSeconds: number, value: string) {
    this.values.set(key, {
      expiresAt: Date.now() + ttlSeconds * 1_000,
      value,
    })
  }
}

const fallbackStore = new MemoryKeyValueStore()
let testStore: KeyValueStore | null = null

function buildAuthKey(token: string) {
  return `auth:telegram:${token}`
}

async function getStore(): Promise<KeyValueStore> {
  if (testStore) {
    return testStore
  }

  const redis = await getRedisClient()

  if (!redis) {
    return fallbackStore
  }

  return {
    del(key: string) {
      return redis.del(key).then(() => undefined)
    },
    get(key: string) {
      return redis.get(key)
    },
    async setEx(key: string, ttlSeconds: number, value: string) {
      await redis.set(key, value, 'EX', ttlSeconds)
    },
  }
}

async function readTelegramAuthState(token: string) {
  const store = await getStore()
  const rawValue = await store.get(buildAuthKey(token))

  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as TelegramAuthState
  } catch {
    await store.del(buildAuthKey(token))
    return null
  }
}

async function writeTelegramAuthState(
  token: string,
  ttlSeconds: number,
  state: TelegramAuthState,
) {
  const store = await getStore()
  await store.setEx(buildAuthKey(token), ttlSeconds, JSON.stringify(state))
}

function getTelegramBotUrl(token: string) {
  const botUsername = getQuorumTelegramBotUsername() ?? 'QuorumSignalsBot'
  return `https://t.me/${botUsername.replace(/^@+/, '')}?start=auth_${token}`
}

export async function beginTelegramAuth(): Promise<PulseTelegramAuthInitResult> {
  const token = randomUUID()

  await writeTelegramAuthState(token, TELEGRAM_AUTH_TTL_SECONDS, {
    createdAt: Date.now(),
    status: 'pending',
  })

  return {
    botUrl: getTelegramBotUrl(token),
    token,
  }
}

export async function getTelegramAuthStatus(token: string) {
  const state = await readTelegramAuthState(token)

  if (!state) {
    return {
      status: 'expired' as const,
    }
  }

  if (state.status === 'approved') {
    return {
      sessionExpiresAt: state.sessionExpiresAt,
      sessionToken: state.sessionToken,
      status: 'approved' as const,
      username: state.username,
    }
  }

  return {
    status: 'pending' as const,
  }
}

async function deleteTelegramAuthState(token: string) {
  const store = await getStore()
  await store.del(buildAuthKey(token))
}

export async function consumeTelegramAuthStatus(token: string) {
  const state = await readTelegramAuthState(token)

  if (!state) {
    return {
      status: 'expired' as const,
    }
  }

  if (state.status === 'approved') {
    await deleteTelegramAuthState(token)

    return {
      sessionExpiresAt: state.sessionExpiresAt,
      sessionToken: state.sessionToken,
      status: 'approved' as const,
      username: state.username,
    }
  }

  return {
    status: 'pending' as const,
  }
}

export async function approveTelegramAuth(input: {
  telegramChatId: string
  telegramHandle: string | null
  telegramUsername: string | null
  token: string
}) {
  const state = await readTelegramAuthState(input.token)

  if (!state) {
    return {
      status: 'expired' as const,
    }
  }

  if (state.status !== 'pending') {
    return {
      status: 'already-used' as const,
    }
  }

  const user = await createOrUpdateTelegramUser({
    telegramChatId: input.telegramChatId,
    telegramHandle: input.telegramHandle,
  })
  const session = await createTelegramSessionForUser(user.id)

  await writeTelegramAuthState(input.token, TELEGRAM_AUTH_APPROVED_TTL_SECONDS, {
    createdAt: state.createdAt,
    sessionExpiresAt: session.session.expiresAt,
    sessionToken: session.session.token,
    status: 'approved',
    username: input.telegramUsername,
  })

  return {
    status: 'approved' as const,
    user,
    username: input.telegramUsername,
  }
}

export function setTestTelegramAuthStore(store: KeyValueStore | null) {
  testStore = store
}
