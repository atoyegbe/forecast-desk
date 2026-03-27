import type { FastifyPluginAsync } from 'fastify'

const healthResponseSchema = {
  type: 'object',
  required: ['status', 'timestamp'],
  properties: {
    status: { type: 'string' },
    timestamp: { type: 'string' },
  },
} as const

export const healthRoute: FastifyPluginAsync = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
      }
    },
  )
}
