import type {
  PulseAuthUser,
  PulseTelegramConnectResult,
  PulseUserDefaultChannel,
  PulseUserPreferencesUpdateInput,
} from '../contracts/pulse-auth.js'
import {
  claimTelegramConnectCode,
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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function isDefaultChannel(value: string): value is PulseUserDefaultChannel {
  return value === 'email' || value === 'telegram' || value === 'both'
}

function validateTelegramCode(code: string) {
  if (!TELEGRAM_CODE_PATTERN.test(code.trim())) {
    throw new InvalidTelegramCodeError()
  }
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
  validateTelegramCode(code)
  const connectedUser = await claimTelegramConnectCode({
    code: code.trim(),
    userId: user.id,
  })

  if (!connectedUser?.telegramHandle) {
    throw new InvalidTelegramCodeError()
  }

  return {
    handle: connectedUser.telegramHandle,
  }
}

export async function disconnectTelegramChannel(userId: string) {
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
