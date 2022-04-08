import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export type CreateInstance<T extends object = {}> = () => Promise<{
  instance: FastifyInstance
  context: T
}>

interface HandlerOptions {
  request: FastifyRequest
  reply: FastifyReply
  template: string
  manifest: Record<string, string[]>
}

export type Handler<T extends object = {}> = (
  options: HandlerOptions,
  context: T
) => Promise<{
  instance: FastifyInstance
  context: T
}>
