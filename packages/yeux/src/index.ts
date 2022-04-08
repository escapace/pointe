import readPackageJson from '@pnpm/read-package-json'
import fse from 'fs-extra'
import { find, isString } from 'lodash'
import path from 'path'
import { sync as resolve } from 'resolve'
import { State, Vite, ViteConfig } from './types'

const TARGET = 'node17'

interface Options {
  directory: string
  configPath?: string
  command: 'build' | 'dev' | 'preview'
  host?: string
  port?: number
}

export const createState = async (options: Options): Promise<State> => {
  const { directory, command } = options

  const port = options.port ?? 3000
  const host = options.host ?? '127.0.0.1'

  const templatePath = path.join(directory, 'index.html')

  const ssrEntryPath = path.join(directory, 'src/entry-ssr.ts')
  const browserEntryPath = path.join(directory, 'src/entry-browser.ts')
  const createInstancePath = path.join(directory, 'src/create-instance.ts')

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

  const vite = (await import(
    resolve('vite', {
      basedir: directory
    })
  )) as Vite

  const viteConfig: ViteConfig = await vite.resolveConfig(
    { configFile: configPath, root: directory },
    'build'
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
  const browserOutputDirectory = path.join(outputDirectory, 'browser')
  const ssrOutputDirectory = path.join(outputDirectory, 'ssr')
  const devOutputDirectory = path.join(outputDirectory, 'dev')

  const ssrManifestPath = path.join(ssrOutputDirectory, 'manifest.json')
  const ssrEntryCompiledPath = path.join(ssrOutputDirectory, 'entry-ssr.cjs')
  const ssrTemplatePath = path.join(ssrOutputDirectory, 'index.html')
  const createInstanceCompiledPath = path.join(
    command === 'dev' ? devOutputDirectory : ssrOutputDirectory,
    'create-instance.cjs'
  )

  const ssrIndexPath = path.join(ssrOutputDirectory, 'index.cjs')
  const devIndexPath = path.join(devOutputDirectory, 'index.cjs')

  const nodeEnv = {
    build: 'production',
    preview: 'staging',
    dev: 'development'
  }[command]

  return {
    basedir: path.resolve(__dirname, '../../'),
    browserOutputDirectory,
    command,
    createInstanceCompiledPath,
    createInstancePath,
    devIndexPath,
    devOutputDirectory,
    directory,
    hmrPort: 24678,
    hmrPrefix: '/hmr',
    host,
    nodeEnv,
    packageJson,
    port,
    ssrEntryCompiledPath,
    ssrEntryPath,
    ssrIndexPath,
    ssrManifestPath,
    ssrOutputDirectory,
    ssrTemplatePath,
    target: TARGET,
    templatePath,
    tsconfigPath,
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

  process.umask(0o022)
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