import type TelegramBot from 'node-telegram-bot-api'
import { setTestTelegramAuthStore } from '../../src/app/telegram-auth-service.js'
import { setTestTelegramBot } from '../../src/bot/index.js'
import { setTestVerificationStore } from '../../src/bot/verify.js'

type StoredValue = {
  expiresAt: number
  value: string
}

type SentMessage = {
  chatId: string
  options?: TelegramBot.SendMessageOptions
  text: string
}

function createVerificationStore() {
  const values = new Map<string, StoredValue>()

  function prune(key: string) {
    const current = values.get(key)

    if (current && current.expiresAt <= Date.now()) {
      values.delete(key)
    }
  }

  return {
    async del(...keys: string[]) {
      for (const key of keys) {
        values.delete(key)
      }
    },
    async expire(key: string, ttlSeconds: number) {
      prune(key)
      const current = values.get(key)

      if (!current) {
        return
      }

      current.expiresAt = Date.now() + ttlSeconds * 1_000
      values.set(key, current)
    },
    async get(key: string) {
      prune(key)
      return values.get(key)?.value ?? null
    },
    async incr(key: string) {
      prune(key)
      const currentValue = Number.parseInt(values.get(key)?.value ?? '0', 10)
      const nextValue = (Number.isNaN(currentValue) ? 0 : currentValue) + 1
      const currentExpiry = values.get(key)?.expiresAt ?? Date.now() + 60_000

      values.set(key, {
        expiresAt: currentExpiry,
        value: String(nextValue),
      })

      return nextValue
    },
    async setEx(key: string, ttlSeconds: number, value: string) {
      values.set(key, {
        expiresAt: Date.now() + ttlSeconds * 1_000,
        value,
      })
    },
  }
}

export class TestTelegramBot {
  readonly sentMessages: SentMessage[] = []

  async sendMessage(
    chatId: TelegramBot.ChatId,
    text: string,
    options?: TelegramBot.SendMessageOptions,
  ) {
    this.sentMessages.push({
      chatId: String(chatId),
      options,
      text,
    })

    return {
      chat: {
        id: typeof chatId === 'number' ? chatId : Number(chatId),
        type: 'private',
      },
      date: Math.floor(Date.now() / 1_000),
      message_id: this.sentMessages.length,
      text,
    } as TelegramBot.Message
  }

  on() {
    return this
  }

  onText() {
    return this
  }

  async startPolling() {}

  async stopPolling() {}
}

export function createTestTelegramMessage(input: {
  chatId?: number
  text: string
  username?: string
}) {
  return {
    chat: {
      id: input.chatId ?? 1001,
      type: 'private',
    },
    date: Math.floor(Date.now() / 1_000),
    from: {
      first_name: 'Reader',
      id: 5001,
      is_bot: false,
      username: input.username ?? 'reader_tg',
    },
    message_id: 1,
    text: input.text,
  } as TelegramBot.Message
}

export function registerTestTelegramBot() {
  const bot = new TestTelegramBot()
  const store = createVerificationStore()
  setTestTelegramBot(bot)
  setTestVerificationStore(store)
  setTestTelegramAuthStore(store)
  return bot
}

export function resetTestTelegramBot() {
  setTestTelegramBot(null)
  setTestVerificationStore(null)
  setTestTelegramAuthStore(null)
}
