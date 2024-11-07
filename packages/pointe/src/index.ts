import { safeReadPackageJson as readPackageJson } from '@pnpm/read-package-json'
import fse from 'fs-extra'
import { find, isFunction, isPlainObject, isString, noop } from 'lodash-es'
import assert from 'node:assert'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import semver from 'semver'
import supportsColor from 'supports-color'
import type { InlineConfig } from 'vite'
import type { injectManifest as InjectManifest } from 'workbox-build'
import { z } from 'zod'
import { NODE_SEMVER } from './constants'
import type { State, Vite, ViteConfig, InlineConfig as YeuxInlineConfig } from './types'
import { resolve } from './utilities/resolve'
import { rollupInputOptions } from './utilities/rollup-input-options'

const importWorkbox = async (directory: string) => {
  /* eslint-disable typescript/no-unsafe-member-access */
  const injectManifest = (await import(await resolve('workbox-build', directory)))
    .injectManifest as typeof InjectManifest
  assert(isFunction(injectManifest))
  /* eslint-enable typescript/no-unsafe-member-access */

  return injectManifest
}

const Options = z
  .object({
    command: z.enum(['build', 'dev', 'preview'] as const),
    configPath: z.string().optional(),
    directory: z.string().refine(async (value) => (await stat(value)).isDirectory()),
    host: z.string().default('127.0.0.1'),
    port: z
      .number()
      .int()
      .default(3000)
      .refine((value) => value > 0),
  })
  .strict()

