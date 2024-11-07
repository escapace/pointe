import type { OptionsProduction } from '@pointe/types'
import { createFilter } from '@rollup/pluginutils'
import builtinModules from 'builtin-modules'
import fse from 'fs-extra'
import { assign, flatten, mapValues, omit, uniq } from 'lodash-es'
import path from 'node:path'
import { getPackageEntryPoints } from 'pkg-entry-points'
import type { OutputOptions, PreRenderedAsset } from 'rollup'
import type { Manifest, SSROptions } from 'vite'
import type { State, ViteInlineConfig } from '../types'
import { createAssetFileNames } from '../utilities/create-asset-file-names'
import { emptyDirectory } from '../utilities/empty-directory'
import { step } from '../utilities/log'
import { rollupInputOptions } from '../utilities/rollup-input-options'

const mapRollupOutputOptions = (
  options: OutputOptions | OutputOptions[] | undefined,
  function_: (options: OutputOptions) => OutputOptions,
): OutputOptions | OutputOptions[] => {
  const values: OutputOptions[] = (Array.isArray(options) ? options : [options ?? {}]).map(
    (value) => function_(value),
  )

  return values.length === 1 ? values[0] : values
}

const clientConfig = async (state: State): Promise<ViteInlineConfig> => {
  const current = await state.resolveConfig()
  const assetFileNames = createAssetFileNames(current.build.assetsDir)

  const input = assign(
    {},
    rollupInputOptions(current.build.rollupOptions.input, state),
    state.serviceWorkerEntryExists ? { 'service-worker': state.serviceWorkerEntryPath } : undefined,
  )

  return omit(
    assign({}, current, {
      build: assign({}, current.build, {
        emptyOutDir: false,
        manifest: state.clientManifestName,
        outDir: path.relative(state.directory, state.clientOutputDirectory),
        rollupOptions: assign({}, current.build.rollupOptions, {
          input,
          output: mapRollupOutputOptions(current.build.rollupOptions.output, (options) =>
            assign<OutputOptions, OutputOptions, OutputOptions>({}, options, {
              assetFileNames:
                options.assetFileNames ?? ((asset: PreRenderedAsset) => assetFileNames(asset.name)),
              chunkFileNames: path.join(current.build.assetsDir, 'js/[name]-[hash].js'),
              entryFileNames: (value) => {
                if (value.name === 'service-worker') {
                  return '[name].js'
                }

                return path.join(current.build.assetsDir, 'js/[name]-[hash].js')
              },
            }),
          ),
        }),
        ssrManifest: state.serverSSRManifestName,
        terserOptions: current.build.minify === 'terser' ? current.build.terserOptions : undefined,
      }),
      mode: state.nodeEnv,
      root: state.directory,
    }),
    // TODO: dobule check worker
    ['plugins', 'assetsInclude', 'worker'],
  )
}

const serverConfig = async (state: State): Promise<ViteInlineConfig> => {
  const current = await state.resolveConfig({
    build: { ssr: path.relative(state.directory, state.serverEntryPath) },
  })
  const assetFileNames = createAssetFileNames(current.build.assetsDir)

  const noExternal = state.serverRuntime === 'node' ? undefined : current.ssr.noExternal

  const isExternal =
    noExternal === undefined
      ? () => true
      : noExternal === true
        ? () => false
        : createFilter(undefined, noExternal, {
            resolve: false,
          })

  const entryPoints = async (ids: string[]) =>
    flatten(
      await Promise.all(
        ids.map(async (id) => [
          id,
          ...Object.keys(
            await getPackageEntryPoints(path.join(state.directory, 'node_modules', id)),
          ).map((value) => path.join(id, value)),
        ]),
      ),
    )

  const dependencies = Object.keys(state.packageJson.dependencies ?? {})

  const external = uniq([
    ...(Array.isArray(current.ssr.external) ? current.ssr.external : []),
    ...dependencies,
    ...(await entryPoints(dependencies)),
    ...builtinModules,
    ...builtinModules.map((value) => `node:${value}`),
    'node:assert/strict',
  ]).filter((value) => isExternal(value))

  const ssr: SSROptions = {
    external,
    noExternal,
    target: state.serverRuntime,
  }

  return omit(
    assign({}, current, {
      build: assign({}, current.build, {
        emptyOutDir: false,
        manifest: state.serverManifestName,
        minify: false,
        outDir: path.relative(state.directory, state.serverOutputDirectory),
        rollupOptions: assign(current.build.rollupOptions, {
          output: mapRollupOutputOptions(current.build.rollupOptions.output, (options) =>
            assign({}, options, {
              manualChunks: (id: string) =>
                external.includes(id) ? undefined : 'entry-server.mjs',
              // state.serverRuntime === 'node'
              //   ? options.manualChunks
              //   : undefined,
              assetFileNames:
                options.assetFileNames ?? ((asset: PreRenderedAsset) => assetFileNames(asset.name)),
              chunkFileNames: '[name]-[hash].mjs',
              entryFileNames: '[name].mjs',
              format: 'esm',
            }),
          ),
        }),
        ssr: path.relative(state.directory, state.serverEntryPath),
        target: state.serverTarget,
        terserOptions: undefined,
      }),
      mode: state.nodeEnv,
      publicDir: false as const,
      root: state.directory,
      ssr: assign({}, current.ssr, ssr),
    }),
    ['plugins', 'assetsInclude'],
  )
}

