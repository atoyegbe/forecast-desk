/*
  SETUP:
  1. Message @BotFather on Telegram
  2. Send /newbot
  3. Set name: Quorum Alerts
  4. Set username: QuorumSignalsBot (or available variant)
  5. Copy the token into TELEGRAM_BOT_TOKEN in .env
  6. Send /setdescription to BotFather:
       "Get instant alerts when high-conviction
        Polymarket wallets open new positions."
  7. Send /setcommands to BotFather:
       start - Connect your Quorum account
       stop - Disconnect and pause alerts
       status - Check your connection status
  8. Send /setprivacy to BotFather -> Disable
     (bot only reads commands, not group messages)
*/

import TelegramBot from 'node-telegram-bot-api'
import { buildMarketUrl } from '../app/alert-email-template.js'
import type { PulseSmartMoneySignal } from '../contracts/pulse-smart-money.js'
import { getQuorumBaseUrl, getQuorumTelegramBotToken } from '../db/config.js'
import { registerBotHandlers, type TelegramBotLike } from './handlers.js'
import { alertMessage, connectedMessage, type AlertSignal } from './messages.js'

type BotInstance = TelegramBotLike & Partial<Pick<TelegramBot, 'startPolling' | 'stopPolling'>>

export type TelegramDeliveryResult = {
  error?: string
  providerMessageId?: string | null
  success: boolean
}

let pollingStarted = false
let realBot: TelegramBot | null = null
let registeredBot: BotInstance | null = null
let startupWarningLogged = false
let testBot: BotInstance | null = null

function formatCompactUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 1,
    notation: value >= 1_000 ? 'compact' : 'standard',
    style: 'currency',
  }).format(value)
}

function buildWalletUrl(walletAddress: string) {
  return new URL(
    `/smart-money/wallets/${encodeURIComponent(walletAddress.toLowerCase())}`,
    getQuorumBaseUrl(),
  ).toString()
}

function toProviderMessageId(message: TelegramBot.Message | undefined) {
  if (!message?.message_id && message?.message_id !== 0) {
    return null
  }

  return String(message.message_id)
}

function toTelegramAlertSignal(signal: PulseSmartMoneySignal): AlertSignal {
  return {
    currentDiff: signal.priceDelta * 100,
    currentPrice: signal.currentPrice * 100,
    entryPrice: signal.entryPrice * 100,
    marketTitle: signal.marketTitle,
    marketUrl: buildMarketUrl(signal),
    outcome: signal.outcome,
    positionSize: formatCompactUsd(signal.size),
    walletName: signal.walletDisplayName?.trim() || signal.walletShortAddress,
    walletRank: signal.walletRank,
    walletScore: signal.walletScore,
    walletUrl: buildWalletUrl(signal.walletAddress),
  }
}

function ensureRealBot() {
  const token = getQuorumTelegramBotToken()

  if (!token) {
    if (!startupWarningLogged) {
      console.warn(
        'Telegram bot token is not configured. Telegram delivery will stay disabled.',
      )
      startupWarningLogged = true
    }

    return null
  }

  if (!realBot) {
    realBot = new TelegramBot(token, {
      polling: false,
    })
    realBot.on('polling_error', (error) => {
      console.error('Telegram polling error:', error)
    })
  }

  return realBot
}

function getBot() {
  return testBot ?? ensureRealBot()
}

function ensureHandlersRegistered(bot: BotInstance) {
  if (registeredBot === bot) {
    return
  }

  registerBotHandlers(bot)
  registeredBot = bot
}

async function sendMarkdownMessage(
  chatId: number | string,
  text: string,
): Promise<TelegramDeliveryResult> {
  const activeBot = getBot()

  if (!activeBot) {
    return {
      error: 'telegram_disabled',
      success: false,
    }
  }

  try {
    const sentMessage = await activeBot.sendMessage(String(chatId), text, {
      disable_web_page_preview: true,
      parse_mode: 'MarkdownV2',
    })

    return {
      providerMessageId: toProviderMessageId(sentMessage),
      success: true,
    }
  } catch (error) {
    const telegramError = error as {
      message?: string
      response?: {
        body?: {
          description?: string
          error_code?: number
        }
      }
    }
    const errorCode = telegramError.response?.body?.error_code

    if (errorCode === 403) {
      return {
        error: 'user_blocked_bot',
        success: false,
      }
    }

    if (errorCode === 400) {
      return {
        error: 'invalid_chat_id',
        success: false,
      }
    }

    return {
      error:
        telegramError.response?.body?.description ||
        telegramError.message ||
        'telegram_send_failed',
      success: false,
    }
  }
}

export async function sendTelegramConnectedMessage(input: {
  chatId: number | string
  email: string
}) {
  return sendMarkdownMessage(input.chatId, connectedMessage(input.email))
}

export async function sendTelegramAlert(
  chatId: number | string,
  signal: AlertSignal | PulseSmartMoneySignal,
): Promise<TelegramDeliveryResult> {
  const normalizedSignal =
    'walletAddress' in signal ? toTelegramAlertSignal(signal) : signal

  await new Promise((resolve) => {
    setTimeout(resolve, 50)
  })

  return sendMarkdownMessage(chatId, alertMessage(normalizedSignal))
}

export function setTestTelegramBot(bot: BotInstance | null) {
  testBot = bot
  registeredBot = null
  pollingStarted = false
}

export async function startTelegramBotWorker() {
  const activeBot = getBot()

  if (!activeBot) {
    return
  }

  ensureHandlersRegistered(activeBot)

  if (!activeBot.startPolling || pollingStarted) {
    return
  }

  try {
    await activeBot.startPolling()
    pollingStarted = true
  } catch (error) {
    console.error(
      `Telegram bot failed to start: ${error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

export async function stopTelegramBotWorker() {
  const activeBot = getBot()

  if (!activeBot?.stopPolling || !pollingStarted) {
    return
  }

  try {
    await activeBot.stopPolling()
  } catch (error) {
    console.error('Telegram bot failed to stop cleanly:', error)
  } finally {
    pollingStarted = false
  }
}
