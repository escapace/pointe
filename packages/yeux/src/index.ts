import { safeReadPackageJson as readPackageJson } from '@pnpm/read-package-json'
import fse from 'fs-extra'
import { stat } from 'fs/promises'
import { find, isString } from 'lodash-es'
import path from 'path'
import semver from 'semver'
import supportsColor from 'supports-color'
import { fileURLToPath } from 'url'
import { z } from 'zod'
import { NODE_SEMVER } from './constants'
import { State, Vite, ViteConfig } from './types'
import { resolve } from './utilities/resolve'

const Options = z
  .object({
    directory: z
      .string()
      .refine(async (value) => (await stat(value)).isDirectory()),
    command: z.enum(['build', 'dev', 'preview'] as const),
    configPath: z.string().optional(),
    host: z.string().default('127.0.0.1'),
    port: z
      .number()
      .int()
      .default(3000)
      .refine((value) => value > 0)
  })
  .strict()

const createState = async (
  options: z.input<typeof Options>
): Promise<State> => {
  const {
    directory,
    host,
    port,
    command,
    configPath: _configPath
  } = await Options.parseAsync(options)

  const basedir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../'
  )

  const templatePath = path.join(directory, 'index.html')

  const serverEntryPath = path.join(directory, 'src/entry-server.ts')
  const clientEntryPath = path.join(directory, 'src/entry-browser.ts')

  const configPath =
    _configPath === undefined
      ? find(
          [
            (await fse.pathExists(path.join(directory, 'vite.config.ts')))
              ? 'vite.config.ts'
              : undefined,
            (await fse.pathExists(path.join(directory, 'vite.config.js')))
              ? 'vite.config.js'
              : undefined
          ],
          (name) => isString(name)
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
    await fse.pathExists(tsconfigPath)
  ]

  if (conditions.includes(false)) {
    throw new Error('Not a vite directory.')
  }

  const packageJson = await readPackageJson(packageJSONPath)

  if (packageJson === null) {
    throw new Error(`package.json: unable to read`)
  }

  const nodeMinVersion = semver.minVersion(NODE_SEMVER)?.version as string

  const targetVersion = semver.minVersion(
    isString(packageJson.engines?.node)
      ? semver.validRange(packageJson.engines?.node) ?? NODE_SEMVER
      : NODE_SEMVER
  )?.version as string

  if (!semver.satisfies(targetVersion, NODE_SEMVER)) {
    throw new Error(`Minumum target version is ${nodeMinVersion}.`)
  }

  const vite = (await import(await resolve('vite', directory))) as Vite

  const nodeEnv = (
    {
      build: 'production',
      preview: 'staging',
      dev: 'development'
    } as const
  )[command]

  const viteConfig: ViteConfig = await vite.resolveConfig(
    { configFile: configPath, root: directory },
    'build',
    nodeEnv
  )

  if (!(await fse.pathExists(clientEntryPath))) {
    throw new Error(
      `${path.relative(directory, clientEntryPath)}: No such file.`
    )
  }

  if (!(await fse.pathExists(serverEntryPath))) {
    throw new Error(
      `${path.relative(directory, serverEntryPath)}: No such file.`
    )
  }

  if (!(await fse.pathExists(templatePath))) {
    throw new Error(`${path.relative(directory, templatePath)}: No such file.`)
  }

  if (Array.isArray(viteConfig.build.rollupOptions.output)) {
    throw new Error(
      'build.rollupOptions.output is an array, not supported by yeux.'
    )
  }

  const outputDirectory = path.resolve(directory, viteConfig.build.outDir)
  const clientOutputDirectory = path.join(outputDirectory, 'client')
  const serverOutputDirectory = path.join(outputDirectory, 'server')

  const clientManifestName = 'build-client-manifest.json'
  const clientManifestPath = path.join(
    serverOutputDirectory,
    clientManifestName
  )

  const serverSSRManifestName = 'build-ssr-manifest.json'
  const serverSSRManifestPath = path.join(
    serverOutputDirectory,
    serverSSRManifestName
  )

  const serverEntryCompiledPath = path.join(
    serverOutputDirectory,
    'entry-server.mjs'
  )

  const serverTemplatePath = path.join(serverOutputDirectory, 'index.html')
  // const serverCreateInstanceCompiledPath = path.join(
  //   serverOutputDirectory,
  //   'create-instance.mjs'
  // )

  // const serverAPIEntryCompiledPath = path.join(
  //   serverOutputDirectory,
  //   'entry-api.mjs'
  // )

  // const serverIndexPath = path.join(serverOutputDirectory, 'index.mjs')

  const umask = 0o027
  const maskFile = 0o666 & ~umask
  const maskDirectory = 0o777 & ~umask

  return {
    basedir,
    clientOutputDirectory,
    color: !(supportsColor.stdout === false),
    command,
    directory,
    maskDirectory,
    maskFile,
    nodeEnv,
    outputDirectory,
    packageJson,
    packageJSONPath,
    // serverAPIEntryCompiledPath,
    // serverAPIEntryEnable: await fse.pathExists(serverAPIEntryPath),
    // serverAPIEntryPath,
    // serverCreateInstanceCompiledPath,
    // serverCreateInstancePath,
    serverHMRPort: 24678,
    serverHMRPrefix: '/hmr',
    serverHost: host,
    // serverIndexPath,
    serverOutputDirectory,
    serverPort: port,
    serverEntryCompiledPath,
    serverEntryPath,
    serverSSRManifestName,
    serverSSRManifestPath,
    serverTemplatePath,
    clientManifestName,
    clientManifestPath,
    // sourceMapSupportVersion,
    target: `node${targetVersion}`,
    templatePath,
    tsconfigPath,
    umask,
    vite,
    viteConfig
  }
}

export const yeux = async (options: z.input<typeof Options>) => {
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