const patchOptions = async (state: State) => {
  const options: {
    manifest: Partial<OptionsProduction['manifest']>
  } & Partial<Omit<OptionsProduction, 'manifest'>> = {
    ...state.optionsProduction,
    command: state.command as 'build' | 'preview',
    manifest: { ...state.optionsProduction?.manifest },
    mode: state.nodeEnv as 'production' | 'staging',
  }

  // if (await fse.exists(state.clientManifestPath)) {
  options.manifest.client = (await fse.readJson(state.clientManifestPath)) as Manifest
  // }

  // if (await fse.exists(state.serverManifestPath)) {
  options.manifest.server = (await fse.readJson(state.serverManifestPath)) as Manifest
  // }

  // if (await fse.exists(state.serverSSRManifestPath)) {
  options.manifest.ssr = mapValues(
    (await fse.readJSON(state.serverSSRManifestPath)) as Record<string, string[] | undefined>,
    (value) =>
      value === undefined
        ? undefined
        : uniq(value).filter((value) =>
            fse.existsSync(path.join(state.clientOutputDirectory, value)),
          ),
  )
  // }

  // if (await fse.exists(templatePath)) {
  options.template = await fse.readFile(state.clientTemplatePath, 'utf8')
  // }

  // await fse.remove(state.clientManifestPath)
  // await fse.remove(state.serverManifestPath)
  // await fse.remove(state.serverSSRManifestPath)
  // await fse.remove(state.clientTemplatePath)

  state.optionsProduction = options as OptionsProduction

  const entry = state.serverEntryCompiledPath

  // if (state.optionsProduction !== undefined) {
  const content = await fse.readFile(entry, 'utf8')

  // TODO: codemod
  await fse.writeFile(
    entry,
    content.replaceAll(
      /YEUX_OPTIONS|\/\* YEUX-REPLACE-START \*\/[\s\S]+\/\* YEUX-REPLACE-END \*\//g,
      `/* YEUX-REPLACE-START */${JSON.stringify(state.optionsProduction)}/* YEUX-REPLACE-END */`,
    ),
  )
}

const patchOptionsClean = async (state: State) => {
  await fse.remove(state.clientManifestPath)
  await fse.remove(state.serverManifestPath)
  await fse.remove(state.serverSSRManifestPath)
  await fse.remove(state.clientTemplatePath)
}

const injectManifest = async (state: State) => {
  if (state.serviceWorkerEntryExists) {
    // eslint-disable-next-line typescript/no-non-null-assertion
    await state.injectManifest!({
      ...state.viteConfig.pointe?.injectManifest,
      globDirectory: path.relative(process.cwd(), state.clientOutputDirectory),
      globIgnores: uniq([
        ...(state.viteConfig.pointe?.injectManifest.globIgnores ?? []),
        ...[
          state.clientManifestPath,
          state.serverManifestPath,
          state.serverSSRManifestPath,
          state.clientTemplatePath,
        ].map((value) => path.relative(state.clientOutputDirectory, value)),
      ]),
      swDest: path.relative(
        process.cwd(),
        path.join(state.clientOutputDirectory, 'service-worker.js'),
      ),
      swSrc: path.relative(
        process.cwd(),
        path.join(state.clientOutputDirectory, 'service-worker.js'),
      ),
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

export const build = async (state: State): Promise<void> => {
  await emptyDirectory(state.clientOutputDirectory)
  await emptyDirectory(state.serverOutputDirectory)

  step(`Client Build`)

  await state.vite.build(await clientConfig(state))

  step(`Server Build`)

  await state.vite.build(await serverConfig(state))

  await patchOptions(state)
  await patchOptionsClean(state)
  await injectManifest(state)
}