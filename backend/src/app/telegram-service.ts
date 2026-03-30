import { randomInt } from 'node:crypto'
import type { PulseSmartMoneySignal, PulseSmartMoneyWallet } from '../contracts/pulse-smart-money.js'
import { buildMarketUrl } from './alert-email-template.js'
import {
  createTelegramConnectCode,
  findActiveTelegramConnectCodeByChatId,
  getTelegramUpdatesCursor,
  saveTelegramUpdatesCursor,
} from '../db/auth-repository.js'
import {
  getQuorumTelegramBotToken,
  getQuorumTelegramConnectCodeTtlMinutes,
  getQuorumTelegramPollIntervalMs,
} from '../db/config.js'

type TelegramUpdate = {
  message?: {
    chat?: {
      id: number | string
      type?: string
    }
    from?: {
      first_name?: string
      id: number | string
      last_name?: string
      username?: string
    }
    text?: string
  }
  update_id: number
}

type TelegramMessageFrom = NonNullable<NonNullable<TelegramUpdate['message']>['from']>

type TelegramApi = {
  getUpdates: (input: {
    allowedUpdates: string[]
    limit: number
    offset: number
    timeoutSeconds: number
  }) => Promise<TelegramUpdate[]>
  sendMessage: (input: {
    chatId: string
    text: string
  }) => Promise<{
    providerMessageId: string | null
  }>
}

const TELEGRAM_UPDATES_STREAM_KEY = 'telegram-bot-updates'
let telegramPollingInterval: NodeJS.Timeout | null = null
let testTelegramApi: TelegramApi | null = null

function getTelegramApiBaseUrl() {
  const token = getQuorumTelegramBotToken()

  if (!token) {
    return null
  }

  return `https://api.telegram.org/bot${token}`
}

