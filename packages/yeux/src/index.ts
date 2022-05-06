import { safeReadPackage as readPackageJson } from '@pnpm/read-package-json'
import fse from 'fs-extra'
import { find, isString } from 'lodash-es'
import path from 'path'
import supportsColor from 'supports-color'
import { fileURLToPath } from 'url'
import { State, Vite, ViteConfig } from './types'
import { resolve } from './utilities/resolve'

const TARGET = 'node17'

interface Options {
  directory: string
  configPath?: string
  command: 'build' | 'dev' | 'preview'
  host?: string
  port?: number
}

const createState = async (options: Options): Promise<State> => {
  const { directory, command } = options

  const basedir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../'
  )

  const port = options.port ?? 3000
  const host = options.host ?? '127.0.0.1'

  const templatePath = path.join(directory, 'index.html')

  const ssrEntryPath = path.join(directory, 'src/entry-ssr.ts')
  const browserEntryPath = path.join(directory, 'src/entry-browser.ts')
  const createInstancePath = path.join(directory, 'src/create-instance.ts')
  const apiEntryPath = path.join(directory, 'src/entry-api.ts')

  const configPath =
    options.configPath === undefined
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
      : path.relative(directory, path.resolve(directory, options.configPath))

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

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const sourceMapSupportVersion = (await readPackageJson(
    path.join(basedir, 'package.json')
  ))!.dependencies!['source-map-support']

  const vite = (await import(await resolve('vite', directory))) as Vite

  const nodeEnv = {
    build: 'production',
    preview: 'staging',
    dev: 'development'
  }[command]

  const viteConfig: ViteConfig = await vite.resolveConfig(
    { configFile: configPath, root: directory },
    'build',
    nodeEnv
  )

  if (!(await fse.pathExists(browserEntryPath))) {
    throw new Error(
      `${path.relative(directory, browserEntryPath)}: No such file.`
    )
  }

  if (!(await fse.pathExists(ssrEntryPath))) {
    throw new Error(`${path.relative(directory, ssrEntryPath)}: No such file.`)
  }

  if (!(await fse.pathExists(createInstancePath))) {
    throw new Error(
      `${path.relative(directory, createInstancePath)}: No such file.`
    )
  }

  if (!(await fse.pathExists(templatePath))) {
    throw new Error(`${path.relative(directory, templatePath)}: No such file.`)
  }

  const outputDirectory = path.resolve(directory, viteConfig.build.outDir)
  const clientOutputDirectory = path.join(outputDirectory, 'client')
  const ssrOutputDirectory = path.join(outputDirectory, 'server')
  const devOutputDirectory = path.join(outputDirectory, 'dev')

  const ssrManifestPath = path.join(ssrOutputDirectory, 'manifest.json')
  const ssrEntryCompiledPath = path.join(ssrOutputDirectory, 'entry-ssr.mjs')
  const ssrTemplatePath = path.join(ssrOutputDirectory, 'index.html')
  const createInstanceCompiledPath = path.join(
    command === 'dev' ? devOutputDirectory : ssrOutputDirectory,
    'create-instance.mjs'
  )

  const apiEntryCompiledPath = path.join(
    command === 'dev' ? devOutputDirectory : ssrOutputDirectory,
    'entry-api.mjs'
  )

  const ssrIndexPath = path.join(ssrOutputDirectory, 'index.mjs')
  const devIndexPath = path.join(devOutputDirectory, 'index.mjs')

  const umask = 0o027
  const fileMask = 0o666 & ~umask
  const directoryMask = 0o777 & ~umask

  return {
    apiEntryCompiledPath,
    apiEntryEnable: await fse.pathExists(apiEntryPath),
    apiEntryPath,
    basedir,
    clientOutputDirectory,
    color: !(supportsColor.stdout === false),
    command,
    createInstanceCompiledPath,
    createInstancePath,
    devIndexPath,
    devOutputDirectory,
    directory,
    directoryMask,
    fileMask,
    hmrPort: 24678,
    hmrPrefix: '/hmr',
    host,
    nodeEnv,
    outputDirectory,
    packageJson,
    port,
    sourceMapSupportVersion,
    ssrEntryCompiledPath,
    ssrEntryPath,
    ssrIndexPath,
    ssrManifestPath,
    ssrOutputDirectory,
    ssrTemplatePath,
    target: TARGET,
    templatePath,
    tsconfigPath,
    umask,
    vite,
    viteConfig
  }
}

export const yeux = async (options: Options) => {
  const state = await createState(options)

  if (state.command === 'dev') {
    process.env.NODE_ENV = 'development'
  } else {
    process.env.NODE_ENV = 'production'
  }

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
