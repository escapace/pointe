import { CreateApp } from '@yeuxjs/types'
import { writeAssets } from '@yeuxjs/write-assets'
import bodyParser from 'body-parser'
import express from 'express'
import { fromNodeHeaders, toNodeHeaders } from 'fastify-fetch'
import { readFile } from 'fs/promises'
import { assign, omit } from 'lodash-es'
import path from 'path'
import { isNativeError } from 'util/types'
import { State } from '../types'
import {
  extensionFont,
  extensionImage,
  hasExtension
} from '../utilities/create-asset-file-names'
import { emptyDir } from '../utilities/empty-dir'

export async function dev(state: State) {
  await emptyDir(state.clientOutputDirectory)

  const server = express()
  server.disable('x-powered-by')

  const instance = server.listen(state.serverPort, state.serverHost)
  const current = await state.resolveConfig()

  const viteDevServier = await state.vite.createServer(
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
          emptyOutDir: false,
          minify: false,
          terserOptions: undefined
        },
        plugins: [
          writeAssets({
            outDir: state.clientOutputDirectory,
            publicDir: true,
            include: (file) =>
              hasExtension(file, [...extensionImage, ...extensionFont])
          })
        ],
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
      // TODO: dobule check worker
      ['assetsInclude', 'worker']
    )
  )

  server.use(viteDevServier.middlewares)

  server.use(
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
    server.get('/service-worker.js', (_, response) => {
      return response
        .type('text/javascript')
        .send(SELF_DESTROYING_SERVICE_WORKER)
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  server.use('*', async (incoming, outgoing, next) => {
    const url = `${incoming.protocol}://${incoming.get('host') ?? 'localhost'}${
      incoming.originalUrl
    }`

    try {
      let template = await readFile(state.templatePath, 'utf-8')

      template = await viteDevServier.transformIndexHtml(url, template)

      const {
        createApp: createAppA,
        createServer: createAppB,
        createYeuxApp: createAppC,
        default: createAppD
      } = (await viteDevServier.ssrLoadModule(
        path.relative(state.directory, state.serverEntryPath)
      )) as {
        createApp: CreateApp
        createServer: CreateApp
        createYeuxApp: CreateApp
        default: CreateApp
      }

      const { fetch } = await (
        createAppA ??
        createAppB ??
        createAppC ??
        createAppD
      )({
        command: 'dev',
        template,
        mode: state.nodeEnv as 'development',
        moduleGraph: viteDevServier.moduleGraph
      })

      const body =
        incoming.method === 'GET' || incoming.method === 'HEAD'
          ? undefined
          : (incoming.body as Buffer)

      const response = await fetch(url, {
        method: incoming.method,
        body,
        // @ts-expect-error undici/fetch compat
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
        viteDevServier.ssrFixStacktrace(e)
      }

      next(e)
    }
  })
}