async function callTelegramMethod<T>(method: string, body: Record<string, unknown>) {
  const baseUrl = getTelegramApiBaseUrl()

  if (!baseUrl) {
    throw new Error('Telegram bot token is not configured.')
  }

  const response = await fetch(`${baseUrl}/${method}`, {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Telegram API request failed with status ${response.status}.`)
  }

  const payload = await response.json() as {
    ok: boolean
    result?: T
  }

  if (!payload.ok || payload.result === undefined) {
    throw new Error(`Telegram API ${method} failed.`)
  }

  return payload.result
}

function getTelegramApi(): TelegramApi | null {
  if (testTelegramApi) {
    return testTelegramApi
  }

  if (!getQuorumTelegramBotToken()) {
    return null
  }

  return {
    async getUpdates(input) {
      return callTelegramMethod<TelegramUpdate[]>('getUpdates', {
        allowed_updates: input.allowedUpdates,
        limit: input.limit,
        offset: input.offset,
        timeout: input.timeoutSeconds,
      })
    },
    async sendMessage(input) {
      const result = await callTelegramMethod<{ message_id?: number | string }>('sendMessage', {
        chat_id: input.chatId,
        text: input.text,
      })

      return {
        providerMessageId:
          result.message_id === undefined ? null : String(result.message_id),
      }
    },
  }
}

function isConnectCommand(text: string | undefined) {
  const normalized = text?.trim().toLowerCase()

  if (!normalized) {
    return false
  }

  return normalized === '/start' || normalized.startsWith('/start ') || normalized === '/connect'
}

function buildTelegramHandle(messageFrom: TelegramMessageFrom | undefined) {
  const username = messageFrom?.username?.trim()

  if (username) {
    return `@${username.replace(/^@+/, '')}`
  }

  const firstName = messageFrom?.first_name?.trim()
  const lastName = messageFrom?.last_name?.trim()
  const fallback = [firstName, lastName].filter(Boolean).join(' ').trim()

  return fallback || 'Telegram'
}

function buildConnectReply(code: string) {
  return [
    'Your Quorum connect code:',
    code,
    '',
    'Enter this on Quorum within 15 minutes to finish connecting Telegram.',
  ].join('\n')
}

async function issueConnectCodeForChat(input: {
  chatId: string
  telegramHandle: string
}) {
  const existingCode = await findActiveTelegramConnectCodeByChatId(input.chatId)

  if (existingCode) {
    return existingCode.code
  }

  const expiresAt = new Date(
    Date.now() + getQuorumTelegramConnectCodeTtlMinutes() * 60 * 1000,
  ).toISOString()

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0')

    try {
      await createTelegramConnectCode({
        chatId: input.chatId,
        code,
        expiresAt,
        telegramHandle: input.telegramHandle,
      })

      return code
    } catch (error) {
      const postgresError = error as Error & { code?: string }

      if (postgresError.code === '23505') {
        continue
      }

      throw error
    }
  }

  throw new Error('Could not issue a Telegram connect code.')
}

export async function pollTelegramBotUpdatesOnce(limit = 25) {
  const telegramApi = getTelegramApi()

  if (!telegramApi) {
    return {
      issuedCodes: 0,
      processedUpdates: 0,
    }
  }

  const lastUpdateId = await getTelegramUpdatesCursor(TELEGRAM_UPDATES_STREAM_KEY)
  const updates = await telegramApi.getUpdates({
    allowedUpdates: ['message'],
    limit,
    offset: lastUpdateId + 1,
    timeoutSeconds: 0,
  })

  if (!updates.length) {
    return {
      issuedCodes: 0,
      processedUpdates: 0,
    }
  }

  let issuedCodes = 0
  let highestUpdateId = lastUpdateId

  for (const update of updates) {
    highestUpdateId = Math.max(highestUpdateId, update.update_id)

    const message = update.message
    const chatId = message?.chat?.id
    const chatType = message?.chat?.type

    if (!message || chatId === undefined || chatType !== 'private' || !isConnectCommand(message.text)) {
      continue
    }

    const code = await issueConnectCodeForChat({
      chatId: String(chatId),
      telegramHandle: buildTelegramHandle(message.from),
    })

    await telegramApi.sendMessage({
      chatId: String(chatId),
      text: buildConnectReply(code),
    })

    issuedCodes += 1
  }

  await saveTelegramUpdatesCursor({
    lastUpdateId: highestUpdateId,
    streamKey: TELEGRAM_UPDATES_STREAM_KEY,
  })

  return {
    issuedCodes,
    processedUpdates: updates.length,
  }
}

function formatSignedPoints(value: number) {
  if (!Number.isFinite(value) || value === 0) {
    return '0.0'
  }

  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}`
}

function buildWalletSignalTelegramText(input: {
  signal: PulseSmartMoneySignal
  wallet: Pick<PulseSmartMoneyWallet, 'marketCount' | 'roi' | 'winRate'> | null
}) {
  const walletDisplayName =
    input.signal.walletDisplayName?.trim() || input.signal.walletShortAddress

  return [
    `${walletDisplayName} opened a new position.`,
    '',
    input.signal.marketTitle,
    `Opened: ${input.signal.outcome} @ ${(input.signal.entryPrice * 100).toFixed(0)}%`,
    `Position: $${Math.round(input.signal.size).toLocaleString()}`,
    `Current market: ${(input.signal.currentPrice * 100).toFixed(0)}% · ${formatSignedPoints(input.signal.priceDelta)} pts`,
    input.wallet
      ? `Wallet: win rate ${Math.round(input.wallet.winRate * 100)}% · ROI ${(input.wallet.roi * 100).toFixed(0)}% · ${input.wallet.marketCount} markets`
      : null,
    '',
    `View on Quorum: ${buildMarketUrl(input.signal)}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export async function sendWalletSignalAlertTelegram(input: {
  chatId: string
  signal: PulseSmartMoneySignal
  wallet: Pick<PulseSmartMoneyWallet, 'marketCount' | 'roi' | 'winRate'> | null
}) {
  const telegramApi = getTelegramApi()

  if (!telegramApi) {
    return {
      providerMessageId: null,
    }
  }

  return telegramApi.sendMessage({
    chatId: input.chatId,
    text: buildWalletSignalTelegramText({
      signal: input.signal,
      wallet: input.wallet,
    }),
  })
}

export function startTelegramBotWorker() {
  if (telegramPollingInterval || !getTelegramApi()) {
    return
  }

  void pollTelegramBotUpdatesOnce()
  telegramPollingInterval = setInterval(() => {
    void pollTelegramBotUpdatesOnce()
  }, getQuorumTelegramPollIntervalMs())
}

export function stopTelegramBotWorker() {
  if (!telegramPollingInterval) {
    return
  }

  clearInterval(telegramPollingInterval)
  telegramPollingInterval = null
}

export function setTestTelegramApi(api: TelegramApi | null) {
  testTelegramApi = api
}
