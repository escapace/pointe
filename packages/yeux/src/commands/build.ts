import { execa } from 'execa'
import fse from 'fs-extra'
import { omitBy } from 'lodash-es'
import path from 'path'
import process from 'process'
import type { State, ViteInlineConfig } from '../types'
import { buildEntries } from '../utilities/build-entries'
import { resolve } from '../utilities/resolve'
import { buildIndex } from '../utilities/build-index'
import { step } from '../utilities/log'
import { pathToFileURL } from 'url'
import { copyFile, chmod } from 'fs/promises'
import { envPrefix } from '../utilities/env-prefix'

// import { env } from '../utilities/env'
// for (const [key, value] of Object.entries(${JSON.stringify(env(state, true))})) {
//   if (typeof process.env[key] !== 'string') {
//     process.env[key] = value
//   }
// }

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

process.cwd(path.dirname(fileURLToPath(import.meta.url)))

process.env.NODE_ENV = ${JSON.stringify(state.nodeEnv)}

const run = async () => {
  const { createInstance } = await import('./${path.basename(
    state.serverCreateInstanceCompiledPath
  )}')

  const { handler: ssrHandler } = await import('./${path.basename(
    state.serverSSREntryCompiledPath
  )}')

${
  state.serverAPIEntryEnable
    ? `
  const { handler: apiHandler } = await import('./${path.basename(
    state.serverAPIEntryCompiledPath
  )}')
`
    : ''
}

  const manifest = JSON.parse(await readFile('./${path.basename(
    state.serverSSRManifestPath
  )}', 'utf-8'))
  const template = await readFile('./${path.basename(
    state.serverSSRTemplatePath
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
    '@fastify/static',
    state.basedir
  )}'), {
    root: '${state.clientOutputDirectory}',
    wildcard: false,
    maxAge: 60000
  })
`
    : ''
}


${
  state.serverAPIEntryEnable
    ? `
  await apiHandler(instance, context)
`
    : ''
}

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
      state.serverPort
    } : parseInt(process.env.PORT, 10),
    host: process.env.HOST ?? '${state.serverHost}'
  })

${
  state.command === 'preview'
    ? `
  printServerUrls(instance.addresses())
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
  const clientConfig: ViteInlineConfig = {
    root: state.directory,
    mode: state.nodeEnv,
    envPrefix: envPrefix(state),
    build: {
      ...state.viteConfig.build,
      minify: 'esbuild',
      sourcemap: 'hidden',
      terserOptions: undefined,
      ssrManifest: true,
      outDir: path.relative(state.directory, state.clientOutputDirectory)
    }
  }

  const serverConfig: ViteInlineConfig = {
    root: state.directory,
    mode: state.nodeEnv,
    envPrefix: envPrefix(state),
    publicDir: false,
    // ssr: {
    //   target: 'webworker',
    //   noExternal: [/^((?!(node:)).)*$/]
    // },
    build: {
      ...state.viteConfig.build,
      target: state.target,
      minify: false,
      terserOptions: undefined,
      rollupOptions: {
        ...state.viteConfig.build.rollupOptions,
        output: {
          ...state.viteConfig.build.rollupOptions.output,
          entryFileNames: '[name].mjs',
          chunkFileNames: '[name]-[hash].mjs',
          format: 'esm'
        }
      },
      sourcemap: true,
      ssr: path.relative(state.directory, state.serverSSREntryPath),
      outDir: path.relative(state.directory, state.serverOutputDirectory)
    }
  }

  step(`Client Build`)
  await fse.emptyDir(state.clientOutputDirectory)
  await state.vite.build(clientConfig)

  step(`Server Build`)
  await fse.emptyDir(state.serverOutputDirectory)
  await state.vite.build(serverConfig)

  await buildEntries(state)

  await fse.move(
    path.join(state.clientOutputDirectory, 'ssr-manifest.json'),
    state.serverSSRManifestPath
  )

  await fse.move(
    path.join(state.clientOutputDirectory, 'index.html'),
    state.serverSSRTemplatePath
  )

  const packageJSONPath = path.join(state.serverOutputDirectory, 'package.json')
  await fse.writeJSON(packageJSONPath, await PACKAGE_JSON(state), { spaces: 2 })

  const pnpmLockfile = path.join(state.directory, 'pnpm-lock.yaml')
  const npmLockfile = path.join(state.directory, 'package-lock.json')

  step(`Dependencies`)

  const packageManager = (await fse.pathExists(pnpmLockfile))
    ? 'pnpm'
    : (await fse.pathExists(npmLockfile))
    ? 'npm'
    : undefined

  if (packageManager === 'pnpm') {
    const destPnpmLockfile = path.join(
      state.serverOutputDirectory,
      'pnpm-lock.yaml'
    )

    await copyFile(pnpmLockfile, destPnpmLockfile)

    await execa(
      'pnpm',
      ['install', '--prod', '--prefer-offline', '--no-frozen-lockfile'],
      {
        stdout: process.stdout,
        stderr: process.stderr,
        cwd: state.serverOutputDirectory
      }
    )

    await chmod(pnpmLockfile, state.maskFile)
  }

  if (packageManager === 'npm') {
    const destNpmLockfile = path.join(
      state.serverOutputDirectory,
      'package-lock.json'
    )

    await copyFile(npmLockfile, destNpmLockfile)

    await execa('npm', ['install', '--production'], {
      stdout: process.stdout,
      stderr: process.stderr,
      cwd: state.serverOutputDirectory
    })

    await chmod(destNpmLockfile, state.maskFile)
  }

  await buildIndex(await INDEX_CONTENTS(state), state)
}
