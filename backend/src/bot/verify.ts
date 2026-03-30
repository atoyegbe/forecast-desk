import type TelegramBot from 'node-telegram-bot-api'
import { createClient } from 'redis'
import { getRedisUrl } from '../db/config.js'

const TELEGRAM_VERIFICATION_CODE_TTL_SECONDS = 15 * 60
const TELEGRAM_VERIFICATION_COOLDOWN_SECONDS = 10 * 60
const TELEGRAM_VERIFICATION_MAX_ATTEMPTS = 3

type VerificationPayload = {
  chatId: string
  createdAt: number
  telegramHandle: string
}

type KeyValueStore = {
  del: (...keys: string[]) => Promise<void>
  expire: (key: string, ttlSeconds: number) => Promise<void>
  get: (key: string) => Promise<string | null>
  incr: (key: string) => Promise<number>
  setEx: (key: string, ttlSeconds: number, value: string) => Promise<void>
}

type ExpiringValue = {
  expiresAt: number
  value: string
}

class MemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, ExpiringValue>()

  private prune(key: string) {
    const current = this.values.get(key)

    if (current && current.expiresAt <= Date.now()) {
      this.values.delete(key)
    }
  }

  async del(...keys: string[]) {
    for (const key of keys) {
      this.values.delete(key)
    }
  }

  async expire(key: string, ttlSeconds: number) {
    this.prune(key)
    const current = this.values.get(key)

    if (!current) {
      return
    }

    current.expiresAt = Date.now() + ttlSeconds * 1_000
    this.values.set(key, current)
  }

  async get(key: string) {
    this.prune(key)
    return this.values.get(key)?.value ?? null
  }

  async incr(key: string) {
    this.prune(key)
    const currentValue = Number.parseInt(this.values.get(key)?.value ?? '0', 10)
    const nextValue = (Number.isNaN(currentValue) ? 0 : currentValue) + 1
    const currentExpiry = this.values.get(key)?.expiresAt ?? Date.now() + 60_000

    this.values.set(key, {
      expiresAt: currentExpiry,
      value: String(nextValue),
    })

    return nextValue
  }

  async setEx(key: string, ttlSeconds: number, value: string) {
    this.values.set(key, {
      expiresAt: Date.now() + ttlSeconds * 1_000,
      value,
    })
  }
}

const fallbackStore = new MemoryKeyValueStore()
const loggedWarnings = new Set<string>()
let redisClientPromise: Promise<ReturnType<typeof createClient> | null> | null = null
let testStore: KeyValueStore | null = null

function logWarningOnce(message: string, error?: unknown) {
  if (loggedWarnings.has(message)) {
    return
  }

  loggedWarnings.add(message)
  console.warn(message, error ?? '')
}

function buildAttemptsKey(userId: string) {
  return `telegram:verify:attempts:${userId}`
}

function buildChatCodeKey(chatId: string) {
  return `telegram:verify:chat:${chatId}`
}

function buildCodeKey(code: string) {
  return `telegram:verify:${code}`
}

async function createRedisStore(): Promise<KeyValueStore | null> {
  const redisUrl = getRedisUrl()

  if (!redisUrl) {
    logWarningOnce(
      'Telegram verification is using in-memory storage because REDIS_URL is not set.',
    )
    return null
  }

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      const client = createClient({
        url: redisUrl,
      })

      client.on('error', (error) => {
        logWarningOnce('Telegram verification Redis client error.', error)
      })

      try {
        await client.connect()
        return client
      } catch (error) {
        logWarningOnce(
          'Telegram verification failed to connect to Redis. Falling back to in-memory storage.',
          error,
        )
        return null
      }
    })()
  }

  const client = await redisClientPromise

  if (!client) {
    return null
  }

  return {
    async del(...keys: string[]) {
      if (!keys.length) {
        return
      }

      await client.del(keys)
    },
    async expire(key: string, ttlSeconds: number) {
      await client.expire(key, ttlSeconds)
    },
    get(key: string) {
      return client.get(key)
    },
    incr(key: string) {
      return client.incr(key)
    },
    async setEx(key: string, ttlSeconds: number, value: string) {
      await client.set(key, value, {
        EX: ttlSeconds,
      })
    },
  } satisfies KeyValueStore
}

