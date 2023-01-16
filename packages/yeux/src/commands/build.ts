import fse from 'fs-extra'
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
    outDir: path.relative(state.directory, state.clientOutputDirectory)
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
        format: 'esm'
      }
    },
    sourcemap: true,
    ssr: path.relative(state.directory, state.serverEntryPath),
    outDir: path.relative(state.directory, state.serverOutputDirectory),
    emptyOutDir: false
  }
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

  step(`Server Build`)

  const manifestPath = path.join(
    state.clientOutputDirectory,
    'ssr-manifest.json'
  )

  if (await fse.pathExists(manifestPath)) {
    await fse.move(manifestPath, state.serverManifestPath)
  }

  const templatePath = path.join(state.clientOutputDirectory, 'index.html')

  if (await fse.pathExists(templatePath)) {
    await fse.move(templatePath, state.serverTemplatePath)
  }

  const server = await state.vite.build(serverConfig(state))

  step(`Dependencies`)

  await install(state)

  return {
    client,
    server
  }
}
