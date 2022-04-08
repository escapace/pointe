import { State } from '../types'
import { esbuildExternalPlugin } from '../plugins/external'
import { build as esbuild, BuildFailure, BuildResult } from 'esbuild'
import { mkdirp } from 'fs-extra'
import path from 'path'

export const buildCreateInstance = async (
  state: State,
  onRebuild?: (error: BuildFailure | null, result: BuildResult | null) => void
) => {
  const outdir = path.dirname(state.createInstanceCompiledPath)

  await mkdirp(outdir)

  return await esbuild({
    bundle: true,
    entryPoints: [state.createInstancePath],
    plugins: [esbuildExternalPlugin()],
    format: 'cjs',
    outExtension: { '.js': `.cjs` },
    outdir,
    define: {
      'import.meta.env.SSR': 'true',
      'process.env.NODE_ENV': JSON.stringify(state.nodeEnv)
    },
    platform: 'node',
    sourcemap: true,
    target: state.target,
    logLevel: 'error',
    watch:
      state.command === 'dev'
        ? {
            onRebuild
          }
        : undefined
  })
}
