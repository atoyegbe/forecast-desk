import type TelegramBot from 'node-telegram-bot-api'
import { approveTelegramAuth } from '../app/telegram-auth-service.js'
import {
  countActiveAlertSubscriptionsByUser,
  failPendingTelegramDeliveriesForUser,
} from '../db/alerts-repository.js'
import {
  getUserByTelegramChatId,
  updateUserPreferences,
  updateUserTelegramConnection,
} from '../db/auth-repository.js'
import {
  escapeMarkdown,
  notConnectedMessage,
  startMessage,
  statusMessage,
  stopMessage,
  unknownMessage,
  verificationMessage,
} from './messages.js'
import {
  buildTelegramHandle,
  clearVerificationStateForChat,
  issueVerificationCode,
} from './verify.js'

const START_COMMAND = /^\/start(?:@\w+)?(?:\s+(.+))?$/i
const STATUS_COMMAND = /^\/status(?:@\w+)?$/i
const STOP_COMMAND = /^\/stop(?:@\w+)?$/i
const TELEGRAM_CONNECT_START_PARAMETER = 'connect'
const VERIFICATION_CODE_PATTERN = /^\d{6}$/

export type TelegramBotLike = Pick<
  TelegramBot,
  'on' | 'onText' | 'sendMessage'
>

function getChatId(message: TelegramBot.Message) {
  return String(message.chat.id)
}

function getMessageText(message: TelegramBot.Message) {
  return message.text?.trim() ?? ''
}

function isPrivateChat(message: TelegramBot.Message) {
  return message.chat.type === 'private'
}

function isKnownCommand(text: string) {
  return (
    START_COMMAND.test(text) ||
    STATUS_COMMAND.test(text) ||
    STOP_COMMAND.test(text)
  )
}

async function sendMarkdownMessage(
  bot: TelegramBotLike,
  chatId: string,
  text: string,
) {
  await bot.sendMessage(chatId, text, {
    disable_web_page_preview: true,
    parse_mode: 'MarkdownV2',
  })
}

async function disconnectTelegramUser(chatId: string) {
  const user = await getUserByTelegramChatId(chatId)

  if (!user) {
    await clearVerificationStateForChat(chatId)
    return null
  }

  await failPendingTelegramDeliveriesForUser(
    user.id,
    'Telegram connection removed.',
  )
  await Promise.all([
    updateUserTelegramConnection({
      telegramChatId: null,
      telegramHandle: null,
      userId: user.id,
    }),
    updateUserPreferences({
      defaultChannel: 'email',
      userId: user.id,
    }),
    clearVerificationStateForChat(chatId),
  ])

  return user
}

function logHandlerError(command: string, error: unknown) {
  console.error(`Telegram bot ${command} handler failed:`, error)
}

function getTelegramUsername(
  from: Pick<TelegramBot.User, 'username'> | undefined,
) {
  const username = from?.username?.trim()

  return username ? username.replace(/^@+/, '') : null
}

function buildSignedInConfirmationMessage(firstName?: string | null) {
  const normalizedFirstName = firstName?.trim()
  const welcomeLine = normalizedFirstName
    ? `Welcome, ${escapeMarkdown(normalizedFirstName)}\\. Switch back to Quorum to continue\\.`
    : 'You are connected\\. Switch back to Quorum to continue\\.'

  return `
*Signed in to Quorum* ✓

${welcomeLine}

You'll receive smart money alerts here when watched wallets move\\.

Use /stop at any time to disconnect\\.
`
}

