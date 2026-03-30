import type { FastifyPluginAsync } from 'fastify'
import {
  getBearerToken,
  getCurrentSession,
  isValidEmail,
  logoutSession,
  requestPasswordlessLink,
  verifyPasswordlessLink,
} from '../../app/auth-service.js'
import {
  createApiErrorResponse,
  createApiResponse,
} from '../../contracts/api-response.js'
import type {
  PulseAuthCurrentSession,
  PulseAuthLogoutResult,
  PulseAuthRequestLinkInput,
  PulseAuthRequestLinkResult,
  PulseAuthVerifyLinkInput,
  PulseAuthVerifyLinkResult,
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

    return createApiResponse<PulseAuthVerifyLinkResult>(result)
  })

  app.get('/auth/me', async (request, reply) => {
    const token = getBearerToken(request.headers.authorization)

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
    const token = getBearerToken(request.headers.authorization)

    if (!token) {
      return replyWithError(
        reply,
        401,
        'UNAUTHORIZED',
        'Authentication is required.',
      )
    }

    const result = await logoutSession(token)

    return createApiResponse<PulseAuthLogoutResult>(result)
  })
}
