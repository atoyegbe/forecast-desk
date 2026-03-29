import type { FastifyPluginAsync } from 'fastify'
import { DuplicateAlertSubscriptionError } from '../../app/alerts-service.js'
import {
  createWalletAlertSubscription,
  deleteUserAlertSubscription,
  listUserAlertSubscriptions,
  updateUserAlertSubscription,
} from '../../app/alerts-service.js'
import { getBearerToken, getCurrentSession } from '../../app/auth-service.js'
import {
  createApiErrorResponse,
  createApiResponse,
} from '../../contracts/api-response.js'
import type { PulseAuthCurrentSession } from '../../contracts/pulse-auth.js'
import type {
  PulseAlertSubscription,
  PulseAlertSubscriptionCreateInput,
  PulseAlertSubscriptionListData,
  PulseAlertSubscriptionUpdateInput,
} from '../../contracts/pulse-alerts.js'

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

export const v1AlertRoutes: FastifyPluginAsync = async (app) => {
  app.get('/alerts/subscriptions', async (request, reply) => {
    const session = await requireSession(request, reply)

    if (!session) {
      return
    }

    const items = await listUserAlertSubscriptions(session.user.id)

    return createApiResponse<PulseAlertSubscriptionListData>({
      items,
    })
  })

  app.post<{
    Body: PulseAlertSubscriptionCreateInput
  }>('/alerts/subscriptions', async (request, reply) => {
    const session = await requireSession(request, reply)

    if (!session) {
      return
    }

    try {
      const subscription = await createWalletAlertSubscription(
        session.user.id,
        request.body,
      )

      reply.code(201)

      return createApiResponse<PulseAlertSubscription>(subscription)
    } catch (error) {
      if (error instanceof DuplicateAlertSubscriptionError) {
        return replyWithError(reply, 409, 'DUPLICATE_ALERT', error.message)
      }

      if (error instanceof Error) {
        return replyWithError(reply, 400, 'INVALID_ALERT', error.message)
      }

      throw error
    }
  })

  app.delete<{
    Params: {
      id: string
    }
  }>('/alerts/subscriptions/:id', async (request, reply) => {
    const session = await requireSession(request, reply)

    if (!session) {
      return
    }

    const deleted = await deleteUserAlertSubscription(
      session.user.id,
      request.params.id,
    )

    if (!deleted) {
      return replyWithError(
        reply,
        404,
        'ALERT_NOT_FOUND',
        'Alert subscription was not found.',
      )
    }

    return reply.code(204).send()
  })

  app.patch<{
    Body: PulseAlertSubscriptionUpdateInput
    Params: {
      id: string
    }
  }>('/alerts/subscriptions/:id', async (request, reply) => {
    const session = await requireSession(request, reply)

    if (!session) {
      return
    }

    try {
      const subscription = await updateUserAlertSubscription(
        session.user.id,
        request.params.id,
        request.body,
      )

      if (!subscription) {
        return replyWithError(
          reply,
          404,
          'ALERT_NOT_FOUND',
          'Alert subscription was not found.',
        )
      }

      return createApiResponse<PulseAlertSubscription>(subscription)
    } catch (error) {
      if (error instanceof Error) {
        return replyWithError(reply, 400, 'INVALID_ALERT', error.message)
      }

      throw error
    }
  })
}