async function getStore() {
  if (testStore) {
    return testStore
  }

  return (await createRedisStore()) ?? fallbackStore
}

function buildPayload(input: {
  chatId: string
  telegramHandle: string
}): VerificationPayload {
  return {
    chatId: input.chatId,
    createdAt: Date.now(),
    telegramHandle: input.telegramHandle,
  }
}

function normalizeChatId(chatId: number | string) {
  return String(chatId).trim()
}

export function buildTelegramHandle(
  from:
    | Pick<TelegramBot.User, 'first_name' | 'last_name' | 'username'>
    | undefined,
) {
  const username = from?.username?.trim()

  if (username) {
    return `@${username.replace(/^@+/, '')}`
  }

  const firstName = from?.first_name?.trim()
  const lastName = from?.last_name?.trim()
  const fallback = [firstName, lastName].filter(Boolean).join(' ').trim()

  return fallback || 'Telegram'
}

export function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function clearVerificationFailureAttempts(userId: string) {
  const store = await getStore()
  await store.del(buildAttemptsKey(userId))
}

export async function clearVerificationStateForChat(chatId: number | string) {
  const store = await getStore()
  const normalizedChatId = normalizeChatId(chatId)
  const existingCode = await store.get(buildChatCodeKey(normalizedChatId))

  if (existingCode) {
    await store.del(buildChatCodeKey(normalizedChatId), buildCodeKey(existingCode))
    return
  }

  await store.del(buildChatCodeKey(normalizedChatId))
}

export async function consumeVerificationCode(code: string) {
  const store = await getStore()
  const rawValue = await store.get(buildCodeKey(code))

  if (!rawValue) {
    return null
  }

  let payload: VerificationPayload | null = null

  try {
    payload = JSON.parse(rawValue) as VerificationPayload
  } catch {
    payload = null
  }

  await store.del(buildCodeKey(code))

  if (!payload?.chatId) {
    return null
  }

  await store.del(buildChatCodeKey(payload.chatId))
  return payload
}

export async function getVerificationFailureAttempts(userId: string) {
  const store = await getStore()
  const rawValue = await store.get(buildAttemptsKey(userId))
  const attempts = Number.parseInt(rawValue ?? '0', 10)

  return Number.isNaN(attempts) ? 0 : attempts
}

export async function isVerificationCooldownActive(userId: string) {
  const attempts = await getVerificationFailureAttempts(userId)
  return attempts >= TELEGRAM_VERIFICATION_MAX_ATTEMPTS
}

export async function issueVerificationCode(input: {
  chatId: number | string
  telegramHandle: string
}) {
  const store = await getStore()
  const chatId = normalizeChatId(input.chatId)
  const existingCode = await store.get(buildChatCodeKey(chatId))

  if (existingCode) {
    await store.del(buildChatCodeKey(chatId), buildCodeKey(existingCode))
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateVerificationCode()
    const existingPayload = await store.get(buildCodeKey(code))

    if (existingPayload) {
      continue
    }

    const payload = JSON.stringify(
      buildPayload({
        chatId,
        telegramHandle: input.telegramHandle,
      }),
    )

    await Promise.all([
      store.setEx(
        buildCodeKey(code),
        TELEGRAM_VERIFICATION_CODE_TTL_SECONDS,
        payload,
      ),
      store.setEx(
        buildChatCodeKey(chatId),
        TELEGRAM_VERIFICATION_CODE_TTL_SECONDS,
        code,
      ),
    ])

    return code
  }

  throw new Error('Could not issue a Telegram verification code.')
}

export async function recordFailedVerificationAttempt(userId: string) {
  const store = await getStore()
  const attempts = await store.incr(buildAttemptsKey(userId))

  await store.expire(
    buildAttemptsKey(userId),
    TELEGRAM_VERIFICATION_COOLDOWN_SECONDS,
  )

  return attempts
}

export function setTestVerificationStore(store: KeyValueStore | null) {
  testStore = store
}
