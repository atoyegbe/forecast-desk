import type { FastifyPluginAsync } from 'fastify'
import {
  getBearerToken,
  getCurrentSession,
  isValidEmail,
  logoutSession,
  requestPasswordlessCode,
  verifyPasswordlessCode,
} from '../../app/auth-service.js'
import {
  createApiErrorResponse,
  createApiResponse,
} from '../../contracts/api-response.js'
import type {
  PulseAuthCurrentSession,
  PulseAuthLogoutResult,
  PulseAuthRequestCodeInput,
  PulseAuthRequestCodeResult,
  PulseAuthVerifyCodeInput,
  PulseAuthVerifyCodeResult,
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

export const v1AuthRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Body: PulseAuthRequestCodeInput
  }>('/auth/request-code', async (request, reply) => {
    const email = request.body?.email?.trim() ?? ''

    if (!isValidEmail(email)) {
      return replyWithError(
        reply,
        400,
        'INVALID_EMAIL',
        'A valid email address is required.',
      )
    }

    const result = await requestPasswordlessCode(email)

    return createApiResponse<PulseAuthRequestCodeResult>(result)
  })

  app.post<{
    Body: PulseAuthVerifyCodeInput
  }>('/auth/verify-code', async (request, reply) => {
    const email = request.body?.email?.trim() ?? ''
    const code = request.body?.code?.trim() ?? ''

    if (!isValidEmail(email) || code.length < 6) {
      return replyWithError(
        reply,
        400,
        'INVALID_LOGIN_CODE',
        'A valid email address and 6-digit code are required.',
      )
    }

    const result = await verifyPasswordlessCode({
      code,
      email,
    })

    if (!result) {
      return replyWithError(
        reply,
        401,
        'INVALID_LOGIN_CODE',
        'That login code is invalid or has expired.',
      )
    }

    return createApiResponse<PulseAuthVerifyCodeResult>(result)
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
