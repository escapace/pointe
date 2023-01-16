import { CreateApp } from '@yeuxjs/types'
import bodyParser from 'body-parser'
import express from 'express'
import { readFile } from 'fs/promises'
import path from 'path'
import { isNativeError } from 'util/types'
import { State } from '../types'
import { fromNodeHeaders, toNodeHeaders } from '../utilities/headers'

export async function dev(state: State) {
  const app = express()
  app.disable('x-powered-by')

  const server = await state.vite.createServer({
    root: state.directory,
    mode: 'development',
    logLevel: 'info',
    appType: 'custom',
    server: {
      middlewareMode: true,
      strictPort: true,
      hmr: {
        clientPort: state.serverHMRPort,
        path: state.serverHMRPrefix,
        port: state.serverHMRPort
      }
    }
  })

  app.use(server.middlewares)

  app.use(
    bodyParser.raw({
      inflate: false,
      type: [
        'application/*',
        'text/*',
        'multipart/form-data',
        'application/x-www-form-urlencoded'
      ]
    })
  )

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.use('*', async (incoming, outgoing, next) => {
    const url = `${incoming.protocol}://${incoming.get('host') ?? 'localhost'}${
      incoming.originalUrl
    }`

    try {
      let template = await readFile(state.templatePath, 'utf-8')

      template = await server.transformIndexHtml(url, template)

      const { createApp } = (await server.ssrLoadModule(
        path.relative(state.directory, state.serverEntryPath)
      )) as { createApp: CreateApp }

      const { fetch } = await createApp({
        template,
        mode: state.nodeEnv
      })

      const body =
        incoming.method === 'GET' || incoming.method === 'HEAD'
          ? undefined
          : (incoming.body as Buffer)

      const response = await fetch(url, {
        method: incoming.method,
        body,
        headers: fromNodeHeaders(incoming.headers),
        cache: 'no-cache',
        credentials: 'include',
        keepalive: false,
        mode: 'no-cors',
        redirect: 'manual'
      })

      for (const [key, value] of Object.entries(
        toNodeHeaders(response.headers)
      )) {
        if (value === undefined) {
          continue
        }

        outgoing.setHeader(key, value)
      }

      outgoing.statusMessage = response.statusText

      outgoing
        .status(response.status)
        .end(Buffer.from(await response.arrayBuffer()))
    } catch (e) {
      if (isNativeError(e)) {
        server.ssrFixStacktrace(e)
      }

      next(e)
    }
  })

  app.listen(state.serverPort, state.serverHost)
}