const createState = async (options: z.input<typeof Options>): Promise<State> => {
  const {
    command,
    configPath: _configPath,
    directory,
    host,
    port,
  } = await Options.parseAsync(options)

  const basedir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../')

  const sourceDirectory = path.join(directory, 'src')

  const serverEntryPath = path.join(sourceDirectory, 'entry-server.ts')
  const clientEntryPath = path.join(sourceDirectory, 'entry-browser.ts')
  const serviceWorkerEntryPath = path.join(sourceDirectory, 'entry-service-worker.ts')

  const configPath =
    _configPath === undefined
      ? find(
          [
            (await fse.pathExists(path.join(directory, 'vite.config.ts')))
              ? 'vite.config.ts'
              : undefined,
            (await fse.pathExists(path.join(directory, 'vite.config.js')))
              ? 'vite.config.js'
              : undefined,
          ],
          (name) => isString(name),
        )
      : path.relative(directory, path.resolve(directory, _configPath))

  const packageJSONPath = path.join(directory, 'package.json')
  const tsconfigPath = path.join(directory, 'tsconfig.json')

  const conditions = [
    await fse.pathExists(directory),
    await fse.pathExists(path.join(directory, 'node_modules', '.bin', 'vite')),
    configPath !== undefined &&
      !configPath.startsWith('../') &&
      (await fse.pathExists(path.join(directory, configPath))),
    await fse.pathExists(packageJSONPath),
    await fse.pathExists(tsconfigPath),
  ]

  if (conditions.includes(false)) {
    throw new Error('Not a vite directory.')
  }

  const packageJson = await readPackageJson(packageJSONPath)

  if (packageJson === null) {
    throw new Error(`package.json: unable to read`)
  }

  const nodeMinVersion = semver.minVersion(NODE_SEMVER)?.version

  assert.ok(typeof nodeMinVersion === 'string')

  const nodeVersion = semver.minVersion(
    isString(packageJson.engines?.node)
      ? (semver.validRange(packageJson.engines?.node) ?? NODE_SEMVER)
      : NODE_SEMVER,
  )?.version

  assert.ok(typeof nodeVersion === 'string')

  if (!semver.satisfies(nodeVersion, NODE_SEMVER)) {
    throw new Error(`Minumum target version is ${nodeMinVersion}.`)
  }

  const vite = (await import(await resolve('vite', directory))) as Vite

  const nodeEnvironment = (
    {
      build: process.env.NODE_ENV === 'staging' ? 'staging' : 'production',
      dev: 'development',
      preview: 'staging',
    } as const
  )[command]

  const resolveConfig = async (
    inlineConfig?: InlineConfig,
  ): ReturnType<typeof vite.resolveConfig> =>
    await vite.resolveConfig(
      { configFile: configPath, root: directory, ...inlineConfig },
      'build',
      nodeEnvironment,
    )

  const viteConfig: ViteConfig = await resolveConfig()

  if (!(await fse.pathExists(clientEntryPath))) {
    throw new Error(`${path.relative(directory, clientEntryPath)}: No such file.`)
  }

  if (!(await fse.pathExists(serverEntryPath))) {
    throw new Error(`${path.relative(directory, serverEntryPath)}: No such file.`)
  }

  if (Array.isArray(viteConfig.build.rollupOptions.output)) {
    throw new TypeError('build.rollupOptions.output is an array, not supported by pointe.')
  }

  if (typeof viteConfig.build.rollupOptions.input === 'string') {
    noop()
  } else if (Array.isArray(viteConfig.build.rollupOptions.input)) {
    throw new TypeError('build.rollupOptions.input is an array, not supported by pointe.')
  } else if (
    isPlainObject(viteConfig.build.rollupOptions.input) &&
    viteConfig.build.rollupOptions.input?.main === 'undefined'
  ) {
    throw new Error('build.rollupOptions.input.main is not defined.')
  }

  if (viteConfig.ssr.noExternal === true) {
    throw new Error('setting ssr.noExternal to true, is not supported by pointe.')
  }

  const templatePath = path.resolve(
    directory,
    rollupInputOptions(viteConfig.build.rollupOptions.input, { directory }).main,
  )

  if (!(await fse.pathExists(templatePath))) {
    throw new Error(`${path.relative(directory, templatePath)}: No such file.`)
  }

  const outputDirectory = path.resolve(directory, viteConfig.build.outDir)
  const clientOutputDirectory = path.join(outputDirectory, 'client')
  const serverOutputDirectory = path.join(outputDirectory, 'server')

  const clientTemplatePath = path.join(clientOutputDirectory, path.basename(templatePath))

  const clientManifestName = 'build-client-manifest.json'
  const clientManifestPath = path.join(clientOutputDirectory, clientManifestName)

  const serverSSRManifestName = 'build-ssr-manifest.json'
  const serverSSRManifestPath = path.join(clientOutputDirectory, serverSSRManifestName)

  const serverManifestName = 'build-server-manifest.json'

  const serverManifestPath = path.join(serverOutputDirectory, serverManifestName)

  const serverEntryCompiledPath = path.join(serverOutputDirectory, 'entry-server.mjs')

  // const serverCreateInstanceCompiledPath = path.join(
  //   serverOutputDirectory,
  //   'create-instance.mjs'
  // )

  // const serverAPIEntryCompiledPath = path.join(
  //   serverOutputDirectory,
  //   'entry-api.mjs'
  // )

  // const serverIndexPath = path.join(serverOutputDirectory, 'index.mjs')

  const umask = 0o022 // 0o027
  const maskFile = 0o666 & ~umask
  const maskDirectory = 0o777 & ~umask

  const serverRuntime: 'node' | 'webworker' = command === 'build' ? viteConfig.ssr.target : 'node'

  const serverTarget = serverRuntime === 'node' ? `node${nodeVersion}` : 'esnext'

  const serviceWorkerEntryExists = await fse.pathExists(serviceWorkerEntryPath)

  const watchPaths = [
    sourceDirectory,
    tsconfigPath,
    // eslint-disable-next-line typescript/no-non-null-assertion
    path.join(directory, configPath!),
    packageJSONPath,
    path.resolve(directory, viteConfig.publicDir),
  ].filter((path) => fse.pathExistsSync(path))

  return {
    injectManifest: serviceWorkerEntryExists ? await importWorkbox(directory) : undefined,
    serviceWorkerEntryExists,
    serviceWorkerEntryPath,
    watchPaths,
    // serverAPIEntryCompiledPath,
    // serverAPIEntryEnable: await fse.pathExists(serverAPIEntryPath),
    // serverAPIEntryPath,
    // serverCreateInstanceCompiledPath,
    // serverCreateInstancePath,
    // serverIndexPath,
    // sourceMapSupportVersion,
    basedir,
    clientManifestName,
    clientManifestPath,
    clientOutputDirectory,
    clientTemplatePath,
    color: !(supportsColor.stdout === false),
    command,
    directory,
    maskDirectory,
    maskFile,
    nodeEnv: nodeEnvironment,
    outputDirectory,
    packageJson,
    packageJSONPath,
    resolveConfig,
    serverEntryCompiledPath,
    serverEntryPath,
    serverHMRPrefix: '/hmr',
    serverHost: host,
    serverManifestName,
    serverManifestPath,
    serverOutputDirectory,
    serverPort: port,
    serverRuntime,
    serverSSRManifestName,
    serverSSRManifestPath,
    serverTarget,
    templatePath,
    tsconfigPath,
    umask,
    vite,
    viteConfig,
  }
}

export const pointe = async (options: z.input<typeof Options>) => {
  const state = await createState(options)

  process.env.NODE_ENV = state.nodeEnv

  process.umask(state.umask)
  process.chdir(state.directory)

  if (state.command === 'build') {
    const { build } = await import('./commands/build')

    await build(state)
  } else if (state.command === 'preview') {
    const { preview } = await import('./commands/preview')

    await preview(state)
  } else {
    const { dev } = await import('./commands/dev')

    await dev(state)
  }
}

declare module 'vite' {
  interface UserConfig {
    /**
     * Options for Yeux
     */
    pointe?: YeuxInlineConfig
  }
}

export type { YeuxInlineConfig }