async function handleDeepLinkAuth(
  bot: TelegramBotLike,
  message: TelegramBot.Message,
  token: string,
) {
  if (!token) {
    await sendMarkdownMessage(
      bot,
      getChatId(message),
      'This sign\\-in link has expired\\. Please go back to Quorum and try again\\.',
    )
    return
  }

  try {
    const result = await approveTelegramAuth({
      telegramChatId: getChatId(message),
      telegramHandle: buildTelegramHandle(message.from),
      telegramUsername: getTelegramUsername(message.from),
      token,
    })

    if (result.status === 'expired') {
      await sendMarkdownMessage(
        bot,
        getChatId(message),
        'This sign\\-in link has expired\\. Please go back to Quorum and try again\\.',
      )
      return
    }

    if (result.status === 'already-used') {
      await sendMarkdownMessage(
        bot,
        getChatId(message),
        'This link has already been used\\.',
      )
      return
    }

    await sendMarkdownMessage(
      bot,
      getChatId(message),
      buildSignedInConfirmationMessage(message.from?.first_name),
    )
  } catch (error) {
    logHandlerError('deep-link auth', error)
    await sendMarkdownMessage(
      bot,
      getChatId(message),
      'Something went wrong\\. Please try again from the Quorum website\\.',
    )
  }
}

async function handleVerificationStart(
  bot: TelegramBotLike,
  message: TelegramBot.Message,
) {
  const code = await issueVerificationCode({
    chatId: message.chat.id,
    telegramHandle: buildTelegramHandle(message.from),
  })

  await sendMarkdownMessage(bot, getChatId(message), verificationMessage(code))
}

export async function handleStartCommand(
  bot: TelegramBotLike,
  message: TelegramBot.Message,
  parameter?: string | null,
) {
  if (!isPrivateChat(message)) {
    return
  }

  const normalizedParameter = parameter?.trim()

  if (normalizedParameter?.startsWith('auth_')) {
    const token = normalizedParameter.slice('auth_'.length).trim()
    await handleDeepLinkAuth(bot, message, token)
    return
  }

  if (normalizedParameter?.toLowerCase() === TELEGRAM_CONNECT_START_PARAMETER) {
    await handleVerificationStart(bot, message)
    return
  }

  await sendMarkdownMessage(bot, getChatId(message), startMessage())
}

export async function handleStatusCommand(
  bot: TelegramBotLike,
  message: TelegramBot.Message,
) {
  if (!isPrivateChat(message)) {
    return
  }

  const chatId = getChatId(message)
  const user = await getUserByTelegramChatId(chatId)

  if (!user) {
    await sendMarkdownMessage(bot, chatId, notConnectedMessage())
    return
  }

  const activeSubscriptionCount = await countActiveAlertSubscriptionsByUser(user.id)

  await sendMarkdownMessage(
    bot,
    chatId,
    statusMessage(user.email ?? user.telegramHandle ?? 'Telegram', activeSubscriptionCount),
  )
}

export async function handleStopCommand(
  bot: TelegramBotLike,
  message: TelegramBot.Message,
) {
  if (!isPrivateChat(message)) {
    return
  }

  const chatId = getChatId(message)
  const user = await disconnectTelegramUser(chatId)

  if (!user) {
    await sendMarkdownMessage(bot, chatId, notConnectedMessage())
    return
  }

  await sendMarkdownMessage(bot, chatId, stopMessage())
}

export async function handleUnknownMessage(
  bot: TelegramBotLike,
  message: TelegramBot.Message,
) {
  if (!isPrivateChat(message)) {
    return
  }

  const text = getMessageText(message)

  if (!text || isKnownCommand(text) || VERIFICATION_CODE_PATTERN.test(text)) {
    return
  }

  await sendMarkdownMessage(bot, getChatId(message), unknownMessage())
}

export function registerBotHandlers(bot: TelegramBotLike) {
  bot.onText(START_COMMAND, (message, match) => {
    void handleStartCommand(bot, message, match?.[1]).catch((error) => {
      logHandlerError('/start', error)
    })
  })

  bot.onText(STOP_COMMAND, (message) => {
    void handleStopCommand(bot, message).catch((error) => {
      logHandlerError('/stop', error)
    })
  })

  bot.onText(STATUS_COMMAND, (message) => {
    void handleStatusCommand(bot, message).catch((error) => {
      logHandlerError('/status', error)
    })
  })

  bot.on('message', (message) => {
    void handleUnknownMessage(bot, message).catch((error) => {
      logHandlerError('message', error)
    })
  })
}
