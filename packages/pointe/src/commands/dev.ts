// eslint-disable-next-line unicorn/prevent-abbreviations
import { writeAssets } from '@pointe/plugin-write-assets'
import type { CreateApp } from '@pointe/types'
import bodyParser from 'body-parser'
import express from 'express'
import { fromNodeHeaders, toNodeHeaders } from 'fastify-fetch'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { isNativeError } from 'node:util/types'
import type { State } from '../types'
import { extensionFont, extensionImage, hasExtension } from '../utilities/create-asset-file-names'
import { emptyDirectory } from '../utilities/empty-directory'

// eslint-disable-next-line unicorn/prevent-abbreviations
export async function dev(state: State) {
  await emptyDirectory(state.clientOutputDirectory)

  const server = express()
  server.disable('x-powered-by')

  const instance = server.listen(state.serverPort, state.serverHost)
  // const current = await state.resolveConfig()

  // TODO: make it work with changes to vite.config.ts
  const viteDevelopmentServier = await state.vite.createServer({
    appType: 'custom' as const,
    build: {
      emptyOutDir: false,
      minify: false,
      terserOptions: undefined,
    },
    define: {
      POINTE_OPTIONS: JSON.stringify({ mode: 'development' }),
    },
    logLevel: 'info' as const,
    mode: 'development',
    plugins: [
      writeAssets({
        include: (file) => hasExtension(file, [...extensionImage, ...extensionFont]),
        outDir: state.clientOutputDirectory,
        publicDir: true,
      }),
    ],
    root: state.directory,
    server: {
      hmr: {
        server: instance,
        // clientPort: state.serverHMRPort,
        // path: state.serverHMRPrefix,
        // port: state.serverHMRPort
      },
      middlewareMode: true,
      strictPort: true,
    },
    ssr: {
      target: 'node' as const,
    },
  })

  server.use(viteDevelopmentServier.middlewares)

  server.use(
    bodyParser.raw({
      inflate: false,
      type: ['application/*', 'text/*', 'multipart/form-data', 'application/x-www-form-urlencoded'],
    }),
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
    server.get('/service-worker.js', (_request, response) => {
      response.type('text/javascript').send(SELF_DESTROYING_SERVICE_WORKER)
    })
  }

  server.use('*', async (incoming, outgoing, next) => {
    const url = `${incoming.protocol}://${incoming.get('host') ?? 'localhost'}${
      incoming.originalUrl
    }`

    try {
      let template = await readFile(state.templatePath, 'utf-8')

      template = await viteDevelopmentServier.transformIndexHtml(url, template)

      const {
        createApp: createAppA,
        createPointeApp: createAppC,
        createServer: createAppB,
        default: createAppD,
      } = (await viteDevelopmentServier.ssrLoadModule(
        path.relative(state.directory, state.serverEntryPath),
      )) as {
        createApp: CreateApp
        createPointeApp: CreateApp
        createServer: CreateApp
        default: CreateApp
      }

      const { fetch } = await (createAppA ?? createAppB ?? createAppC ?? createAppD)({
        command: 'dev',
        mode: state.nodeEnv as 'development',
        moduleGraph: viteDevelopmentServier.moduleGraph,
        template,
      })

      const body =
        incoming.method === 'GET' || incoming.method === 'HEAD'
          ? undefined
          : (incoming.body as Buffer)

      const response = await fetch(url, {
        body,
        cache: 'no-cache',
        credentials: 'include',
        method: incoming.method,
        // @ts-expect-error undici/fetch compat
        headers: fromNodeHeaders(incoming.headers),
        keepalive: false,
        mode: 'no-cors',
        redirect: 'manual',
      })

      for (const [key, value] of Object.entries(toNodeHeaders(response.headers))) {
        if (value === undefined) {
          continue
        }

        outgoing.setHeader(key, value)
      }

      outgoing.statusMessage = response.statusText

      outgoing.status(response.status).end(Buffer.from(await response.arrayBuffer()))
    } catch (error) {
      if (isNativeError(error)) {
        viteDevelopmentServier.ssrFixStacktrace(error)
      }

      next(error)
    }
  })
}
