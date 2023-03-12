import { OptionsProduction } from '@yeuxjs/types'
import fse from 'fs-extra'
import { mapValues, uniq } from 'lodash-es'
import path from 'path'
import type { RollupOutput, RollupWatcher } from 'rollup'
import type { Manifest } from 'vite'
import type { State, ViteInlineConfig } from '../types'
import { step } from '../utilities/log'

export const clientConfig = (state: State): ViteInlineConfig => ({
  root: state.directory,
  mode: state.nodeEnv,
  build: {
    ...state.viteConfig.build,
    watch: state.command === 'build' ? undefined : {},
    manifest: state.clientManifestName,
    ssrManifest: state.serverSSRManifestName,
    terserOptions:
      state.viteConfig.build.minify === 'terser'
        ? state.viteConfig.build.terserOptions
        : undefined,
    outDir: path.relative(state.directory, state.clientOutputDirectory),
    rollupOptions: {
      ...state.viteConfig.build.rollupOptions,
      output: {
        ...state.viteConfig.build.rollupOptions.output,
        entryFileNames: path.join(
          state.viteConfig.build.assetsDir,
          '[name]-[hash].js'
        ),
        assetFileNames: path.join(
          state.viteConfig.build.assetsDir,
          '[name]-[hash].[ext]'
        ),
        chunkFileNames: path.join(
          state.viteConfig.build.assetsDir,
          '[name]-[hash].js'
        )
      }
    }
  }
})

export const serverConfig = (state: State): ViteInlineConfig => ({
  root: state.directory,
  mode: state.nodeEnv,
  publicDir: false,
  // define: {
  //   ...state.viteConfig.define,
  //   define
  // },
  // ssr: {
  //   target: 'webworker',
  //   format: 'esm',
  //   noExternal: [/^((?!(node:)).)*$/]
  // },
  build: {
    ...state.viteConfig.build,
    watch: state.command === 'build' ? undefined : {},
    target: state.target,
    manifest: state.serverManifestName,
    minify: false,
    terserOptions: undefined,
    rollupOptions: {
      ...state.viteConfig.build.rollupOptions,
      output: {
        ...state.viteConfig.build.rollupOptions.output,
        entryFileNames: '[name].mjs',
        chunkFileNames: '[name]-[hash].mjs',
        assetFileNames: '[name]-[hash].[ext]',
        format: 'esm'
      }
    },
    ssr: path.relative(state.directory, state.serverEntryPath),
    outDir: path.relative(state.directory, state.serverOutputDirectory),
    emptyOutDir: false
  }
})

export const patchOptions = async (state: State) => {
  const templatePath = path.join(state.clientOutputDirectory, 'index.html')

  const options: Partial<Omit<OptionsProduction, 'manifest'>> & {
    manifest: Partial<OptionsProduction['manifest']>
  } = {
    ...state.optionsProduction,
    manifest: { ...state.optionsProduction?.manifest },
    mode: state.nodeEnv as 'staging' | 'production'
  }

  if (await fse.exists(state.clientManifestPath)) {
    options.manifest.client = (await fse.readJson(
      state.clientManifestPath
    )) as Manifest
  }

  if (await fse.exists(state.serverManifestPath)) {
    options.manifest.server = (await fse.readJson(
      state.serverManifestPath
    )) as Manifest
  }

  if (await fse.exists(state.serverSSRManifestPath)) {
    options.manifest.ssr = mapValues(
      (await fse.readJSON(state.serverSSRManifestPath)) as Record<
        string,
        string[] | undefined
      >,
      (value) =>
        value === undefined
          ? undefined
          : uniq(value).filter((value) =>
              fse.existsSync(path.join(state.clientOutputDirectory, value))
            )
    )
  }

  if (await fse.exists(templatePath)) {
    options.template = await fse.readFile(templatePath, 'utf8')
  }

  await fse.remove(state.clientManifestPath)
  await fse.remove(state.serverManifestPath)
  await fse.remove(state.serverSSRManifestPath)
  await fse.remove(templatePath)

  state.optionsProduction = options as OptionsProduction

  const entry = state.serverEntryCompiledPath

  if (state.optionsProduction !== undefined && (await fse.exists(entry))) {
    const content = await fse.readFile(entry, 'utf8')

    // TODO: codemod
    await fse.writeFile(
      entry,
      content.replaceAll(
        /YEUX_OPTIONS|\/\* YEUX-REPLACE-START \*\/[^]+\/\* YEUX-REPLACE-END \*\//gm,
        `/* YEUX-REPLACE-START */${JSON.stringify(
          state.optionsProduction
        )}/* YEUX-REPLACE-END */`
      )
    )
  }
}

const waitForInitialBuild = async (watcher: RollupWatcher) =>
  await new Promise((resolve) => {
    watcher.on('event', ({ code }) => {
      if (code === 'END' || code === 'ERROR') {
        resolve(undefined)
      }
    })
  })

export const build = async (
  state: State
): Promise<{
  client: RollupOutput | RollupOutput[] | RollupWatcher | undefined
  server: RollupOutput | RollupOutput[] | RollupWatcher | undefined
}> => {
  await fse.emptyDir(state.clientOutputDirectory)
  await fse.emptyDir(state.serverOutputDirectory)

  step(`Client Build`)

  const client = await state.vite.build(clientConfig(state))

  if (state.command === 'preview') {
    await waitForInitialBuild(client as RollupWatcher)
  }

  step(`Server Build`)

  const server = await state.vite.build(serverConfig(state))

  if (state.command === 'preview') {
    await waitForInitialBuild(server as RollupWatcher)
  }

  await patchOptions(state)

  return {
    client,
    server
  }
}
