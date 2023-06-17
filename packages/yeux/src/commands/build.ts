import { createFilter } from '@rollup/pluginutils'
import { OptionsProduction } from '@yeuxjs/types'
import builtinModules from 'builtin-modules'
import fse from 'fs-extra'
import { assign, mapValues, omit, uniq } from 'lodash-es'
import path from 'path'
import type {
  InputOption,
  OutputOptions,
  RollupOutput,
  RollupWatcher
} from 'rollup'
import type { Manifest, SSROptions } from 'vite'
import type { State, ViteInlineConfig } from '../types'
import { step } from '../utilities/log'

const mapRollupOutputOptions = (
  options: OutputOptions | OutputOptions[] | undefined,
  fn: (options: OutputOptions) => OutputOptions
): OutputOptions | OutputOptions[] => {
  const values: OutputOptions[] = (
    Array.isArray(options) ? options : [options ?? {}]
  ).map((value) => fn(value))

  if (values.length === 1) {
    return values[0]
  } else {
    return values
  }
}

const rollupInputOptions = (input: InputOption | undefined, state: State) =>
  (input === undefined
    ? { main: path.join(state.directory, 'index.html') }
    : typeof input === 'string'
    ? { main: input }
    : input) as {
    [entryAlias: string]: string
  }

export const clientConfig = async (state: State): Promise<ViteInlineConfig> => {
  const current = await state.resolveConfig()

  const input = assign(
    {},
    rollupInputOptions(current.build.rollupOptions.input, state),
    state.serviceWorkerEntryExists
      ? { 'service-worker': state.serviceWorkerEntryPath }
      : undefined
  )

  return omit(
    assign({}, current, {
      root: state.directory,
      mode: state.nodeEnv,
      build: assign({}, current.build, {
        watch: state.command === 'build' ? undefined : {},
        manifest: state.clientManifestName,
        ssrManifest: state.serverSSRManifestName,
        terserOptions:
          current.build.minify === 'terser'
            ? current.build.terserOptions
            : undefined,
        outDir: path.relative(state.directory, state.clientOutputDirectory),
        rollupOptions: assign({}, current.build.rollupOptions, {
          input,
          output: mapRollupOutputOptions(
            current.build.rollupOptions.output,
            (options) =>
              assign<OutputOptions, OutputOptions, OutputOptions>({}, options, {
                entryFileNames: (value) => {
                  if (value.name === 'service-worker') {
                    return '[name].js'
                  }

                  return path.join(current.build.assetsDir, '[name]-[hash].js')
                },
                assetFileNames: path.join(
                  current.build.assetsDir,
                  '[name]-[hash].[ext]'
                ),
                chunkFileNames: path.join(
                  current.build.assetsDir,
                  '[name]-[hash].js'
                )
              })
          )
        })
      })
    }),
    ['plugins', 'assetsInclude']
  )
}

export const serverConfig = async (state: State): Promise<ViteInlineConfig> => {
  const current = await state.resolveConfig({
    build: { ssr: path.relative(state.directory, state.serverEntryPath) }
  })

  const noExternal =
    state.serverRuntime === 'node' ? undefined : current.ssr.noExternal

  const isExternal =
    noExternal === undefined
      ? () => true
      : noExternal === true
      ? () => false
      : createFilter(undefined, noExternal, {
          resolve: false
        })

  const external = [
    ...(current.ssr.external ?? []),
    ...Object.keys(state.packageJson.dependencies ?? {}),
    ...builtinModules,
    ...builtinModules.map((value) => `node:${value}`)
  ].filter((value) => isExternal(value))

  const ssr: SSROptions = {
    target: state.serverRuntime,
    noExternal,
    external
  }

  return omit(
    assign({}, current, {
      root: state.directory,
      mode: state.nodeEnv,
      publicDir: false as const,
      ssr: assign({}, current.ssr, ssr),
      build: assign({}, current.build, {
        watch: state.command === 'build' ? undefined : {},
        target: state.serverTarget,
        manifest: state.serverManifestName,
        minify: false,
        terserOptions: undefined,
        rollupOptions: assign({}, current.build.rollupOptions, {
          output: mapRollupOutputOptions(
            current.build.rollupOptions.output,
            (options) =>
              assign({}, options, {
                manualChunks:
                  state.serverRuntime === 'node'
                    ? options.manualChunks
                    : undefined,
                entryFileNames: '[name].mjs',
                chunkFileNames: '[name]-[hash].mjs',
                assetFileNames: '[name]-[hash].[ext]',
                format: 'esm'
              })
          )
        }),
        ssr: path.relative(state.directory, state.serverEntryPath),
        outDir: path.relative(state.directory, state.serverOutputDirectory),
        emptyOutDir: false
      })
    }),
    ['plugins', 'assetsInclude']
  )
}

export const patchOptions = async (state: State) => {
  const templatePath = path.join(state.clientOutputDirectory, 'index.html')

  const options: Partial<Omit<OptionsProduction, 'manifest'>> & {
    manifest: Partial<OptionsProduction['manifest']>
  } = {
    ...state.optionsProduction,
    manifest: { ...state.optionsProduction?.manifest },
    mode: state.nodeEnv as 'staging' | 'production',
    command: state.command as 'build' | 'preview'
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

  if (state.serviceWorkerEntryExists) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await state.injectManifest!({
      swSrc: path.relative(
        process.cwd(),
        path.join(state.clientOutputDirectory, 'service-worker.js')
      ),
      globDirectory: path.relative(process.cwd(), state.clientOutputDirectory),
      swDest: path.relative(
        process.cwd(),
        path.join(state.clientOutputDirectory, 'service-worker.js')
      ),
      // globPatterns: ['**/*.{js,css,html}'],
      globIgnores: [],
      globFollow: true,
      globStrict: true,
      ...state.viteConfig.yeux?.injectManifest
      // TODO: Assets that match this will be assumed to be uniquely versioned via
      // their URL, and exempted from the normal HTTP cache-busting that's done
      // when populating the precache. While not required, it's recommended that
      // if your existing build process already inserts a [hash] value into each
      // filename, you provide a RegExp that will detect that, as it will reduce
      // the bandwidth consumed when precaching.
      // dontCacheBustURLsMatching:
    })
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

  const client = await state.vite.build(await clientConfig(state))

  if (state.command === 'preview') {
    await waitForInitialBuild(client as RollupWatcher)
  }

  step(`Server Build`)

  const server = await state.vite.build(await serverConfig(state))

  if (state.command === 'preview') {
    await waitForInitialBuild(server as RollupWatcher)
  }

  await patchOptions(state)

  return {
    client,
    server
  }
}
