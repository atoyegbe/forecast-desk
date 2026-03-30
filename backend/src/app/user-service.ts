import type {
  PulseAuthUser,
  PulseTelegramConnectResult,
  PulseUserDefaultChannel,
  PulseUserPreferencesUpdateInput,
} from '../contracts/pulse-auth.js'
import { sendTelegramConnectedMessage } from '../bot/index.js'
import {
  clearVerificationFailureAttempts,
  consumeVerificationCode,
  isVerificationCooldownActive,
  recordFailedVerificationAttempt,
} from '../bot/verify.js'
import { failPendingTelegramDeliveriesForUser } from '../db/alerts-repository.js'
import {
  getUserById,
  updateUserPreferences,
  updateUserTelegramConnection,
} from '../db/auth-repository.js'
import { isValidEmail } from './auth-service.js'

type PostgresError = Error & {
  code?: string
}

const TELEGRAM_CODE_PATTERN = /^\d{6}$/

export class DuplicateUserEmailError extends Error {
  constructor() {
    super('That email address is already in use.')
  }
}

export class InvalidTelegramCodeError extends Error {
  constructor() {
    super('Invalid code. Try again.')
  }
}

export class TelegramVerificationCooldownError extends Error {
  constructor() {
    super('Too many invalid codes. Wait 10 minutes, then request a new code.')
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function isDefaultChannel(value: string): value is PulseUserDefaultChannel {
  return value === 'email' || value === 'telegram' || value === 'both'
}

function validateTelegramCode(code: string) {
  return TELEGRAM_CODE_PATTERN.test(code.trim())
}

async function handleFailedVerificationAttempt(userId: string): Promise<never> {
  const attemptCount = await recordFailedVerificationAttempt(userId)

  if (attemptCount >= 3) {
    throw new TelegramVerificationCooldownError()
  }

  throw new InvalidTelegramCodeError()
}

export async function getUserProfile(userId: string) {
  return getUserById(userId)
}

export async function updateUserProfilePreferences(
  userId: string,
  input: PulseUserPreferencesUpdateInput,
) {
  const currentUser = await getUserById(userId)

  if (!currentUser) {
    return null
  }

  const nextEmail = input.email === undefined
    ? undefined
    : normalizeEmail(input.email)

  if (nextEmail !== undefined && !isValidEmail(nextEmail)) {
    throw new Error('A valid email address is required.')
  }

  if (
    input.defaultChannel !== undefined &&
    !isDefaultChannel(input.defaultChannel)
  ) {
    throw new Error('Default channel is invalid.')
  }

  if (
    input.defaultChannel !== undefined &&
    input.defaultChannel !== 'email' &&
    !currentUser.telegramHandle
  ) {
    throw new Error('Connect Telegram before using it as a delivery default.')
  }

  try {
    return await updateUserPreferences({
      defaultChannel: input.defaultChannel,
      email: nextEmail,
      userId,
    })
  } catch (error) {
    if ((error as PostgresError).code === '23505') {
      throw new DuplicateUserEmailError()
    }

    throw error
  }
}

export async function connectTelegramChannel(
  user: PulseAuthUser,
  code: string,
): Promise<PulseTelegramConnectResult> {
  if (await isVerificationCooldownActive(user.id)) {
    throw new TelegramVerificationCooldownError()
  }

  const normalizedCode = code.trim()

  if (!validateTelegramCode(normalizedCode)) {
    await handleFailedVerificationAttempt(user.id)
  }

  const claimedCode = await consumeVerificationCode(normalizedCode)

  if (!claimedCode?.telegramHandle || !claimedCode.chatId) {
    return handleFailedVerificationAttempt(user.id)
  }

  const { chatId, telegramHandle } = claimedCode

  const connectedUser = await updateUserTelegramConnection({
    telegramChatId: chatId,
    telegramHandle,
    userId: user.id,
  })

  if (!connectedUser?.telegramHandle) {
    throw new InvalidTelegramCodeError()
  }

  await clearVerificationFailureAttempts(user.id)
  const confirmationResult = await sendTelegramConnectedMessage({
    chatId,
    email: user.email,
  })

  if (!confirmationResult.success) {
    console.warn(
      `Telegram connected confirmation failed for user ${user.id}: ${confirmationResult.error}`,
    )
  }

  return {
    handle: connectedUser.telegramHandle,
  }
}

export async function disconnectTelegramChannel(userId: string) {
  await failPendingTelegramDeliveriesForUser(
    userId,
    'Telegram connection removed.',
  )
  await updateUserTelegramConnection({
    telegramChatId: null,
    telegramHandle: null,
    userId,
  })

  return updateUserPreferences({
    defaultChannel: 'email',
    userId,
  })
}
