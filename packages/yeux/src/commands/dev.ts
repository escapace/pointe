import { execa, ExecaChildProcess } from 'execa'
import fse from 'fs-extra'
import { throttle } from 'lodash-es'
import path from 'path'
import process from 'process'
import { State } from '../types'
import { buildApi } from '../utilities/build-api'
import { buildCreateInstance } from '../utilities/build-create-instance'
import { buildIndex } from '../utilities/build-index'
import { info, warn } from '../utilities/log'
import { prefixChildProcess } from '../utilities/prefix-child-process'
import { resolve } from '../utilities/resolve'

const INDEX_CONTENTS = async (state: State) => `#!/usr/bin/env node
import sourceMapSupport from '${await resolve(
  'source-map-support',
  state.basedir
)}'
sourceMapSupport.install()

import vite from 'vite'
import process from 'process'
import { readFile } from 'fs/promises'
import { printServerUrls } from '${await resolve(
  '@yeuxjs/runtime',
  state.basedir
)}'

process.env.NODE_ENV = 'development'
process.cwd("${state.directory}")

const run = async () => {
  const { createInstance } = await import('./${path.basename(
    state.createInstanceCompiledPath
  )}')

  const { handler: apiHandler } = await import('./${path.basename(
    state.apiEntryCompiledPath
  )}')

  const { instance, context } = await createInstance()

  const manifest = {}

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception', error)

    try {
      instance.close(() => process.exit(1))
    } catch {
      process.exit(1)
    }
  })

  process.once('SIGTERM', () =>
    instance
      .close()
      .then(() => process.exit(0))
      .catch(() => process.exit(1))
  )

  process.once('SIGTERM', () =>
    instance
      .close()
      .then(() => process.exit(0))
      .catch(() => process.exit(1))
  )

  await instance.register(await import('${await resolve(
    'middie',
    state.basedir
  )}'))

  const server = await vite.createServer({
    root: '${state.directory}',
    mode: 'development',
    logLevel: 'info',
    server: {
      middlewareMode: true,
      hmr: {
        clientPort: ${state.hmrPort},
        path: '${state.hmrPrefix}',
        port: ${state.hmrPort}
      }
    }
  })

  await instance.use(server.middlewares)

  await apiHandler(instance, context)

  let ssrHandler
  let template

  instance.get('*', async (request, reply) => {
    try {
      const url = request.url

      // always read fresh template in dev
      template = await readFile('${state.templatePath}', 'utf-8')
      template = await server.transformIndexHtml(url, template)

      server.moduleGraph.onFileChange('${path.relative(
        state.directory,
        state.ssrEntryPath
      )}')

      ssrHandler = (await server.ssrLoadModule('${path.relative(
        state.directory,
        state.ssrEntryPath
      )}')).handler

      return await ssrHandler({
        manifest,
        reply,
        request,
        template
      }, context)
    } catch (e) {
      if (isError(e)) {
        server.ssrFixStacktrace(e)

        return await reply.status(500).send(e.stack)
      } else {
        return await reply.status(500)
      }
    }
  })

  await instance.listen({
    port: process.env.PORT === undefined ? ${
      state.port
    } : parseInt(process.env.PORT, 10),
    host: process.env.HOST ?? '${state.host}'
  })

  printServerUrls(instance.server.address())
}

run()
`

export async function dev(state: State) {
  await fse.emptyDir(state.devOutputDirectory)

  await buildIndex(await INDEX_CONTENTS(state), state)

  let server: ExecaChildProcess<string> | undefined

  const { devIndexPath } = state
  // const relativeDevIndexPath = path.relative(state.directory, devIndexPath)

  const exitHandler = (signal: NodeJS.Signals = 'SIGTERM') => {
    if (server !== undefined) {
      if (server.kill(signal)) {
        server = undefined
      } else {
        warn(`Unable to ${signal} process with pid '${server.pid as number}'.`)

        setTimeout(() => exitHandler('SIGKILL'), 1500)

        // eslint-disable-next-line no-unmodified-loop-condition, no-empty
        while (server !== undefined) {}
      }
    }
  }

  ;['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'uncaughtException'].forEach(
    (event) =>
      process.once(event, () => {
        exitHandler()

        process.exit()
      })
  )

  const restart = throttle(
    () => {
      if (server !== undefined) {
        info(`restarting dev server`)

        exitHandler()
      } else {
        info(`starting dev server`)
      }

      server = execa('node', [devIndexPath], {
        detached: true,
        buffer: false,
        env: {
          HOST: state.host,
          PORT: `${state.port}`,
          [state.color ? 'FORCE_COLOR' : 'NO_COLOR']: 'true'
        },
        // stdout: process.stdout,
        // stderr: process.stderr,
        cwd: state.directory
      })

      prefixChildProcess(server)
    },
    1000,
    { leading: true }
  )

  await buildCreateInstance(state, restart)
  await buildApi(state, restart)

  restart()
}
