import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export type CreateInstance<T extends object = {}> = () => Promise<{
  instance: FastifyInstance
  context: T
}>

interface SSRHandlerOptions {
  request: FastifyRequest
  reply: FastifyReply
  template: string
  manifest: Record<string, string[]>
}

export type SSRHandler<T extends object = {}> = (
  options: SSRHandlerOptions,
  context: T
) => Promise<FastifyReply>

export type APIHandler<T extends object = {}> = (
  instance: FastifyInstance,
  context: T
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => any
