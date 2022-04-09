import { execa, ExecaChildProcess } from 'execa'
import path from 'path'
import process from 'process'
import { State } from '../types'
import { buildCreateInstance } from '../utilities/build-create-instance'
import { buildIndex } from '../utilities/build-index'
import { info } from '../utilities/log'
import { prefixChildProcess } from '../utilities/prefix-child-process'
import { resolve } from '../utilities/resolve'

const INDEX_CJS_CONTENTS = (state: State) => `#!/usr/bin/env node
require("${resolve('source-map-support', state)}").install();

const vite = require('vite')
const process = require('process')
const { readFile } = require('fs/promises')

process.env.NODE_ENV = 'development'
process.cwd("${state.directory}")

const run = async () => {
  const { createInstance } = require('./${path.basename(
    state.createInstanceCompiledPath
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

  await instance.register(require('${resolve('middie', state)}'))

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

  let handler
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

      handler = (await server.ssrLoadModule('${path.relative(
        state.directory,
        state.ssrEntryPath
      )}')).handler

      return await handler({
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

  const { printServerUrls } = require("${resolve('@yeuxjs/runtime', state)}")

  printServerUrls(instance.server.address())
}

run()
`

export async function dev(state: State) {
  await buildIndex(INDEX_CJS_CONTENTS(state), state)

  let server: ExecaChildProcess<string> | undefined

  const { devIndexPath } = state
  // const relativeDevIndexPath = path.relative(state.directory, devIndexPath)

  const exitHandler = () => {
    if (server !== undefined) {
      if (server.kill()) {
        server = undefined
      }
      // TODO: SIGTEMR in few seconds
    }
  }

  ;['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'uncaughtException'].forEach(
    (event) =>
      process.once(event, () => {
        exitHandler()

        process.exit()
      })
  )

  const restart = () => {
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
  }

  await buildCreateInstance(state, restart)

  restart()
}
