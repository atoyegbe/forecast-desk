import type { FastifyPluginAsync } from 'fastify'
import {
  AuthEmailInUseError,
  buildExpiredSessionCookie,
  buildSessionCookie,
  getCurrentSession,
  getSessionTokenFromHeaders,
  isValidEmail,
  logoutSession,
  requestEmailLinkForUser,
  requestPasswordlessLink,
  verifyPasswordlessLink,
} from '../../app/auth-service.js'
import {
  beginTelegramAuth,
  consumeTelegramAuthStatus,
} from '../../app/telegram-auth-service.js'
import {
  createApiErrorResponse,
  createApiResponse,
} from '../../contracts/api-response.js'
import type {
  PulseAuthCurrentSession,
  PulseAuthEmailLinkInput,
  PulseAuthEmailLinkResult,
  PulseAuthLogoutResult,
  PulseAuthRequestLinkInput,
  PulseAuthRequestLinkResult,
  PulseAuthVerifyLinkInput,
  PulseAuthVerifyLinkResult,
  PulseTelegramAuthInitResult,
  PulseTelegramAuthStatusResult,
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

function getRequestOrigin(request: {
  headers: {
    origin?: string
    referer?: string
  }
}) {
  const origin = request.headers.origin?.trim()

  if (origin) {
    return origin
  }

  const referer = request.headers.referer?.trim()

  if (!referer) {
    return null
  }

  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

async function requireSession(
  request: {
    headers: {
      authorization?: string
      cookie?: string
    }
  },
  reply: {
    code: (statusCode: number) => { send: (body: unknown) => unknown }
  },
): Promise<PulseAuthCurrentSession | null> {
  const token = getSessionTokenFromHeaders(request.headers)

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

export const v1AuthRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Body: PulseAuthRequestLinkInput
  }>('/auth/request-link', async (request, reply) => {
    const email = request.body?.email?.trim() ?? ''

    if (!isValidEmail(email)) {
      return replyWithError(
        reply,
        400,
        'INVALID_EMAIL',
        'A valid email address is required.',
      )
    }

    const result = await requestPasswordlessLink({
      email,
      requestOrigin: getRequestOrigin(request),
      returnToPath: request.body?.returnToPath,
    })

    return createApiResponse<PulseAuthRequestLinkResult>(result)
  })

  app.post<{
    Body: PulseAuthEmailLinkInput
  }>('/auth/email-link', async (request, reply) => {
    const session = await requireSession(request, reply)

    if (!session) {
      return
    }

    const email = request.body?.email?.trim() ?? ''

    if (!isValidEmail(email)) {
      return replyWithError(
        reply,
        400,
        'INVALID_EMAIL',
        'A valid email address is required.',
      )
    }

    try {
      const result = await requestEmailLinkForUser({
        email,
        requestOrigin: getRequestOrigin(request),
        returnToPath: '/alerts',
        userId: session.user.id,
      })

      return createApiResponse<PulseAuthEmailLinkResult>(result)
    } catch (error) {
      if (error instanceof AuthEmailInUseError) {
        return replyWithError(reply, 409, 'EMAIL_IN_USE', error.message)
      }

      throw error
    }
  })

  app.post('/auth/telegram/init', async () => {
    const result = await beginTelegramAuth()
    return createApiResponse<PulseTelegramAuthInitResult>(result)
  })

  app.get<{
    Querystring: {
      token?: string
    }
  }>('/auth/telegram/status', async (request, reply) => {
    const token = request.query?.token?.trim() ?? ''

    if (!token) {
      return replyWithError(
        reply,
        400,
        'TOKEN_REQUIRED',
        'A Telegram auth token is required.',
      )
    }

    const result = await consumeTelegramAuthStatus(token)

    if (result.status === 'approved') {
      reply.header(
        'Set-Cookie',
        buildSessionCookie(result.sessionToken, result.sessionExpiresAt),
      )

      return createApiResponse<PulseTelegramAuthStatusResult>({
        status: 'approved',
        username: result.username,
      })
    }

    return createApiResponse<PulseTelegramAuthStatusResult>(result)
  })

  app.post<{
    Body: PulseAuthVerifyLinkInput
  }>('/auth/verify-link', async (request, reply) => {
    const email = request.body?.email?.trim() ?? ''
    const token = request.body?.token?.trim() ?? ''

    if (!isValidEmail(email) || token.length < 8) {
      return replyWithError(
        reply,
        400,
        'INVALID_MAGIC_LINK',
        'A valid email address and magic link token are required.',
      )
    }

    try {
      const result = await verifyPasswordlessLink({
        email,
        token,
      })

      if (!result) {
        return replyWithError(
          reply,
          401,
          'INVALID_MAGIC_LINK',
          'That magic link is invalid or has expired.',
        )
      }

      if (result.status === 'signed-in') {
        reply.header(
          'Set-Cookie',
          buildSessionCookie(result.session.token, result.session.expiresAt),
        )
      }

      return createApiResponse<PulseAuthVerifyLinkResult>(result)
    } catch (error) {
      if (error instanceof AuthEmailInUseError) {
        return replyWithError(reply, 409, 'EMAIL_IN_USE', error.message)
      }

      throw error
    }
  })

  app.get('/auth/me', async (request, reply) => {
    const token = getSessionTokenFromHeaders(request.headers)

    if (!token) {
      return replyWithError(
        reply,
        401,
        'UNAUTHORIZED',
        'Authentication is required.',
      )
    }

    const session = await getCurrentSession(token)

    if (!session) {
      return replyWithError(
        reply,
        401,
        'UNAUTHORIZED',
        'Authentication is required.',
      )
    }

    return createApiResponse<PulseAuthCurrentSession>(session)
  })

  app.post('/auth/logout', async (request, reply) => {
    const token = getSessionTokenFromHeaders(request.headers)

    if (!token) {
      return replyWithError(
        reply,
        401,
        'UNAUTHORIZED',
        'Authentication is required.',
      )
    }

    const result = await logoutSession(token)
    reply.header('Set-Cookie', buildExpiredSessionCookie())

    return createApiResponse<PulseAuthLogoutResult>(result)
  })
}
