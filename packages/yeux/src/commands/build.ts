import { execa } from 'execa'
import fse from 'fs-extra'
import { omitBy } from 'lodash-es'
import path from 'path'
import process from 'process'
import type { State, ViteInlineConfig } from '../types'
import { buildCreateInstance } from '../utilities/build-create-instance'
import { resolve } from '../utilities/resolve'
import { buildIndex } from '../utilities/build-index'
import { step } from '../utilities/log'
import { buildApi } from '../utilities/build-api'
import { pathToFileURL } from 'url'

const INDEX_CONTENTS = async (state: State) => `#!/usr/bin/env node
import sourceMapSupport from 'source-map-support'
sourceMapSupport.install()

import { fileURLToPath } from 'url'
import path from 'path'
import process from 'process'
import { readFile } from 'fs/promises'

${
  state.command === 'preview'
    ? `
import { printServerUrls } from '@yeuxjs/runtime'
`
    : ''
}

process.env.NODE_ENV = '${state.command === 'build' ? 'production' : 'staging'}'
process.cwd(path.dirname(fileURLToPath(import.meta.url)))

const run = async () => {
  const { createInstance } = await import('./${path.basename(
    state.createInstanceCompiledPath
  )}')

  const { handler: ssrHandler } = await import('./${path.basename(
    state.ssrEntryCompiledPath
  )}')
  const { handler: apiHandler } = await import('./${path.basename(
    state.apiEntryCompiledPath
  )}')

  const manifest = JSON.parse(await readFile('./${path.basename(
    state.ssrManifestPath
  )}'))
  const template = await readFile('./${path.basename(
    state.ssrTemplatePath
  )}', 'utf-8')
  const { instance, context } = await createInstance()

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

${
  state.command === 'preview'
    ? `
  await instance.register(await import('${await resolve(
    'fastify-static',
    state.basedir
  )}'), {
    root: '${state.browserOutputDirectory}',
    wildcard: false,
    maxAge: 60000
  })
`
    : ''
}

  await apiHandler(instance, context)

  instance.get('*', async (request, reply) => {
    try {
      return await ssrHandler(
        {
          manifest,
          reply,
          request,
          template
        },
        context
      )
    } catch {
      return await reply.status(500)
    }
  })

  await instance.listen({
    port: process.env.PORT === undefined ? ${
      state.port
    } : parseInt(process.env.PORT, 10),
    host: process.env.HOST ?? '${state.host}'
  })

${
  state.command === 'preview'
    ? `
  printServerUrls(instance.server.address())
`
    : ''
}
}

run()
`

const PACKAGE_JSON = async (state: State) =>
  omitBy(
    {
      name: state.packageJson.name,
      version: state.packageJson.version,
      author: state.packageJson.author,
      license: state.packageJson.license,
      description: state.packageJson.description,
      dependencies: {
        '@yeuxjs/runtime':
          state.command === 'preview'
            ? pathToFileURL(
                path.resolve(
                  path.dirname(await resolve('@yeuxjs/runtime', state.basedir)),
                  '../../'
                )
              )
            : '*',
        'source-map-support': state.sourceMapSupportVersion,
        ...(state.packageJson.dependencies ?? {})
      }
    },
    (value) => value === undefined
  )

export async function build(state: State) {
  const browserConfig: ViteInlineConfig = {
    root: state.directory,
    mode: 'production',
    build: {
      ...state.viteConfig.build,
      minify: 'esbuild',
      sourcemap: 'hidden',
      terserOptions: undefined,
      ssrManifest: true,
      outDir: path.relative(state.directory, state.browserOutputDirectory)
    }
  }

  const ssrConfig: ViteInlineConfig = {
    root: state.directory,
    mode: 'production',
    publicDir: false,
    build: {
      ...state.viteConfig.build,
      target: state.target,
      minify: false,
      terserOptions: undefined,
      rollupOptions: {
        output: {
          entryFileNames: '[name].mjs',
          chunkFileNames: '[name]-[hash].mjs',
          format: 'esm'
        }
      },
      sourcemap: true,
      ssr: path.relative(state.directory, state.ssrEntryPath),
      outDir: path.relative(state.directory, state.ssrOutputDirectory)
    }
  }

  step(`Browser Build`)
  await fse.emptyDir(state.browserOutputDirectory)
  await state.vite.build(browserConfig)

  step(`SSR Build`)
  await fse.emptyDir(state.ssrOutputDirectory)
  await state.vite.build(ssrConfig)

  await buildCreateInstance(state)
  await buildApi(state)

  await fse.move(
    path.join(state.browserOutputDirectory, 'ssr-manifest.json'),
    state.ssrManifestPath
  )

  await fse.move(
    path.join(state.browserOutputDirectory, 'index.html'),
    state.ssrTemplatePath
  )

  const packageJSONPath = path.join(state.ssrOutputDirectory, 'package.json')
  await fse.writeJSON(packageJSONPath, await PACKAGE_JSON(state), { spaces: 2 })

  const pnpmLockfile = path.join(state.directory, 'pnpm-lock.yaml')
  const npmLockfile = path.join(state.directory, 'package-lock.json')

  step(`Dependencies`)

  if (await fse.pathExists(pnpmLockfile)) {
    await fse.copyFile(
      pnpmLockfile,
      path.join(state.ssrOutputDirectory, 'pnpm-lock.yaml')
    )

    await execa(
      'pnpm',
      ['install', '--prod', '--fix-lockfile', '--prefer-offline'],
      {
        stdout: process.stdout,
        stderr: process.stderr,
        cwd: state.ssrOutputDirectory
      }
    )
  } else if (await fse.pathExists(npmLockfile)) {
    await fse.copyFile(
      pnpmLockfile,
      path.join(state.ssrOutputDirectory, 'package-lock.json')
    )

    await execa('npm', ['install', '--production'], {
      stdout: process.stdout,
      stderr: process.stderr,
      cwd: state.ssrOutputDirectory
    })
  }

  await buildIndex(await INDEX_CONTENTS(state), state)
}
