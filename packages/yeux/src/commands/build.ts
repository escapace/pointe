import fse from 'fs-extra'
import { mapValues, uniq } from 'lodash-es'
import path from 'path'
import type { RollupOutput, RollupWatcher } from 'rollup'
import type { State, ViteInlineConfig } from '../types'
import { install } from '../utilities/install'
import { step } from '../utilities/log'

export const clientConfig = (state: State): ViteInlineConfig => ({
  root: state.directory,
  mode: state.nodeEnv,
  build: {
    ...state.viteConfig.build,
    watch: state.command === 'build' ? undefined : {},
    minify: 'esbuild',
    sourcemap: 'hidden',
    terserOptions: undefined,
    ssrManifest: true,
    outDir: path.relative(state.directory, state.clientOutputDirectory),
    rollupOptions: {
      ...state.viteConfig.build.rollupOptions,
      output: {
        ...state.viteConfig.build.rollupOptions.output,
        entryFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash].[ext]',
        chunkFileNames: '[name]-[hash].js'
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
  //   noExternal: [/^((?!(node:)).)*$/]
  // },
  build: {
    ...state.viteConfig.build,
    watch: state.command === 'build' ? undefined : {},
    target: state.target,
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
    sourcemap: true,
    ssr: path.relative(state.directory, state.serverEntryPath),
    outDir: path.relative(state.directory, state.serverOutputDirectory),
    emptyOutDir: false
  }
})

export const copyManifestTemplate = async (state: State) => {
  const manifestPath = path.join(
    state.clientOutputDirectory,
    'ssr-manifest.json'
  )

  if (await fse.pathExists(manifestPath)) {
    const manifest = (await fse.readJSON(manifestPath)) as Record<
      string,
      string[] | undefined
    >

    await fse.writeJson(
      state.serverManifestPath,
      mapValues(manifest, (value) =>
        value === undefined
          ? undefined
          : uniq(value).filter((value) =>
              fse.existsSync(path.join(state.clientOutputDirectory, value))
            )
      )
    )
  }

  const templatePath = path.join(state.clientOutputDirectory, 'index.html')

  if (await fse.pathExists(templatePath)) {
    await fse.move(templatePath, state.serverTemplatePath, { overwrite: true })
  }
}

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

  step(`Server Build`)

  await copyManifestTemplate(state)

  const server = await state.vite.build(serverConfig(state))

  step(`Dependencies`)

  await install(state)

  return {
    client,
    server
  }
}
