import type {
  PulseAuthUser,
  PulseTelegramConnectResult,
  PulseUserDefaultChannel,
  PulseUserPreferencesUpdateInput,
} from '../contracts/pulse-auth.js'
import { getPulseTelegramConnectCode } from '../db/config.js'
import {
  getUserById,
  updateUserPreferences,
  updateUserTelegramHandle,
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

function buildTelegramHandle(email: string) {
  const localPart = normalizeEmail(email).split('@')[0] ?? 'quorum'
  const normalizedHandle = localPart.replace(/[^a-z0-9_]/gi, '').toLowerCase()

  return `@${normalizedHandle || 'quorum'}`
}

function validateTelegramCode(code: string) {
  if (!TELEGRAM_CODE_PATTERN.test(code.trim())) {
    throw new InvalidTelegramCodeError()
  }

  const configuredCode = getPulseTelegramConnectCode()

  if (configuredCode && configuredCode !== code.trim()) {
    throw new InvalidTelegramCodeError()
  }

  if (!configuredCode && code.trim() === '000000') {
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
  const handle = buildTelegramHandle(user.email)

  await updateUserTelegramHandle({
    telegramHandle: handle,
    userId: user.id,
  })

  return {
    handle,
  }
}

export async function disconnectTelegramChannel(userId: string) {
  await updateUserTelegramHandle({
    telegramHandle: null,
    userId,
  })

  return updateUserPreferences({
    defaultChannel: 'email',
    userId,
  })
}
