import type { FastifyPluginAsync } from 'fastify'
import { getBearerToken, getCurrentSession } from '../../app/auth-service.js'
import {
  DuplicateUserEmailError,
  InvalidTelegramCodeError,
  connectTelegramChannel,
  disconnectTelegramChannel,
  getUserProfile,
  updateUserProfilePreferences,
} from '../../app/user-service.js'
import {
  createApiErrorResponse,
  createApiResponse,
} from '../../contracts/api-response.js'
import type {
  PulseAuthCurrentSession,
  PulseAuthUser,
  PulseTelegramConnectInput,
  PulseTelegramConnectResult,
  PulseUserPreferencesUpdateInput,
} from '../../contracts/pulse-auth.js'

function replyWithError(
  reply: {
    code: (statusCode: number) => { send: (body: unknown) => unknown }
  },
  statusCode: number,
  code: string,
  message: string,
) {
  return reply.code(statusCode).send(createApiErrorResponse(code, message))
}

async function requireSession(
  request: {
    headers: {
      authorization?: string
    }
  },
  reply: {
    code: (statusCode: number) => { send: (body: unknown) => unknown }
  },
): Promise<PulseAuthCurrentSession | null> {
  const token = getBearerToken(request.headers.authorization)

  if (!token) {
    replyWithError(
      reply,
      401,
      'UNAUTHORIZED',
      'Authentication is required.',
    )

    return null
  }

  const session = await getCurrentSession(token)

  if (!session) {
    replyWithError(
      reply,
      401,
      'UNAUTHORIZED',
      'Authentication is required.',
    )

    return null
  }

  return session
}

export const v1UserRoutes: FastifyPluginAsync = async (app) => {
  app.get('/user/me', async (request, reply) => {
    const session = await requireSession(request, reply)

    if (!session) {
      return
    }

    const user = await getUserProfile(session.user.id)

    if (!user) {
      return replyWithError(reply, 404, 'USER_NOT_FOUND', 'User not found.')
    }

    return createApiResponse<PulseAuthUser>(user)
  })

  app.patch<{
    Body: PulseUserPreferencesUpdateInput
  }>('/user/preferences', async (request, reply) => {
    const session = await requireSession(request, reply)

    if (!session) {
      return
    }

    try {
      const user = await updateUserProfilePreferences(session.user.id, request.body ?? {})

      if (!user) {
        return replyWithError(reply, 404, 'USER_NOT_FOUND', 'User not found.')
      }

      return createApiResponse<PulseAuthUser>(user)
    } catch (error) {
      if (error instanceof DuplicateUserEmailError) {
        return replyWithError(reply, 409, 'EMAIL_IN_USE', error.message)
      }

      if (error instanceof Error) {
        return replyWithError(reply, 400, 'INVALID_USER_PREFERENCES', error.message)
      }

      throw error
    }
  })

  app.post<{
    Body: PulseTelegramConnectInput
  }>('/telegram/connect', async (request, reply) => {
    const session = await requireSession(request, reply)

    if (!session) {
      return
    }

    try {
      const result = await connectTelegramChannel(
        session.user,
        request.body?.code ?? '',
      )

      return createApiResponse<PulseTelegramConnectResult>(result)
    } catch (error) {
      if (error instanceof InvalidTelegramCodeError) {
        return replyWithError(reply, 400, 'invalid_code', error.message)
      }

      if (error instanceof Error) {
        return replyWithError(reply, 400, 'INVALID_TELEGRAM_CONNECT', error.message)
      }

      throw error
    }
  })

  const disconnectTelegram = async (
    request: {
      headers: {
        authorization?: string
      }
    },
    reply: {
      code: (statusCode: number) => { send: (body: unknown) => unknown }
      send: (body?: unknown) => unknown
    },
  ) => {
    const session = await requireSession(request, reply)

    if (!session) {
      return
    }

    await disconnectTelegramChannel(session.user.id)

    return reply.code(204).send(null)
  }

  app.delete('/telegram/connect', disconnectTelegram)
  app.delete('/telegram-connection', disconnectTelegram)
}
