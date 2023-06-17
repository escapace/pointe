import { CreateApp } from '@yeuxjs/types'
import bodyParser from 'body-parser'
import express from 'express'
import { readFile } from 'fs/promises'
import { assign, omit } from 'lodash-es'
import path from 'path'
import { isNativeError } from 'util/types'
import { State } from '../types'
import { fromNodeHeaders, toNodeHeaders } from '../utilities/headers'

export async function dev(state: State) {
  const app = express()
  app.disable('x-powered-by')

  const instance = app.listen(state.serverPort, state.serverHost)

  const current = state.resolveConfig()

  const server = await state.vite.createServer(
    omit(
      assign({}, current, {
        ssr: {
          target: 'node' as const
        },
        root: state.directory,
        mode: 'development',
        logLevel: 'info' as const,
        appType: 'custom' as const,
        define: {
          ...state.viteConfig.define,
          YEUX_OPTIONS: JSON.stringify({ mode: 'development' })
        },
        build: {
          ...state.viteConfig.build,
          minify: false,
          terserOptions: undefined
        },
        server: {
          middlewareMode: true,
          strictPort: true,
          hmr: {
            server: instance
            // clientPort: state.serverHMRPort,
            // path: state.serverHMRPrefix,
            // port: state.serverHMRPort
          }
        }
      }),
      ['plugins', 'assetsInclude']
    )
  )

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

  const SELF_DESTROYING_SERVICE_WORKER = `self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  self.registration.unregister()
    .then(function() {
      return self.clients.matchAll();
    })
    .then(function(clients) {
      clients.forEach(client => client.navigate(client.url))
    });
});`

  if (state.serviceWorkerEntryExists) {
    app.get('/service-worker.js', (_, response) => {
      return response
        .type('text/javascript')
        .send(SELF_DESTROYING_SERVICE_WORKER)
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.use('*', async (incoming, outgoing, next) => {
    const url = `${incoming.protocol}://${incoming.get('host') ?? 'localhost'}${
      incoming.originalUrl
    }`

    try {
      let template = await readFile(state.templatePath, 'utf-8')

      template = await server.transformIndexHtml(url, template)

      const {
        createYeuxApp: createAppOne,
        createApp: createAppTwo,
        default: createAppThree
      } = (await server.ssrLoadModule(
        path.relative(state.directory, state.serverEntryPath)
      )) as {
        createYeuxApp: CreateApp
        createApp: CreateApp
        default: CreateApp
      }

      const { fetch } = await (createAppOne ?? createAppTwo ?? createAppThree)({
        command: 'dev',
        template,
        mode: state.nodeEnv as 'development',
        moduleGraph: server.moduleGraph
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
}
